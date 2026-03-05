import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { Breadcrumb } from "@/components/seo/Breadcrumb";
import { TOC } from "./TOC";
import { Rating } from "@/components/business/Rating";
import { MDXRenderer } from "@/components/mdx/MDXRenderer";
import { getAllArticles, type ArticleContent } from "@/lib/articles";

interface ArticleLayoutProps {
  article: ArticleContent;
}

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function ArticleLayout({ article }: ArticleLayoutProps) {
  const readingTime = estimateReadingTime(article.content);
  const popularArticles = getAllArticles().slice(0, 5);

  const breadcrumbItems = [
    ...(article.category
      ? [{ label: article.category, href: `/${article.category}` }]
      : []),
    { label: article.title },
  ];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumb items={breadcrumbItems} />

        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-10">
          {/* Main content */}
          <article>
            <header className="mb-8">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {article.category && (
                  <Badge variant="secondary">{article.category}</Badge>
                )}
                {article.date && (
                  <span>
                    {new Date(article.date).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                )}
                <span>{readingTime} min de lecture</span>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                {article.title}
              </h1>

              {article.meta_description && (
                <p className="mt-3 text-lg text-muted-foreground">
                  {article.meta_description}
                </p>
              )}

              {article.rating && (
                <div className="mt-3">
                  <Rating value={article.rating} size="lg" />
                </div>
              )}

              {article.author && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Par {article.author}
                </p>
              )}
            </header>

            <Separator className="mb-8" />

            <MDXRenderer source={article.content} />

            {article.tags && article.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </article>

          {/* Sidebar with TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-6">
              <TOC source={article.content} />
              <Sidebar popularArticles={popularArticles} />
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
