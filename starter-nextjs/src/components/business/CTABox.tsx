import Link from "next/link";
import { Button } from "@/components/ui/button";

interface CTABoxProps {
  title: string;
  description?: string;
  slug: string;
  variant?: "default" | "highlight" | "minimal";
}

export function CTABox({ title, description, slug, variant = "default" }: CTABoxProps) {
  const isHighlight = variant === "highlight";
  const isMinimal = variant === "minimal";

  if (isMinimal) {
    return (
      <div className="my-4 flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-4">
        <div>
          <p className="font-medium">{title}</p>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <Button asChild size="sm">
          <Link href={`/go/${slug}`} rel="nofollow sponsored" target="_blank">
            Visiter
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`my-6 rounded-lg border p-6 text-center ${
        isHighlight
          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5"
          : "border-border bg-card"
      }`}
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
      <Button asChild className="mt-4" size="lg">
        <Link href={`/go/${slug}`} rel="nofollow sponsored" target="_blank">
          Profiter de l&apos;offre
        </Link>
      </Button>
    </div>
  );
}
