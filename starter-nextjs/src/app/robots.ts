import type { MetadataRoute } from "next";
import config from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = `https://${config.domain}`;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/go/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
