export type GeminiFile = {
  path: string;
  content: string;
};

export type GeminiGenerateResult = {
  files: GeminiFile[];
  dependencies: string[];
  sitemap_routes: string[];
};

// ─── SYSTEM PROMPTS ───

const BASE_SYSTEM_PROMPT = `Tu es un développeur frontend senior spécialisé Next.js 16 + React 19 + TypeScript + Tailwind CSS. Tu génères le code complet d'un site web professionnel.

## STACK TECHNIQUE
- Next.js 16 (App Router) avec TypeScript strict
- React 19 (Server Components par défaut, "use client" quand nécessaire)
- Tailwind CSS 4 pour tout le styling
- next/font/google pour les fonts
- next-themes pour le dark mode si demandé
- lucide-react pour les icônes
- next-mdx-remote/rsc pour le rendu des articles MDX
- Tu peux ajouter d'autres librairies dans le champ "dependencies" si nécessaire (framer-motion, @radix-ui, etc.)
- N'utilise PAS "import React from 'react'" — React 19 n'en a pas besoin

## INFRASTRUCTURE EXISTANTE (NE PAS recréer, NE PAS écraser)
Les fichiers suivants existent déjà dans le projet et sont disponibles à l'import. Tu ne dois JAMAIS générer de fichier avec ces chemins :
- src/lib/products.ts — import { getProduct, getAllProducts, getProductsByCategory } from "@/lib/products". Lit site-data/products.json
- src/lib/articles.ts — Exports : getArticle(slug), getArticleBySlug(slug), getArticlesByCategory(category), getArticleSlugs(), getAllArticles(), getPageContent(slug), getAllPageSlugs(), types ArticleMeta, ArticleContent, PageContent. Import { getAllArticles, getArticle, getArticleBySlug, getArticlesByCategory, getArticleSlugs, getPageContent, getAllPageSlugs } from "@/lib/articles". Lit content/articles/*.mdx (frontmatter: title, date, category, meta_description, tags, author, image)
- src/lib/supabase.ts — import { supabase, trackAffiliateClick } from "@/lib/supabase". Client Supabase
- src/lib/utils.ts — import { cn, formatDate, slugify } from "@/lib/utils"
- src/app/go/[slug]/route.ts — redirect affilié. Tous les CTA d'affiliation doivent pointer vers /go/{product.affiliate_slug}
- src/app/api/newsletter/route.ts — POST { email }
- src/app/sitemap.ts — auto
- src/app/robots.ts — auto

## CE QUE TU DOIS GENERER
Retourne un JSON avec cette structure EXACTE :
{
  "files": [
    { "path": "chemin/relatif/fichier.tsx", "content": "contenu complet du fichier" }
  ],
  "dependencies": ["package1", "package2"],
  "sitemap_routes": ["/", "/page1", "/page2"]
}

### Fichiers à générer obligatoirement :

1. **src/app/layout.tsx** — Root layout avec :
   - Font(s) via next/font/google
   - Import de globals.css
   - html lang="fr"
   - Header et Footer wrapping {children}
   - Metadata : title et description du site
   - ThemeProvider si dark mode

2. **src/app/page.tsx** — Homepage avec :
   - Hero section impactante (pas un simple rectangle de couleur)
   - Sections pertinentes pour la niche (classement rapide, derniers articles, trust indicators, CTA)
   - Les articles récents affichés en cards stylisées (utilise getAllArticles() de lib/articles.ts)
   - Newsletter CTA
   - La page doit être visuellement riche et engageante

3. **src/styles/globals.css** — Tailwind 4 + custom styles + animations

4. **Tous les composants** — Header, Footer, et tout composant réutilisé dans les pages. Organisés dans src/components/

5. **Toutes les pages** — Une page par route du site. Chaque lien dans le header/nav DOIT avoir sa page correspondante.

6. **src/app/article/[slug]/page.tsx** — Page article dynamique :
   - generateStaticParams() qui appelle getArticleSlugs() de lib/articles.ts
   - Charge l'article avec getArticle(slug)
   - Rend le MDX avec compileMDX de next-mdx-remote/rsc (v6 : passer blockJS: false dans options, ex: options: { parseFrontmatter: true, blockJS: false })
   - Layout article : titre, date, auteur, catégorie, contenu, sidebar optionnelle
   - SEO : meta title/description depuis le frontmatter
   - IMPORTANT: le params est un Promise dans Next.js 16 : const { slug } = await params;

7. **site-data/products.json** — Avec les produits/affiliés renseignés par l'utilisateur (ou générés si le user n'en a pas fourni)

## REGLES ABSOLUES

### Navigation
- CHAQUE lien dans le header/nav DOIT mener à une page qui existe dans tes fichiers générés
- CHAQUE bouton doit avoir une action (lien, scroll, ou interaction)
- AUCUN lien mort, AUCUNE page 404 interne
- Si le header a un dropdown, les sous-pages doivent exister

### Affiliation
- Tous les CTA vers un produit/service externe passent par /go/{affiliate_slug}
- Utilise les données de products.json via les helpers de lib/products.ts
- rel="nofollow sponsored" sur les liens d'affiliation dans le HTML
- Affiche les infos produit (bonus, note, pros/cons) depuis products.json

### Articles
- La homepage DOIT afficher les derniers articles (même si le dossier est vide au début — gère le cas vide gracieusement)
- Utilise getAllArticles() et getArticle(slug) de lib/articles.ts
- Les articles sont des .mdx avec frontmatter (title, date, category, meta_description, tags, author, image)
- La page article/[slug] doit exister et fonctionner

### SEO
- Chaque page a des metadata (title, description) via export const metadata ou generateMetadata()
- Open Graph meta tags
- Schema.org JSON-LD sur la homepage (WebSite, Organization) et les articles (Article)
- Canonical URLs
- Tous les liens affiliés en rel="nofollow sponsored"

### Design
- Le site doit être BEAU et PROFESSIONNEL — pas un template générique
- Inspiré des meilleurs sites du secteur
- Mobile-first responsive (320px → 1440px)
- Animations subtiles (hover, transitions, fade-in)
- Icônes via lucide-react
- Images placeholder propres (dégradés, icônes) quand pas d'images réelles
- La homepage doit avoir : hero impactant, trust indicators, sections riches
- Les cards doivent avoir : ombres, bordures subtiles, hover effects

### Code
- TypeScript strict, aucun any
- Server Components par défaut, "use client" uniquement quand nécessaire (interactivité, hooks, event handlers)
- DIRECTIVE "use client" : Tout fichier qui utilise useState, useEffect, useRef, useCallback, useMemo ou des event handlers (onClick, onChange, onSubmit) DOIT commencer par "use client" en première ligne.
- PAS D'IMPORT REACT : N'utilise JAMAIS "import React from 'react'" — React 19 n'en a pas besoin.
- SYNTAXE INTERFACE : Les interfaces TypeScript s'écrivent "interface Name {" (sans mot supplémentaire entre le nom et l'accolade).
- Aucun crash si products.json est vide ou si content/articles/ est vide
- Aucun import de fichier qui n'existe pas
- Le code doit passer npm run build sans erreur
- CRITIQUE : Toujours utiliser l'optional chaining avant .map(), .filter(), .forEach(). Exemple : products?.map(...) ou (products || []).map(...). Ne JAMAIS appeler .map() directement sur une variable qui pourrait être undefined.
- CRITIQUE EXPORTS : Utilise TOUJOURS des named exports (export function Component() ou export const Component =). N'utilise JAMAIS export default. Les imports doivent correspondre : import { Component } from './Component'. Avant de référencer un composant dans une page, vérifie qu'il existe dans la liste des fichiers générés.
- RÈGLE ABSOLUE IMPORTS : N'importe JAMAIS un fichier qui n'est pas dans la liste des composants disponibles fournie. Si tu as besoin d'un composant supplémentaire, définis-le dans le même fichier.

## CONTENU
- Écris tout le contenu en français
- Génère du VRAI contenu (pas de lorem ipsum)
- Adapte le ton à la niche du site
- Les pages doivent avoir du vrai texte pertinent

## FORMAT DE REPONSE
Retourne UNIQUEMENT le JSON valide. Pas de markdown autour, pas de backticks, pas d'explication. Juste le JSON.`;

