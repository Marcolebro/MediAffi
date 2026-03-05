import config from "@/lib/config";
import { getPageContent } from "@/lib/articles";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MDXRenderer } from "@/components/mdx/MDXRenderer";

export default function HomePage() {
  const page = getPageContent("homepage");

  return (
    <>
      <Header />
      <main className="min-h-screen">
        {page ? (
          <MDXRenderer source={page.content} />
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <h1
                className="text-4xl font-bold"
                style={{ color: "var(--color-brand-primary)" }}
              >
                {config.name}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                {config.tagline}
              </p>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
