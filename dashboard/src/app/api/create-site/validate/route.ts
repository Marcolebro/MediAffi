import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getSiteById, updateSite } from "@/lib/queries/sites";
import { readStarterFiles } from "../shared";

export const runtime = "nodejs";
export const maxDuration = 30;

type ValidateBody = {
  siteId: string;
};

// Starter infrastructure files — skip validation & auto-fix
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

// ─── Shadcn CSS tokens to inject when missing ───

const SHADCN_THEME_BLOCK = `@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}`;

const SHADCN_ROOT_VARS = `:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;

// Shadcn class names that need CSS variable definitions
const SHADCN_CLASSES = [
  "text-muted-foreground", "bg-muted", "border-border", "text-foreground",
  "bg-background", "bg-card", "text-card-foreground", "bg-popover",
  "bg-primary", "text-primary-foreground", "bg-secondary",
  "text-secondary-foreground", "bg-accent", "text-accent-foreground",
  "bg-destructive", "ring-ring",
];

// ─── Mechanical auto-fixes ───

function autoFixUseClient(content: string): string {
  const needsUseClient = CLIENT_INDICATORS.test(content);
  if (!needsUseClient) return content;

  // Remove any existing "use client" from wrong position
  const cleaned = content.replace(/^\s*["']use client["'];?\s*\n?/gm, "");
  const trimmed = cleaned.trimStart();

  // Check if already first line
  if (content.trimStart().startsWith('"use client"') || content.trimStart().startsWith("'use client'")) {
    return content;
  }

  return '"use client";\n\n' + trimmed;
}

function autoFixTrackAffiliateClick(content: string): string {
  // Remove import of trackAffiliateClick from @/lib/supabase
  // Handle: import { trackAffiliateClick } from "@/lib/supabase"
  // Handle: import { supabase, trackAffiliateClick } from "@/lib/supabase"
  let result = content;

  // Case 1: trackAffiliateClick is the only import
  result = result.replace(
    /import\s*\{\s*trackAffiliateClick\s*\}\s*from\s*["']@\/lib\/supabase["'];?\s*\n?/g,
    ""
  );

  // Case 2: trackAffiliateClick is one of multiple imports — remove just it
  result = result.replace(
    /,\s*trackAffiliateClick\b/g,
    ""
  );
  result = result.replace(
    /\btrackAffiliateClick\s*,\s*/g,
    ""
  );

  // Replace calls: trackAffiliateClick(...) → /* tracking via /go/ */
  result = result.replace(
    /(?:await\s+)?trackAffiliateClick\s*\([^)]*\)\s*;?/g,
    "/* tracking via /go/ */"
  );

  return result;
}

function autoFixGlobalsCss(content: string): string {
  const usesShadcnClasses = SHADCN_CLASSES.some((cls) => content.includes(cls));
  if (!usesShadcnClasses && !content.includes("--background")) return content;

  const hasThemeBlock = content.includes("@theme inline");
  const hasRootVars = content.includes("--background:") && content.includes(":root");

  let result = content;

  // Inject @theme block if missing
  if (!hasThemeBlock) {
    // Insert after @import lines
    const lastImportIdx = result.lastIndexOf("@import");
    if (lastImportIdx !== -1) {
      const lineEnd = result.indexOf("\n", lastImportIdx);
      result =
        result.slice(0, lineEnd + 1) +
        "\n" +
        SHADCN_THEME_BLOCK +
        "\n" +
        result.slice(lineEnd + 1);
    } else {
      result = SHADCN_THEME_BLOCK + "\n\n" + result;
    }
  }

  // Inject :root + .dark + @layer base if missing
  if (!hasRootVars) {
    result = result + "\n\n" + SHADCN_ROOT_VARS + "\n";
  }

  return result;
}

function autoFixDuplicateExports(content: string): string {
  const exportRegex = /export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g;
  const seen = new Map<string, number>();
  let match;

  while ((match = exportRegex.exec(content)) !== null) {
    const name = match[1];
    seen.set(name, (seen.get(name) || 0) + 1);
  }

  let result = content;
  for (const [name, count] of seen) {
    if (count <= 1) continue;

    // Find and rename duplicates (keep first, rename subsequent)
    let occurrenceIdx = 0;
    result = result.replace(
      new RegExp(`(export\\s+(?:async\\s+)?(?:function|const|class)\\s+)(${name})\\b`, "g"),
      (_full, prefix, exportName) => {
        occurrenceIdx++;
        if (occurrenceIdx === 1) return prefix + exportName;
        return prefix + exportName + "_" + occurrenceIdx;
      }
    );
  }

  return result;
}

/** layout.tsx and page.tsx MUST have export default — Next.js requirement */
function autoFixDefaultExport(filePath: string, content: string): string {
  // Only applies to layout.tsx and page.tsx files
  const basename = filePath.split("/").pop() || "";
  if (basename !== "layout.tsx" && basename !== "page.tsx") return content;

  // Already has export default → nothing to do
  if (/export\s+default\s/.test(content)) return content;

  // Try: export function X / export async function X → export default function X
  let replaced = false;
  const result = content.replace(
    /export\s+(async\s+)?function\s+/,
    (_match, asyncKw) => {
      if (replaced) return _match;
      replaced = true;
      return `export default ${asyncKw || ""}function `;
    }
  );

  if (replaced) return result;

  // Try: export const X = → const X = ... + append export default X
  const constMatch = content.match(/export\s+const\s+(\w+)\s*=/);
  if (constMatch) {
    const name = constMatch[1];
    return content.replace(
      /export\s+const\s+/,
      "const "
    ) + `\nexport default ${name};\n`;
  }

  return content;
}

/** Apply all mechanical fixes to a single file */
function autoFix(filePath: string, content: string): string {
  let result = content;

  if (filePath.endsWith(".css")) {
    result = autoFixGlobalsCss(result);
  } else if (/\.(tsx?|jsx?)$/.test(filePath)) {
    result = autoFixUseClient(result);
    result = autoFixTrackAffiliateClick(result);
    result = autoFixDuplicateExports(result);
    result = autoFixDefaultExport(filePath, result);
  }

  return result;
}

// ─── Import validation ───

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

function resolveImport(specifier: string, importIndex: Set<string>): boolean {
  const resolved = specifier.replace(/^@\//, "src/");
  if (importIndex.has(resolved)) return true;
  if (importIndex.has(resolved + ".ts")) return true;
  if (importIndex.has(resolved + ".tsx")) return true;
  if (importIndex.has(resolved + "/index.ts")) return true;
  if (importIndex.has(resolved + "/index.tsx")) return true;
  return false;
}

function validateFile(
  filePath: string,
  content: string,
  importIndex: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split("\n");

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

  // "use client" still missing after autofix (shouldn't happen, but safety)
  const hasUseClient =
    content.trimStart().startsWith('"use client"') ||
    content.trimStart().startsWith("'use client'");
  if (!hasUseClient && CLIENT_INDICATORS.test(content)) {
    errors.push({
      file: filePath,
      error: `File uses hooks/event handlers but missing "use client" directive`,
    });
  }

  // Malformed interface syntax
  const badInterfaceMatch = content.match(/interface\s+\w+\s+\w+\s*\{/);
  if (badInterfaceMatch) {
    errors.push({
      file: filePath,
      error: `Malformed interface syntax: "${badInterfaceMatch[0]}"`,
    });
  }

  // Unnecessary import React
  if (/import\s+React\s+from\s+['"]react['"]/.test(content)) {
    errors.push({
      file: filePath,
      error: `Unnecessary "import React from 'react'" — React 19 doesn't need it`,
    });
  }

  return errors;
}

