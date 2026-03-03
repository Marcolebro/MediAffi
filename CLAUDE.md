# MediAffi — Media Sites Builder

Système automatisé de création et gestion de sites d'affiliation/médias. Architecture 100% serverless.

## Stack

| Composant | Technologie | Déploiement |
|-----------|-------------|-------------|
| BDD | Supabase (PostgreSQL + Auth + Storage) | Supabase Cloud |
| Sites affiliation | Astro + Tailwind | Vercel |
| Dashboard | Next.js 14 App Router + Supabase Auth | Vercel |
| Cron pipelines | GitHub Actions (daily 6h UTC, weekly vendredi 9h) | GitHub |
| LLM | Gemini API | — |
| Scraping | Apify API | — |
| SEO | Brave Search API + Gemini + Google Search Console | — |
| Social | Buffer API (Instagram, Twitter, LinkedIn, Pinterest, TikTok) | — |
| Newsletter | Resend API | — |
| Analytics | Plausible Cloud | — |
| Images | Playwright screenshots + Clearbit logos + Unsplash (optionnel) | — |

## Structure du repo

```
MediAffi/
├── supabase/
│   ├── migrations/          # Migrations SQL ordonnées
│   └── seed.sql             # Schema BDD (11 tables) + seed prompts
├── template-astro/          # Template Astro réutilisable, paramétré par site.config.json
├── scripts/
│   └── modules/             # Pipeline Node.js (chaque module testable individuellement)
│       ├── scraper.js
│       ├── seo.js
│       ├── writer.js
│       ├── images.js
│       ├── publisher.js
│       ├── social.js
│       ├── metrics.js
│       ├── newsletter.js
│       ├── analyzer.js
│       └── tracker.js
├── dashboard/               # Next.js 14 + Supabase Auth + Tailwind + Recharts + shadcn/ui
├── .github/workflows/
│   ├── daily-pipeline.yml   # Cron quotidien 6h UTC
│   └── weekly-pipeline.yml  # Cron hebdo vendredi 9h UTC
└── CLAUDE.md
```

## Commandes

### Template Astro
```bash
cd template-astro && npm install && npm run dev
```

### Dashboard
```bash
cd dashboard && npm install && npm run dev
# Nécessite les env vars Supabase configurées
```

### Scripts pipeline
```bash
node scripts/modules/<module>.js  # Exécuter un module individuellement
```

## Phases de build

1. Supabase schema + seed prompts
2. Template Astro (site affiliation config-driven)
3. Pipeline articles cron quotidien
4. Pipeline social auto
5. Newsletter hebdo + analytics + analyse IA
6. Dashboard Next.js

## Conventions de code

- **TypeScript** pour `template-astro/` et `dashboard/`
- **JavaScript pur** pour `scripts/` (simplicité GitHub Actions)
- **Mobile-first** responsive pour template et dashboard
- Commits propres par feature, messages descriptifs en anglais

## Règles strictes

- Env vars pour TOUTES les API keys — jamais en dur
- Gestion d'erreurs robuste : try/catch partout, logs dans Supabase, status `failed` en BDD
- Chaque module `scripts/modules/` doit être testable individuellement
- `template-astro/` doit fonctionner standalone (`npm install && npm run dev`)
- `dashboard/` doit fonctionner standalone (`npm install && npm run dev` + env vars)
- Ne jamais modifier les fichiers d'une phase précédente sans raison explicite

## Variables d'environnement requises

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
APIFY_API_TOKEN=
BRAVE_SEARCH_API_KEY=
BUFFER_ACCESS_TOKEN=
RESEND_API_KEY=
PLAUSIBLE_API_KEY=
PLAUSIBLE_SITE_ID=
GOOGLE_SEARCH_CONSOLE_KEY=
```
