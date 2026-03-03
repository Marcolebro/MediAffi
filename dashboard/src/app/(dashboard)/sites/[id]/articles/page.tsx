import { createClient } from "@/lib/supabase/server";
import { getArticles } from "@/lib/queries/articles";
import { getSiteById } from "@/lib/queries/sites";
import { ArticlesClient } from "@/components/articles/articles-table";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; status?: string; page?: string }>;
};

export default async function ArticlesPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const { id: siteId } = await params;
  const { type, status, page } = await searchParams;

  const currentPage = page ? parseInt(page, 10) : 1;

  const [{ articles, total }, site] = await Promise.all([
    getArticles(supabase, siteId, {
      type: type || undefined,
      status: status || undefined,
      page: currentPage,
      perPage: 25,
    }),
    getSiteById(supabase, siteId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Sites / {site.name}
        </p>
        <h1 className="text-2xl font-bold">Articles</h1>
      </div>
      <ArticlesClient
        articles={articles}
        siteId={siteId}
        total={total}
        filters={{
          type: type || undefined,
          status: status || undefined,
          page: currentPage,
        }}
      />
    </div>
  );
}
