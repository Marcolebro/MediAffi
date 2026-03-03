/**
 * Daily Pipeline — runs every day at 6h UTC via GitHub Actions
 *
 * For each active site:
 * 1. Dequeue next article task
 * 2. Scrape product + competitors + news (parallel)
 * 3. SEO research
 * 4. Write article via Gemini
 * 5. Generate images
 * 6. Publish to site repo
 * 7. Insert article in DB + mark queue as published
 * 8. Generate & publish social posts (non-fatal)
 */

import { getActiveSites, dequeueArticle, updateQueueStatus, insertArticle } from './modules/supabase.js';
import { scrapeProduct, scrapeCompetitors, scrapeNews } from './modules/scraper.js';
import { researchKeyword } from './modules/seo.js';
import { writeArticle } from './modules/writer.js';
import { getImages } from './modules/images.js';
import { publishToSite } from './modules/publisher.js';
import { logResult } from './modules/tracker.js';

async function run() {
  console.log('=== MediAffi Daily Pipeline ===');
  console.log(`Started at ${new Date().toISOString()}\n`);

  const sites = await getActiveSites();
  if (!sites.length) {
    console.log('No active sites found. Exiting.');
    return;
  }

  console.log(`Found ${sites.length} active site(s)\n`);

  const results = { success: 0, skipped: 0, failed: 0, errors: [] };

  for (const site of sites) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Processing: ${site.name} (${site.slug})`);
    console.log('='.repeat(50));

    // 1. Dequeue next task
    const task = await dequeueArticle(site.id);
    if (!task) {
      console.log('  No pending articles in queue — skipping');
      results.skipped++;
      continue;
    }

    console.log(`  Task: "${task.keyword}" (${task.type || 'review'})`);

    try {
      // 2. Scrape in parallel
      const [scraped, competitorData, newsData] = await Promise.allSettled([
        scrapeProduct(task.keyword, task.product_url || `https://www.google.com/search?q=${encodeURIComponent(task.keyword)}`),
        scrapeCompetitors(task.keyword),
        scrapeNews(site.niche || task.keyword),
      ]).then(r => r.map(p => p.status === 'fulfilled' ? p.value : null));

      // 3. SEO research
      const seo = await researchKeyword(task.keyword);

      // 4. Write article
      const article = await writeArticle({
        task,
        scraped,
        seo,
        site,
        competitorData,
        newsData,
      });

      console.log(`  ✓ Article written: "${article.title}" (${article.wordCount} words)`);

      // 5. Images
      const images = await getImages({
        keyword: task.keyword,
        productUrl: task.product_url,
        domain: scraped?.url ? new URL(scraped.url).hostname : null,
      });

      // 6. Publish to site
      const published = await publishToSite({ site, article, images });

      // 7. Insert article in DB
      const articleId = await insertArticle({
        site_id: site.id,
        title: article.title,
        slug: article.slug,
        content: article.content,
        meta_description: article.metaDescription,
        type: task.type || 'review',
        target_keyword: task.keyword,
        secondary_keywords: seo.secondary_keywords || [],
        tags: article.tags,
        category: article.category,
        word_count: article.wordCount,
        prompt_id: article.promptId,
        prompt_version: article.promptVersion,
        model_used: article.modelUsed,
        commit_hash: published.commit,
        file_path: published.filePath,
        status: 'published',
        published_at: new Date().toISOString(),
      });

      // Mark queue as published
      await updateQueueStatus(task.id, 'published', { article_id: articleId });
      logResult(site, 'success', { message: `Published "${article.title}"` });

      // 8. Social (non-fatal)
      try {
        const { generateAndPublishSocial } = await import('./modules/social-generator.js');
        await generateAndPublishSocial(site, { id: articleId, ...article });
        console.log('  ✓ Social posts generated');
      } catch (e) {
        console.error(`  ⚠ Social step failed (non-fatal): ${e.message}`);
      }

      results.success++;
    } catch (e) {
      console.error(`\n  ✗ Failed for ${site.name}: ${e.message}`);
      results.failed++;
      results.errors.push({ site: site.name, error: e.message });

      await updateQueueStatus(task.id, 'failed', { error_log: e.message }).catch(() => {});
      logResult(site, 'error', { message: e.message, queueId: task.id });
    }
  }

  // Summary
  console.log(`\n\n${'='.repeat(50)}`);
  console.log('DAILY PIPELINE SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Success: ${results.success}`);
  console.log(`⏭  Skipped: ${results.skipped}`);
  console.log(`❌ Failed:  ${results.failed}`);

  if (results.errors.length) {
    console.log('\nErrors:');
    for (const e of results.errors) {
      console.log(`  - ${e.site}: ${e.error}`);
    }
  }

  console.log(`\nFinished at ${new Date().toISOString()}`);

  if (results.failed > 0) process.exit(1);
}

run().catch(e => {
  console.error(`\n💥 Fatal error: ${e.message}`);
  process.exit(1);
});
