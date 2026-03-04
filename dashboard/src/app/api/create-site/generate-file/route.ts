import { createClient } from "@/lib/supabase/server";
import { getSiteById, updateSite } from "@/lib/queries/sites";
import { callAI, getPreferredModel } from "@/lib/ai";
import {
  getFileGenerationSystemPrompt,
  buildFileUserPrompt,
  stripCodeFences,
  type GeminiArchitectureResult,
} from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenerateFileBody = {
  siteId: string;
  filePath: string;
  fileDescription: string;
  siteType: "affiliation" | "media" | "libre";
  architecture: GeminiArchitectureResult;
  sitePrompt: string;
  config?: {
    siteName?: string;
    primaryColor?: string;
    accentColor?: string;
    affiliates?: { name: string; url: string }[];
    social?: { twitter?: string; instagram?: string; linkedin?: string };
    adsenseId?: string;
  };
  finalize?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GenerateFileBody = await request.json();
  const { siteId, filePath, fileDescription, siteType, architecture, sitePrompt, config, finalize } = body;

  if (!siteId || !filePath || !fileDescription || !siteType || !architecture || !sitePrompt) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const site = await getSiteById(supabase, siteId);
  if (!site) {
    return Response.json({ error: "Site not found" }, { status: 404 });
  }

  const model = await getPreferredModel(supabase, "site");
  const siteName = config?.siteName || site.name;

  try {
    const fileSystemPrompt = getFileGenerationSystemPrompt(siteType);
    const filePrompt = buildFileUserPrompt({
      filePath,
      fileDescription,
      architecture,
      sitePrompt,
      siteName,
      primaryColor: config?.primaryColor,
      accentColor: config?.accentColor,
      affiliates: config?.affiliates,
      social: config?.social,
      adsenseId: config?.adsenseId,
    });

    const { text } = await callAI({
      prompt: filePrompt,
      systemPrompt: fileSystemPrompt,
      model,
      maxTokens: 16384,
    });

    const content = stripCodeFences(text);
    const generatedFile = { path: filePath, content };

    // Read current generated_files and append (or replace if retrying)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentData = (site.generated_files as any) || { files: [], dependencies: [], sitemap_routes: [] };
    const updatedFiles = [...(currentData.files || [])];

    const existingIndex = updatedFiles.findIndex((f: { path: string }) => f.path === filePath);
    if (existingIndex >= 0) {
      updatedFiles[existingIndex] = generatedFile;
    } else {
      updatedFiles.push(generatedFile);
    }

    const updates: Record<string, unknown> = {
      generated_files: { ...currentData, files: updatedFiles },
    };

    if (finalize) {
      updates.creation_step = "generated";
    }

    await updateSite(supabase, siteId, updates);

    return Response.json({ path: filePath, content });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : `Failed to generate ${filePath}` },
      { status: 500 }
    );
  }
}