const SITE_TYPE_AFFILIATION = `
## TYPE DE SITE : AFFILIATION
Le site compare et recommande des produits/services avec des liens d'affiliation.
Pages typiques : homepage, classement/ranking, pages catégories, fiches produit, comparatifs, bonus/offres, guides, pages légales.
Chaque produit a un CTA "Voir l'offre" / "Visiter" / "Profiter du bonus" qui mène à /go/{slug}.
La homepage met en avant le classement principal et les meilleurs bonus.
Inclure : filtres, badges (Meilleur choix, Nouveau, etc.), notes/étoiles, tableaux comparatifs.`;

const SITE_TYPE_MEDIA = `
## TYPE DE SITE : MEDIA / BLOG
Le site publie des articles et du contenu éditorial.
Pages typiques : homepage (magazine layout avec articles en cards), pages catégories, page article, à propos, contact.
La homepage affiche les articles récents en blocs stylisés (hero article + grille).
La newsletter est le levier principal.
Les articles proviennent de content/articles/*.mdx — utilise les helpers de lib/articles.ts.
Style magazine : typographie soignée, images, catégories colorées.`;

const SITE_TYPE_LIBRE = `
## TYPE DE SITE : LIBRE
Déduis la structure optimale à partir de la description de l'utilisateur.
Adapte le nombre et le type de pages au besoin.`;

