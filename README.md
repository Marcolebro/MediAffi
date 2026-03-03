# MediAffi — Media Sites Builder

Système automatisé de création et gestion de sites d'affiliation/médias. Architecture 100% serverless.

## Architecture

```
[Dashboard Next.js — Vercel]
        ↕ API REST
[Supabase — PostgreSQL + Auth + Storage]
        ↕
[GitHub Actions — Cron quotidien 6h + hebdo vendredi 9h]
  ├── Scrape données (Apify API)
  ├── Analyse SEO (Brave Search API + Gemini)
  ├── Rédaction article (Gemini API)
  ├── Génération images (Playwright + Clearbit + Unsplash)
  ├── Publish site (git push → Vercel rebuild)
  ├── Génération + publish social (Buffer API)
  ├── Collecte métriques (Plausible + GSC)
  ├── Analyse performance hebdo (Gemini)
  └── Newsletter (Resend API)

[Sites d'affiliation — Vercel] × N (template Astro)
```

## Structure

```
MediAffi/
├── supabase/
│   ├── migrations/     # SQL migrations ordonnées
│   └── seed.sql        # Prompts par défaut
├── template-astro/     # Template Astro réutilisable (Phase 2)
├── scripts/            # Pipeline Node.js (Phase 3+)
├── dashboard/          # Next.js 14 (Phase 6)
└── .github/workflows/  # Cron pipelines
```

## Supabase — Migrations

### Appliquer le schema

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **SQL Editor**
3. Copier-coller `supabase/migrations/001_initial_schema.sql` et exécuter
4. Copier-coller `supabase/seed.sql` et exécuter

### Tables (11)

| Table | Description |
|-------|-------------|
| `sites` | Configuration de chaque site d'affiliation |
| `affiliate_programs` | Programmes d'affiliation par site |
| `prompts` | Prompts versionnés (globaux ou par site) |
| `article_queue` | File d'attente du pipeline d'articles |
| `articles` | Articles publiés |
| `metrics` | Métriques quotidiennes par article |
| `social_posts` | Posts sociaux générés et publiés |
| `affiliate_clicks` | Tracking des clics /go/ |
| `newsletters` | Newsletters envoyées |
| `sponsors` | Sponsors newsletter |
| `weekly_analysis` | Analyses de performance hebdomadaires |

## Variables d'environnement

Copier `.env.example` → `.env` et remplir les clés API.
