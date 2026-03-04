const GEMINI_MODEL = "gemini-2.5-flash";

export type GeminiFile = {
  path: string;
  content: string;
};

export type GeminiGenerateResult = {
  files: GeminiFile[];
  dependencies: string[];
  sitemap_routes: string[];
};

export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const { temperature = 0.7, maxOutputTokens = 65536, jsonMode = false } = options;

  const generationConfig: Record<string, unknown> = { temperature, maxOutputTokens };
  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig,
      systemInstruction: { parts: [{ text: systemPrompt }] },
    }),
  });

  if (!res.ok) {
    const errData = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errData}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No content in Gemini response");
  return text;
}

export function parseGeminiJSON<T>(raw: string): T {
  // Strip markdown code fences if present
  let cleaned = raw
    .replace(/^```(?:json)?\s*\n?/gm, "")
    .replace(/\n?```\s*$/gm, "")
    .trim();

  // Try direct parse first (works with responseMimeType: application/json)
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall through to boundary extraction
  }

  // Find JSON boundaries (first {/[ to last }/])
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error("No JSON object or array found in Gemini response");
  }

  let start: number;
  let end: number;

  if (firstBracket === -1 || (firstBrace !== -1 && firstBrace < firstBracket)) {
    start = firstBrace;
    end = cleaned.lastIndexOf("}") + 1;
  } else {
    start = firstBracket;
    end = cleaned.lastIndexOf("]") + 1;
  }

  if (end <= start) {
    throw new Error("Malformed JSON in Gemini response");
  }

  cleaned = cleaned.slice(start, end);
  return JSON.parse(cleaned) as T;
}

export async function callGeminiJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxOutputTokens?: number; retries?: number } = {}
): Promise<T> {
  const { retries = 3, ...callOptions } = options;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const raw = await callGemini(systemPrompt, userPrompt, { ...callOptions, jsonMode: true });
      return parseGeminiJSON<T>(raw);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      // Retry on parse failure
    }
  }

  throw new Error("Failed to get valid JSON from Gemini after retries");
}

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

