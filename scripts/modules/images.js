/**
 * Images module — Playwright screenshots + Clearbit logos + Unsplash.
 * Uses dynamic import for Playwright so modules load without it installed.
 */

/**
 * Take a screenshot of a product URL → WebP buffer.
 */
export async function screenshotProduct(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    return buffer;
  } finally {
    await browser.close();
  }
}

/**
 * Get a company logo via Clearbit Logo API.
 */
export async function getLogo(domain) {
  const res = await fetch(`https://logo.clearbit.com/${domain}`);
  if (!res.ok) throw new Error(`Clearbit logo ${res.status} for ${domain}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Search Unsplash and download a stock image.
 */
export async function getStockImage(query) {
  if (!process.env.UNSPLASH_ACCESS_KEY) throw new Error('UNSPLASH_ACCESS_KEY not set');

  const searchRes = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1`,
    { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
  );

  if (!searchRes.ok) {
    const err = await searchRes.text();
    throw new Error(`Unsplash search ${searchRes.status}: ${err}`);
  }

  const data = await searchRes.json();
  const photo = data.results?.[0];
  if (!photo) throw new Error(`No Unsplash results for "${query}"`);

  const imgRes = await fetch(photo.urls.regular);
  if (!imgRes.ok) throw new Error(`Unsplash download failed: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

/**
 * Orchestrator: gather all images for an article.
 */
export async function getImages({ keyword, productUrl, domain }) {
  let featured = null;
  const additional = [];

  // Featured: product screenshot or stock image
  if (productUrl) {
    try {
      featured = await screenshotProduct(productUrl);
    } catch (e) {
      console.error(`  ⚠ Screenshot failed: ${e.message}`);
    }
  }
  if (!featured) {
    try {
      featured = await getStockImage(keyword);
    } catch (e) {
      console.error(`  ⚠ Stock image failed: ${e.message}`);
    }
  }

  // Additional: logo
  if (domain) {
    try {
      additional.push({ type: 'logo', buffer: await getLogo(domain) });
    } catch (e) {
      console.error(`  ⚠ Logo fetch failed: ${e.message}`);
    }
  }

  return { featured, additional };
}
