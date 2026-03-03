import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { ExternalLink, Eye, FileText } from "lucide-react";
import type { Site } from "@/lib/types/database";

type SiteCardProps = {
  site: Site;
  articleCount?: number;
  pageviews7d?: number;
};

export function SiteCard({ site, articleCount = 0, pageviews7d = 0 }: SiteCardProps) {
  return (
    <Link href={`/sites/${site.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold leading-none">{site.name}</h3>
              {site.domain && (
                <a
                  href={`https://${site.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  {site.domain}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Badge
              variant="secondary"
              className={cn(
                site.active
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
              )}
            >
              {site.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge variant="outline" className="text-xs">
            {site.niche}
          </Badge>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              <span className="font-mono font-medium">{formatNumber(pageviews7d)}</span>
              <span className="text-xs">7d</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span className="font-mono font-medium">{formatNumber(articleCount)}</span>
              <span className="text-xs">articles</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
