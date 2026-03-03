"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart } from "@/components/charts/line-chart";
import { formatDate, formatNumber, getStatusColor } from "@/lib/utils";
import type { Article, Metric, SocialPost } from "@/lib/types/database";

type Props = {
  article: Article;
  metrics: Metric[];
  socialPosts: SocialPost[];
};

export function ArticleDetailClient({ article, metrics, socialPosts }: Props) {
  const trafficChartData = metrics.map((m) => ({
    date: formatDate(m.date, "MMM d"),
    pageviews: m.pageviews,
    clicks: m.organic_clicks,
  }));

  const seoChartData = metrics.map((m) => ({
    date: formatDate(m.date, "MMM d"),
    position: m.google_position ?? 0,
    impressions: m.impressions,
    ctr: m.ctr != null ? Math.round(m.ctr * 100) / 100 : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{article.title}</h1>
          <Badge className={getStatusColor(article.status)}>
            {article.status}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="font-mono">
            {formatDate(article.created_at)}
          </span>
          {article.target_keyword && (
            <Badge variant="outline">{article.target_keyword}</Badge>
          )}
          {article.word_count != null && (
            <span className="font-mono">
              {formatNumber(article.word_count)} words
            </span>
          )}
          <Badge variant="outline">{article.type}</Badge>
        </div>
      </div>

      {/* Metrics charts */}
      {metrics.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Traffic chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Pageviews &amp; Clicks (30d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart
                data={trafficChartData}
                xKey="date"
                lines={[
                  { key: "pageviews", label: "Pageviews" },
                  { key: "clicks", label: "Organic Clicks" },
                ]}
                height={260}
                formatValue={(v) => formatNumber(v)}
              />
            </CardContent>
          </Card>

          {/* SEO chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                SEO Metrics (30d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart
                data={seoChartData}
                xKey="date"
                lines={[
                  { key: "position", label: "Google Position" },
                  { key: "impressions", label: "Impressions" },
                ]}
                height={260}
                formatValue={(v) => formatNumber(v)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Social posts */}
      {socialPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Social Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {socialPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="capitalize">
                      {post.platform}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {post.content
                        ? post.content.length > 100
                          ? `${post.content.slice(0, 100)}...`
                          : post.content
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(post.likes)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(post.clicks)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(post.reach)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(post.status)}>
                        {post.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Generation Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm text-muted-foreground">Prompt</dt>
              <dd className="mt-1 text-sm font-medium font-mono">
                {article.prompt_id ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Model</dt>
              <dd className="mt-1 text-sm font-medium font-mono">
                {article.model_used ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Git Commit</dt>
              <dd className="mt-1 text-sm font-medium font-mono">
                {article.git_commit
                  ? article.git_commit.slice(0, 7)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Generation Cost
              </dt>
              <dd className="mt-1 text-sm font-medium font-mono">
                {article.generation_cost != null
                  ? `$${article.generation_cost.toFixed(4)}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
