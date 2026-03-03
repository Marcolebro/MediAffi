"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "@/components/charts/line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DailyMetric } from "@/lib/queries/metrics";

type Props = {
  data: DailyMetric[];
};

export function OverviewCharts({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    date: formatDate(d.date, "MMM d"),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Traffic (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            data={chartData}
            xKey="date"
            lines={[{ key: "pageviews", label: "Pageviews" }]}
            height={250}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Revenue (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={chartData}
            xKey="date"
            bars={[{ key: "revenue", label: "Revenue" }]}
            height={250}
            formatValue={(v) => formatCurrency(v)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
