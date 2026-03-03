import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageContent } from "@/lib/content";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MDXRenderer } from "@/components/mdx/MDXRenderer";
import pagesConfig from "../../../site-data/pages-config.json";

const pages = pagesConfig.pages.filter((p) => p.slug !== "homepage");

export function generateStaticParams() {
  return pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getPageContent(slug);
  if (!page) return {};

  const title = (page.frontmatter.title as string) ?? slug;
  const description = page.frontmatter.description as string | undefined;

  return {
    title,
    description,
  };
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getPageContent(slug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <MDXRenderer source={page.content} />
      </main>
      <Footer />
    </>
  );
}
