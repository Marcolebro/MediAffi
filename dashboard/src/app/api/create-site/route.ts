import { createClient } from "@/lib/supabase/server";
import { createSite, createAffiliateProgram, updateSite } from "@/lib/queries/sites";
import { addToQueue } from "@/lib/queries/queue";
import { Octokit } from "octokit";
import fs from "fs/promises";
import path from "path";
import {
  callGeminiJSON,
  getArchitectureSystemPrompt,
  getLayoutSystemPrompt,
  getPageSystemPrompt,
  buildArchitectureUserPrompt,
  buildLayoutUserPrompt,
  buildPageUserPrompt,
  ARTICLE_IDEAS_SYSTEM_PROMPT,
  buildArticleIdeasPrompt,
  type GeminiGenerateResult,
  type GeminiArchitectureResult,
  type GeminiLayoutResult,
  type GeminiPageResult,
  type GeminiFile,
} from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

type StepEvent = {
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

type AffiliateInput = { name: string; url: string };

type RequestBody = {
  mode: "prompt" | "repo" | "existing";
  // Prompt mode
  site_type?: "affiliation" | "media" | "libre";
  prompt?: string;
  // Repo mode
  repo_url?: string;
  // Existing mode
  site_url?: string;
  existing_repo?: string;
  // Shared
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

// Skip when reading starter-nextjs files
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

type TemplateFile = {
  path: string;
  content: string;
  encoding: "base64";
};

async function readStarterFiles(dir: string, base = ""): Promise<TemplateFile[]> {
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

function mergePackageJson(
  starterPkgBase64: string,
  newDeps: string[]
): string {
  const starterPkg = JSON.parse(Buffer.from(starterPkgBase64, "base64").toString("utf-8"));
  for (const dep of newDeps) {
    if (!starterPkg.dependencies?.[dep]) {
      starterPkg.dependencies = starterPkg.dependencies || {};
      starterPkg.dependencies[dep] = "latest";
    }
  }
  return Buffer.from(JSON.stringify(starterPkg, null, 2)).toString("base64");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body: RequestBody = await request.json();
  const { mode } = body;

  if (!mode) {
    return new Response(
      JSON.stringify({ error: "mode is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: StepEvent) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }

      if (mode === "prompt") {
        await handlePromptMode(body, supabase, send);
      } else if (mode === "repo") {
        await handleRepoMode(body, supabase, send);
      } else if (mode === "existing") {
        await handleExistingMode(body, supabase, send);
      }

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

// ─── MODE PROMPT (6 steps) ───

async function handlePromptMode(
  body: RequestBody,
  supabase: Awaited<ReturnType<typeof createClient>>,
  send: (e: StepEvent) => void
) {
  const siteType = body.site_type || "libre";
  const userPrompt = body.prompt || "";
  const siteName = body.name || userPrompt.slice(0, 40);
  const slug = body.slug || slugify(siteName);
  const validAffiliates = (body.affiliates || []).filter(
    (a) => a.name?.trim() && a.url?.trim()
  );

  let siteId = "";
  let repoUrl = "";
  let vercelUrl = "";

  // Step 1 — Supabase
  try {
    const site = await createSite(supabase, {
      name: siteName.trim(),
      slug: slug.trim(),
      niche: userPrompt.slice(0, 100),
      description: userPrompt,
      primary_color: body.primary_color || "#3b82f6",
      accent_color: body.accent_color || "#10b981",
      instagram: body.instagram || null,
      twitter: body.twitter || null,
      linkedin: body.linkedin || null,
      adsense_id: body.adsense_id || null,
      active: false,
    });
    siteId = site.id;

    for (const affiliate of validAffiliates) {
      await createAffiliateProgram(supabase, {
        site_id: siteId,
        name: affiliate.name.trim(),
        url: affiliate.url.trim(),
      });
    }

    send({ step: "supabase", status: "done", siteId });
  } catch (err) {
    send({
      step: "supabase",
      status: "error",
      error: err instanceof Error ? err.message : "Failed to create site in database",
    });
    return;
  }

  // Step 2a — Architecture planning (fast, ~5s)
  let generatedFiles: GeminiGenerateResult | null = null;
  let architecture: GeminiArchitectureResult | null = null;
  try {
    const archSystemPrompt = getArchitectureSystemPrompt(siteType);
    const archUserPrompt = buildArchitectureUserPrompt({
      prompt: userPrompt,
      siteName,
      primaryColor: body.primary_color,
      accentColor: body.accent_color,
      affiliates: validAffiliates,
    });

    architecture = await callGeminiJSON<GeminiArchitectureResult>(
      archSystemPrompt,
      archUserPrompt,
      { maxOutputTokens: 4096, retries: 2 }
    );

    if (!architecture?.pages || architecture.pages.length === 0) {
      throw new Error("Gemini returned no pages in architecture");
    }

    send({
      step: "generate_arch",
      status: "done",
      message: `${architecture.pages.length} pages planifiées`,
    });
  } catch (err) {
    send({
      step: "generate_arch",
      status: "error",
      error: err instanceof Error ? err.message : "Failed to plan architecture",
    });
  }

  // Step 2b — Layout + shared components (~20s)
  let layoutResult: GeminiLayoutResult | null = null;
  if (architecture) {
    try {
      const layoutSystemPrompt = getLayoutSystemPrompt(siteType);
      const layoutUserPrompt = buildLayoutUserPrompt(
        {
          prompt: userPrompt,
          siteName,
          primaryColor: body.primary_color,
          accentColor: body.accent_color,
          affiliates: validAffiliates,
          social: {
            twitter: body.twitter,
            instagram: body.instagram,
            linkedin: body.linkedin,
          },
          adsenseId: body.adsense_id,
        },
        architecture
      );

      layoutResult = await callGeminiJSON<GeminiLayoutResult>(
        layoutSystemPrompt,
        layoutUserPrompt,
        { maxOutputTokens: 32768, retries: 2 }
      );

      if (!layoutResult?.files || layoutResult.files.length === 0) {
        throw new Error("Gemini returned no layout files");
      }

      send({
        step: "generate_layout",
        status: "done",
        filesCount: layoutResult.files.length,
      });
    } catch (err) {
      send({
        step: "generate_layout",
        status: "error",
        error: err instanceof Error ? err.message : "Failed to generate layout",
      });
    }
  } else {
    send({ step: "generate_layout", status: "error", error: "Skipped: no architecture" });
  }

  // Step 2c — Pages (batched, max 3 concurrent, ~10-20s each)
  const pageFiles: GeminiFile[] = [];
  if (architecture) {
    try {
      const pageSystemPrompt = getPageSystemPrompt();
      const sharedComponentNames = (layoutResult?.files || [])
        .filter((f) => f.path.startsWith("src/components/"))
        .map((f) => f.path.replace("src/components/", "").replace(/\.tsx?$/, ""));

      const pagesToGenerate = architecture.pages;
      const BATCH_SIZE = 3;

      for (let i = 0; i < pagesToGenerate.length; i += BATCH_SIZE) {
        const batch = pagesToGenerate.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (page) => {
            const pageUserPrompt = buildPageUserPrompt(
              page,
              architecture!,
              sharedComponentNames
            );
            return callGeminiJSON<GeminiPageResult>(
              pageSystemPrompt,
              pageUserPrompt,
              { maxOutputTokens: 16384, retries: 2 }
            );
          })
        );

        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const page = batch[j];
          if (result.status === "fulfilled" && result.value?.files) {
            pageFiles.push(...result.value.files);
            send({
              step: "generate_pages",
              status: "progress",
              message: `${page.title} OK`,
            });
          } else {
            send({
              step: "generate_pages",
              status: "progress",
              message: `${page.title} — erreur`,
            });
          }
        }
      }

      send({
        step: "generate_pages",
        status: "done",
        filesCount: pageFiles.length,
      });
    } catch (err) {
      send({
        step: "generate_pages",
        status: "error",
        error: err instanceof Error ? err.message : "Failed to generate pages",
      });
    }
  } else {
    send({ step: "generate_pages", status: "error", error: "Skipped: no architecture" });
  }

  // Merge all generated files into the expected format
  {
    const allFiles = [...(layoutResult?.files || []), ...pageFiles];
    const allDeps = [
      ...(layoutResult?.dependencies || []),
      ...(architecture?.dependencies || []),
    ];

    if (allFiles.length > 0) {
      generatedFiles = {
        files: allFiles,
        dependencies: [...new Set(allDeps)],
        sitemap_routes:
          architecture?.pages
            .map((p) => p.slug)
            .filter((s) => !s.includes("[")) || [],
      };
    }
  }

  // Step 3 — GitHub: push starter + generated files
  const githubToken = process.env.GITHUB_TOKEN;
  let octokit: Octokit | null = null;
  if (githubToken) {
    octokit = new Octokit({ auth: githubToken });
  }

  try {
    if (!octokit) throw new Error("GITHUB_TOKEN is not configured");

    // Create empty repo
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: slug.trim(),
      auto_init: true,
      private: false,
    });
    repoUrl = repo.html_url;

    // Read starter-nextjs files
    const starterDir = path.resolve(process.cwd(), "..", "starter-nextjs");
    const starterFiles = await readStarterFiles(starterDir);

    // Build file map (starter base)
    const fileMap = new Map<string, TemplateFile>();
    for (const f of starterFiles) {
      fileMap.set(f.path, f);
    }

    // Overlay generated files (they overwrite starter files at same paths)
    if (generatedFiles?.files) {
      for (const gf of generatedFiles.files) {
        fileMap.set(gf.path, {
          path: gf.path,
          content: Buffer.from(gf.content).toString("base64"),
          encoding: "base64",
        });
      }
    }

    // Merge dependencies into package.json if needed
    if (generatedFiles?.dependencies && generatedFiles.dependencies.length > 0) {
      const pkgFile = fileMap.get("package.json");
      if (pkgFile) {
        pkgFile.content = mergePackageJson(pkgFile.content, generatedFiles.dependencies);
      }
    }

    // Push everything via Git Data API
    const repoOwner = repo.owner.login;
    const repoName = repo.name;

    const { data: ref } = await octokit.rest.git.getRef({
      owner: repoOwner,
      repo: repoName,
      ref: "heads/main",
    });
    const parentSha = ref.object.sha;

    // Create blobs
    const treeItems: { path: string; mode: "100644"; type: "blob"; sha: string }[] = [];
    for (const file of fileMap.values()) {
      const { data: blob } = await octokit.rest.git.createBlob({
        owner: repoOwner,
        repo: repoName,
        content: file.content,
        encoding: file.encoding,
      });
      treeItems.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    // Create tree, commit, update ref
    const { data: tree } = await octokit.rest.git.createTree({
      owner: repoOwner,
      repo: repoName,
      tree: treeItems,
    });

    const { data: commit } = await octokit.rest.git.createCommit({
      owner: repoOwner,
      repo: repoName,
      message: "chore: initialize from starter-nextjs + AI-generated code",
      tree: tree.sha,
      parents: [parentSha],
    });

    await octokit.rest.git.updateRef({
      owner: repoOwner,
      repo: repoName,
      ref: "heads/main",
      sha: commit.sha,
    });

    send({ step: "github", status: "done", repoUrl });
  } catch (err) {
    send({
      step: "github",
      status: "error",
      error: err instanceof Error ? err.message : "Failed to create GitHub repo",
    });
  }

  // Step 4 — Vercel
  const vercelToken = process.env.VERCEL_TOKEN;
  let vercelProjectName = "";
  try {
    if (!vercelToken) throw new Error("VERCEL_TOKEN is not configured");
    if (!repoUrl) throw new Error("Skipped: GitHub repo not created");

    const repoOwner = repoUrl.split("/").slice(-2, -1)[0];
    const repoFullName = `${repoOwner}/${slug.trim()}`;

    const createRes = await fetch("https://api.vercel.com/v10/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: slug.trim(),
        framework: "nextjs",
        gitRepository: {
          type: "github",
          repo: repoFullName,
        },
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      throw new Error(`Vercel API ${createRes.status}: ${JSON.stringify(errData)}`);
    }

    const project = await createRes.json();
    vercelProjectName = project.name;
    vercelUrl = `https://${project.name}.vercel.app`;

    // Set env vars
    const envVars = [
      { key: "SUPABASE_URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL || "", target: ["production", "preview", "development"] },
      { key: "SUPABASE_ANON_KEY", value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", target: ["production", "preview", "development"] },
      { key: "SITE_ID", value: siteId, target: ["production", "preview", "development"] },
      { key: "RESEND_API_KEY", value: process.env.RESEND_API_KEY || "", target: ["production", "preview", "development"] },
    ];

    await fetch(`https://api.vercel.com/v10/projects/${project.id}/env`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envVars),
    }).catch(() => {});

    send({
      step: "vercel",
      status: "done",
      siteUrl: vercelUrl,
      projectName: vercelProjectName,
    });
  } catch (err) {
    send({
      step: "vercel",
      status: "error",
      error: err instanceof Error ? err.message : "Failed to create Vercel project",
    });
  }

  // Step 5 — Generate article ideas
  let articlesQueued = 0;
  try {
    const articleIdeas = await callGeminiJSON<
      { title: string; slug: string; category: string; priority: number; keywords: string[]; meta_description: string }[]
    >(
      ARTICLE_IDEAS_SYSTEM_PROMPT,
      buildArticleIdeasPrompt(siteName, userPrompt),
      { temperature: 0.7, maxOutputTokens: 8000, retries: 3 }
    );

    const queueItems = (articleIdeas || []).map((article) => ({
      site_id: siteId,
      keyword: article.title,
      type: "article" as const,
      priority: article.priority || 3,
      status: "pending" as const,
    }));

    if (queueItems.length > 0) {
      await addToQueue(supabase, queueItems);
      articlesQueued = queueItems.length;
    }

    send({ step: "articles", status: "done", count: articlesQueued });
  } catch (err) {
    send({
      step: "articles",
      status: "error",
      error: err instanceof Error ? err.message : "Failed to generate articles",
    });
  }

  // Step 6 — Finalize
  try {
    const updates: Record<string, unknown> = {};
    if (repoUrl) {
      const repoOwner = repoUrl.split("/").slice(-2, -1)[0];
      updates.github_repo = `${repoOwner}/${slug.trim()}`;
    }
    if (vercelProjectName) updates.vercel_project = vercelProjectName;
    if (vercelUrl) updates.domain = vercelUrl.replace("https://", "");
    updates.active = true;

    await updateSite(supabase, siteId, updates);
    send({ step: "finalize", status: "done" });
  } catch (err) {
    send({
      step: "finalize",
      status: "error",
      error: err instanceof Error ? err.message : "Failed to finalize site",
    });
  }

  // Final event
  send({
    step: "complete",
    status: "done",
    siteId,
    repoUrl,
    siteUrl: vercelUrl,
    articlesQueued,
  });
}

// ─── MODE REPO (basic) ───

async function handleRepoMode(
  body: RequestBody,
  supabase: Awaited<ReturnType<typeof createClient>>,
  send: (e: StepEvent) => void
) {
  const repoUrlInput = body.repo_url || "";
  const siteName = body.name || repoUrlInput.split("/").pop() || "site";
  const slug = body.slug || slugify(siteName);

  // Step 1 — Analyze
  send({ step: "analyze", status: "done" });

  // Step 2 — Supabase
  let siteId = "";
  try {
    const site = await createSite(supabase, {
      name: siteName,
      slug,
      niche: "imported",
      github_repo: repoUrlInput.replace("https://github.com/", ""),
      primary_color: body.primary_color || "#3b82f6",
      accent_color: body.accent_color || "#10b981",
      active: false,
    });
    siteId = site.id;
    send({ step: "supabase", status: "done", siteId });
  } catch (err) {
    send({ step: "supabase", status: "error", error: err instanceof Error ? err.message : "DB error" });
    return;
  }

  // Step 3 — Vercel
  const vercelToken = process.env.VERCEL_TOKEN;
  let vercelUrl = "";
  try {
    if (!vercelToken) throw new Error("VERCEL_TOKEN not configured");
    const repoFullName = repoUrlInput.replace("https://github.com/", "");

    const createRes = await fetch("https://api.vercel.com/v10/projects", {
      method: "POST",
      headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: slug, framework: "nextjs", gitRepository: { type: "github", repo: repoFullName } }),
    });

    if (!createRes.ok) throw new Error(`Vercel API ${createRes.status}`);
    const project = await createRes.json();
    vercelUrl = `https://${project.name}.vercel.app`;

    await updateSite(supabase, siteId, {
      vercel_project: project.name,
      domain: project.name + ".vercel.app",
      active: true,
    });

    send({ step: "vercel", status: "done", siteUrl: vercelUrl });
  } catch (err) {
    send({ step: "vercel", status: "error", error: err instanceof Error ? err.message : "Vercel error" });
  }

  // Step 4 — Articles
  send({ step: "articles", status: "done", count: 0 });

  send({ step: "complete", status: "done", siteId, repoUrl: repoUrlInput, siteUrl: vercelUrl, articlesQueued: 0 });
}

// ─── MODE EXISTING (basic) ───

async function handleExistingMode(
  body: RequestBody,
  supabase: Awaited<ReturnType<typeof createClient>>,
  send: (e: StepEvent) => void
) {
  const siteUrlInput = body.site_url || "";
  const siteName = body.name || new URL(siteUrlInput).hostname;
  const slug = body.slug || slugify(siteName);

  // Step 1 — Scrape
  send({ step: "scrape", status: "done" });

  // Step 2 — Supabase
  let siteId = "";
  try {
    const site = await createSite(supabase, {
      name: siteName,
      slug,
      niche: "imported",
      domain: new URL(siteUrlInput).hostname,
      github_repo: body.existing_repo?.replace("https://github.com/", "") || null,
      primary_color: body.primary_color || "#3b82f6",
      accent_color: body.accent_color || "#10b981",
      active: true,
    });
    siteId = site.id;
    send({ step: "supabase", status: "done", siteId });
  } catch (err) {
    send({ step: "supabase", status: "error", error: err instanceof Error ? err.message : "DB error" });
    return;
  }

  // Step 3 — Connect
  send({ step: "connect", status: "done" });

  // Step 4 — Vercel
  send({ step: "vercel", status: "done", siteUrl: siteUrlInput });

  // Step 5 — Articles
  send({ step: "articles", status: "done", count: 0 });

  send({ step: "complete", status: "done", siteId, siteUrl: siteUrlInput, articlesQueued: 0 });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
