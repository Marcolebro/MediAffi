import { createClient } from "@/lib/supabase/server";
import { getAllSites } from "@/lib/queries/sites";
import { getSiteArticleCount } from "@/lib/queries/articles";
import { getSiteMetrics } from "@/lib/queries/metrics";
import { SiteCard } from "@/components/sites/site-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function SitesPage() {
  const supabase = await createClient();
  const sites = await getAllSites(supabase).catch(() => []);

  const sitesWithStats = await Promise.all(
    sites.map(async (site) => {
      const [articleCount, metrics7d] = await Promise.all([
        getSiteArticleCount(supabase, site.id).catch(() => 0),
        getSiteMetrics(supabase, site.id, 7).catch(() => []),
      ]);
      const pageviews7d = metrics7d.reduce((sum, m) => sum + m.pageviews, 0);
      return { site, articleCount, pageviews7d };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sites</h1>
        <Link href="/sites/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create site
          </Button>
        </Link>
      </div>

      {sitesWithStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No sites yet.</p>
          <Link href="/sites/new" className="mt-4">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create your first site
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sitesWithStats.map(({ site, articleCount, pageviews7d }) => (
            <SiteCard
              key={site.id}
              site={site}
              articleCount={articleCount}
              pageviews7d={pageviews7d}
            />
          ))}
        </div>
      )}
    </div>
  );
}
