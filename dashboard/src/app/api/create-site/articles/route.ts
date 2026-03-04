import { createClient } from "@/lib/supabase/server";
import { getSiteById, updateSite } from "@/lib/queries/sites";
import { addToQueue } from "@/lib/queries/queue";
import { callAIJSON, getPreferredModel } from "@/lib/ai";
import {
  ARTICLE_IDEAS_SYSTEM_PROMPT,
  buildArticleIdeasPrompt,
} from "@/lib/gemini";
import { createNDJSONStream, type StepEvent } from "../shared";

export const runtime = "nodejs";
export const maxDuration = 60;

type ArticlesBody = {
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

  const body: ArticlesBody = await request.json();
  const { siteId } = body;

  if (!siteId) {
    return Response.json({ error: "siteId is required" }, { status: 400 });
  }

  const site = await getSiteById(supabase, siteId);
  if (!site) {
    return Response.json({ error: "Site not found" }, { status: 404 });
  }

  const model = await getPreferredModel(supabase, "article");

  return createNDJSONStream(async (send: (e: StepEvent) => void) => {
    let articlesQueued = 0;

    try {
      const articleIdeas = await callAIJSON<
        { title: string; slug: string; category: string; priority: number; keywords: string[]; meta_description: string }[]
      >({
        prompt: buildArticleIdeasPrompt(site.name, site.description || site.niche),
        systemPrompt: ARTICLE_IDEAS_SYSTEM_PROMPT,
        model,
        temperature: 0.7,
        maxTokens: 8000,
        retries: 3,
      });

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

    // Finalize
    try {
      await updateSite(supabase, siteId, {
        active: true,
        creation_step: "complete",
      } as Record<string, unknown>);
      send({ step: "finalize", status: "done" });
    } catch (err) {
      send({
        step: "finalize",
        status: "error",
        error: err instanceof Error ? err.message : "Failed to finalize site",
      });
    }

    send({
      step: "complete",
      status: "done",
      siteId,
      articlesQueued,
    });
  });
}
