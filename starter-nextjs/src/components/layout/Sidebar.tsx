import Link from "next/link";
import type { ArticleMeta } from "@/lib/articles";

interface SidebarProps {
  popularArticles?: ArticleMeta[];
}

export function Sidebar({ popularArticles }: SidebarProps) {
  return (
    <aside className="space-y-6">
      {/* Popular articles */}
      {popularArticles && popularArticles.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Articles populaires
          </h3>
          <ul className="space-y-2">
            {popularArticles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/article/${article.slug}`}
                  className="text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA placeholder */}
      <div className="rounded-lg border border-border/50 bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Espace publicitaire
        </p>
      </div>
    </aside>
  );
}
