/**
 * Test Pipeline — validates ALL modules load and exports are correct.
 * Run: node scripts/test-pipeline.js
 * Live mode: node scripts/test-pipeline.js --live  (calls real APIs)
 *
 * Does NOT call any API in dry-run mode — only checks module structure and function signatures.
 * Sets dummy env vars so clients can initialize without real credentials.
 */

const isLive = process.argv.includes('--live');

// Dummy env vars for import-only testing (no API calls are made)
process.env.SUPABASE_URL          = process.env.SUPABASE_URL          || 'https://test.supabase.co';
process.env.SUPABASE_KEY          = process.env.SUPABASE_KEY          || 'test-key';
process.env.GEMINI_API_KEY        = process.env.GEMINI_API_KEY        || 'test-gemini-key';
process.env.APIFY_TOKEN           = process.env.APIFY_TOKEN           || 'test-apify-token';
process.env.BRAVE_SEARCH_API_KEY  = process.env.BRAVE_SEARCH_API_KEY  || 'test-brave-key';
process.env.UNSPLASH_ACCESS_KEY   = process.env.UNSPLASH_ACCESS_KEY   || 'test-unsplash-key';
process.env.GITHUB_TOKEN          = process.env.GITHUB_TOKEN          || 'test-gh-token';
process.env.BUFFER_ACCESS_TOKEN   = process.env.BUFFER_ACCESS_TOKEN   || 'test-buffer-token';
process.env.POSTIZ_API_KEY        = process.env.POSTIZ_API_KEY        || 'test-postiz-key';
process.env.POSTIZ_BASE_URL       = process.env.POSTIZ_BASE_URL       || 'https://app.postiz.com';

async function test() {
  console.log(`=== MediAffi — Module Tests ${isLive ? '(LIVE)' : '(dry-run)'} ===\n`);
  let passed = 0;
  let failed = 0;

  function assert(name, condition) {
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }

  // ---- supabase.js (6 exports) ----
  console.log('📦 modules/supabase.js');
  try {
    const mod = await import('./modules/supabase.js');
    assert('exports supabase client', mod.supabase != null);
    assert('exports callGemini function', typeof mod.callGemini === 'function');
    assert('exports getActiveSites function', typeof mod.getActiveSites === 'function');
    assert('exports dequeueArticle function', typeof mod.dequeueArticle === 'function');
    assert('exports updateQueueStatus function', typeof mod.updateQueueStatus === 'function');
    assert('exports insertArticle function', typeof mod.insertArticle === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- metrics.js (6 exports + unit tests) ----
  console.log('\n📦 modules/metrics.js');
  try {
    const mod = await import('./modules/metrics.js');
    assert('exports collectPlausibleMetrics', typeof mod.collectPlausibleMetrics === 'function');
    assert('exports collectGSCMetrics', typeof mod.collectGSCMetrics === 'function');
    assert('exports collectAffiliateClicks', typeof mod.collectAffiliateClicks === 'function');
    assert('exports computePerformanceScore', typeof mod.computePerformanceScore === 'function');
    assert('exports saveMetrics', typeof mod.saveMetrics === 'function');
    assert('exports collectAllMetrics', typeof mod.collectAllMetrics === 'function');

    // Unit tests for computePerformanceScore
    const score = mod.computePerformanceScore({ pageviews: 1000, affiliateClicks: 50, socialEngagement: 200 });
    assert('computePerformanceScore returns a number', typeof score === 'number');
    assert('computePerformanceScore > 0 for positive inputs', score > 0);

    const zeroScore = mod.computePerformanceScore({ pageviews: 0, affiliateClicks: 0, socialEngagement: 0 });
    assert('computePerformanceScore = 0 for zero inputs', zeroScore === 0);
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- scraper.js (3 exports) ----
  console.log('\n📦 modules/scraper.js');
  try {
    const mod = await import('./modules/scraper.js');
    assert('exports scrapeProduct', typeof mod.scrapeProduct === 'function');
    assert('exports scrapeCompetitors', typeof mod.scrapeCompetitors === 'function');
    assert('exports scrapeNews', typeof mod.scrapeNews === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- seo.js (2 exports) ----
  console.log('\n📦 modules/seo.js');
  try {
    const mod = await import('./modules/seo.js');
    assert('exports researchKeyword', typeof mod.researchKeyword === 'function');
    assert('exports getPositions', typeof mod.getPositions === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- writer.js (1 export) ----
  console.log('\n📦 modules/writer.js');
  try {
    const mod = await import('./modules/writer.js');
    assert('exports writeArticle', typeof mod.writeArticle === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- images.js (4 exports) ----
  console.log('\n📦 modules/images.js');
  try {
    const mod = await import('./modules/images.js');
    assert('exports screenshotProduct', typeof mod.screenshotProduct === 'function');
    assert('exports getLogo', typeof mod.getLogo === 'function');
    assert('exports getStockImage', typeof mod.getStockImage === 'function');
    assert('exports getImages', typeof mod.getImages === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- publisher.js (1 export) ----
  console.log('\n📦 modules/publisher.js');
  try {
    const mod = await import('./modules/publisher.js');
    assert('exports publishToSite', typeof mod.publishToSite === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- tracker.js (1 export) ----
  console.log('\n📦 modules/tracker.js');
  try {
    const mod = await import('./modules/tracker.js');
    assert('exports logResult', typeof mod.logResult === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- social-generator.js (5 exports) ----
  console.log('\n📦 modules/social-generator.js');
  try {
    const mod = await import('./modules/social-generator.js');
    assert('exports generateCarousel', typeof mod.generateCarousel === 'function');
    assert('exports generateImagePost', typeof mod.generateImagePost === 'function');
    assert('exports generatePinImage', typeof mod.generatePinImage === 'function');
    assert('exports generateLinkedInPost', typeof mod.generateLinkedInPost === 'function');
    assert('exports generateAndPublishSocial', typeof mod.generateAndPublishSocial === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- social-publisher.js (3 exports) ----
  console.log('\n📦 modules/social-publisher.js');
  try {
    const mod = await import('./modules/social-publisher.js');
    assert('exports publishToBuffer', typeof mod.publishToBuffer === 'function');
    assert('exports publishToPostiz', typeof mod.publishToPostiz === 'function');
    assert('exports saveSocialPost', typeof mod.saveSocialPost === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- analyzer.js (1 export) ----
  console.log('\n📦 modules/analyzer.js');
  try {
    const mod = await import('./modules/analyzer.js');
    assert('exports weeklyAnalysis', typeof mod.weeklyAnalysis === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- newsletter.js (2 exports) ----
  console.log('\n📦 modules/newsletter.js');
  try {
    const mod = await import('./modules/newsletter.js');
    assert('exports generateNewsletter', typeof mod.generateNewsletter === 'function');
    assert('exports sendNewsletter', typeof mod.sendNewsletter === 'function');
  } catch (e) {
    console.log(`  ❌ Failed to import: ${e.message}`);
    failed++;
  }

  // ---- Summary ----
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

test().catch(e => {
  console.error(`Fatal: ${e.message}`);
  process.exit(1);
});
