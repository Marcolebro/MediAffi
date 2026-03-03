import rawConfig from '../../site.config.json';

export interface NavLink {
  label: string;
  href: string;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
}

export interface SiteConfig {
  name: string;
  domain: string;
  language: string;
  description: string;
  tagline: string;
  author: string;
  categories: Category[];
  colors: {
    primary: string;
    accent: string;
    background: string;
    text: string;
  };
  social: {
    twitter: string;
    linkedin: string;
    instagram: string;
  };
  analytics: {
    plausible_domain: string;
    plausible_script: string;
  };
  ads: {
    adsense_id: string;
  };
  newsletter: {
    resend_audience_id: string;
  };
  supabase: {
    url: string;
    anon_key: string;
  };
  affiliate_programs: Record<string, { name: string; url: string }>;
  nav_links: NavLink[];
  footer_links: NavLink[];
}

function resolveEnvValues(obj: Record<string, unknown>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.startsWith('env:')) {
      const envKey = value.slice(4);
      resolved[key] = import.meta.env[envKey] ?? '';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveEnvValues(value as Record<string, unknown>);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

export const config = resolveEnvValues(rawConfig as unknown as Record<string, unknown>) as unknown as SiteConfig;
