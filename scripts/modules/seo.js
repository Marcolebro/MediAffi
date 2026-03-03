/**
 * SEO module — Brave Search API + optional DataForSEO + Gemini analysis.
 */

import { callGemini } from './supabase.js';

// ============================================
// Brave Search
// ============================================

async function braveSearch(query) {
  if (!process.env.BRAVE_SEARCH_API_KEY) throw new Error('BRAVE_SEARCH_API_KEY not set');

  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
    { headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brave Search ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.web?.results || []).map(r => ({
    title: r.title,
    url: r.url,
    description: r.description || '',
  }));
}

// ============================================
// DataForSEO (optional)
// ============================================

async function dataForSEOPost(endpoint, payload) {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) return null;

  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');

  const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data?.tasks?.[0]?.result?.[0] || null;
}

// ============================================
// Exports
// ============================================

/**
 * Research a keyword: Brave Search top 10 + optional DataForSEO + Gemini SEO analysis.
 */
export async function researchKeyword(keyword) {
  // Step 1: Brave Search
  const results = await braveSearch(keyword);

  // Step 2: DataForSEO enrichment (optional — skip gracefully)
  let searchVolume = null;
  let keywordDifficulty = null;

  try {
    const seoData = await dataForSEOPost('keywords_data/google_ads/search_volume/live', [
      { keywords: [keyword], language_code: 'en', location_code: 2840 },
    ]);
    if (seoData?.result) {
      const kw = seoData.result[0];
      searchVolume = kw?.search_volume ?? null;
      keywordDifficulty = kw?.competition_level ?? null;
    }
  } catch {
    // DataForSEO not available — continue without it
  }

  // Step 3: Gemini SEO analysis
  const prompt = `You are an SEO expert. Analyze these top 10 Google results for the keyword "${keyword}":

${results.map((r, i) => `${i + 1}. "${r.title}" — ${r.url}\n   ${r.description}`).join('\n\n')}

Return a JSON object (no markdown, no comments):
{
  "search_intent": "informational|commercial|transactional|navigational",
  "secondary_keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "competitor_analysis": "Brief analysis of what top results do well",
  "content_gaps": "What's missing from existing results",
  "recommended_angle": "Best angle for a new article"
}`;

  let analysis = {};
  try {
    const raw = await callGemini(prompt, { temperature: 0.3, maxTokens: 1500 });
    const match = raw.match(/\{[\s\S]*\}/);
    analysis = match ? JSON.parse(match[0]) : {};
  } catch (e) {
    console.error(`  ⚠ Gemini SEO analysis failed: ${e.message}`);
  }

  return {
    keyword,
    search_volume: searchVolume,
    competition: keywordDifficulty,
    secondary_keywords: analysis.secondary_keywords || [],
    search_intent: analysis.search_intent || null,
    competitor_analysis: analysis.competitor_analysis || '',
    content_gaps: analysis.content_gaps || '',
    recommended_angle: analysis.recommended_angle || '',
    top_results: results,
  };
}

/**
 * Check keyword positions for a domain in Brave Search results.
 */
export async function getPositions(domain, keywords) {
  const positions = [];

  for (const keyword of keywords) {
    try {
      const results = await braveSearch(keyword);
      const idx = results.findIndex(r => {
        try { return new URL(r.url).hostname.includes(domain); } catch { return false; }
      });

      positions.push({
        keyword,
        position: idx >= 0 ? idx + 1 : null,
        url: idx >= 0 ? results[idx].url : null,
      });
    } catch (e) {
      positions.push({ keyword, position: null, url: null, error: e.message });
    }
  }

  return positions;
}
