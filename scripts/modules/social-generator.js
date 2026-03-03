/**
 * Social Generator module — creates visual social posts using Gemini + Playwright.
 * Dynamic Playwright import so the module loads without it installed.
 */

import { supabase, callGemini } from './supabase.js';

// ============================================
// Internal helpers
// ============================================

function isLightColor(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

async function renderHtmlToImage(html, width, height) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}

function buildSlideHtml(slide, site, num, total) {
  const bg = site.primary_color || '#2563eb';
  const textColor = isLightColor(bg) ? '#1a1a1a' : '#ffffff';
  const accent = site.accent_color || '#059669';

  return `<!DOCTYPE html>
<html>
<head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1080px; height: 1080px; background: ${bg}; color: ${textColor};
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         display: flex; flex-direction: column; justify-content: center; padding: 80px; }
  h2 { font-size: 48px; margin-bottom: 24px; line-height: 1.2; }
  p { font-size: 28px; line-height: 1.6; opacity: 0.9; }
  .footer { position: absolute; bottom: 40px; left: 80px; right: 80px;
            display: flex; justify-content: space-between; font-size: 20px; opacity: 0.7; }
  .accent { color: ${accent}; }
</style></head>
<body>
  <h2>${slide.title || ''}</h2>
  <p>${slide.body || ''}</p>
  <div class="footer">
    <span>${site.name || ''}</span>
    <span>${num}/${total}</span>
  </div>
</body>
</html>`;
}

function renderCarouselSlides(slides, site) {
  return Promise.all(
    slides.map((slide, i) =>
      renderHtmlToImage(buildSlideHtml(slide, site, i + 1, slides.length), 1080, 1080)
    )
  );
}

// ============================================
// Exports
// ============================================

/**
 * Generate a carousel (6 slides) from a DB prompt + Gemini.
 */
export async function generateCarousel(site, article) {
  const { data: prompt } = await supabase
    .from('prompts')
    .select('*')
    .eq('type', 'carousel')
    .eq('category', 'social')
    .eq('is_active', true)
    .or(`site_id.eq.${site.id},site_id.is.null`)
    .order('site_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();

  if (!prompt) throw new Error('No carousel prompt found');

  const filled = prompt.template
    .replace('{{title}}', article.title || '')
    .replace('{{content}}', (article.content || '').slice(0, 2000))
    .replace('{{keyword}}', article.target_keyword || '')
    .replace('{{site_name}}', site.name || '');

  const raw = await callGemini(filled + '\n\nReturn a JSON array of 6 slides: [{"title":"...","body":"..."},...]', {
    model: prompt.model || 'gemini-2.5-flash',
    temperature: prompt.temperature || 0.7,
    maxTokens: prompt.max_tokens || 2000,
  });

  let slides;
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    slides = match ? JSON.parse(match[0]) : [];
  } catch {
    throw new Error('Failed to parse carousel slides from Gemini');
  }

  if (!slides.length) throw new Error('No carousel slides generated');

  const images = await renderCarouselSlides(slides.slice(0, 6), site);
  return { type: 'carousel', images, slides };
}

/**
 * Generate a single image post (1200x675).
 */
export async function generateImagePost(site, article) {
  const bg = site.primary_color || '#2563eb';
  const textColor = isLightColor(bg) ? '#1a1a1a' : '#ffffff';

  const bullets = (article.content || '')
    .match(/^[-*]\s+.+/gm)?.slice(0, 3)
    ?.map(b => `<li>${b.replace(/^[-*]\s+/, '')}</li>`)
    .join('') || '';

  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 675px; background: ${bg}; color: ${textColor};
         font-family: -apple-system, BlinkMacSystemFont, sans-serif;
         display: flex; flex-direction: column; justify-content: center; padding: 60px 80px; }
  h1 { font-size: 42px; margin-bottom: 24px; line-height: 1.2; }
  ul { font-size: 24px; line-height: 1.8; list-style: none; }
  ul li::before { content: "→ "; opacity: 0.7; }
  .brand { position: absolute; bottom: 30px; right: 40px; font-size: 18px; opacity: 0.6; }
</style></head>
<body>
  <h1>${article.title || ''}</h1>
  ${bullets ? `<ul>${bullets}</ul>` : ''}
  <div class="brand">${site.name || ''}</div>
