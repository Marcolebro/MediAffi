import { createClient } from "@/lib/supabase/server";
import { getSiteById, updateSite } from "@/lib/queries/sites";
import { Octokit } from "octokit";
import {
  callGeminiJSON,
  getSystemPromptForGeneration,
} from "@/lib/gemini";

export const runtime = "nodejs";

type RequestBody = {
  siteId: string;
  action: "add_page" | "update_config" | "add_affiliate" | "rebuild";
  data: Record<string, unknown>;
};

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
  const { siteId, action, data } = body;

  if (!siteId || !action) {
    return new Response(
      JSON.stringify({ error: "siteId and action are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const site = await getSiteById(supabase, siteId);
  if (!site) {
    return new Response(
      JSON.stringify({ error: "Site not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const vercelToken = process.env.VERCEL_TOKEN;

  try {
    switch (action) {
      case "add_page": {
        if (!githubToken || !site.github_repo) {
          throw new Error("GitHub not configured for this site");
        }
        const octokit = new Octokit({ auth: githubToken });
        const [owner, repo] = site.github_repo.split("/");
        const prompt = (data.prompt as string) || "";

        // Generate a single page with Gemini
        const systemPrompt = getSystemPromptForGeneration("libre");
        const pageResult = await callGeminiJSON<{
          files: { path: string; content: string }[];
          dependencies: string[];
        }>(
          systemPrompt,
          `Génère UNE SEULE page React/Next.js pour le site "${site.name}". Description : ${prompt}. Retourne le JSON avec les fichiers nécessaires (page + composants utilisés).`,
          { maxOutputTokens: 16000, retries: 3 }
        );

        // Push each generated file
        for (const file of pageResult.files || []) {
          // Check if file exists to get sha
          let sha: string | undefined;
          try {
            const { data: existing } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: file.path,
            });
            if (!Array.isArray(existing) && existing.type === "file") {
              sha = existing.sha;
            }
          } catch {
            // File doesn't exist
          }

          await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: file.path,
            message: `feat: add page via AI - ${file.path}`,
            content: Buffer.from(file.content).toString("base64"),
            ...(sha && { sha }),
          });
        }

        return Response.json({ success: true, filesCount: pageResult.files?.length || 0 });
      }

      case "update_config": {
        if (!githubToken || !site.github_repo) {
          throw new Error("GitHub not configured for this site");
        }
        const octokit = new Octokit({ auth: githubToken });
        const [owner, repo] = site.github_repo.split("/");

        // Update products.json if products provided
        if (data.products) {
          const productsJson = JSON.stringify(data.products, null, 2);
          let sha: string | undefined;
          try {
            const { data: existing } = await octokit.rest.repos.getContent({
              owner, repo, path: "site-data/products.json",
            });
            if (!Array.isArray(existing) && existing.type === "file") sha = existing.sha;
          } catch { /* doesn't exist */ }

          await octokit.rest.repos.createOrUpdateFileContents({
            owner, repo,
            path: "site-data/products.json",
            message: "chore: update products.json",
            content: Buffer.from(productsJson).toString("base64"),
            ...(sha && { sha }),
          });
        }

        // Update colors in DB
        if (data.colors) {
          const colors = data.colors as { primary?: string; accent?: string };
          await updateSite(supabase, siteId, {
            ...(colors.primary && { primary_color: colors.primary }),
            ...(colors.accent && { accent_color: colors.accent }),
          });
        }

        // Update social in DB
        if (data.social) {
          const social = data.social as Record<string, string>;
          await updateSite(supabase, siteId, {
            ...(social.twitter !== undefined && { twitter: social.twitter }),
            ...(social.instagram !== undefined && { instagram: social.instagram }),
            ...(social.linkedin !== undefined && { linkedin: social.linkedin }),
          });
        }

        return Response.json({ success: true });
      }

      case "add_affiliate": {
        if (!githubToken || !site.github_repo) {
          throw new Error("GitHub not configured for this site");
        }
        const octokit = new Octokit({ auth: githubToken });
        const [owner, repo] = site.github_repo.split("/");

        // Read current products.json
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner, repo, path: "site-data/products.json",
        });

        if (Array.isArray(fileData) || fileData.type !== "file") {
          throw new Error("products.json not found");
        }

        const currentContent = Buffer.from(fileData.content, "base64").toString("utf-8");
        const products = JSON.parse(currentContent);

        // Find and update the product
        const productSlug = data.productSlug as string;
        const affiliateUrl = data.affiliateUrl as string;
        const product = products.products?.find(
          (p: { slug: string }) => p.slug === productSlug
        );
        if (product) {
          product.affiliate_url = affiliateUrl;
        }

        await octokit.rest.repos.createOrUpdateFileContents({
          owner, repo,
          path: "site-data/products.json",
          message: `chore: update affiliate URL for ${productSlug}`,
          content: Buffer.from(JSON.stringify(products, null, 2)).toString("base64"),
          sha: fileData.sha,
        });

        return Response.json({ success: true });
      }

      case "rebuild": {
        if (!vercelToken || !site.vercel_project) {
          throw new Error("Vercel not configured for this site");
        }

        // Trigger redeploy via Vercel API
        const res = await fetch(
          `https://api.vercel.com/v13/deployments`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${vercelToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: site.vercel_project,
              target: "production",
              gitSource: {
                type: "github",
                repo: site.github_repo,
                ref: "main",
              },
            }),
          }
        );

        if (!res.ok) {
          const errData = await res.text();
          throw new Error(`Vercel redeploy failed: ${errData}`);
        }

        return Response.json({ success: true });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
