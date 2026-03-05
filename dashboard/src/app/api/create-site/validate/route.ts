import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getSiteById } from "@/lib/queries/sites";
import { readStarterFiles } from "../shared";

export const runtime = "nodejs";
export const maxDuration = 30;

type ValidateBody = {
  siteId: string;
};

// Starter infrastructure files — skip validation
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

export type ValidationError = {
  file: string;
  error: string;
  line?: number;
};

/** Build the set of all resolvable import paths from available files */
function buildImportIndex(filePaths: string[]): Set<string> {
  const index = new Set<string>();
  for (const fp of filePaths) {
    index.add(fp);
    index.add(fp.replace(/\.(ts|tsx)$/, ""));
    const dir = fp.replace(/\/index\.(ts|tsx)$/, "");
    if (dir !== fp) index.add(dir);
  }
  return index;
}

/** Resolve a @/... import to check if it exists */
function resolveImport(specifier: string, importIndex: Set<string>): boolean {
  const resolved = specifier.replace(/^@\//, "src/");
  if (importIndex.has(resolved)) return true;
  if (importIndex.has(resolved + ".ts")) return true;
  if (importIndex.has(resolved + ".tsx")) return true;
  if (importIndex.has(resolved + "/index.ts")) return true;
  if (importIndex.has(resolved + "/index.tsx")) return true;
  return false;
}

/** Validate a single file, return errors */
function validateFile(
  filePath: string,
  content: string,
  importIndex: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split("\n");

  // Check imports
  for (let i = 0; i < lines.length; i++) {
    const importMatch = lines[i].match(/from\s+["'](@\/[^"']+)["']/);
    if (importMatch) {
      const specifier = importMatch[1];
      if (!resolveImport(specifier, importIndex)) {
        errors.push({
          file: filePath,
          error: `Import "${specifier}" does not resolve to any file`,
          line: i + 1,
        });
      }
    }
  }

  // Check "use client" requirement
  const hasUseClient =
    content.trimStart().startsWith('"use client"') ||
    content.trimStart().startsWith("'use client'");
  if (!hasUseClient && CLIENT_INDICATORS.test(content)) {
    errors.push({
      file: filePath,
      error: `File uses hooks/event handlers but missing "use client" directive`,
    });
  }

  // Check malformed interface syntax: "interface Foo bar {"
  const badInterfaceMatch = content.match(/interface\s+\w+\s+\w+\s*\{/);
  if (badInterfaceMatch) {
    errors.push({
      file: filePath,
      error: `Malformed interface syntax: "${badInterfaceMatch[0]}"`,
    });
  }

  // Check unnecessary import React
  if (/import\s+React\s+from\s+['"]react['"]/.test(content)) {
    errors.push({
      file: filePath,
      error: `Unnecessary "import React from 'react'" — React 19 doesn't need it`,
    });
  }

  return errors;
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

  // Read starter files
  const starterDir = path.resolve(process.cwd(), "..", "starter-nextjs");
  const starterFiles = await readStarterFiles(starterDir);

  // Build file map: starter base + generated overlay
  const fileMap = new Map<string, string>();
  for (const f of starterFiles) {
    fileMap.set(f.path, Buffer.from(f.content, "base64").toString("utf-8"));
  }

  for (const gf of generatedFiles.files) {
    if (!gf.path || !gf.content) continue;
    if (PROTECTED_PATHS.has(gf.path)) continue;
    fileMap.set(gf.path, gf.content);
  }

  const importIndex = buildImportIndex(Array.from(fileMap.keys()));

  // Validate only generated .ts/.tsx files (not protected)
  const errors: ValidationError[] = [];
  for (const gf of generatedFiles.files) {
    if (!gf.path || !gf.content) continue;
    if (PROTECTED_PATHS.has(gf.path)) continue;
    if (!/\.(ts|tsx)$/.test(gf.path)) continue;
    errors.push(...validateFile(gf.path, gf.content, importIndex));
  }

  return Response.json({ valid: errors.length === 0, errors });
}
