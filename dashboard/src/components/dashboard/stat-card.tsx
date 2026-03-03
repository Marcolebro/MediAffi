import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: number;
  format?: "number" | "currency" | "raw";
  change?: number;
  icon?: LucideIcon;
};

export function StatCard({ title, value, format = "raw", change, icon: Icon }: StatCardProps) {
  const formattedValue =
    format === "currency"
      ? formatCurrency(value)
      : format === "number"
        ? formatNumber(value)
        : value.toLocaleString();

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{title}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="mt-2 font-mono text-2xl font-bold">{formattedValue}</p>
        {change !== undefined && (
          <p
            className={`mt-1 font-mono text-xs ${
              change >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
