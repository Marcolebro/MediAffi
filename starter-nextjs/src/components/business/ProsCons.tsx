import { Check, X } from "lucide-react";
import { getProduct } from "@/lib/products";

interface ProsConsProps {
  slug?: string;
  pros?: string[];
  cons?: string[];
}

export function ProsCons({ slug, pros, cons }: ProsConsProps) {
  let prosItems = pros;
  let consItems = cons;

  if (slug && (!prosItems || !consItems)) {
    const product = getProduct(slug);
    if (product) {
      prosItems = prosItems ?? product.pros;
      consItems = consItems ?? product.cons;
    }
  }

  if ((!prosItems || prosItems.length === 0) && (!consItems || consItems.length === 0)) {
    return null;
  }

  return (
    <div className="my-6 grid gap-4 sm:grid-cols-2">
      {prosItems && prosItems.length > 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h4 className="mb-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            Avantages
          </h4>
          <ul className="space-y-2">
            {prosItems.map((pro, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{pro}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {consItems && consItems.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <h4 className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400">
            Inconvénients
          </h4>
          <ul className="space-y-2">
            {consItems.map((con, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <span>{con}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
