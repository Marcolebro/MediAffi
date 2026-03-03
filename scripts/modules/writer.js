/**
 * Writer module — fetches prompt from DB, calls Gemini, returns structured article.
 * Follows the prompt-fetch pattern from newsletter.js.
 */

import { supabase, callGemini } from './supabase.js';

// ============================================
// Internal helpers
// ============================================

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function parseSimpleYaml(str) {
  const result = {};
  for (const line of str.split('\n')) {
    const match = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
    if (match) {
      let value = match[2].trim();
      // Handle arrays like [tag1, tag2]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      } else {
        value = value.replace(/^["']|["']$/g, '');
      }
      result[match[1]] = value;
    }
  }
  return result;
}

function parseFrontmatterAndContent(raw, fallbackKeyword) {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  let meta = {};
  let content = raw;

  if (fmMatch) {
    meta = parseSimpleYaml(fmMatch[1]);
    content = fmMatch[2].trim();
  }

  const title = meta.title || content.match(/^#\s+(.+)/m)?.[1] || fallbackKeyword;
  const slug = meta.slug || slugify(title);
  const metaDescription = meta.description || meta.meta_description || content.slice(0, 155).replace(/\n/g, ' ');
  const tags = Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : []);
  const category = meta.category || '';

  return { title, slug, content, metaDescription, wordCount: countWords(content), tags, category };
}

// ============================================
// Export
// ============================================

/**
 * Write an article using a DB prompt + Gemini.
 * @param {object} params
 * @param {object} params.task - Queue task (keyword, type, site_id, etc.)
 * @param {object} params.scraped - Scraped product data
 * @param {object} params.seo - SEO research data
 * @param {object} params.site - Site config from DB
 * @param {object} params.competitorData - Competitor scrape results
 * @param {object} params.newsData - News scrape results
 */
export async function writeArticle({ task, scraped, seo, site, competitorData, newsData }) {
  const articleType = task.type || 'review';

  // 1. Fetch prompt from DB (site-specific or global, following newsletter.js pattern)
  const { data: prompt } = await supabase
    .from('prompts')
    .select('*')
    .eq('type', articleType)
    .eq('category', 'article')
    .eq('is_active', true)
    .or(`site_id.eq.${site.id},site_id.is.null`)
    .order('site_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();

  if (!prompt) throw new Error(`No active prompt found for type="${articleType}" category="article"`);

  // 2. Build template variables
  const competitorText = (competitorData || [])
    .map((c, i) => `${i + 1}. "${c.title}" — ${c.url}\n   ${c.description}`)
    .join('\n');

  const newsText = [
    ...(newsData?.hn || []).map(n => `- [HN] ${n.title} (${n.points} pts)`),
    ...(newsData?.reddit || []).map(n => `- [Reddit] ${n.title} (score ${n.score})`),
  ].join('\n') || 'No recent news';

  const secondaryKws = (seo?.secondary_keywords || []).join(', ');

  const filledTemplate = prompt.template
    .replace('{{keyword}}', task.keyword || '')
    .replace('{{product_name}}', scraped?.title || scraped?.h1 || task.keyword || '')
    .replace('{{product_url}}', scraped?.url || task.product_url || '')
    .replace('{{product_data}}', JSON.stringify(scraped || {}, null, 2))
    .replace('{{competitors}}', competitorText)
    .replace('{{news}}', newsText)
    .replace('{{search_intent}}', seo?.search_intent || 'informational')
    .replace('{{secondary_keywords}}', secondaryKws)
    .replace('{{competitor_analysis}}', seo?.competitor_analysis || '')
    .replace('{{content_gaps}}', seo?.content_gaps || '')
    .replace('{{recommended_angle}}', seo?.recommended_angle || '')
    .replace('{{site_name}}', site.name || '')
    .replace('{{niche}}', site.niche || '')
    .replace('{{tone}}', site.tone || 'professional');

  // 3. Call Gemini
  const raw = await callGemini(filledTemplate, {
    model: prompt.model || 'gemini-2.5-flash',
    temperature: prompt.temperature || 0.7,
    maxTokens: prompt.max_tokens || 4000,
    systemPrompt: prompt.system_prompt || '',
  });

  // 4. Parse frontmatter + content
  const parsed = parseFrontmatterAndContent(raw, task.keyword);

  return {
    ...parsed,
    promptId: prompt.id,
    promptVersion: prompt.version || 1,
    modelUsed: prompt.model || 'gemini-2.5-flash',
  };
}
