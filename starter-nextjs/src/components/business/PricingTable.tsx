import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Check } from "lucide-react";

interface Plan {
  name: string;
  price: string;
  features: string[];
  cta_slug?: string;
  highlighted?: boolean;
}

interface PricingTableProps {
  plans: Plan[];
}

export function PricingTable({ plans }: PricingTableProps) {
  if (!plans || plans.length === 0) return null;

  return (
    <div className="my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <Card
          key={plan.name}
          className={`relative ${
            plan.highlighted
              ? "border-[var(--color-brand-primary)] shadow-md"
              : ""
          }`}
        >
          {plan.highlighted && (
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              Recommandé
            </div>
          )}
          <CardHeader className="text-center">
            <h4 className="text-lg font-semibold">{plan.name}</h4>
            <p className="text-3xl font-bold">{plan.price}</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {plan.cta_slug && (
              <Button
                asChild
                className="mt-6 w-full"
                variant={plan.highlighted ? "default" : "outline"}
              >
                <Link href={`/go/${plan.cta_slug}`} rel="nofollow sponsored" target="_blank">
                  Choisir {plan.name}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
