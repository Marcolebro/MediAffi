import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getSiteById, updateSite } from "@/lib/queries/sites";
import { callAI, getPreferredModel } from "@/lib/ai";
import { stripCodeFences } from "@/lib/gemini";
import {
  createNDJSONStream,
  readStarterFiles,
  type StepEvent,
} from "../shared";

export const runtime = "nodejs";
export const maxDuration = 120;

type ValidateBody = {
  siteId: string;
};

// Starter infrastructure files that must NEVER be validated/overwritten
const PROTECTED_PATHS = new Set([
  "src/lib/articles.ts",
  "src/lib/products.ts",
  "src/lib/utils.ts",
  "src/lib/supabase.ts",
  "src/app/go/[slug]/route.ts",
  "src/app/api/newsletter/route.ts",
  "src/app/sitemap.ts",
  "src/app/robots.ts",
]);

// Hooks/events that require "use client"
const CLIENT_INDICATORS =
  /\b(useState|useEffect|useRef|useCallback|useMemo|useReducer|useContext)\b|(\bonClick\b|\bonChange\b|\bonSubmit\b|\bonBlur\b|\bonFocus\b|\bonKeyDown\b)/;

type ValidationError = {
  type: "missing_import" | "use_client" | "bad_interface" | "import_react";
  message: string;
  line?: number;
};

type FileValidation = {
  path: string;
  errors: ValidationError[];
};

/** Build the set of all resolvable import paths from available files */
function buildImportIndex(filePaths: string[]): Set<string> {
  const index = new Set<string>();
  for (const fp of filePaths) {
    // Add the raw path: src/components/Header.tsx
    index.add(fp);
    // Add without extension: src/components/Header
    index.add(fp.replace(/\.(ts|tsx)$/, ""));
    // Add index variant: src/components → src/components/index
    const dir = fp.replace(/\/index\.(ts|tsx)$/, "");
    if (dir !== fp) index.add(dir);
  }
  return index;
}

