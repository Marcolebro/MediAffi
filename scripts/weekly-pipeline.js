/**
 * Weekly Pipeline — runs every Friday at 9h UTC via GitHub Actions
 *
 * For each active site:
 * 1. Collect metrics for the past 7 days
 * 2. Run AI-powered weekly analysis (top/flop, patterns, suggestions)
 * 3. Generate and send newsletter (if auto_newsletter = true)
 */

import { supabase } from './modules/supabase.js';
import { collectAllMetrics } from './modules/metrics.js';
import { weeklyAnalysis } from './modules/analyzer.js';
import { generateNewsletter, sendNewsletter } from './modules/newsletter.js';

async function run() {
  console.log('=== MediAffi Weekly Pipeline ===');
  console.log(`Started at ${new Date().toISOString()}\n`);

  // Get all active sites
  const { data: sites, error } = await supabase
    .from('sites')
    .select('*')
    .eq('active', true);

  if (error) throw new Error(`Failed to fetch sites: ${error.message}`);
  if (!sites?.length) {
    console.log('No active sites found. Exiting.');
    return;
  }

  console.log(`Found ${sites.length} active site(s)\n`);

  const results = { success: 0, failed: 0, errors: [] };

  for (const site of sites) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Processing: ${site.name} (${site.slug})`);
    console.log('='.repeat(50));

    try {
      // Step 1: Collect metrics for last 7 days
      const today = new Date();
      for (let i = 7; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        try {
          await collectAllMetrics(site, dateStr);
        } catch (e) {
          console.error(`  ⚠ Metrics ${dateStr}: ${e.message}`);
        }
      }

      // Step 2: Weekly analysis
      await weeklyAnalysis(site.id);

      // Step 3: Newsletter (if enabled)
      if (site.auto_newsletter) {
        const newsletterId = await generateNewsletter(site.id);
        await sendNewsletter(newsletterId);
      } else {
        console.log('\n📭 Newsletter disabled for this site');
      }

      results.success++;
    } catch (e) {
      console.error(`\n❌ Failed for ${site.name}: ${e.message}`);
      results.failed++;
      results.errors.push({ site: site.name, error: e.message });
    }
  }

  // Summary
  console.log(`\n\n${'='.repeat(50)}`);
  console.log('WEEKLY PIPELINE SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed:  ${results.failed}`);

  if (results.errors.length) {
    console.log('\nErrors:');
    for (const e of results.errors) {
      console.log(`  - ${e.site}: ${e.error}`);
    }
  }

  console.log(`\nFinished at ${new Date().toISOString()}`);

  // Exit with error code if any failures
  if (results.failed > 0) process.exit(1);
}

run().catch(e => {
  console.error(`\n💥 Fatal error: ${e.message}`);
  process.exit(1);
});