</body></html>`;

  const image = await renderHtmlToImage(html, 1200, 675);
  return { type: 'image_post', images: [image] };
}

/**
 * Generate a Pinterest pin image (1000x1500 vertical).
 */
export async function generatePinImage(site, article) {
  const bg = site.primary_color || '#2563eb';
  const textColor = isLightColor(bg) ? '#1a1a1a' : '#ffffff';

  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1000px; height: 1500px; background: ${bg}; color: ${textColor};
         font-family: -apple-system, BlinkMacSystemFont, sans-serif;
         display: flex; flex-direction: column; justify-content: center; align-items: center;
         text-align: center; padding: 80px; }
  h1 { font-size: 52px; margin-bottom: 32px; line-height: 1.3; }
  p { font-size: 26px; line-height: 1.6; opacity: 0.85; }
  .brand { position: absolute; bottom: 50px; font-size: 22px; opacity: 0.6; }
</style></head>
<body>
  <h1>${article.title || ''}</h1>
  <p>${(article.meta_description || article.metaDescription || '').slice(0, 200)}</p>
  <div class="brand">${site.name || ''}</div>
</body></html>`;

  const image = await renderHtmlToImage(html, 1000, 1500);
  return { type: 'pin', images: [image] };
}

/**
 * Generate a LinkedIn post image (1200x1200 square) via Gemini prompt.
 */
export async function generateLinkedInPost(site, article) {
  const { data: prompt } = await supabase
    .from('prompts')
    .select('*')
    .eq('type', 'linkedin')
    .eq('category', 'social')
    .eq('is_active', true)
    .or(`site_id.eq.${site.id},site_id.is.null`)
    .order('site_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();

  let postText = '';
  if (prompt) {
    const filled = prompt.template
      .replace('{{title}}', article.title || '')
      .replace('{{content}}', (article.content || '').slice(0, 2000))
      .replace('{{keyword}}', article.target_keyword || '');

    postText = await callGemini(filled, {
      model: prompt.model || 'gemini-2.5-flash',
      temperature: prompt.temperature || 0.7,
      maxTokens: prompt.max_tokens || 800,
    });
  } else {
    postText = article.title || '';
  }

  const bg = site.primary_color || '#2563eb';
  const textColor = isLightColor(bg) ? '#1a1a1a' : '#ffffff';
  const displayText = postText.slice(0, 300).replace(/\n/g, '<br>');

  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 1200px; background: ${bg}; color: ${textColor};
         font-family: -apple-system, BlinkMacSystemFont, sans-serif;
         display: flex; flex-direction: column; justify-content: center; padding: 80px; }
  .text { font-size: 36px; line-height: 1.6; }
  .brand { position: absolute; bottom: 40px; left: 80px; font-size: 20px; opacity: 0.6; }
</style></head>
<body>
  <div class="text">${displayText}</div>
  <div class="brand">${site.name || ''}</div>
</body></html>`;

  const image = await renderHtmlToImage(html, 1200, 1200);
  return { type: 'linkedin', images: [image], text: postText };
}

/**
 * Generate all social formats and publish them.
 */
export async function generateAndPublishSocial(site, article) {
  const results = [];

  const generators = [
    ['carousel', () => generateCarousel(site, article)],
    ['image_post', () => generateImagePost(site, article)],
    ['pin', () => generatePinImage(site, article)],
    ['linkedin', () => generateLinkedInPost(site, article)],
  ];

  for (const [name, gen] of generators) {
    try {
      const result = await gen();
      results.push(result);
      console.log(`    ✓ ${name} generated`);
    } catch (e) {
      console.error(`    ⚠ ${name} failed: ${e.message}`);
    }
  }

  // Publish via social-publisher (non-fatal)
  try {
    const { publishToBuffer, publishToPostiz, saveSocialPost } = await import('./social-publisher.js');

    for (const post of results) {
      try {
        if (process.env.BUFFER_ACCESS_TOKEN) {
          const extId = await publishToBuffer({ site, article, ...post });
          await saveSocialPost(site, article, post, extId);
        }
      } catch (e) {
        console.error(`    ⚠ Buffer publish failed: ${e.message}`);
      }

      try {
        if (process.env.POSTIZ_API_KEY) {
          const extId = await publishToPostiz({ site, article, ...post });
          await saveSocialPost(site, article, post, extId);
        }
      } catch (e) {
        console.error(`    ⚠ Postiz publish failed: ${e.message}`);
      }
    }
  } catch (e) {
    console.error(`    ⚠ Social publisher import failed: ${e.message}`);
  }

  return results;
}
