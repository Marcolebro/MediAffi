import { createSign } from 'node:crypto';
import { supabase } from './supabase.js';

// ============================================
// Plausible Analytics
// ============================================

export async function collectPlausibleMetrics(site, date) {
  const siteId = site.plausible_site_id;
  if (!siteId || !process.env.PLAUSIBLE_API_KEY) {
    console.log(`  ⏭ Plausible skipped for ${site.name} (not configured)`);
    return [];
  }

  const res = await fetch(
    `https://plausible.io/api/v1/stats/breakdown?` +
    `site_id=${encodeURIComponent(siteId)}&period=day&date=${date}` +
    `&property=event:page&metrics=visitors,pageviews,bounce_rate,visit_duration`,
    { headers: { Authorization: `Bearer ${process.env.PLAUSIBLE_API_KEY}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Plausible API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.results || [];
}

// ============================================
// Google Search Console
// ============================================

async function getGSCAccessToken() {
  const raw = Buffer.from(process.env.GOOGLE_SEARCH_CONSOLE_KEY, 'base64').toString();
  const key = JSON.parse(raw);

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(key.private_key, 'base64url');

  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) throw new Error(`GSC auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function collectGSCMetrics(site, date) {
  if (!site.gsc_property || !process.env.GOOGLE_SEARCH_CONSOLE_KEY) {
    console.log(`  ⏭ GSC skipped for ${site.name} (not configured)`);
    return [];
  }

  const token = await getGSCAccessToken();
  const siteUrl = encodeURIComponent(site.gsc_property);

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: date,
        endDate: date,
        dimensions: ['page'],
        rowLimit: 1000,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GSC API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.rows || [];
}

// ============================================
// Affiliate Clicks (from Supabase)
// ============================================

export async function collectAffiliateClicks(siteId, date) {
  const startOfDay = `${date}T00:00:00Z`;
  const endOfDay = `${date}T23:59:59Z`;

  const { data, error } = await supabase
    .from('affiliate_clicks')
    .select('article_slug')
    .eq('site_id', siteId)
    .gte('clicked_at', startOfDay)
    .lte('clicked_at', endOfDay);

  if (error) throw new Error(`affiliate_clicks query: ${error.message}`);

  // Group by article_slug
  const counts = {};
  for (const row of data || []) {
    counts[row.article_slug] = (counts[row.article_slug] || 0) + 1;
  }
  return counts;
}

// ============================================
// Performance Score
// ============================================

export function computePerformanceScore({ pageviews = 0, affiliateClicks = 0, socialEngagement = 0 }) {
  // Log-scale normalization to handle different magnitudes
  const traffic = Math.log10(Math.max(pageviews, 1));
  const clicks = Math.log10(Math.max(affiliateClicks, 1));
  const social = Math.log10(Math.max(socialEngagement, 1));

  // Weighted: traffic 0.3 + clicks 0.4 + social 0.3
  return +(traffic * 0.3 + clicks * 0.4 + social * 0.3).toFixed(2);
}

// ============================================
// Save Metrics (upsert per article per day)
// ============================================

export async function saveMetrics(rows) {
  if (!rows.length) return;

  const { error } = await supabase
    .from('metrics')
    .upsert(rows, { onConflict: 'article_id,date' });

  if (error) throw new Error(`metrics upsert: ${error.message}`);
  console.log(`  ✓ ${rows.length} metrics rows saved`);
}

// ============================================
// Collect all metrics for a site for a given date
// ============================================

export async function collectAllMetrics(site, date) {
  console.log(`\n📊 Collecting metrics for ${site.name} — ${date}`);

  // Get all published articles for this site
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, slug, site_id')
    .eq('site_id', site.id)
    .eq('status', 'published');

  if (error) throw new Error(`articles query: ${error.message}`);
  if (!articles?.length) {
    console.log('  No published articles, skipping');
    return;
  }

  // Collect from all sources in parallel
  const [plausible, gsc, affClicks] = await Promise.all([
    collectPlausibleMetrics(site, date).catch(e => { console.error(`  ⚠ Plausible: ${e.message}`); return []; }),
    collectGSCMetrics(site, date).catch(e => { console.error(`  ⚠ GSC: ${e.message}`); return []; }),
    collectAffiliateClicks(site.id, date).catch(e => { console.error(`  ⚠ Clicks: ${e.message}`); return {}; }),
  ]);

  // Index Plausible data by page path
  const plausibleByPage = {};
  for (const row of plausible) {
    plausibleByPage[row.page] = row;
  }

  // Index GSC data by page URL
  const gscByPage = {};
  for (const row of gsc) {
    const path = new URL(row.keys[0]).pathname;
    gscByPage[path] = row;
  }

  // Get social engagement per article
  const { data: socialData } = await supabase
    .from('social_posts')
    .select('article_id, likes, comments, shares, saves')
    .eq('site_id', site.id)
    .eq('status', 'posted');

  const socialByArticle = {};
  for (const post of socialData || []) {
    if (!socialByArticle[post.article_id]) socialByArticle[post.article_id] = 0;
    socialByArticle[post.article_id] += (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
  }

  // Build metrics rows
  const rows = articles.map(article => {
    const pagePath = `/${article.slug}`;
    const p = plausibleByPage[pagePath] || {};
    const g = gscByPage[pagePath] || {};
    const clickCount = affClicks[article.slug] || 0;
    const socialEng = socialByArticle[article.id] || 0;

    const pageviews = p.pageviews || 0;
    const score = computePerformanceScore({ pageviews, affiliateClicks: clickCount, socialEngagement: socialEng });

    return {
      article_id: article.id,
      site_id: site.id,
      date,
      pageviews,
      unique_visitors: p.visitors || 0,
      avg_time_seconds: p.visit_duration || null,
      bounce_rate: p.bounce_rate || null,
      google_position: g.position || null,
      impressions: g.impressions || 0,
      organic_clicks: g.clicks || 0,
      ctr: g.ctr || null,
      affiliate_clicks: clickCount,
      performance_score: score,
    };
  });

  await saveMetrics(rows);
}
