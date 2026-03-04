import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProductsForRanking, getRanking } from "@/lib/products";
import { Rating } from "./Rating";

interface RankingTableProps {
  id: string;
}

export function RankingTable({ id }: RankingTableProps) {
  const ranking = getRanking(id);
  if (!ranking) return null;

  const products = getProductsForRanking(id);
  if (products.length === 0) return null;

  return (
    <div className="my-8">
      <h3 className="mb-2 text-xl font-semibold">{ranking.title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{ranking.description}</p>

      {/* Desktop table */}
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Casino</TableHead>
              <TableHead>Bonus</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product, i) => (
              <TableRow key={product.slug}>
                <TableCell className="font-bold text-muted-foreground">
                  {i + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-bold">
                      {product.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.badge && (
                        <Badge variant="secondary" className="mt-0.5 text-[10px]">
                          {product.badge}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-semibold" style={{ color: "var(--color-brand-primary)" }}>
                    {product.bonus}
                  </p>
                </TableCell>
                <TableCell>
                  <Rating value={product.rating} size="sm" />
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm">
                    <Link
                      href={`/go/${product.affiliate_slug}`}
                      rel="nofollow sponsored"
                      target="_blank"
                    >
                      Visiter
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {products.map((product, i) => (
          <div
            key={product.slug}
            className="rounded-lg border border-border/50 bg-card p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-muted-foreground">
                  #{i + 1}
                </span>
                <div>
                  <p className="font-semibold">{product.name}</p>
                  {product.badge && (
                    <Badge variant="secondary" className="mt-0.5 text-[10px]">
                      {product.badge}
                    </Badge>
                  )}
                </div>
              </div>
              <Rating value={product.rating} size="sm" />
            </div>
            <p
              className="mt-2 text-lg font-bold"
              style={{ color: "var(--color-brand-primary)" }}
            >
              {product.bonus}
            </p>
            <Button asChild className="mt-3 w-full" size="sm">
              <Link
                href={`/go/${product.affiliate_slug}`}
                rel="nofollow sponsored"
                target="_blank"
              >
                Visiter {product.name}
              </Link>
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Dernière mise à jour : {new Date(ranking.last_updated).toLocaleDateString("fr-FR")}
      </p>
    </div>
  );
}
