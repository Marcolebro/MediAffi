import Link from "next/link";
import config from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Newsletter CTA */}
        {config.newsletter.enabled && (
          <div className="mb-10 rounded-lg border border-border/50 bg-card p-6 text-center">
            <h3 className="text-lg font-semibold">{config.newsletter.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {config.newsletter.description}
            </p>
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <h4
              className="text-lg font-bold"
              style={{ color: "var(--color-brand-primary)" }}
            >
              {config.name}
            </h4>
            <p className="mt-2 text-sm text-muted-foreground">
              {config.tagline}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Liens
            </h4>
            <ul className="mt-3 space-y-2">
              {config.footer.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Suivez-nous
            </h4>
            <div className="mt-3 flex gap-4">
              {config.social.twitter && (
                <a
                  href={config.social.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Twitter
                </a>
              )}
              {config.social.facebook && (
                <a
                  href={config.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Facebook
                </a>
              )}
              {config.social.instagram && (
                <a
                  href={config.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Instagram
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-10 border-t border-border/40 pt-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {config.footer.disclaimer}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            {config.footer.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
