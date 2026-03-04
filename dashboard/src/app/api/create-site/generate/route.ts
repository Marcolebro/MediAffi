import { createClient } from "@/lib/supabase/server";
import { getSiteById, updateSite } from "@/lib/queries/sites";
import { callAIJSON, getPreferredModel } from "@/lib/ai";
import {
  getArchitectureSystemPrompt,
  buildArchitectureUserPrompt,
  getLayoutFilePaths,
  slugToFilePath,
  type GeminiArchitectureResult,
} from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenerateBody = {
  siteId: string;
  prompt: string;
  siteType: "affiliation" | "media" | "libre";
  config?: {
    siteName?: string;
    primaryColor?: string;
    accentColor?: string;
    affiliates?: { name: string; url: string }[];
    social?: { twitter?: string; instagram?: string; linkedin?: string };
    adsenseId?: string;
  };
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GenerateBody = await request.json();
  const { siteId, prompt: userPrompt, siteType, config } = body;

  if (!siteId || !userPrompt) {
    return Response.json({ error: "siteId and prompt are required" }, { status: 400 });
  }

  const site = await getSiteById(supabase, siteId);
  if (!site) {
    return Response.json({ error: "Site not found" }, { status: 404 });
  }

  const model = await getPreferredModel(supabase, "site");
  const siteName = config?.siteName || site.name;

  try {
    const archSystemPrompt = getArchitectureSystemPrompt(siteType);
    const archUserPrompt = buildArchitectureUserPrompt({
      prompt: userPrompt,
      siteName,
      primaryColor: config?.primaryColor,
      accentColor: config?.accentColor,
      affiliates: config?.affiliates,
    });

    const architecture = await callAIJSON<GeminiArchitectureResult>({
      prompt: archUserPrompt,
      systemPrompt: archSystemPrompt,
      model,
      maxTokens: 4096,
      retries: 2,
    });

    if (!architecture?.pages || architecture.pages.length === 0) {
      throw new Error("AI returned no pages in architecture");
    }

    // Build the full list of files to generate
    const layoutFiles = getLayoutFilePaths(architecture);
    const pageFiles = architecture.pages.map((page) => ({
      path: slugToFilePath(page.slug),
      description: `Page "${page.title}": ${page.description}. Composants à utiliser: ${page.components_needed.join(", ")}`,
    }));
    const filesToGenerate = [...layoutFiles, ...pageFiles];

    // Initialize generated_files in DB (empty files array, dependencies + sitemap already set)
    const generatedFilesData = {
      files: [],
      dependencies: [...new Set(architecture.dependencies || [])],
      sitemap_routes: architecture.pages
        .map((p) => p.slug)
        .filter((s) => !s.includes("[")),
    };

    await updateSite(supabase, siteId, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generated_files: generatedFilesData as any,
    } as Record<string, unknown>);

    return Response.json({ architecture, filesToGenerate });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to plan architecture" },
      { status: 500 }
    );
  }
}