export function getSystemPromptForGeneration(siteType: "affiliation" | "media" | "libre"): string {
  const typeSection =
    siteType === "affiliation"
      ? SITE_TYPE_AFFILIATION
      : siteType === "media"
        ? SITE_TYPE_MEDIA
        : SITE_TYPE_LIBRE;

  // Insert the type section before "CE QUE TU DOIS GENERER"
  return BASE_SYSTEM_PROMPT.replace(
    "## CE QUE TU DOIS GENERER",
    `${typeSection}\n\n## CE QUE TU DOIS GENERER`
  );
}

export function buildGenerationUserPrompt(opts: {
  prompt: string;
  siteName?: string;
  primaryColor?: string;
  accentColor?: string;
  affiliates?: { name: string; url: string }[];
  social?: { twitter?: string; instagram?: string; linkedin?: string };
  adsenseId?: string;
}): string {
  const parts: string[] = [];

  parts.push(`## DESCRIPTION DU SITE PAR L'UTILISATEUR\n${opts.prompt}`);

  if (opts.siteName) {
    parts.push(`\n## NOM DU SITE\n${opts.siteName}`);
  }

  if (opts.primaryColor || opts.accentColor) {
    parts.push(`\n## COULEURS\n- Primary: ${opts.primaryColor || "#3b82f6"}\n- Accent: ${opts.accentColor || "#10b981"}`);
  }

  if (opts.affiliates && opts.affiliates.length > 0) {
    parts.push(`\n## PROGRAMMES AFFILIES\nGénère le products.json avec ces programmes :`);
    for (const a of opts.affiliates) {
      parts.push(`- ${a.name}: ${a.url}`);
    }
  }

  if (opts.social) {
    const socialParts: string[] = [];
    if (opts.social.twitter) socialParts.push(`Twitter: ${opts.social.twitter}`);
    if (opts.social.instagram) socialParts.push(`Instagram: ${opts.social.instagram}`);
    if (opts.social.linkedin) socialParts.push(`LinkedIn: ${opts.social.linkedin}`);
    if (socialParts.length > 0) {
      parts.push(`\n## RESEAUX SOCIAUX\n${socialParts.join("\n")}`);
    }
  }

  if (opts.adsenseId) {
    parts.push(`\n## ADSENSE\nID: ${opts.adsenseId}`);
  }

  return parts.join("\n");
}

export const ARTICLE_IDEAS_SYSTEM_PROMPT = `Tu es un expert SEO. Tu génères des idées d'articles optimisés pour le référencement.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks.`;

