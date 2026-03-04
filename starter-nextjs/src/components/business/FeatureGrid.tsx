interface Feature {
  icon?: string;
  title: string;
  description: string;
}

interface FeatureGridProps {
  features: Feature[];
  columns?: 2 | 3 | 4;
}

const columnClasses = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function FeatureGrid({ features, columns = 3 }: FeatureGridProps) {
  if (!features || features.length === 0) return null;

  return (
    <div className={`my-8 grid gap-6 ${columnClasses[columns]}`}>
      {features.map((feature, i) => (
        <div
          key={i}
          className="rounded-lg border border-border/50 bg-card p-5 transition-shadow hover:shadow-sm"
        >
          {feature.icon && (
            <div className="mb-3 text-2xl">{feature.icon}</div>
          )}
          <h4 className="font-semibold">{feature.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  );
}
