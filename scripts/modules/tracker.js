import { supabase } from './supabase.js';

/**
 * Log a pipeline result and optionally update the article_queue error_log.
 */
export async function logResult(site, status, data = {}) {
  const prefix = `[${site?.name || 'unknown'}]`;
  if (status === 'success') {
    console.log(`  ✓ ${prefix} ${data.message || 'OK'}`);
  } else {
    console.error(`  ✗ ${prefix} ${data.message || status}`);
  }

  if (data.queueId && status !== 'success') {
    try {
      await supabase
        .from('article_queue')
        .update({ error_log: data.message || status })
        .eq('id', data.queueId);
    } catch (e) {
      console.error(`  ⚠ Failed to update error_log: ${e.message}`);
    }
  }
}
