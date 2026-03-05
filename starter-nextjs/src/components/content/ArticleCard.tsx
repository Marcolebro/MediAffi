import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ArticleMeta } from "@/lib/articles";

interface ArticleCardProps {
  article: ArticleMeta;
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        {/* Image placeholder */}
        <div className="mb-3 aspect-video rounded-md bg-muted" />

        <div className="flex items-center gap-2">
          {article.category && (
            <Badge variant="secondary" className="text-[10px]">
              {article.category}
            </Badge>
          )}
          {article.date && (
            <span className="text-xs text-muted-foreground">
              {new Date(article.date).toLocaleDateString("fr-FR", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>

        <Link href={`/article/${article.slug}`} className="block">
          <h3 className="mt-2 font-semibold transition-colors group-hover:text-foreground/80">
            {article.title}
          </h3>
        </Link>

        {article.meta_description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
            {article.meta_description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
