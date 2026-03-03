import type { MDXComponents } from "mdx/types";

// Stub component factory - renders a placeholder div showing the component name and props
function createStub(name: string) {
  return function StubComponent(props: Record<string, unknown>) {
    return (
      <div
        style={{
          border: "1px dashed #666",
          padding: "1rem",
          margin: "1rem 0",
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          color: "#888",
        }}
      >
        <strong>[{name}]</strong>
        {Object.keys(props).length > 0 && (
          <pre style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
            {JSON.stringify(props, null, 2)}
          </pre>
        )}
      </div>
    );
  };
}

export function getMdxComponents(): MDXComponents {
  return {
    // Business components (stubs — will be replaced in Phase 3E)
    HeroBanner: createStub("HeroBanner"),
    RankingTable: createStub("RankingTable"),
    ProductCard: createStub("ProductCard"),
    BonusCard: createStub("BonusCard"),
    BonusGrid: createStub("BonusGrid"),
    ComparisonTable: createStub("ComparisonTable"),
    PricingTable: createStub("PricingTable"),
    CTABox: createStub("CTABox"),
    FAQ: createStub("FAQ"),
    Rating: createStub("Rating"),
    ProsCons: createStub("ProsCons"),
    FeatureGrid: createStub("FeatureGrid"),
    StepGuide: createStub("StepGuide"),
    TestimonialCard: createStub("TestimonialCard"),
    AdSlot: createStub("AdSlot"),
    NewsletterForm: createStub("NewsletterForm"),
    ShareButtons: createStub("ShareButtons"),

    // HTML overrides
    h1: (props) => (
      <h1 className="mt-8 mb-4 text-3xl font-bold tracking-tight" {...props} />
    ),
    h2: (props) => (
      <h2
        className="mt-8 mb-3 text-2xl font-semibold tracking-tight"
        id={typeof props.children === "string" ? props.children.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "") : undefined}
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="mt-6 mb-2 text-xl font-semibold"
        id={typeof props.children === "string" ? props.children.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "") : undefined}
        {...props}
      />
    ),
    a: (props) => (
      <a
        className="font-medium underline underline-offset-4"
        style={{ color: "var(--color-brand-primary)" }}
        {...props}
      />
    ),
    table: (props) => (
      <div className="my-6 w-full overflow-x-auto">
        <table className="w-full border-collapse text-sm" {...props} />
      </div>
    ),
    img: (props) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="rounded-lg" alt={props.alt ?? ""} {...props} />
    ),
  } as MDXComponents;
}