/** Resolve a @/... import to check if it exists */
function resolveImport(specifier: string, importIndex: Set<string>): boolean {
  // Convert @/foo/bar → src/foo/bar
  const resolved = specifier.replace(/^@\//, "src/");

  // Try exact match, with .ts, .tsx, /index.ts, /index.tsx
  if (importIndex.has(resolved)) return true;
  if (importIndex.has(resolved + ".ts")) return true;
  if (importIndex.has(resolved + ".tsx")) return true;
  if (importIndex.has(resolved + "/index.ts")) return true;
  if (importIndex.has(resolved + "/index.tsx")) return true;

  return false;
}

/** Validate a single generated file */
function validateFile(
  filePath: string,
  content: string,
  importIndex: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split("\n");

  // Check imports
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const importMatch = line.match(/from\s+["'](@\/[^"']+)["']/);
    if (importMatch) {
      const specifier = importMatch[1];
      if (!resolveImport(specifier, importIndex)) {
        errors.push({
          type: "missing_import",
          message: `Import "${specifier}" does not resolve to any file`,
          line: i + 1,
        });
      }
    }
  }

  // Check "use client" requirement
  const hasUseClient = content.trimStart().startsWith('"use client"') || content.trimStart().startsWith("'use client'");
  if (!hasUseClient && CLIENT_INDICATORS.test(content)) {
    errors.push({
      type: "use_client",
      message: `File uses hooks/event handlers but missing "use client" directive`,
    });
  }

  // Check malformed interface syntax: "interface Foo bar {"
  const badInterfaceMatch = content.match(/interface\s+\w+\s+\w+\s*\{/);
  if (badInterfaceMatch) {
    errors.push({
      type: "bad_interface",
      message: `Malformed interface syntax: "${badInterfaceMatch[0]}"`,
    });
  }

  // Check unnecessary import React
  if (/import\s+React\s+from\s+['"]react['"]/.test(content)) {
    errors.push({
      type: "import_react",
      message: `Unnecessary "import React from 'react'" — React 19 doesn't need it`,
    });
  }

  return errors;
}

/** Build AI fix prompt for a file with errors */
function buildFixPrompt(
  filePath: string,
  content: string,
  errors: ValidationError[],
  availableFiles: string[]
): string {
  const parts: string[] = [];
  parts.push(`Fix the following errors in ${filePath}:\n`);

  for (const err of errors) {
    parts.push(`- [${err.type}]${err.line ? ` line ${err.line}` : ""}: ${err.message}`);
  }

  parts.push(`\nAvailable files for imports (@/... → src/...):`);
  for (const f of availableFiles.filter((f) => f.startsWith("src/"))) {
    parts.push(`  ${f}`);
  }

  parts.push(`\nRules:`);
  parts.push(`- If an import doesn't resolve, either fix the path or inline the missing component`);
  parts.push(`- Add "use client" at the top if the file uses hooks or event handlers`);
  parts.push(`- Fix any malformed interface syntax (interface Name { ... })`);
  parts.push(`- Remove "import React from 'react'" — React 19 doesn't need it`);
  parts.push(`- Return ONLY the corrected file code, no backticks, no explanation`);

  parts.push(`\nCurrent code:\n\`\`\`tsx\n${content}\n\`\`\``);

  return parts.join("\n");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: ValidateBody = await request.json();
  const { siteId } = body;

  if (!siteId) {
    return Response.json({ error: "siteId is required" }, { status: 400 });
  }

  const site = await getSiteById(supabase, siteId);
  if (!site) {
    return Response.json({ error: "Site not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generatedFiles = site.generated_files as any;
  if (!generatedFiles?.files?.length) {
    return Response.json({ error: "No generated files to validate" }, { status: 400 });
  }

  return createNDJSONStream(async (send: (e: StepEvent) => void) => {
    try {
      send({ step: "validate", status: "progress", message: "Lecture des fichiers starter..." });

      // Read starter files
      const starterDir = path.resolve(process.cwd(), "..", "starter-nextjs");
      const starterFiles = await readStarterFiles(starterDir);

      // Build file map: starter base + generated overlay
      const fileMap = new Map<string, string>();
      for (const f of starterFiles) {
        fileMap.set(f.path, Buffer.from(f.content, "base64").toString("utf-8"));
      }

      // Working copy of generated files (will be mutated on fixes)
      const generatedFilesCopy: { path: string; content: string }[] = generatedFiles.files.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f: any) => ({ path: f.path, content: f.content })
      );

      // Overlay generated files (skip protected)
      for (const gf of generatedFilesCopy) {
        if (!gf.path || !gf.content) continue;
        if (PROTECTED_PATHS.has(gf.path)) continue;
        fileMap.set(gf.path, gf.content);
      }

      const allPaths = Array.from(fileMap.keys());
      const importIndex = buildImportIndex(allPaths);
      const model = await getPreferredModel(supabase, "site");

      const MAX_ITERATIONS = 3;
      let iteration = 0;
      let totalFixed = 0;

      while (iteration < MAX_ITERATIONS) {
        iteration++;

        // Validate only generated .ts/.tsx files (not protected)
        const validations: FileValidation[] = [];
        for (const gf of generatedFilesCopy) {
          if (!gf.path || !gf.content) continue;
          if (PROTECTED_PATHS.has(gf.path)) continue;
          if (!/\.(ts|tsx)$/.test(gf.path)) continue;

          const errors = validateFile(gf.path, gf.content, importIndex);
          if (errors.length > 0) {
            validations.push({ path: gf.path, errors });
          }
        }

        if (validations.length === 0) {
          send({
            step: "validate",
            status: "progress",
            message: iteration === 1
              ? "Aucune erreur détectée !"
              : `Toutes les erreurs corrigées (${totalFixed} fichiers fixés)`,
          });
          break;
        }

        send({
          step: "validate",
          status: "progress",
          message: `Itération ${iteration}: ${validations.length} fichier(s) avec erreurs, correction en cours...`,
        });

        // Fix each file with AI
        for (const v of validations) {
          const gf = generatedFilesCopy.find((f) => f.path === v.path);
          if (!gf) continue;

          const fixPrompt = buildFixPrompt(v.path, gf.content, v.errors, allPaths);

          try {
            const { text } = await callAI({
              prompt: fixPrompt,
              systemPrompt: "Tu es un correcteur de code Next.js 16 + React 19 + TypeScript. Corrige les erreurs et retourne UNIQUEMENT le code corrigé, sans backticks, sans explication.",
              model,
              temperature: 0.2,
            });

            const fixed = stripCodeFences(text);
            gf.content = fixed;
            fileMap.set(gf.path, fixed);
            totalFixed++;

            send({
              step: "validate",
              status: "progress",
              message: `Corrigé: ${v.path} (${v.errors.length} erreur(s))`,
            });
          } catch (err) {
            send({
              step: "validate",
              status: "progress",
              message: `Échec correction ${v.path}: ${err instanceof Error ? err.message : "unknown"}`,
            });
          }
        }

        // Rebuild import index after fixes (new files may have been inlined)
        const updatedPaths = Array.from(fileMap.keys());
        const updatedIndex = buildImportIndex(updatedPaths);
        // Update the outer importIndex reference for next iteration
        importIndex.clear();
        for (const p of updatedIndex) importIndex.add(p);
      }

      // Save corrected files back to DB
      const updatedGeneratedFiles = {
        ...generatedFiles,
        files: generatedFilesCopy,
      };

      await updateSite(supabase, siteId, {
        generated_files: updatedGeneratedFiles,
        creation_step: "validated",
      } as Record<string, unknown>);

      send({ step: "validate", status: "done", message: `Validation terminée (${totalFixed} fichier(s) corrigé(s))` });
    } catch (err) {
      send({
        step: "validate",
        status: "error",
        error: err instanceof Error ? err.message : "Validation failed",
      });
    }
  });
}
