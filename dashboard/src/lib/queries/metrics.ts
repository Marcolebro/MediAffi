import { SupabaseClient } from "@supabase/supabase-js";
import type { Metric } from "@/lib/types/database";
import { format, subDays } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export type DailyMetric = {
  date: string;
  pageviews: number;
  revenue: number;
  affiliate_clicks: number;
};

export type OverviewStats = {
  activeSites: number;
  articlesToday: number;
  traffic7d: number;
  revenue30d: number;
  dailyMetrics: DailyMetric[];
};

export async function getOverviewStats(supabase: Client, days = 30): Promise<OverviewStats> {
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [sitesRes, todayArticlesRes, metricsRes] = await Promise.all([
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("active", true),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00`),
    supabase
      .from("metrics")
      .select("date, pageviews, revenue, affiliate_clicks")
      .gte("date", since)
      .order("date", { ascending: true }),
  ]);

  const metrics = (metricsRes.data ?? []) as Pick<Metric, "date" | "pageviews" | "revenue" | "affiliate_clicks">[];

  // Aggregate by date
  const byDate = new Map<string, DailyMetric>();
  for (const m of metrics) {
    const existing = byDate.get(m.date);
    if (existing) {
      existing.pageviews += m.pageviews;
      existing.revenue += m.revenue;
      existing.affiliate_clicks += m.affiliate_clicks;
    } else {
      byDate.set(m.date, {
        date: m.date,
        pageviews: m.pageviews,
        revenue: m.revenue,
        affiliate_clicks: m.affiliate_clicks,
      });
    }
  }

  const dailyMetrics = Array.from(byDate.values());
  const since7d = format(subDays(new Date(), 7), "yyyy-MM-dd");

  return {
    activeSites: sitesRes.count ?? 0,
    articlesToday: todayArticlesRes.count ?? 0,
    traffic7d: dailyMetrics
      .filter((m) => m.date >= since7d)
      .reduce((sum, m) => sum + m.pageviews, 0),
    revenue30d: dailyMetrics.reduce((sum, m) => sum + m.revenue, 0),
    dailyMetrics,
  };
}

export async function getSiteMetrics(supabase: Client, siteId: string, days = 30) {
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("metrics")
    .select("*")
    .eq("site_id", siteId)
    .gte("date", since)
    .order("date", { ascending: true });
  if (error) throw error;

  // Aggregate by date
  const byDate = new Map<string, DailyMetric>();
  for (const m of data as Metric[]) {
    const existing = byDate.get(m.date);
    if (existing) {
      existing.pageviews += m.pageviews;
      existing.revenue += m.revenue;
      existing.affiliate_clicks += m.affiliate_clicks;
    } else {
      byDate.set(m.date, {
        date: m.date,
        pageviews: m.pageviews,
        revenue: m.revenue,
        affiliate_clicks: m.affiliate_clicks,
      });
    }
  }
  return Array.from(byDate.values());
}

export async function getArticleMetrics(supabase: Client, articleId: string, days = 30) {
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("metrics")
    .select("*")
    .eq("article_id", articleId)
    .gte("date", since)
    .order("date", { ascending: true });
  if (error) throw error;
  return data as Metric[];
}

export async function getSiteTopArticles(supabase: Client, siteId: string, days = 30, limit = 5) {
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("metrics")
    .select("article_id, pageviews, revenue, affiliate_clicks")
    .eq("site_id", siteId)
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
    .sort((a, b) => b[1].pageviews - a[1].pageviews);

  return {
    top: sorted.slice(0, limit).map(([id, stats]) => ({ article_id: id, ...stats })),
    flop: sorted.slice(-limit).reverse().map(([id, stats]) => ({ article_id: id, ...stats })),
  };
}
