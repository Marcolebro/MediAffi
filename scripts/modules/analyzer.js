import { supabase, callGemini } from './supabase.js';

/**
 * Run weekly analysis for a site:
 * 1. Aggregate metrics for the past 7 days
 * 2. Rank articles by performance_score → top 5 / flop 5
 * 3. Aggregate social insights
 * 4. Send everything to Gemini for analysis
 * 5. Save to weekly_analysis table
 */
export async function weeklyAnalysis(siteId) {
  console.log(`\n🔍 Running weekly analysis for site ${siteId}`);

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 7);

  const startDate = weekStart.toISOString().split('T')[0];
  const endDate = new Date(today.getTime() - 86400000).toISOString().split('T')[0]; // yesterday

  // ---- 1. Get aggregated metrics for the week ----
  const { data: metrics, error: metricsErr } = await supabase
    .from('metrics')
    .select(`
      article_id,
      pageviews,
      unique_visitors,
      organic_clicks,
      affiliate_clicks,
      revenue,
      performance_score,
      google_position,
      impressions
    `)
    .eq('site_id', siteId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (metricsErr) throw new Error(`metrics query: ${metricsErr.message}`);

  // Aggregate per article
  const byArticle = {};
  for (const m of metrics || []) {
    if (!byArticle[m.article_id]) {
      byArticle[m.article_id] = {
        article_id: m.article_id,
        pageviews: 0,
        unique_visitors: 0,
        organic_clicks: 0,
        affiliate_clicks: 0,
        revenue: 0,
        avg_position: [],
        impressions: 0,
        scores: [],
      };
    }
    const a = byArticle[m.article_id];
    a.pageviews += m.pageviews || 0;
    a.unique_visitors += m.unique_visitors || 0;
    a.organic_clicks += m.organic_clicks || 0;
    a.affiliate_clicks += m.affiliate_clicks || 0;
    a.revenue += m.revenue || 0;
    a.impressions += m.impressions || 0;
    if (m.google_position) a.avg_position.push(m.google_position);
    if (m.performance_score) a.scores.push(m.performance_score);
  }

  // Compute average score per article
  const ranked = Object.values(byArticle).map(a => ({
    ...a,
    avg_score: a.scores.length ? +(a.scores.reduce((s, v) => s + v, 0) / a.scores.length).toFixed(2) : 0,
    avg_position: a.avg_position.length
      ? +(a.avg_position.reduce((s, v) => s + v, 0) / a.avg_position.length).toFixed(1)
      : null,
  }));

  ranked.sort((a, b) => b.avg_score - a.avg_score);

  // ---- 2. Get article titles for context ----
  const articleIds = ranked.map(a => a.article_id);
  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, slug, type, target_keyword, published_at')
    .in('id', articleIds.length ? articleIds : ['00000000-0000-0000-0000-000000000000']);

  const titlesMap = {};
  for (const art of articles || []) {
    titlesMap[art.id] = art;
  }

  // Enrich ranked data with titles
  const enriched = ranked.map(a => ({
    ...a,
    title: titlesMap[a.article_id]?.title || 'Unknown',
    slug: titlesMap[a.article_id]?.slug || '',
    type: titlesMap[a.article_id]?.type || '',
    keyword: titlesMap[a.article_id]?.target_keyword || '',
  }));

  const top5 = enriched.slice(0, 5);
  const flop5 = enriched.slice(-5).reverse();

  // ---- 3. Social insights ----
  const { data: socialPosts } = await supabase
    .from('social_posts')
    .select('platform, type, likes, comments, shares, saves, reach, clicks')
    .eq('site_id', siteId)
    .eq('status', 'posted')
    .gte('posted_at', `${startDate}T00:00:00Z`)
    .lte('posted_at', `${endDate}T23:59:59Z`);

  const socialByPlatform = {};
  let bestFormat = null;
  let bestFormatEngagement = 0;

  for (const post of socialPosts || []) {
    const eng = (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
    const key = `${post.platform}:${post.type}`;
    if (!socialByPlatform[key]) socialByPlatform[key] = { engagement: 0, count: 0, reach: 0, clicks: 0 };
    socialByPlatform[key].engagement += eng;
    socialByPlatform[key].count += 1;
    socialByPlatform[key].reach += post.reach || 0;
    socialByPlatform[key].clicks += post.clicks || 0;

    if (eng > bestFormatEngagement) {
      bestFormatEngagement = eng;
      bestFormat = key;
    }
  }

  // ---- 4. Totals ----
  const totals = {
    articles_published: enriched.length,
    total_pageviews: enriched.reduce((s, a) => s + a.pageviews, 0),
    total_affiliate_clicks: enriched.reduce((s, a) => s + a.affiliate_clicks, 0),
    total_revenue: +enriched.reduce((s, a) => s + a.revenue, 0).toFixed(2),
  };

  // ---- 5. Call Gemini for analysis ----
  const prompt = `Tu es un analyste performance pour un site d'affiliation.

Voici les données de la semaine (${startDate} → ${endDate}) :

**Totaux :**
- Articles publiés : ${totals.articles_published}
- Pageviews : ${totals.total_pageviews}
- Clics affiliation : ${totals.total_affiliate_clicks}
- Revenus : ${totals.total_revenue}€

**Top 5 articles :**
${top5.map((a, i) => `${i + 1}. "${a.title}" (${a.type}) — score: ${a.avg_score}, vues: ${a.pageviews}, clics: ${a.affiliate_clicks}, position: ${a.avg_position ?? 'N/A'}, keyword: "${a.keyword}"`).join('\n')}

**Flop 5 articles :**
${flop5.map((a, i) => `${i + 1}. "${a.title}" (${a.type}) — score: ${a.avg_score}, vues: ${a.pageviews}, clics: ${a.affiliate_clicks}, position: ${a.avg_position ?? 'N/A'}, keyword: "${a.keyword}"`).join('\n')}

**Social (par format) :**
${Object.entries(socialByPlatform).map(([k, v]) => `- ${k} : ${v.count} posts, engagement ${v.engagement}, reach ${v.reach}`).join('\n') || 'Pas de données social'}

Réponds en JSON strict (pas de markdown, pas de commentaires) avec cette structure :
{
  "top_patterns": ["pattern1", "pattern2", ...],
  "prompt_suggestions": [{"type": "review|comparatif|top_list|guide|actu", "suggestion": "..."}],
  "next_week_priorities": ["priorité1", "priorité2", ...],
  "social_insights": [{"platform": "...", "insight": "..."}]
}`;

  let analysis;
  try {
    const raw = await callGemini(prompt, { temperature: 0.5, maxTokens: 2000 });
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch (e) {
    console.error(`  ⚠ Gemini analysis failed: ${e.message}`);
    analysis = { top_patterns: [], prompt_suggestions: [], next_week_priorities: [], social_insights: [] };
  }

  // ---- 6. Save to weekly_analysis ----
  const row = {
    site_id: siteId,
    week_start: startDate,
    articles_published: totals.articles_published,
    total_pageviews: totals.total_pageviews,
    total_affiliate_clicks: totals.total_affiliate_clicks,
    total_revenue: totals.total_revenue,
    top_patterns: analysis.top_patterns || [],
    prompt_suggestions: analysis.prompt_suggestions || [],
    next_week_priorities: analysis.next_week_priorities || [],
    top_articles: top5.map(a => ({ title: a.title, slug: a.slug, score: a.avg_score, pageviews: a.pageviews, clicks: a.affiliate_clicks })),
    flop_articles: flop5.map(a => ({ title: a.title, slug: a.slug, score: a.avg_score, pageviews: a.pageviews, clicks: a.affiliate_clicks })),
    best_social_format: bestFormat,
    social_insights: analysis.social_insights || [],
  };

  const { error: upsertErr } = await supabase
    .from('weekly_analysis')
    .upsert(row, { onConflict: 'site_id,week_start' });

  if (upsertErr) throw new Error(`weekly_analysis upsert: ${upsertErr.message}`);

  console.log(`  ✓ Weekly analysis saved (${startDate})`);
  console.log(`    Top: "${top5[0]?.title || 'N/A'}" — Flop: "${flop5[0]?.title || 'N/A'}"`);

  return row;
}