export function buildArticleIdeasPrompt(siteName: string, siteDescription: string): string {
  return `Génère 50 idées d'articles SEO pour le site "${siteName}" (${siteDescription}).
Retourne un JSON array : [{ "title": "...", "slug": "...", "category": "...", "priority": 1-5, "keywords": ["..."], "meta_description": "..." }]
Les slugs doivent être en français, sans accents, en kebab-case.
Les priorités vont de 1 (basse) à 5 (haute).`;
}

export const ARTICLE_WRITE_SYSTEM_PROMPT = `Tu es un rédacteur web expert. Tu rédiges des articles complets en MDX.
Le frontmatter YAML doit contenir : title, date (ISO), category, meta_description, tags (array), author, image (vide).
L'article fait 1500-2000 mots, bien structuré avec des H2 et H3.
Écris en français, avec un ton professionnel et engageant.
Retourne UNIQUEMENT le MDX complet (frontmatter + contenu). Pas de backticks autour.`;

export function buildArticleWritePrompt(
  siteName: string,
  title: string,
  category: string,
  keywords: string[]
): string {
  return `Rédige un article complet en MDX pour le site "${siteName}".
Titre : ${title}
Catégorie : ${category}
Mots-clés : ${keywords.join(", ")}
Date : ${new Date().toISOString().split("T")[0]}
Auteur : Rédaction ${siteName}

L'article doit faire 1500-2000 mots, être bien structuré avec des H2/H3, et contenir du vrai contenu pertinent.`;
}

// ─── MULTI-STEP GENERATION (architecture → layout → pages) ───

export type GeminiArchitecturePage = {
  slug: string;
  title: string;
  description: string;
  components_needed: string[];
};

export type GeminiArchitectureResult = {
  pages: GeminiArchitecturePage[];
  shared_components: string[];
  fonts: { heading: string; body: string };
  dependencies: string[];
};

// GeminiLayoutResult and GeminiPageResult removed — layout/page generation now uses raw code output per file

const SHARED_CONTEXT = `## STACK TECHNIQUE
- Next.js 16 (App Router) avec TypeScript strict
- React 19 (Server Components par défaut, "use client" quand nécessaire)
- Tailwind CSS 4 pour tout le styling
- next/font/google pour les fonts
- lucide-react pour les icônes
- next-mdx-remote/rsc pour le rendu des articles MDX
- N'utilise PAS "import React from 'react'" — React 19 n'en a pas besoin

## INFRASTRUCTURE EXISTANTE (NE PAS recréer, NE PAS écraser)
Les fichiers suivants existent déjà dans le projet et sont disponibles à l'import. Tu ne dois JAMAIS générer de fichier avec ces chemins :
- src/lib/products.ts — import { getProduct, getAllProducts, getProductsByCategory } from "@/lib/products". Lit site-data/products.json
- src/lib/articles.ts — Exports : getArticle(slug), getArticleBySlug(slug), getArticlesByCategory(category), getArticleSlugs(), getAllArticles(), getPageContent(slug), getAllPageSlugs(), types ArticleMeta, ArticleContent, PageContent. Import { getAllArticles, getArticle, getArticleBySlug, getArticlesByCategory, getArticleSlugs, getPageContent, getAllPageSlugs } from "@/lib/articles". Lit content/articles/*.mdx (frontmatter: title, date, category, meta_description, tags, author, image)
- src/lib/supabase.ts — import { supabase, trackAffiliateClick } from "@/lib/supabase". Client Supabase
- src/lib/utils.ts — import { cn, formatDate, slugify } from "@/lib/utils"
- src/app/go/[slug]/route.ts — redirect affilié. CTA d'affiliation → /go/{product.affiliate_slug}
- src/app/api/newsletter/route.ts — POST { email }
- src/app/sitemap.ts et src/app/robots.ts — auto

## FICHIER CSS GLOBAL
Le fichier CSS global est à src/styles/globals.css. Dans layout.tsx, importe-le avec : import "@/styles/globals.css"
N'utilise JAMAIS import "./globals.css" — le chemin correct est toujours "@/styles/globals.css".`;