// ─── Route handler ───

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

  // Phase 1: Apply mechanical auto-fixes to generated files
  let filesChanged = false;
  for (const gf of generatedFiles.files) {
    if (!gf.path || !gf.content) continue;
    if (PROTECTED_PATHS.has(gf.path)) continue;

    const fixed = autoFix(gf.path, gf.content);
    if (fixed !== gf.content) {
      gf.content = fixed;
      filesChanged = true;
    }
    fileMap.set(gf.path, gf.content);
  }

  // Save auto-fixed files to DB if anything changed
  if (filesChanged) {
    await updateSite(supabase, siteId, {
      generated_files: generatedFiles,
    } as Record<string, unknown>);
  }

  // Phase 2: Validate (remaining errors that need AI fix)
  const importIndex = buildImportIndex(Array.from(fileMap.keys()));

  const errors: ValidationError[] = [];
  for (const gf of generatedFiles.files) {
    if (!gf.path || !gf.content) continue;
    if (PROTECTED_PATHS.has(gf.path)) continue;
    if (!/\.(ts|tsx)$/.test(gf.path)) continue;
    errors.push(...validateFile(gf.path, gf.content, importIndex));
  }

  return Response.json({
    valid: errors.length === 0,
    errors,
    autoFixed: filesChanged,
  });
}
