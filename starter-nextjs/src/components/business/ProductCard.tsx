import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getProduct } from "@/lib/products";
import { Rating } from "./Rating";

interface ProductCardProps {
  slug: string;
  variant?: "compact" | "detailed";
}

export function ProductCard({ slug, variant = "compact" }: ProductCardProps) {
  const product = getProduct(slug);
  if (!product) return null;

  if (variant === "compact") {
    return (
      <div className="my-3 flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-bold">
            {product.name.charAt(0)}
          </div>
          <div>
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground">{product.bonus}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Rating value={product.rating} size="sm" />
          <Button asChild size="sm">
            <Link href={`/go/${product.affiliate_slug}`} rel="nofollow sponsored" target="_blank">
              Visiter
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="my-6">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-lg font-bold">
              {product.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{product.name}</h3>
              {product.badge && (
                <Badge variant="secondary" className="mt-1">
                  {product.badge}
                </Badge>
              )}
            </div>
          </div>
          <Rating value={product.rating} size="md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{product.description}</p>

        {/* Bonus */}
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-lg font-bold" style={{ color: "var(--color-brand-primary)" }}>
            {product.bonus}
          </p>
          <p className="text-xs text-muted-foreground">{product.bonus_conditions}</p>
        </div>

        {/* Pros & Cons */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">Avantages</p>
            <ul className="space-y-1">
              {product.pros.map((pro, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-red-600 dark:text-red-400">Inconvénients</p>
            <ul className="space-y-1">
              {product.cons.map((con, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {Object.entries(product.features).map(([key, val]) => (
            <div key={key} className="rounded bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground capitalize">{key}</p>
              <p className="font-medium">{val}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="pt-2">
          <Button asChild className="w-full" size="lg">
            <Link href={`/go/${product.affiliate_slug}`} rel="nofollow sponsored" target="_blank">
              Visiter {product.name}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
