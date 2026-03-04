import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import config, { getSiteColorStyle } from "@/lib/config";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import adsConfig from "../../site-data/ads.json";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: `${config.name} — ${config.tagline}`,
    template: `%s | ${config.name}`,
  },
  description: config.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang={config.language}
      suppressHydrationWarning
      style={getSiteColorStyle()}
    >
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme={config.style === "dark" ? "dark" : "system"}
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>

        {/* Schema.org WebSite */}
        <SchemaOrg
          schema={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: config.name,
            url: `https://${config.domain}`,
            description: config.description,
          }}
        />

        {/* Plausible Analytics */}
        {config.analytics?.plausible_domain && (
          <script
            defer
            data-domain={config.analytics.plausible_domain}
            src="https://plausible.io/js/script.js"
          />
        )}

        {/* AdSense */}
        {adsConfig.adsense_id && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsConfig.adsense_id}`}
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}
