import Link from "next/link";
import { Button } from "@/components/ui/button";
import config from "@/lib/config";

interface HeroBannerProps {
  title?: string;
  subtitle?: string;
  cta?: { label: string; href: string };
  style?: "gradient" | "image" | "simple";
}

export function HeroBanner({
  title,
  subtitle,
  cta,
  style = "gradient",
}: HeroBannerProps) {
  const displayTitle = title ?? config.name;
  const displaySubtitle = subtitle ?? config.tagline;

  if (style === "simple") {
    return (
      <section className="py-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {displayTitle}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {displaySubtitle}
          </p>
          {cta && (
            <Button asChild className="mt-6" size="lg">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden py-20 text-center sm:py-28"
      style={{
        background: `linear-gradient(135deg, var(--color-brand-primary) 0%, var(--color-brand-secondary, var(--color-brand-primary)) 50%, var(--color-brand-accent, var(--color-brand-primary)) 100%)`,
      }}
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative mx-auto max-w-3xl px-4">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          {displayTitle}
        </h1>
        <p className="mt-4 text-lg text-white/80 sm:text-xl">
          {displaySubtitle}
        </p>
        {cta && (
          <Button
            asChild
            className="mt-8 bg-white text-gray-900 hover:bg-white/90"
            size="lg"
          >
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
