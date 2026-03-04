interface Step {
  title: string;
  description: string;
}

interface StepGuideProps {
  steps: Step[];
}

export function StepGuide({ steps }: StepGuideProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="my-8 space-y-0">
      {steps.map((step, i) => (
        <div key={i} className="relative flex gap-4 pb-8 last:pb-0">
          {/* Connecting line */}
          {i < steps.length - 1 && (
            <div
              className="absolute left-5 top-10 w-0.5 bg-border"
              style={{ height: "calc(100% - 2rem)" }}
            />
          )}
          {/* Step number */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            {i + 1}
          </div>
          {/* Content */}
          <div className="pt-1.5">
            <h4 className="font-semibold">{step.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