## INFRASTRUCTURE EXISTANTE (ne pas recréer)
Ces fichiers existent déjà dans le starter et fonctionnent. Tu ne dois PAS les recréer sauf si tu as besoin de les modifier :
- src/lib/products.ts — getProduct(slug), getAllProducts(), getProductsByCategory(cat). Lit site-data/products.json
- src/lib/articles.ts — getAllArticles(), getArticle(slug), getArticlesByCategory(cat). Lit content/articles/*.mdx (frontmatter: title, date, category, meta_description, tags, author, image)
- src/lib/supabase.ts — client Supabase, trackAffiliateClick()
- src/lib/utils.ts — cn(), formatDate(), slugify()
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
   - Rend le MDX avec compileMDX de next-mdx-remote/rsc
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
- Aucun crash si products.json est vide ou si content/articles/ est vide
- Aucun import de fichier qui n'existe pas
- Le code doit passer npm run build sans erreur

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

export type GeminiLayoutResult = {
  files: GeminiFile[];
  dependencies: string[];
};

export type GeminiPageResult = {
  files: GeminiFile[];
};

const SHARED_CONTEXT = `## STACK TECHNIQUE
- Next.js 16 (App Router) avec TypeScript strict
- React 19 (Server Components par défaut, "use client" quand nécessaire)
- Tailwind CSS 4 pour tout le styling
- next/font/google pour les fonts
- lucide-react pour les icônes
- next-mdx-remote/rsc pour le rendu des articles MDX

## INFRASTRUCTURE EXISTANTE (ne pas recréer)
- src/lib/products.ts — getProduct(slug), getAllProducts(), getProductsByCategory(cat). Lit site-data/products.json
- src/lib/articles.ts — getAllArticles(), getArticle(slug), getArticlesByCategory(cat). Lit content/articles/*.mdx (frontmatter: title, date, category, meta_description, tags, author, image)
- src/lib/supabase.ts — client Supabase, trackAffiliateClick()
- src/lib/utils.ts — cn(), formatDate(), slugify()
- src/app/go/[slug]/route.ts — redirect affilié. CTA d'affiliation → /go/{product.affiliate_slug}
- src/app/api/newsletter/route.ts — POST { email }
- src/app/sitemap.ts et src/app/robots.ts — auto`;

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
- Le code doit passer npm run build sans erreur`;

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

export function getLayoutSystemPrompt(siteType: "affiliation" | "media" | "libre"): string {
  return `Tu es un développeur frontend senior Next.js 16 + React 19 + TypeScript + Tailwind CSS 4.

${SHARED_CONTEXT}

${getSiteTypeContext(siteType)}

${SHARED_RULES}

## TA TACHE
Tu génères UNIQUEMENT le layout, les styles globaux, et les composants PARTAGÉS du site.

Fichiers à générer :
1. **src/app/layout.tsx** — Root layout avec fonts (next/font/google), import globals.css, html lang="fr", Header + Footer wrapping {children}, metadata title/description, ThemeProvider si dark mode
2. **src/styles/globals.css** — Tailwind CSS 4 + custom styles + animations
3. **src/components/Header.tsx** — Navigation principale (liens vers les pages du site)
4. **src/components/Footer.tsx** — Footer du site
5. **Autres composants partagés** — Ceux listés dans l'architecture fournie (ProductCard, ArticleCard, etc.)
6. **site-data/products.json** — Données des produits/affiliés

NE PAS générer les pages (page.tsx). Uniquement le layout et les composants réutilisables.
Le Header doit avoir des liens vers TOUTES les pages listées dans l'architecture.

### Design
- Le site doit être BEAU et PROFESSIONNEL — pas un template générique
- Mobile-first responsive (320px → 1440px)
- Les cards doivent avoir : ombres, bordures subtiles, hover effects
- Images placeholder propres (dégradés, icônes) quand pas d'images réelles

## FORMAT DE REPONSE
{
  "files": [{ "path": "chemin/relatif/fichier.tsx", "content": "contenu complet du fichier" }],
  "dependencies": ["package1", "package2"]
}
Retourne UNIQUEMENT le JSON valide, sans markdown, sans backticks.`;
}

export function getPageSystemPrompt(): string {
  return `Tu es un développeur frontend senior Next.js 16 + React 19 + TypeScript + Tailwind CSS 4.

${SHARED_CONTEXT}

${SHARED_RULES}

## TA TACHE
Tu génères UNE SEULE PAGE du site. Les composants partagés (Header, Footer, etc.) sont déjà dans le layout — NE PAS les recréer. Utilise-les via import depuis "@/components/...".

IMPORTANT:
- Le Header et Footer sont dans le layout.tsx, NE PAS les inclure dans la page
- Utilise les composants partagés fournis via import
- Pour la page article/[slug] : params est un Promise dans Next.js 16 → const { slug } = await params;
- generateStaticParams() pour les pages dynamiques
- Chaque page a des metadata (title, description) via export const metadata ou generateMetadata()
- Schema.org JSON-LD si pertinent (WebSite sur homepage, Article sur page article)

### Design
- La page doit être visuellement riche et engageante
- Mobile-first responsive
- Animations subtiles (hover, transitions)
- Du VRAI contenu en français

## FORMAT DE REPONSE
{
  "files": [{ "path": "chemin/relatif/fichier.tsx", "content": "contenu complet du fichier" }]
}
Retourne UNIQUEMENT le JSON valide, sans markdown, sans backticks.`;
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

export function buildLayoutUserPrompt(
  opts: {
    prompt: string;
    siteName?: string;
    primaryColor?: string;
    accentColor?: string;
    affiliates?: { name: string; url: string }[];
    social?: { twitter?: string; instagram?: string; linkedin?: string };
    adsenseId?: string;
  },
  architecture: GeminiArchitectureResult
): string {
  const parts: string[] = [];
  parts.push(`## DESCRIPTION DU SITE\n${opts.prompt}`);
  if (opts.siteName) parts.push(`\n## NOM DU SITE\n${opts.siteName}`);
  if (opts.primaryColor || opts.accentColor) {
    parts.push(`\n## COULEURS\n- Primary: ${opts.primaryColor || "#3b82f6"}\n- Accent: ${opts.accentColor || "#10b981"}`);
  }
  if (opts.affiliates && opts.affiliates.length > 0) {
    parts.push(`\n## PROGRAMMES AFFILIES\nGénère le products.json avec ces programmes :`);
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

  parts.push(`\n## ARCHITECTURE DU SITE (déjà planifiée)`);
  parts.push(`Pages : ${architecture.pages.map((p) => `${p.title} (${p.slug})`).join(", ")}`);
  parts.push(`Composants partagés à générer : ${architecture.shared_components.join(", ")}`);
  parts.push(`Fonts : heading=${architecture.fonts.heading}, body=${architecture.fonts.body}`);

  parts.push(`\n## LIENS DE NAVIGATION POUR LE HEADER`);
  for (const page of architecture.pages) {
    if (page.slug !== "/" && !page.slug.includes("[")) {
      parts.push(`- "${page.title}" → ${page.slug}`);
    }
  }

  parts.push(`\nGénère le layout, globals.css, Header, Footer, les composants partagés listés ci-dessus, et products.json.`);
  return parts.join("\n");
}

export function buildPageUserPrompt(
  page: GeminiArchitecturePage,
  architecture: GeminiArchitectureResult,
  sharedComponentNames: string[]
): string {
  const parts: string[] = [];
  parts.push(`## PAGE A GENERER`);
  parts.push(`- Slug: ${page.slug}`);
  parts.push(`- Titre: ${page.title}`);
  parts.push(`- Description: ${page.description}`);
  parts.push(`- Composants à utiliser: ${page.components_needed.join(", ")}`);

  parts.push(`\n## CONTEXTE DU SITE`);
  parts.push(`Pages du site : ${architecture.pages.map((p) => `${p.title} (${p.slug})`).join(", ")}`);
  parts.push(`Fonts : heading=${architecture.fonts.heading}, body=${architecture.fonts.body}`);

  parts.push(`\n## COMPOSANTS PARTAGÉS DISPONIBLES (déjà générés, utilise-les via import)`);
  for (const name of sharedComponentNames) {
    parts.push(`- import { ... } from "@/components/${name}"`);
  }

  parts.push(`\nGénère UNIQUEMENT les fichiers pour la page "${page.title}" (${page.slug}).`);
  return parts.join("\n");
}
