import { getProduct } from "@/lib/products";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ComparisonTableProps {
  products: string[];
  criteria: string[];
}

export function ComparisonTable({ products: slugs, criteria }: ComparisonTableProps) {
  const products = slugs.map((s) => getProduct(s)).filter(Boolean);
  if (products.length === 0 || criteria.length === 0) return null;

  return (
    <div className="my-6 overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Critère</TableHead>
            {products.map((p) => (
              <TableHead key={p!.slug} className="text-center">
                {p!.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {criteria.map((criterion) => {
            // Check if any product has this criterion in features
            const values = products.map((p) => {
              const features = p!.features;
              // Try to match criterion to a feature key (case-insensitive)
              const key = Object.keys(features).find(
                (k) => k.toLowerCase() === criterion.toLowerCase()
              );
              return key ? features[key] : "—";
            });

            return (
              <TableRow key={criterion}>
                <TableCell className="font-medium">{criterion}</TableCell>
                {values.map((val, i) => (
                  <TableCell key={i} className="text-center text-sm">
                    {val}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {/* Bonus row */}
          <TableRow>
            <TableCell className="font-medium">Bonus</TableCell>
            {products.map((p) => (
              <TableCell
                key={p!.slug}
                className="text-center text-sm font-semibold"
                style={{ color: "var(--color-brand-primary)" }}
              >
                {p!.bonus}
              </TableCell>
            ))}
          </TableRow>
          {/* Rating row */}
          <TableRow>
            <TableCell className="font-medium">Note</TableCell>
            {products.map((p) => (
              <TableCell key={p!.slug} className="text-center text-sm font-semibold">
                {p!.rating}/10
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
