import { getAllProducts, getProductsByCategory } from "@/lib/products";
import { BonusCard } from "./BonusCard";

interface BonusGridProps {
  category?: string;
  max?: number;
  slugs?: string[];
}

export function BonusGrid({ category, max, slugs }: BonusGridProps) {
  let products = slugs
    ? slugs.map((s) => getAllProducts().find((p) => p.slug === s)).filter(Boolean)
    : category
      ? getProductsByCategory(category)
      : getAllProducts();

  if (max) {
    products = products.slice(0, max);
  }

  if (products.length === 0) return null;

  return (
    <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product, i) => (
        <BonusCard
          key={product!.slug}
          slug={product!.slug}
          highlight={i === 0}
        />
      ))}
    </div>
  );
}
