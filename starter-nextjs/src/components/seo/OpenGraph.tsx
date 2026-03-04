import type { Metadata } from "next";
import config from "@/lib/config";

interface BuildMetadataOptions {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
  author?: string;
}

export function buildMetadata({
  title,
  description,
  path = "",
  image,
  type = "website",
  publishedTime,
  author,
}: BuildMetadataOptions): Metadata {
  const url = `https://${config.domain}${path}`;
  const siteName = config.name;
  const desc = description ?? config.description;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url,
      siteName,
      type,
      ...(image && { images: [{ url: image, width: 1200, height: 630 }] }),
      ...(publishedTime && { publishedTime }),
      ...(author && { authors: [author] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      ...(image && { images: [image] }),
    },
    alternates: {
      canonical: url,
    },
  };
}