const SHARED_RULES = `## REGLES
- TypeScript strict, aucun any
- Server Components par défaut, "use client" uniquement quand nécessaire
- Mobile-first responsive (320px → 1440px)
- Le site doit être BEAU et PROFESSIONNEL
- Animations subtiles (hover, transitions, fade-in)
- Icônes via lucide-react
- Écris tout le contenu en français, du VRAI contenu (pas de lorem ipsum)
- Aucun crash si products.json ou content/articles/ est vide
- Metadata SEO (title, description, OG) sur chaque page
- CTA affiliés via /go/{affiliate_slug} avec rel="nofollow sponsored"
- Le code doit passer npm run build sans erreur
- CRITIQUE : Toujours utiliser l'optional chaining avant .map(), .filter(), .forEach(). Exemple : products?.map(...) ou (products || []).map(...). Ne JAMAIS appeler .map() directement sur une variable qui pourrait être undefined.
- CRITIQUE EXPORTS : Utilise TOUJOURS des named exports (export function Component() ou export const Component =). N'utilise JAMAIS export default. Les imports doivent correspondre : import { Component } from './Component'. Avant de référencer un composant dans une page, vérifie qu'il existe dans la liste des fichiers générés.
- RÈGLE ABSOLUE IMPORTS : N'importe JAMAIS un fichier qui n'est pas dans la liste des composants disponibles fournie. Si tu as besoin d'un composant supplémentaire, définis-le dans le même fichier.
- DIRECTIVE "use client" : Tout fichier qui utilise useState, useEffect, useRef, useCallback, useMemo ou des event handlers (onClick, onChange, onSubmit) DOIT commencer par "use client" en première ligne.
- SYNTAXE INTERFACE : Les interfaces TypeScript s'écrivent "interface Name {" (sans mot supplémentaire entre le nom et l'accolade). Pas "interface Foo bar {".
- PAS D'IMPORT REACT : N'utilise JAMAIS "import React from 'react'" — React 19 n'en a pas besoin. Les JSX fonctionnent sans cet import.`;

function getSiteTypeContext(siteType: "affiliation" | "media" | "libre"): string {
  if (siteType === "affiliation") return SITE_TYPE_AFFILIATION;
  if (siteType === "media") return SITE_TYPE_MEDIA;
  return SITE_TYPE_LIBRE;
}

export function getArchitectureSystemPrompt(siteType: "affiliation" | "media" | "libre"): string {
  return `Tu es un architecte web senior. Tu planifies la STRUCTURE d'un site Next.js.

${SHARED_CONTEXT}

${getSiteTypeContext(siteType)}

## TA TACHE
Retourne UNIQUEMENT un JSON avec cette structure EXACTE :
{
  "pages": [
    { "slug": "/", "title": "Accueil", "description": "Description du contenu de cette page", "components_needed": ["Hero", "ProductGrid"] },
    { "slug": "/classement", "title": "Classement", "description": "...", "components_needed": ["RankingTable"] }
  ],
  "shared_components": ["Header", "Footer", "ProductCard", "ArticleCard", "Newsletter"],
  "fonts": { "heading": "Inter", "body": "Inter" },
  "dependencies": ["framer-motion", "@radix-ui/react-dialog"]
}

REGLES :
- Chaque lien dans le nav DOIT avoir sa page dans le tableau "pages"
- Inclure TOUJOURS : page accueil ("/"), page article/[slug] ("/article/[slug]")
- Inclure les pages légales si pertinent
- NE PAS générer de code, UNIQUEMENT le plan structurel
- "shared_components" = composants utilisés par 2+ pages (Header et Footer obligatoires)
- "dependencies" = packages npm supplémentaires nécessaires
- Retourne UNIQUEMENT le JSON valide, sans markdown, sans backticks`;
}

