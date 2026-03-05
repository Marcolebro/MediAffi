import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getSiteById, updateSite } from "@/lib/queries/sites";
import { callAI, getPreferredModel } from "@/lib/ai";
import { stripCodeFences } from "@/lib/gemini";
import { readStarterFiles } from "../shared";

export const runtime = "nodejs";
export const maxDuration = 60;

type FixFileBody = {
  siteId: string;
  filePath: string;
  errors: string[];
};

// Starter infrastructure files — never overwrite
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: FixFileBody = await request.json();
  const { siteId, filePath, errors } = body;

  if (!siteId || !filePath || !errors?.length) {
    return Response.json(
      { error: "siteId, filePath and errors are required" },
      { status: 400 }
    );
  }

  if (PROTECTED_PATHS.has(filePath)) {
    return Response.json({ error: "Cannot modify protected file" }, { status: 400 });
  }

  const site = await getSiteById(supabase, siteId);
  if (!site) {
    return Response.json({ error: "Site not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generatedFiles = site.generated_files as any;
  if (!generatedFiles?.files?.length) {
    return Response.json({ error: "No generated files" }, { status: 400 });
  }

  // Find the file to fix
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetFile = generatedFiles.files.find((f: any) => f.path === filePath);
  if (!targetFile) {
    return Response.json({ error: `File not found: ${filePath}` }, { status: 404 });
  }

  // Build available files list (starter + generated)
  const starterDir = path.resolve(process.cwd(), "..", "starter-nextjs");
  const starterFiles = await readStarterFiles(starterDir);
  const availablePaths: string[] = starterFiles.map((f) => f.path);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const gf of generatedFiles.files) {
    if (gf.path && !availablePaths.includes(gf.path)) {
      availablePaths.push(gf.path);
    }
  }

  // Build fix prompt
  const parts: string[] = [];
  parts.push(`Fix the following errors in ${filePath}:\n`);
  for (const err of errors) {
    parts.push(`- ${err}`);
  }

  parts.push(`\nAvailable files for imports (@/... → src/...):`);
  for (const f of availablePaths.filter((f) => f.startsWith("src/"))) {
    parts.push(`  ${f}`);
  }

  parts.push(`\nRules:`);
  parts.push(`- If an import doesn't resolve, either fix the path or inline the missing component`);
  parts.push(`- Add "use client" at the top if the file uses hooks or event handlers`);
  parts.push(`- Fix any malformed interface syntax (interface Name { ... })`);
  parts.push(`- Remove "import React from 'react'" — React 19 doesn't need it`);
  parts.push(`- Return ONLY the corrected file code, no backticks, no explanation`);
  parts.push(`\nCurrent code:\n\`\`\`tsx\n${targetFile.content}\n\`\`\``);

  const model = await getPreferredModel(supabase, "site");

  try {
    const { text } = await callAI({
      prompt: parts.join("\n"),
      systemPrompt:
        "Tu es un correcteur de code Next.js 16 + React 19 + TypeScript. Corrige les erreurs et retourne UNIQUEMENT le code corrigé, sans backticks, sans explication.",
      model,
      temperature: 0.2,
    });

    const fixedContent = stripCodeFences(text);

    // Update the file in generated_files
    targetFile.content = fixedContent;

    await updateSite(supabase, siteId, {
      generated_files: generatedFiles,
    } as Record<string, unknown>);

    return Response.json({ fixed: true, filePath });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "AI fix failed" },
      { status: 500 }
    );
  }
}
