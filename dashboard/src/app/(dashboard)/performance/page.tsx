import { createClient } from "@/lib/supabase/server";
import {
  getCrossSiteComparison,
  getLatestWeeklyAnalysis,
  getTopArticlesCrossSite,
  getBestPrompts,
} from "@/lib/queries/performance";
import { PerformanceClient } from "@/components/performance/performance-client";

export default async function PerformancePage() {
  const supabase = await createClient();

  const [crossSiteResult, weeklyAnalysis, topArticles, bestPrompts] =
    await Promise.all([
      getCrossSiteComparison(supabase),
      getLatestWeeklyAnalysis(supabase),
      getTopArticlesCrossSite(supabase),
      getBestPrompts(supabase),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Performance</h1>
      <PerformanceClient
        crossSiteData={crossSiteResult.data}
        siteNames={crossSiteResult.siteNames}
        weeklyAnalysis={weeklyAnalysis}
        topArticles={topArticles as any}
        bestPrompts={bestPrompts}
      />
    </div>
  );
}
