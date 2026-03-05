import { getAllArticles } from "@/lib/articles";
import { ArticleCard } from "./ArticleCard";

interface ArticleGridProps {
  limit?: number;
  category?: string;
}

export function ArticleGrid({ limit, category }: ArticleGridProps) {
  let articles = getAllArticles();

  if (category) {
    articles = articles.filter((a) => a.category === category);
  }

  if (limit) {
    articles = articles.slice(0, limit);
  }

  if (articles.length === 0) return null;

  return (
    <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </div>
  );
}
