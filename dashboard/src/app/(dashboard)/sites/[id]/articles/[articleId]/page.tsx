import { createClient } from "@/lib/supabase/server";
import { getArticleDetail } from "@/lib/queries/articles";
import { getArticleMetrics } from "@/lib/queries/metrics";
import { getArticleSocialPosts } from "@/lib/queries/social";
import { ArticleDetailClient } from "@/components/articles/article-detail";

type Props = {
  params: Promise<{ id: string; articleId: string }>;
};

export default async function ArticleDetailPage({ params }: Props) {
  const supabase = await createClient();
  const { id: siteId, articleId } = await params;

  const [article, metrics, socialPosts] = await Promise.all([
    getArticleDetail(supabase, articleId),
    getArticleMetrics(supabase, articleId, 30),
    getArticleSocialPosts(supabase, articleId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <a
            href={`/sites/${siteId}/articles`}
            className="hover:underline"
          >
            Articles
          </a>
          {" / "}
          {article.title}
        </p>
      </div>
      <ArticleDetailClient
        article={article}
        metrics={metrics}
        socialPosts={socialPosts}
      />
    </div>
  );
}
