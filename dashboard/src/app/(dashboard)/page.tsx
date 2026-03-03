import { createClient } from "@/lib/supabase/server";
import { getOverviewStats, getSiteMetrics } from "@/lib/queries/metrics";
import { getLatestArticles } from "@/lib/queries/articles";
import { getAllSites } from "@/lib/queries/sites";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentArticles } from "@/components/dashboard/recent-articles";
import { OverviewCharts } from "@/components/dashboard/overview-charts";
import { Activity, FileText, Eye, DollarSign } from "lucide-react";

export default async function OverviewPage() {
  const supabase = await createClient();
  const [stats, articles, sites] = await Promise.all([
    getOverviewStats(supabase, 30),
    getLatestArticles(supabase, 5),
    getAllSites(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Sites"
          value={stats.activeSites}
          icon={Activity}
        />
        <StatCard
          title="Articles Today"
          value={stats.articlesToday}
          icon={FileText}
        />
        <StatCard
          title="7d Traffic"
          value={stats.traffic7d}
          format="number"
          icon={Eye}
        />
        <StatCard
          title="30d Revenue"
          value={stats.revenue30d}
          format="currency"
          icon={DollarSign}
        />
      </div>
      <OverviewCharts data={stats.dailyMetrics} />
      <RecentArticles articles={articles} sites={sites} />
    </div>
  );
}
