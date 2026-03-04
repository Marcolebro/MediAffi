import { createClient } from "@/lib/supabase/server";
import { getSiteById, updateSite } from "@/lib/queries/sites";
import { callAI, callAIJSON, getPreferredModel } from "@/lib/ai";
import {
  getArchitectureSystemPrompt,
  getFileGenerationSystemPrompt,
  buildArchitectureUserPrompt,
  buildFileUserPrompt,
  stripCodeFences,
  slugToFilePath,
  getLayoutFilePaths,
  type GeminiArchitectureResult,
  type GeminiFile,
} from "@/lib/gemini";
import { createNDJSONStream, type StepEvent } from "../shared";

export const runtime = "nodejs";
export const maxDuration = 120;

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

  return createNDJSONStream(async (send: (e: StepEvent) => void) => {
    const siteName = config?.siteName || site.name;

    // Step 1 — Architecture planning
    let architecture: GeminiArchitectureResult | null = null;
    try {
      const archSystemPrompt = getArchitectureSystemPrompt(siteType);
      const archUserPrompt = buildArchitectureUserPrompt({
        prompt: userPrompt,
        siteName,
        primaryColor: config?.primaryColor,
        accentColor: config?.accentColor,
        affiliates: config?.affiliates,
      });

      architecture = await callAIJSON<GeminiArchitectureResult>({
        prompt: archUserPrompt,
        systemPrompt: archSystemPrompt,
        model,
        maxTokens: 4096,
        retries: 2,
      });

      if (!architecture?.pages || architecture.pages.length === 0) {
        throw new Error("AI returned no pages in architecture");
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
      return;
    }

    // Step 2 — Layout + shared components
    const layoutFiles: GeminiFile[] = [];
    try {
      const fileSystemPrompt = getFileGenerationSystemPrompt(siteType);
      const filesToGenerate = getLayoutFilePaths(architecture);
      const BATCH_SIZE = 3;

      const sharedOpts = {
        architecture,
        sitePrompt: userPrompt,
        siteName,
        primaryColor: config?.primaryColor,
        accentColor: config?.accentColor,
        affiliates: config?.affiliates,
        social: config?.social,
        adsenseId: config?.adsenseId,
      };

      for (let i = 0; i < filesToGenerate.length; i += BATCH_SIZE) {
        const batch = filesToGenerate.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (file) => {
            const filePrompt = buildFileUserPrompt({
              filePath: file.path,
              fileDescription: file.description,
              ...sharedOpts,
            });
            const { text } = await callAI({
              prompt: filePrompt,
              systemPrompt: fileSystemPrompt,
              model,
              maxTokens: 16384,
            });
            return { path: file.path, content: stripCodeFences(text) };
          })
        );

        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const file = batch[j];
          if (result.status === "fulfilled") {
            layoutFiles.push(result.value);
            send({ step: "generate_layout", status: "progress", message: `${file.path.split("/").pop()} OK` });
          } else {
            send({ step: "generate_layout", status: "progress", message: `${file.path.split("/").pop()} — erreur` });
          }
        }
      }

      send({ step: "generate_layout", status: "done", filesCount: layoutFiles.length });
    } catch (err) {
      send({
        step: "generate_layout",
        status: "error",
        error: err instanceof Error ? err.message : "Failed to generate layout",
      });
    }

    // Step 3 — Pages
    const pageFiles: GeminiFile[] = [];
    try {
      const fileSystemPrompt = getFileGenerationSystemPrompt(siteType);
      const BATCH_SIZE = 3;

      const sharedOpts = {
        architecture,
        sitePrompt: userPrompt,
        siteName,
        primaryColor: config?.primaryColor,
        accentColor: config?.accentColor,
        affiliates: config?.affiliates,
        social: config?.social,
        adsenseId: config?.adsenseId,
      };

      for (let i = 0; i < architecture.pages.length; i += BATCH_SIZE) {
        const batch = architecture.pages.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (page) => {
            const filePath = slugToFilePath(page.slug);
            const filePrompt = buildFileUserPrompt({
              filePath,
              fileDescription: `Page "${page.title}": ${page.description}. Composants à utiliser: ${page.components_needed.join(", ")}`,
              ...sharedOpts,
            });
            const { text } = await callAI({
              prompt: filePrompt,
              systemPrompt: fileSystemPrompt,
              model,
              maxTokens: 16384,
            });
            return { path: filePath, content: stripCodeFences(text) };
          })
        );

        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const page = batch[j];
          if (result.status === "fulfilled") {
            pageFiles.push(result.value);
            send({ step: "generate_pages", status: "progress", message: `${page.title} OK` });
          } else {
            send({ step: "generate_pages", status: "progress", message: `${page.title} — erreur` });
          }
        }
      }

      send({ step: "generate_pages", status: "done", filesCount: pageFiles.length });
    } catch (err) {
      send({
        step: "generate_pages",
        status: "error",
        error: err instanceof Error ? err.message : "Failed to generate pages",
      });
    }

    // Save generated files to DB
    const allFiles = [...layoutFiles, ...pageFiles];
    const allDeps = architecture.dependencies || [];

    const generatedFilesData = {
      files: allFiles,
      dependencies: [...new Set(allDeps)],
      sitemap_routes: architecture.pages
        .map((p) => p.slug)
        .filter((s) => !s.includes("[")),
    };

    try {
      await updateSite(supabase, siteId, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        generated_files: generatedFilesData as any,
        creation_step: "generated",
      } as Record<string, unknown>);
    } catch {
      // Non-critical — deploy step will still work if files are in response
    }

    send({ step: "generate_complete", status: "done", filesCount: allFiles.length });
  });
}