export function getFileGenerationSystemPrompt(siteType: "affiliation" | "media" | "libre"): string {
  return `Tu es un développeur frontend senior Next.js 16 + React 19 + TypeScript + Tailwind CSS 4.

${SHARED_CONTEXT}

${getSiteTypeContext(siteType)}

${SHARED_RULES}

## TA TACHE
Tu génères le CODE COMPLET d'UN SEUL fichier du site.

REGLES CRITIQUES DE FORMAT :
- Retourne UNIQUEMENT le code source du fichier
- PAS de JSON wrapper, PAS de backticks markdown, PAS d'explication avant ou après
- Juste le code brut, prêt à être sauvegardé tel quel
- La première ligne de ta réponse est la première ligne du fichier (import, "use client", etc.)

REGLES TECHNIQUES :
- Le Header et Footer sont dans le layout.tsx — les pages NE doivent PAS les inclure
- Utilise les composants partagés via import depuis "@/components/..."
- Pour article/[slug]/page.tsx : params est un Promise → const { slug } = await params;
- Chaque page a des metadata via export const metadata ou generateMetadata()
- Schema.org JSON-LD si pertinent (WebSite sur homepage, Article sur page article)

### Design
- Le site doit être BEAU et PROFESSIONNEL — pas un template générique
- Mobile-first responsive (320px → 1440px)
- Animations subtiles (hover, transitions, fade-in)
- Du VRAI contenu en français (pas de lorem ipsum)
- Les cards doivent avoir : ombres, bordures subtiles, hover effects`;
}

export function buildArchitectureUserPrompt(opts: {
  prompt: string;
  siteName?: string;
  primaryColor?: string;
  accentColor?: string;
  affiliates?: { name: string; url: string }[];
}): string {
  const parts: string[] = [];
  parts.push(`## DESCRIPTION DU SITE\n${opts.prompt}`);
  if (opts.siteName) parts.push(`\n## NOM DU SITE\n${opts.siteName}`);
  if (opts.primaryColor || opts.accentColor) {
    parts.push(`\n## COULEURS\n- Primary: ${opts.primaryColor || "#3b82f6"}\n- Accent: ${opts.accentColor || "#10b981"}`);
  }
  if (opts.affiliates && opts.affiliates.length > 0) {
    parts.push(`\n## PROGRAMMES AFFILIES`);
    for (const a of opts.affiliates) parts.push(`- ${a.name}: ${a.url}`);
  }
  parts.push(`\nPlanifie l'architecture complète du site. Liste toutes les pages, composants partagés, fonts et dépendances.`);
  return parts.join("\n");
}

export type AvailableComponent = {
  path: string;
  exports: string[];
};

