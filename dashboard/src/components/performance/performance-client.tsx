"use client";

import type { Prompt, WeeklyAnalysis } from "@/lib/types/database";
import { CHART_COLORS } from "@/lib/constants";
import { formatNumber, formatCurrency, formatDate } from "@/lib/utils";
import { LineChart } from "@/components/charts/line-chart";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type TopArticle = {
  pageviews: number;
  revenue: number;
  clicks: number;
  article?: {
    id: string;
    title: string;
    site_id: string;
    type: string;
    sites: { name: string } | null;
  };
};

type WeeklyAnalysisWithSite = WeeklyAnalysis & {
  sites: { name: string } | null;
};

type PerformanceClientProps = {
  crossSiteData: Record<string, unknown>[];
  siteNames: string[];
  weeklyAnalysis: WeeklyAnalysisWithSite[];
  topArticles: TopArticle[];
  bestPrompts: Prompt[];
};

function renderJsonField(data: Record<string, unknown> | null): React.ReactNode {
  if (!data) return <span className="text-muted-foreground">--</span>;

  if (Array.isArray(data)) {
    return (
      <ul className="list-disc pl-4 space-y-1">
        {data.map((item, i) => (
          <li key={i} className="text-sm">
            {typeof item === "string" ? item : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="list-disc pl-4 space-y-1">
      {Object.entries(data).map(([key, value]) => (
        <li key={key} className="text-sm">
          <span className="font-medium">{key}:</span>{" "}
          {typeof value === "string"
            ? value
            : Array.isArray(value)
              ? value.join(", ")
              : JSON.stringify(value)}
        </li>
      ))}
    </ul>
  );
}

export function PerformanceClient({
  crossSiteData,
  siteNames,
  weeklyAnalysis,
  topArticles,
  bestPrompts,
}: PerformanceClientProps) {
  const lines = siteNames.map((name, i) => ({
    key: name,
    label: name,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Multi-site comparison chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cross-Site Pageviews (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {crossSiteData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No metrics data available yet.
            </p>
          ) : (
            <LineChart
              data={crossSiteData}
              xKey="date"
              lines={lines}
              height={350}
              formatValue={formatNumber}
            />
          )}
        </CardContent>
      </Card>

      {/* Weekly Analysis */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Weekly Analysis</h2>
        {weeklyAnalysis.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                No weekly analysis available yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {weeklyAnalysis.map((wa) => (
              <Card key={wa.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {wa.sites?.name ?? "Unknown Site"}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      Week of {formatDate(wa.week_start)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Articles:</span>{" "}
                      <span className="font-mono">
                        {wa.articles_published ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pageviews:</span>{" "}
                      <span className="font-mono">
                        {formatNumber(wa.total_pageviews ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Clicks:</span>{" "}
                      <span className="font-mono">
                        {formatNumber(wa.total_affiliate_clicks ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Revenue:</span>{" "}
                      <span className="font-mono">
                        {formatCurrency(wa.total_revenue ?? 0)}
                      </span>
                    </div>
                  </div>

                  {wa.top_patterns && (
                    <div>
                      <p className="text-sm font-medium mb-1">Top Patterns</p>
                      {renderJsonField(wa.top_patterns)}
                    </div>
                  )}

                  {wa.prompt_suggestions && (
                    <div>
                      <p className="text-sm font-medium mb-1">
                        Prompt Suggestions
                      </p>
                      {renderJsonField(wa.prompt_suggestions)}
                    </div>
                  )}

                  {wa.next_week_priorities && (
                    <div>
                      <p className="text-sm font-medium mb-1">
                        Next Week Priorities
                      </p>
                      {renderJsonField(wa.next_week_priorities)}
                    </div>
                  )}

                  {wa.social_insights && (
                    <div>
                      <p className="text-sm font-medium mb-1">
                        Social Insights
                      </p>
                      {renderJsonField(wa.social_insights)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Top 10 Articles */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Articles (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {topArticles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No article data available yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Pageviews</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topArticles.map((item, i) => (
                  <TableRow key={item.article?.id ?? i}>
                    <TableCell className="max-w-xs truncate font-medium">
                      {item.article?.title ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      {item.article?.sites?.name ?? "--"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.article?.type ?? "--"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(item.pageviews)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.revenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(item.clicks)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Best Prompts */}
      <Card>
        <CardHeader>
          <CardTitle>Best Prompts</CardTitle>
        </CardHeader>
        <CardContent>
          {bestPrompts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No prompt performance data available yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Articles</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bestPrompts.map((prompt) => (
                  <TableRow key={prompt.id}>
                    <TableCell className="font-medium">
                      {prompt.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{prompt.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{prompt.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(prompt.articles_generated)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {prompt.avg_performance_score?.toFixed(1) ?? "--"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
