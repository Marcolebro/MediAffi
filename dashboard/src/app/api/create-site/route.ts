import { createClient } from "@/lib/supabase/server";
import { createSite, createAffiliateProgram, updateSite } from "@/lib/queries/sites";
import { addToQueue } from "@/lib/queries/queue";
import { Octokit } from "octokit";
import fs from "fs/promises";
import path from "path";

// Force Node.js runtime (Edge Runtime blocks eval used by dependencies)
export const runtime = "nodejs";

type StepEvent = {
  step: string;
  status: "done" | "error";
  error?: string;
  siteId?: string;
  repoUrl?: string;
  siteUrl?: string;
  projectName?: string;
  count?: number;
  articlesQueued?: number;
};

type AffiliateInput = {
  name: string;
  url: string;
  commission: string;
  category: string;
};

type RequestBody = {
  name: string;
  slug: string;
  niche: string;
  domain?: string;
  description?: string;
  affiliates: AffiliateInput[];
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  pinterest?: string;
  tiktok?: string;
  adsense_id?: string;
  auto_ads?: boolean;
  resend_audience_id?: string;
  articles_per_day?: number;
  auto_social?: boolean;
  auto_newsletter?: boolean;
  primary_color?: string;
  accent_color?: string;
};

const GITHUB_ORG = "MediAffi";

// Directories/files to skip when reading template-astro
const SKIP_PATTERNS = new Set([
  "node_modules",
  ".astro",
  ".vercel",
  "dist",
  ".DS_Store",
  ".env",
  ".env.production",
]);

