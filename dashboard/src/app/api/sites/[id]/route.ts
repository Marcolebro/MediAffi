import { createClient } from "@/lib/supabase/server";
import { getSiteById } from "@/lib/queries/sites";
import { Octokit } from "octokit";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const warnings: string[] = [];

  let site;
  try {
    site = await getSiteById(supabase, id);
  } catch {
    return Response.json({ error: "Site not found" }, { status: 404 });
  }

  // 1. Delete GitHub repo (best-effort)
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken && site.github_repo) {
    try {
      const octokit = new Octokit({ auth: githubToken });
      const [owner, repo] = site.github_repo.split("/");
      await octokit.rest.repos.delete({ owner, repo });
    } catch (err) {
      warnings.push(`GitHub: ${err instanceof Error ? err.message : "Failed to delete repo"}`);
    }
  }

  // 2. Delete Vercel project (best-effort)
  const vercelToken = process.env.VERCEL_TOKEN;
  if (vercelToken && site.vercel_project) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v9/projects/${site.vercel_project}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${vercelToken}` },
        }
      );
      if (!res.ok && res.status !== 404) {
        warnings.push(`Vercel: HTTP ${res.status}`);
      }
    } catch (err) {
      warnings.push(`Vercel: ${err instanceof Error ? err.message : "Failed to delete project"}`);
    }
  }

  // 3. Delete from Supabase (CASCADE handles related records)
  const { error } = await supabase
    .from("sites")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, warnings });
}
