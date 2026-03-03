import { SupabaseClient } from "@supabase/supabase-js";
import type { WeeklyAnalysis } from "@/lib/types/database";
import { format, subDays } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function getCrossSiteComparison(supabase: Client, days = 30) {
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");

  const [metricsRes, sitesRes] = await Promise.all([
    supabase
      .from("metrics")
      .select("site_id, date, pageviews")
      .gte("date", since)
      .order("date", { ascending: true }),
    supabase.from("sites").select("id, name").eq("active", true),
  ]);

  if (metricsRes.error) throw metricsRes.error;
  if (sitesRes.error) throw sitesRes.error;

  const siteNames = new Map(sitesRes.data.map((s) => [s.id, s.name]));

  // Aggregate by date+site
  const byDateSite = new Map<string, Record<string, number>>();
  for (const m of metricsRes.data) {
    const siteName = siteNames.get(m.site_id) ?? m.site_id;
    const existing = byDateSite.get(m.date) ?? {};
    existing[siteName] = (existing[siteName] ?? 0) + m.pageviews;
    byDateSite.set(m.date, existing);
  }

  return {
    data: Array.from(byDateSite.entries()).map(([date, sites]) => ({ date, ...sites })),
    siteNames: Array.from(siteNames.values()),
  };
}

export async function getLatestWeeklyAnalysis(supabase: Client) {
  const { data, error } = await supabase
    .from("weekly_analysis")
    .select("*, sites(name)")
    .order("week_start", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data as (WeeklyAnalysis & { sites: { name: string } | null })[];
}

export async function getTopArticlesCrossSite(supabase: Client, days = 30, limit = 10) {
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("metrics")
    .select("article_id, pageviews, revenue, affiliate_clicks")
    .gte("date", since);
  if (error) throw error;

  // Aggregate by article
  const byArticle = new Map<string, { pageviews: number; revenue: number; clicks: number }>();
  for (const m of data) {
    const existing = byArticle.get(m.article_id);
    if (existing) {
      existing.pageviews += m.pageviews;
      existing.revenue += m.revenue;
      existing.clicks += m.affiliate_clicks;
    } else {
      byArticle.set(m.article_id, {
        pageviews: m.pageviews,
        revenue: m.revenue,
        clicks: m.affiliate_clicks,
      });
    }
  }

  const sorted = Array.from(byArticle.entries())
    .sort((a, b) => b[1].pageviews - a[1].pageviews)
    .slice(0, limit);

  // Fetch article details
  const articleIds = sorted.map(([id]) => id);
  if (articleIds.length === 0) return [];

  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, site_id, type, sites(name)")
    .in("id", articleIds);

  const articleMap = new Map((articles ?? []).map((a) => [a.id, a]));

  return sorted.map(([id, stats]) => ({
    ...stats,
    article: articleMap.get(id),
  }));
}

export async function getBestPrompts(supabase: Client) {
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .gt("articles_generated", 0)
    .order("avg_performance_score", { ascending: false, nullsFirst: false })
    .limit(10);
  if (error) throw error;
  return data;
}
