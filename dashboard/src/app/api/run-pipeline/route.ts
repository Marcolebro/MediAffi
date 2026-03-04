import { createClient } from "@/lib/supabase/server";
import { getSiteById } from "@/lib/queries/sites";
import { updateQueueItem } from "@/lib/queries/queue";
import { Octokit } from "octokit";
import { callAI, getPreferredModel } from "@/lib/ai";
import {
  ARTICLE_WRITE_SYSTEM_PROMPT,
  buildArticleWritePrompt,
} from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

type StepEvent = {
  step: string;
  status: "done" | "error";
  error?: string;
  title?: string;
  slug?: string;
  articleId?: string;
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

  const body = await request.json();
  const { siteId } = body;

  if (!siteId) {
    return new Response(
      JSON.stringify({ error: "siteId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: StepEvent) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }

      try {
        // Get site info
        const site = await getSiteById(supabase, siteId);
        if (!site) {
          send({ step: "fetch", status: "error", error: "Site not found" });
          controller.close();
          return;
        }

        // Dequeue 1 article
        const { data: queueItems, error: queueError } = await supabase
          .from("article_queue")
          .select("*")
          .eq("site_id", siteId)
          .eq("status", "pending")
          .order("priority", { ascending: false })
          .limit(1);

        if (queueError || !queueItems || queueItems.length === 0) {
          send({ step: "dequeue", status: "error", error: "No pending articles in queue" });
          controller.close();
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const queueItem = queueItems[0] as any;
        send({ step: "dequeue", status: "done", title: queueItem.keyword });

        // Update status to processing
        await updateQueueItem(supabase, queueItem.id, { status: "writing" });

        // Generate article with AI
        let mdxContent: string;
        try {
          const slug = slugify(queueItem.keyword);
          const model = await getPreferredModel(supabase, "article");
          const result = await callAI({
            prompt: buildArticleWritePrompt(
              site.name,
              queueItem.keyword,
              queueItem.type || "article",
              queueItem.secondary_keywords || [queueItem.keyword]
            ),
            systemPrompt: ARTICLE_WRITE_SYSTEM_PROMPT,
            model,
            maxTokens: 16000,
          });
          mdxContent = result.text;

          // Strip markdown fences if present
          mdxContent = mdxContent
            .replace(/^```(?:mdx|markdown)?\s*\n?/gm, "")
            .replace(/\n?```\s*$/gm, "")
            .trim();

          send({ step: "generate", status: "done", slug });
        } catch (err) {
          await updateQueueItem(supabase, queueItem.id, { status: "failed", error_log: err instanceof Error ? err.message : "Generation failed" });
          send({ step: "generate", status: "error", error: err instanceof Error ? err.message : "Gemini error" });
          controller.close();
          return;
        }

        // Push to GitHub
        const articleSlug = slugify(queueItem.keyword);
        const githubToken = process.env.GITHUB_TOKEN;

        if (githubToken && site.github_repo) {
          try {
            const octokit = new Octokit({ auth: githubToken });
            const [owner, repo] = site.github_repo.split("/");
            const filePath = `content/articles/${articleSlug}.mdx`;

            // Check if file exists
            let sha: string | undefined;
            try {
              const { data: existing } = await octokit.rest.repos.getContent({
                owner, repo, path: filePath,
              });
              if (!Array.isArray(existing) && existing.type === "file") sha = existing.sha;
            } catch { /* doesn't exist */ }

            await octokit.rest.repos.createOrUpdateFileContents({
              owner, repo,
              path: filePath,
              message: `feat: add article "${queueItem.keyword}"`,
              content: Buffer.from(mdxContent).toString("base64"),
              ...(sha && { sha }),
            });

            send({ step: "push", status: "done", slug: articleSlug });
          } catch (err) {
            send({ step: "push", status: "error", error: err instanceof Error ? err.message : "GitHub push failed" });
          }
        } else {
          send({ step: "push", status: "error", error: "GitHub not configured" });
        }

        // Update queue status to published
        await updateQueueItem(supabase, queueItem.id, { status: "published" });

        // Insert into articles table
        let articleId: string | undefined;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: article } = await (supabase as any)
            .from("articles")
            .insert({
              site_id: siteId,
              title: queueItem.keyword,
              slug: articleSlug,
              type: queueItem.type || "article",
              content_markdown: mdxContent,
              target_keyword: queueItem.keyword,
              status: "published",
              published_at: new Date().toISOString(),
              file_path: `content/articles/${articleSlug}.mdx`,
            })
            .select("id")
            .single();

          articleId = article?.id;

          // Link queue item to article
          if (articleId) {
            await updateQueueItem(supabase, queueItem.id, { article_id: articleId });
          }
        } catch {
          // Non-critical
        }

        send({
          step: "complete",
          status: "done",
          title: queueItem.keyword,
          slug: articleSlug,
          articleId,
        });
      } catch (err) {
        send({
          step: "error",
          status: "error",
          error: err instanceof Error ? err.message : "Pipeline error",
        });
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
