import { createClient } from "@/lib/supabase/server";
import { getSiteById } from "@/lib/queries/sites";
import { getSiteMetrics, getSiteTopArticles } from "@/lib/queries/metrics";
import { getQueue } from "@/lib/queries/queue";
import { getSocialPosts } from "@/lib/queries/social";
import { SiteDetailClient } from "@/components/sites/site-detail-client";
import { Badge } from "@/components/ui/badge";
import { SiteActions } from "@/components/sites/site-actions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SiteDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  let site;
  try {
    site = await getSiteById(supabase, id);
  } catch {
    notFound();
  }

  const [siteMetrics, topArticlesData, queue, socialPosts] = await Promise.all([
    getSiteMetrics(supabase, id, 30).catch(() => []),
    getSiteTopArticles(supabase, id, 30, 5).catch(() => ({ top: [], flop: [] })),
    getQueue(supabase, id).catch(() => []),
    getSocialPosts(supabase, id, 20).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/sites">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{site.name}</h1>
              <Badge
                variant="secondary"
                className={
                  site.active
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                }
              >
                {site.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            {site.domain && (
              <a
                href={`https://${site.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {site.domain}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <SiteActions site={site} />
      </div>

      {/* Client interactive content */}
      <SiteDetailClient
        site={site}
        queue={queue}
        socialPosts={socialPosts}
        siteMetrics={siteMetrics}
        topArticles={topArticlesData.top}
        flopArticles={topArticlesData.flop}
      />
    </div>
  );
}
