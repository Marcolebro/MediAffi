import path from "path";
import { createClient } from "@/lib/supabase/server";
import { getSiteById, updateSite } from "@/lib/queries/sites";
import { Octokit } from "octokit";
import { createNDJSONStream, readStarterFiles, mergePackageJson, type StepEvent, type TemplateFile } from "../shared";

export const runtime = "nodejs";
export const maxDuration = 120;

type DeployBody = {
  siteId: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: DeployBody = await request.json();
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

  return createNDJSONStream(async (send: (e: StepEvent) => void) => {
    const slug = site.slug;
    let repoUrl = "";
    let vercelUrl = "";
    let vercelProjectName = "";

    // Step 1 — GitHub: push starter + generated files
    const githubToken = process.env.GITHUB_TOKEN;
    try {
      if (!githubToken) throw new Error("GITHUB_TOKEN is not configured");

      const octokit = new Octokit({ auth: githubToken });

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

      // Overlay generated files
      if (generatedFiles?.files) {
        for (const gf of generatedFiles.files) {
          fileMap.set(gf.path, {
            path: gf.path,
            content: Buffer.from(gf.content).toString("base64"),
            encoding: "base64",
          });
        }
      }

      // Merge dependencies into package.json
      if (generatedFiles?.dependencies?.length > 0) {
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

    // Step 2 — Vercel
    const vercelToken = process.env.VERCEL_TOKEN;
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
          gitRepository: { type: "github", repo: repoFullName },
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

    // Finalize — update site record
    try {
      const updates: Record<string, unknown> = { creation_step: "deployed" };
      if (repoUrl) {
        const repoOwner = repoUrl.split("/").slice(-2, -1)[0];
        updates.github_repo = `${repoOwner}/${slug.trim()}`;
      }
      if (vercelProjectName) updates.vercel_project = vercelProjectName;
      if (vercelUrl) updates.domain = vercelUrl.replace("https://", "");

      await updateSite(supabase, siteId, updates);
    } catch {
      // Non-critical
    }

    send({
      step: "deploy_complete",
      status: "done",
      repoUrl,
      siteUrl: vercelUrl,
    });
  });
}
