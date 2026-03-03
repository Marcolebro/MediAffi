import productsData from "../../site-data/products.json";
import rankingsData from "../../site-data/rankings.json";

export interface Product {
  slug: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  image: string;
  bonus: string;
  bonus_conditions: string;
  price: string;
  pros: string[];
  cons: string[];
  affiliate_slug: string;
  affiliate_url: string;
  features: Record<string, string>;
  badge: string | null;
}

export interface Ranking {
  id: string;
  title: string;
  description: string;
  criteria: string[];
  products: string[];
  last_updated: string;
}

const products = (productsData as { products: Product[] }).products;
const rankings = (rankingsData as { rankings: Ranking[] }).rankings;

export function getProduct(slug: string): Product | null {
  return products.find((p) => p.slug === slug) ?? null;
}

export function getAllProducts(): Product[] {
  return products;
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter((p) => p.category === category);
}

export function getRanking(id: string): Ranking | null {
  return rankings.find((r) => r.id === id) ?? null;
}

export function getProductsForRanking(id: string): Product[] {
  const ranking = getRanking(id);
  if (!ranking) return [];
  return ranking.products
    .map((slug) => getProduct(slug))
    .filter((p): p is Product => p !== null);
}