export async function POST(request: Request) {
  // Auth check
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
  const { name, slug, niche } = body;

  if (!name?.trim() || !slug?.trim() || !niche?.trim()) {
    return new Response(
      JSON.stringify({ error: "name, slug, and niche are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: StepEvent) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }

      let siteId = "";
      let repoUrl = "";
      let vercelUrl = "";
      let vercelProjectName = "";
      const validAffiliates = (body.affiliates || []).filter(
        (a) => a.name?.trim() && a.url?.trim()
      );

      // Step 1 — Insert in Supabase
      try {
        const site = await createSite(supabase, {
          name: name.trim(),
          slug: slug.trim(),
          niche: niche.trim(),
          domain: body.domain?.trim() || null,
          description: body.description?.trim() || null,
          instagram: body.instagram?.trim() || null,
          twitter: body.twitter?.trim() || null,
          linkedin: body.linkedin?.trim() || null,
          pinterest: body.pinterest?.trim() || null,
          tiktok: body.tiktok?.trim() || null,
          adsense_id: body.adsense_id?.trim() || null,
          auto_ads: body.auto_ads ?? false,
          resend_audience_id: body.resend_audience_id?.trim() || null,
          articles_per_day: body.articles_per_day ?? 3,
          auto_social: body.auto_social ?? true,
          auto_newsletter: body.auto_newsletter ?? true,
          primary_color: body.primary_color || "#3b82f6",
          accent_color: body.accent_color || "#10b981",
          active: false,
        });
        siteId = site.id;

        for (const affiliate of validAffiliates) {
          await createAffiliateProgram(supabase, {
            site_id: siteId,
            name: affiliate.name.trim(),
            url: affiliate.url.trim(),
            commission: affiliate.commission?.trim() || null,
            category: affiliate.category?.trim() || null,
          });
        }

        send({ step: "supabase", status: "done", siteId });
      } catch (err) {
        console.error("Step supabase failed:", err);
        send({
          step: "supabase",
          status: "error",
          error: err instanceof Error ? err.message : "Failed to create site in database",
        });
        controller.close();
        return;
      }

      // Step 2 — Create GitHub repo and push template files
      const githubToken = process.env.GITHUB_TOKEN;
      let octokit: Octokit | null = null;
      if (githubToken) {
        octokit = new Octokit({ auth: githubToken });
      }

      try {
        if (!octokit) throw new Error("GITHUB_TOKEN is not configured");

        // Create empty repo with auto_init so we have a main branch
        const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
          name: slug.trim(),
          auto_init: true,
          private: false,
        });
        repoUrl = repo.html_url;

        // If repo should be under the org, use createInOrg instead
        // For org repos, uncomment the following and comment out the above:
        // const { data: repo } = await octokit.rest.repos.createInOrg({
        //   org: GITHUB_ORG,
        //   name: slug.trim(),
        //   auto_init: true,
        //   private: false,
        // });

        // Read all template files from local filesystem
        const templateDir = path.resolve(process.cwd(), "..", "template-astro");
        const files = await readTemplateFiles(templateDir);

        // Get the current commit SHA on main
        const repoOwner = repo.owner.login;
        const repoName = repo.name;
        const { data: ref } = await octokit.rest.git.getRef({
          owner: repoOwner,
          repo: repoName,
          ref: "heads/main",
        });
        const parentSha = ref.object.sha;

        // Create blobs for all files
        const treeItems: { path: string; mode: "100644" | "100755"; type: "blob"; sha: string }[] = [];
        for (const file of files) {
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

        // Create the tree
        const { data: tree } = await octokit.rest.git.createTree({
          owner: repoOwner,
          repo: repoName,
          tree: treeItems,
        });

        // Create the commit
        const { data: commit } = await octokit.rest.git.createCommit({
          owner: repoOwner,
          repo: repoName,
          message: "chore: initialize from template-astro",
          tree: tree.sha,
          parents: [parentSha],
        });

        // Update main to point to the new commit
        await octokit.rest.git.updateRef({
          owner: repoOwner,
          repo: repoName,
          ref: "heads/main",
          sha: commit.sha,
        });

        send({ step: "github", status: "done", repoUrl });
      } catch (err) {
        console.error("Step github failed:", err);
        send({
          step: "github",
          status: "error",
          error: err instanceof Error ? err.message : "Failed to create GitHub repo",
        });
      }

      // Step 3 — Push site.config.json with site-specific config
      try {
        if (!octokit || !repoUrl) throw new Error("Skipped: GitHub repo not created");

        const configJson = buildSiteConfig(body, validAffiliates);
        const repoName = slug.trim();
        // Determine the owner from repoUrl
        const repoOwner = repoUrl.split("/").slice(-2, -1)[0] || GITHUB_ORG;

        // Get existing file SHA (it was pushed with the template)
        let sha: string | undefined;
        try {
          const { data: existing } = await octokit.rest.repos.getContent({
            owner: repoOwner,
            repo: repoName,
            path: "site.config.json",
          });
          if (!Array.isArray(existing) && existing.type === "file") {
            sha = existing.sha;
          }
        } catch {
          // File doesn't exist yet, that's fine
        }

        await octokit.rest.repos.createOrUpdateFileContents({
          owner: repoOwner,
          repo: repoName,
          path: "site.config.json",
          message: "chore: configure site.config.json for " + body.name.trim(),
          content: Buffer.from(JSON.stringify(configJson, null, 2)).toString("base64"),
          ...(sha && { sha }),
        });

        send({ step: "config", status: "done" });
      } catch (err) {
        console.error("Step config failed:", err);
        send({
          step: "config",
          status: "error",
          error: err instanceof Error ? err.message : "Failed to push site.config.json",
        });
      }

      // Step 4 — Create Vercel project
      const vercelToken = process.env.VERCEL_TOKEN;
      try {
        if (!vercelToken) throw new Error("VERCEL_TOKEN is not configured");
        if (!repoUrl) throw new Error("Skipped: GitHub repo not created");

        const repoOwner4 = repoUrl.split("/").slice(-2, -1)[0] || GITHUB_ORG;
        const repoFullName = `${repoOwner4}/${slug.trim()}`;

        // Create project
        const createRes = await fetch("https://api.vercel.com/v10/projects", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: slug.trim(),
            framework: "astro",
            gitRepository: {
              type: "github",
              repo: repoFullName,
            },
          }),
        });

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          throw new Error(
            `Vercel API ${createRes.status}: ${JSON.stringify(errData)}`
          );
        }

        const project = await createRes.json();
        vercelProjectName = project.name;
        vercelUrl = `${project.name}.vercel.app`;

        // Set environment variables
        const envVars = [
          { key: "SUPABASE_URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL || "", target: ["production", "preview", "development"] },
          { key: "SUPABASE_ANON_KEY", value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", target: ["production", "preview", "development"] },
          { key: "SITE_ID", value: siteId, target: ["production", "preview", "development"] },
        ];

        const envRes = await fetch(
          `https://api.vercel.com/v10/projects/${project.id}/env`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${vercelToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(envVars),
          }
        );

        if (!envRes.ok) {
          console.error("Failed to set Vercel env vars:", await envRes.text());
        }

        send({
          step: "vercel",
          status: "done",
          siteUrl: vercelUrl,
          projectName: vercelProjectName,
        });
      } catch (err) {
        console.error("Step vercel failed:", err);
        send({
          step: "vercel",
          status: "error",
          error: err instanceof Error ? err.message : "Failed to create Vercel project",
        });
      }

      // Step 5 — Generate article queue via Gemini
      let articlesQueued = 0;
      let generatedCategories: { slug: string; name: string; description: string }[] = [];
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

        const prompt = `Génère 50 idées d'articles pour un site d'affiliation sur "${niche.trim()}".
Pour chaque article, donne : keyword, type (review/comparatif/top_list/guide/actu), priority (1-10).
Génère aussi 4-5 catégories pertinentes pour le site, chacune avec slug, name, description.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
{ "categories": [{ "slug": "...", "name": "...", "description": "..." }], "articles": [{ "keyword": "...", "type": "...", "priority": 1 }] }`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8000,
            },
          }),
        });

        if (!geminiRes.ok) {
          throw new Error(`Gemini API error: ${geminiRes.status}`);
        }

        const geminiData = await geminiRes.json();
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error("No content in Gemini response");

        // Parse JSON - handle potential markdown wrapping
        const jsonStr = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(jsonStr) as {
          categories: { slug: string; name: string; description: string }[];
          articles: { keyword: string; type: string; priority: number }[];
        };

        generatedCategories = parsed.categories || [];

        const queueItems = (parsed.articles || []).map((article) => ({
          site_id: siteId,
          keyword: article.keyword,
          type: article.type,
          priority: article.priority || 5,
          status: "pending" as const,
        }));

        if (queueItems.length > 0) {
          await addToQueue(supabase, queueItems);
          articlesQueued = queueItems.length;
        }

        send({ step: "articles", status: "done", count: articlesQueued });
      } catch (err) {
        console.error("Step articles failed:", err);
        send({
          step: "articles",
          status: "error",
          error: err instanceof Error ? err.message : "Failed to generate articles",
        });
      }

      // Step 5b — Update site.config.json with generated categories
      if (generatedCategories.length > 0 && octokit && repoUrl) {
        try {
          const configJson = buildSiteConfig(body, validAffiliates, generatedCategories);
          const repoOwner5b = repoUrl.split("/").slice(-2, -1)[0] || GITHUB_ORG;

          const { data: existing } = await octokit.rest.repos.getContent({
            owner: repoOwner5b,
            repo: slug.trim(),
            path: "site.config.json",
          });

          let sha: string | undefined;
          if (!Array.isArray(existing) && existing.type === "file") {
            sha = existing.sha;
          }

          await octokit.rest.repos.createOrUpdateFileContents({
            owner: repoOwner5b,
            repo: slug.trim(),
            path: "site.config.json",
            message: "chore: add generated categories to site.config.json",
            content: Buffer.from(JSON.stringify(configJson, null, 2)).toString("base64"),
            ...(sha && { sha }),
          });
        } catch (err) {
          console.error("Step config update (categories) failed:", err);
          // Non-critical, don't send a separate error event
        }
      }

      // Step 6 — Update site in database
      try {
        const updates: Record<string, unknown> = {};
        if (repoUrl) {
          const repoOwner6 = repoUrl.split("/").slice(-2, -1)[0] || GITHUB_ORG;
          updates.github_repo = `${repoOwner6}/${slug.trim()}`;
        }
        if (vercelProjectName) updates.vercel_project = vercelProjectName;
        if (vercelUrl && !body.domain?.trim()) updates.domain = vercelUrl;

        if (Object.keys(updates).length > 0) {
          await updateSite(supabase, siteId, updates);
        }

        send({ step: "update", status: "done" });
      } catch (err) {
        console.error("Step update failed:", err);
        send({
          step: "update",
          status: "error",
          error: err instanceof Error ? err.message : "Failed to update site",
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

type TemplateFile = {
  path: string;
  content: string;
  encoding: "base64" | "utf-8";
};

async function readTemplateFiles(dir: string, base = ""): Promise<TemplateFile[]> {
  const files: TemplateFile[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_PATTERNS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = base ? `${base}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const subFiles = await readTemplateFiles(fullPath, relativePath);
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

function buildSiteConfig(
  body: RequestBody,
  affiliates: AffiliateInput[],
  categories: { slug: string; name: string; description: string }[] = []
) {
  const affiliatePrograms: Record<string, { name: string; url: string; commission: string }> = {};
  for (const a of affiliates) {
    const key = a.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    affiliatePrograms[key] = {
      name: a.name,
      url: a.url,
      commission: a.commission || "",
    };
  }

  const navLinks = categories.map((c) => ({
    label: c.name,
    href: `/${c.slug}`,
  }));

  const footerLinks = categories.map((c) => ({
    label: c.name,
    href: `/${c.slug}`,
  }));

  return {
    name: body.name.trim(),
    domain: body.domain?.trim() || `https://${body.slug.trim()}.vercel.app`,
    language: "fr",
    description: body.description?.trim() || "",
    tagline: body.name.trim(),
    categories: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
    })),
    colors: {
      primary: body.primary_color || "#3b82f6",
      accent: body.accent_color || "#10b981",
      background: "#ffffff",
      text: "#1a1a1a",
    },
    social: {
      twitter: body.twitter?.trim() || "",
      linkedin: body.linkedin?.trim() || "",
      instagram: body.instagram?.trim() || "",
    },
    analytics: {
      plausible_domain: "",
      plausible_script: "",
    },
    ads: {
      adsense_id: body.adsense_id?.trim() || "",
    },
    newsletter: {
      resend_audience_id: "env:RESEND_AUDIENCE_ID",
    },
    supabase: {
      url: "env:SUPABASE_URL",
      anon_key: "env:SUPABASE_ANON_KEY",
    },
    affiliate_programs: affiliatePrograms,
    nav_links: navLinks,
    footer_links: footerLinks,
  };
}
