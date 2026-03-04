import fs from "fs/promises";
import path from "path";

// ─── Types ───

export type StepEvent = {
  step: string;
  status: "done" | "error" | "progress";
  error?: string;
  message?: string;
  siteId?: string;
  repoUrl?: string;
  siteUrl?: string;
  projectName?: string;
  filesCount?: number;
  count?: number;
  articlesQueued?: number;
};

export type AffiliateInput = { name: string; url: string };

export type RequestBody = {
  mode: "prompt" | "repo" | "existing";
  site_type?: "affiliation" | "media" | "libre";
  prompt?: string;
  repo_url?: string;
  site_url?: string;
  existing_repo?: string;
  name?: string;
  slug?: string;
  primary_color?: string;
  accent_color?: string;
  affiliates?: AffiliateInput[];
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  adsense_id?: string;
};

// ─── Helpers ───

const SKIP_PATTERNS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  ".DS_Store",
  ".env",
  ".env.local",
  ".env.production",
]);

export type TemplateFile = {
  path: string;
  content: string;
  encoding: "base64";
};

export async function readStarterFiles(dir: string, base = ""): Promise<TemplateFile[]> {
  const files: TemplateFile[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (SKIP_PATTERNS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = base ? `${base}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const subFiles = await readStarterFiles(fullPath, relativePath);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const content = await fs.readFile(fullPath);
      files.push({
        path: relativePath,
        content: content.toString("base64"),
        encoding: "base64",
      });
    }
  }
  return files;
}

export function mergePackageJson(starterPkgBase64: string, newDeps: string[]): string {
  const starterPkg = JSON.parse(Buffer.from(starterPkgBase64, "base64").toString("utf-8"));
  for (const dep of newDeps) {
    if (!starterPkg.dependencies?.[dep]) {
      starterPkg.dependencies = starterPkg.dependencies || {};
      starterPkg.dependencies[dep] = "latest";
    }
  }
  return Buffer.from(JSON.stringify(starterPkg, null, 2)).toString("base64");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── NDJSON Stream Factory ───

export function createNDJSONStream(
  handler: (send: (event: StepEvent) => void) => Promise<void>
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: StepEvent) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      await handler(send);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
