import config from "@/lib/config";
import { getPageContent } from "@/lib/content";

export default function HomePage() {
  const page = getPageContent("homepage");

  return (
    <main className="min-h-screen">
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold" style={{ color: "var(--color-brand-primary)" }}>
            {config.name}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {config.tagline}
          </p>
          {page && (
            <p className="mt-2 text-sm text-muted-foreground">
              MDX content loaded successfully
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
