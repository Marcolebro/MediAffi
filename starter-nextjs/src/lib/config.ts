import type React from "react";
import rawConfig from "../../site-data/site.config.json";

export interface SiteConfig {
  name: string;
  domain: string;
  tagline: string;
  description: string;
  language: string;
  style: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    border: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  nav: Array<{
    label: string;
    href: string;
  }>;
  footer: {
    links: Array<{
      label: string;
      href: string;
    }>;
    disclaimer: string;
    copyright: string;
  };
  social: {
    twitter: string;
    facebook: string;
    instagram: string;
  };
  newsletter: {
    enabled: boolean;
    title: string;
    description: string;
  };
  supabase: {
    url: string;
    anon_key: string;
  };
  analytics: {
    plausible_domain: string;
  };
}

function resolveEnvValues<T>(obj: T): T {
  if (typeof obj === "string") {
    if (obj.startsWith("env:")) {
      return (process.env[obj.slice(4)] ?? "") as T;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvValues) as T;
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvValues(value);
    }
    return result as T;
  }
  return obj;
}

const config = resolveEnvValues(rawConfig) as SiteConfig;

export function getSiteColorStyle(): React.CSSProperties {
  return {
    "--color-brand-primary": config.colors.primary,
    "--color-brand-secondary": config.colors.secondary,
    "--color-brand-accent": config.colors.accent,
  } as React.CSSProperties;
}

export default config;
