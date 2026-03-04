import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getProduct } from "@/lib/products";

interface BonusCardProps {
  slug: string;
  highlight?: boolean;
}

export function BonusCard({ slug, highlight = false }: BonusCardProps) {
  const product = getProduct(slug);
  if (!product) return null;

  return (
    <Card
      className={`transition-shadow hover:shadow-md ${
        highlight ? "border-[var(--color-brand-primary)] shadow-sm" : ""
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-bold">
            {product.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.category}</p>
          </div>
        </div>
        <p
          className="text-xl font-bold"
          style={{ color: "var(--color-brand-primary)" }}
        >
          {product.bonus}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {product.bonus_conditions}
        </p>
        <Button asChild className="mt-4 w-full" size="sm">
          <Link href={`/go/${product.affiliate_slug}`} rel="nofollow sponsored" target="_blank">
            Profiter du bonus
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
