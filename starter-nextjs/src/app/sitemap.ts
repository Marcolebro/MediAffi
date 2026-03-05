import type { MetadataRoute } from "next";
import config from "@/lib/config";
import { getAllArticles } from "@/lib/articles";
import pagesConfig from "../../site-data/pages-config.json";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = `https://${config.domain}`;

  const pages: MetadataRoute.Sitemap = pagesConfig.pages.map((page) => ({
    url: page.slug === "homepage" ? baseUrl : `${baseUrl}/${page.slug}`,
    lastModified: new Date(),
    changeFrequency: page.priority >= 0.8 ? "weekly" : "monthly",
    priority: page.priority,
  }));

  const articles: MetadataRoute.Sitemap = getAllArticles().map((article) => ({
    url: `${baseUrl}/article/${article.slug}`,
    lastModified: article.date ? new Date(article.date) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...pages, ...articles];
}