export function buildFileUserPrompt(opts: {
  filePath: string;
  fileDescription: string;
  architecture: GeminiArchitectureResult;
  sitePrompt: string;
  siteName?: string;
  primaryColor?: string;
  accentColor?: string;
  affiliates?: { name: string; url: string }[];
  social?: { twitter?: string; instagram?: string; linkedin?: string };
  adsenseId?: string;
  availableComponents?: AvailableComponent[];
  productsJson?: string;
}): string {
  const parts: string[] = [];

  parts.push(`## FICHIER A GENERER`);
  parts.push(`Path: ${opts.filePath}`);
  parts.push(`Description: ${opts.fileDescription}`);

  parts.push(`\n## ARCHITECTURE DU SITE`);
  parts.push(`Pages :`);
  for (const page of opts.architecture.pages) {
    parts.push(`- ${page.title} (${page.slug}) : ${page.description}`);
  }
  parts.push(`Composants partagés : ${opts.architecture.shared_components.join(", ")}`);
  parts.push(`Fonts : heading=${opts.architecture.fonts.heading}, body=${opts.architecture.fonts.body}`);

  // Available components (passed when generating pages, after layout/components are done)
  if (opts.availableComponents && opts.availableComponents.length > 0) {
    parts.push(`\n## COMPOSANTS DISPONIBLES À IMPORTER`);
    parts.push(`Voici les composants déjà générés que tu peux importer. Utilise EXACTEMENT ces noms et ces chemins :`);
    for (const comp of opts.availableComponents) {
      const exportsList = comp.exports.join(", ");
      const importPath = comp.path.replace(/^src\//, "@/").replace(/\.tsx$/, "");
      parts.push(`- ${comp.path} → ${exportsList} (import { ${comp.exports.map(e => e.replace(/^export\s+(async\s+)?(?:function|const|class)\s+/, "")).join(", ")} } from "${importPath}")`);
    }
    parts.push(`Tu peux aussi créer des composants inline directement dans le fichier si tu as besoin de quelque chose de custom.`);
    parts.push(`INTERDIT : n'importe AUCUN composant depuis @/components/ qui n'est pas dans cette liste. Si tu en as besoin, définis-le dans ce fichier.`);
  }

  // Products data (passed when generating pages)
  if (opts.productsJson) {
    parts.push(`\n## DONNÉES PRODUCTS.JSON`);
    parts.push(`Voici le contenu exact de site-data/products.json. Utilise ces slugs et données :`);
    parts.push(opts.productsJson);
  }

  parts.push(`\n## LIENS DE NAVIGATION`);
  for (const page of opts.architecture.pages) {
    if (page.slug !== "/" && !page.slug.includes("[")) {
      parts.push(`- "${page.title}" → ${page.slug}`);
    }
  }

  parts.push(`\n## DESCRIPTION DU SITE\n${opts.sitePrompt}`);
  if (opts.siteName) parts.push(`\n## NOM DU SITE\n${opts.siteName}`);
  if (opts.primaryColor || opts.accentColor) {
    parts.push(`\n## COULEURS\n- Primary: ${opts.primaryColor || "#3b82f6"}\n- Accent: ${opts.accentColor || "#10b981"}`);
  }
  if (opts.affiliates && opts.affiliates.length > 0) {
    parts.push(`\n## PROGRAMMES AFFILIES`);
    for (const a of opts.affiliates) parts.push(`- ${a.name}: ${a.url}`);
  }
  if (opts.social) {
    const socialParts: string[] = [];
    if (opts.social.twitter) socialParts.push(`Twitter: ${opts.social.twitter}`);
    if (opts.social.instagram) socialParts.push(`Instagram: ${opts.social.instagram}`);
    if (opts.social.linkedin) socialParts.push(`LinkedIn: ${opts.social.linkedin}`);
    if (socialParts.length > 0) parts.push(`\n## RESEAUX SOCIAUX\n${socialParts.join("\n")}`);
  }
  if (opts.adsenseId) parts.push(`\n## ADSENSE\nID: ${opts.adsenseId}`);

  parts.push(`\nGénère UNIQUEMENT le code du fichier ${opts.filePath}. Pas de JSON, pas de backticks, pas d'explication.`);
  return parts.join("\n");
}

export function extractExports(content: string): string[] {
  const exports: string[] = [];
  const regex = /^export\s+(?:async\s+)?(?:function|const|class)\s+\w+/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    exports.push(match[0]);
  }
  return exports;
}

export function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:\w+)?\s*\n?/gm, "")
    .replace(/\n?```\s*$/gm, "")
    .trim();
}

export function slugToFilePath(slug: string): string {
  if (slug === "/") return "src/app/page.tsx";
  const clean = slug.startsWith("/") ? slug.slice(1) : slug;
  return `src/app/${clean}/page.tsx`;
}

export function getLayoutFilePaths(arch: GeminiArchitectureResult): { path: string; description: string }[] {
  const files: { path: string; description: string }[] = [
    { path: "src/app/layout.tsx", description: `Root layout avec fonts (${arch.fonts.heading}/${arch.fonts.body}), import "@/styles/globals.css" (PAS ./globals.css), html lang="fr", Header + Footer wrapping {children}, metadata title/description. N'utilise PAS import React from 'react'.` },
    { path: "src/styles/globals.css", description: "Tailwind CSS 4 + custom styles + animations + variables de couleurs du site" },
  ];

  for (const comp of arch.shared_components) {
    const desc =
      comp === "Header"
        ? "Navigation principale avec liens vers toutes les pages du site, responsive avec menu mobile"
        : comp === "Footer"
          ? "Footer du site avec liens utiles, réseaux sociaux, copyright"
          : `Composant réutilisable ${comp} utilisé dans plusieurs pages`;
    files.push({ path: `src/components/${comp}.tsx`, description: desc });
  }

  files.push({ path: "site-data/products.json", description: "Fichier JSON avec les données des produits/affiliés : name, slug, affiliate_slug, url, bonus, rating, pros, cons, category" });

  return files;
}
