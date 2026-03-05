import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleBySlug, getAllArticles } from "@/lib/articles";
import { ArticleLayout } from "@/components/content/ArticleLayout";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import { buildMetadata } from "@/components/seo/OpenGraph";
import config from "@/lib/config";

export function generateStaticParams() {
  const articles = getAllArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  return buildMetadata({
    title: article.title,
    description: article.meta_description,
    path: `/article/${slug}`,
    type: "article",
    publishedTime: article.date,
    author: article.author,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": article.type === "review" ? "Review" : "Article",
    headline: article.title,
    datePublished: article.date,
    author: {
      "@type": "Person",
      name: article.author ?? config.name,
    },
    publisher: {
      "@type": "Organization",
      name: config.name,
      url: `https://${config.domain}`,
    },
    description: article.meta_description,
    ...(article.type === "review" && article.rating
      ? {
          reviewRating: {
            "@type": "Rating",
            ratingValue: article.rating,
            bestRating: 10,
          },
        }
      : {}),
  };

  return (
    <>
      <SchemaOrg schema={articleSchema} />
      <ArticleLayout article={article} />
    </>
  );
}
