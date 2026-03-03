/**
 * Scraper module — Apify REST API v2 (no SDK) + HN Algolia.
 */

const APIFY_BASE = 'https://api.apify.com/v2';

async function apifyRun(actorId, input) {
  if (!process.env.APIFY_TOKEN) throw new Error('APIFY_TOKEN not set');

  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apify ${actorId} error ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Scrape a product page for structured data using Cheerio scraper.
 */
export async function scrapeProduct(keyword, productUrl) {
  const items = await apifyRun('apify~cheerio-scraper', {
    startUrls: [{ url: productUrl }],
    pageFunction: `async function pageFunction(context) {
      const { $, request } = context;
      return {
        url: request.url,
        title: $('title').text().trim(),
        h1: $('h1').first().text().trim(),
        metaDescription: $('meta[name="description"]').attr('content') || '',
        price: $('[class*="price"], [data-price]').first().text().trim(),
        images: $('img[src]').map((_, el) => $(el).attr('src')).get().slice(0, 5),
        keyword,
      };
    }`,
    maxRequestsPerCrawl: 1,
  });

  return items[0] || { url: productUrl, keyword, title: '', h1: '', metaDescription: '', price: '', images: [] };
}

/**
 * Scrape top 5 Google results for a keyword using Google Search scraper.
 */
export async function scrapeCompetitors(keyword) {
  const items = await apifyRun('apify~google-search-scraper', {
    queries: keyword,
    maxPagesPerQuery: 1,
    resultsPerPage: 5,
  });

  return items.slice(0, 5).map(item => ({
    title: item.title || '',
    url: item.url || '',
    description: item.description || '',
    position: item.position || 0,
  }));
}

/**
 * Scrape news from HN Algolia (free) + Reddit via Apify.
 */
export async function scrapeNews(niche) {
  const results = { hn: [], reddit: [] };

  // HN Algolia — free, no auth needed
  try {
    const hnRes = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(niche)}&tags=story&hitsPerPage=5`
    );
    if (hnRes.ok) {
      const hnData = await hnRes.json();
      results.hn = (hnData.hits || []).map(h => ({
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        points: h.points || 0,
        source: 'hackernews',
      }));
    }
  } catch (e) {
    console.error(`  ⚠ HN scrape failed: ${e.message}`);
  }

  // Reddit via Apify (if token available)
  if (process.env.APIFY_TOKEN) {
    try {
      const redditItems = await apifyRun('trudax~reddit-scraper-lite', {
        searches: [{ term: niche, sort: 'new', time: 'week' }],
        maxItems: 5,
      });
      results.reddit = redditItems.slice(0, 5).map(r => ({
        title: r.title || '',
        url: r.url || '',
        score: r.score || 0,
        source: 'reddit',
      }));
    } catch (e) {
      console.error(`  ⚠ Reddit scrape failed: ${e.message}`);
    }
  }

  return results;
}
