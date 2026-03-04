import fs from "fs";
import path from "path";
import matter from "gray-matter";

const PAGES_DIR = path.join(process.cwd(), "content/pages");
const ARTICLES_DIR = path.join(process.cwd(), "content/articles");

export interface PageContent {
  frontmatter: Record<string, unknown>;
  content: string;
}

export interface ArticleMeta {
  slug: string;
  title: string;
  date: string;
  category: string;
  type: string;
  rating?: number;
  meta_description?: string;
  author?: string;
  tags?: string[];
  image?: string;
}

export interface ArticleContent extends ArticleMeta {
  content: string;
}

export function getPageContent(slug: string): PageContent | null {
  try {
    const filePath = path.join(PAGES_DIR, `${slug}.mdx`);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    return { frontmatter: data, content };
  } catch {
    return null;
  }
}

export function getArticleBySlug(slug: string): ArticleContent | null {
  try {
    const filePath = path.join(ARTICLES_DIR, `${slug}.mdx`);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    return {
      slug,
      title: data.title ?? "",
      date: data.date ?? "",
      category: data.category ?? "",
      type: data.type ?? "article",
      rating: data.rating,
      meta_description: data.meta_description,
      author: data.author,
      tags: data.tags,
      image: data.image,
      content,
    };
  } catch {
    return null;
  }
}

export function getAllArticles(): ArticleMeta[] {
  try {
    if (!fs.existsSync(ARTICLES_DIR)) return [];
    const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".mdx"));
    return files
      .map((file) => {
        const slug = file.replace(/\.mdx$/, "");
        const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf-8");
        const { data } = matter(raw);
        return {
          slug,
          title: data.title ?? "",
          date: data.date ?? "",
          category: data.category ?? "",
          type: data.type ?? "article",
          rating: data.rating,
          meta_description: data.meta_description,
          author: data.author,
          tags: data.tags,
          image: data.image,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export function getAllPageSlugs(): string[] {
  try {
    if (!fs.existsSync(PAGES_DIR)) return [];
    return fs
      .readdirSync(PAGES_DIR)
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => f.replace(/\.mdx$/, ""));
  } catch {
    return [];
  }
}
