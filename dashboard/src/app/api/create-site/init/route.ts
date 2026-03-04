import { createClient } from "@/lib/supabase/server";
import { createSite, createAffiliateProgram } from "@/lib/queries/sites";
import type { RequestBody } from "../shared";
import { slugify } from "../shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: RequestBody = await request.json();
  const { mode } = body;

  if (!mode) {
    return Response.json({ error: "mode is required" }, { status: 400 });
  }

  try {
    let siteName: string;
    let slug: string;
    let siteData: Record<string, unknown>;

    if (mode === "prompt") {
      const userPrompt = body.prompt || "";
      siteName = body.name || userPrompt.slice(0, 40);
      slug = body.slug || slugify(siteName);

      siteData = {
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
        creation_step: "init",
      };
    } else if (mode === "repo") {
      const repoUrlInput = body.repo_url || "";
      siteName = body.name || repoUrlInput.split("/").pop() || "site";
      slug = body.slug || slugify(siteName);

      siteData = {
        name: siteName,
        slug,
        niche: "imported",
        github_repo: repoUrlInput.replace("https://github.com/", ""),
        primary_color: body.primary_color || "#3b82f6",
        accent_color: body.accent_color || "#10b981",
        active: false,
        creation_step: "init",
      };
    } else if (mode === "existing") {
      const siteUrlInput = body.site_url || "";
      siteName = body.name || new URL(siteUrlInput).hostname;
      slug = body.slug || slugify(siteName);

      siteData = {
        name: siteName,
        slug,
        niche: "imported",
        domain: new URL(siteUrlInput).hostname,
        github_repo: body.existing_repo?.replace("https://github.com/", "") || null,
        primary_color: body.primary_color || "#3b82f6",
        accent_color: body.accent_color || "#10b981",
        active: true,
        creation_step: "init",
      };
    } else {
      return Response.json({ error: "Invalid mode" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const site = await createSite(supabase, siteData as any);

    // Create affiliate programs
    const validAffiliates = (body.affiliates || []).filter(
      (a) => a.name?.trim() && a.url?.trim()
    );
    for (const affiliate of validAffiliates) {
      await createAffiliateProgram(supabase, {
        site_id: site.id,
        name: affiliate.name.trim(),
        url: affiliate.url.trim(),
      });
    }

    return Response.json({
      siteId: site.id,
      slug: site.slug,
      mode,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create site" },
      { status: 500 }
    );
  }
}
