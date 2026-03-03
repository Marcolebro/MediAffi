/**
 * Social Publisher module — Buffer API + Postiz API + DB persistence.
 *
 * Known limitation: Buffer/Postiz need hosted image URLs, not buffers.
 * Media is saved as placeholder. Full implementation needs Supabase Storage upload.
 * // TODO: Upload images to Supabase Storage, get public URLs, then attach to posts.
 */

import { supabase } from './supabase.js';

// ============================================
// Buffer API v1
// ============================================

/**
 * Publish a post to Buffer.
 * @returns {string|null} External post ID from Buffer
 */
export async function publishToBuffer(post) {
  if (!process.env.BUFFER_ACCESS_TOKEN) throw new Error('BUFFER_ACCESS_TOKEN not set');

  // Get Buffer profiles
  const profilesRes = await fetch('https://api.bufferapp.com/1/profiles.json', {
    headers: { Authorization: `Bearer ${process.env.BUFFER_ACCESS_TOKEN}` },
  });

  if (!profilesRes.ok) throw new Error(`Buffer profiles ${profilesRes.status}`);
  const profiles = await profilesRes.json();

  if (!profiles.length) throw new Error('No Buffer profiles configured');

  // Post to the first profile
  const profile = profiles[0];
  const text = post.text || post.article?.title || '';

  const createRes = await fetch('https://api.bufferapp.com/1/updates/create.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.BUFFER_ACCESS_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      profile_ids: profile.id,
      text,
      now: 'false',
      // TODO: Attach media URLs once Supabase Storage upload is implemented
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Buffer create ${createRes.status}: ${err}`);
  }

  const data = await createRes.json();
  return data.updates?.[0]?.id || null;
}

// ============================================
// Postiz API
// ============================================

/**
 * Publish a post to Postiz.
 * @returns {string|null} External post ID from Postiz
 */
export async function publishToPostiz(post) {
  if (!process.env.POSTIZ_API_KEY) throw new Error('POSTIZ_API_KEY not set');

  const baseUrl = process.env.POSTIZ_BASE_URL || 'https://app.postiz.com';
  const text = post.text || post.article?.title || '';

  const res = await fetch(`${baseUrl}/api/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.POSTIZ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: text,
      type: post.type || 'image_post',
      // TODO: Attach media URLs once Supabase Storage upload is implemented
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Postiz ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.id || null;
}

// ============================================
// DB Persistence
// ============================================

/**
 * Save a social post record in the DB.
 */
export async function saveSocialPost(site, article, post, externalId) {
  const { error } = await supabase
    .from('social_posts')
    .insert({
      site_id: site.id,
      article_id: article.id,
      platform: post.type === 'linkedin' ? 'linkedin' : post.type === 'pin' ? 'pinterest' : 'instagram',
      type: post.type || 'image_post',
      content: post.text || article.title || '',
      external_id: externalId,
      status: externalId ? 'posted' : 'draft',
      posted_at: externalId ? new Date().toISOString() : null,
    });

  if (error) throw new Error(`saveSocialPost: ${error.message}`);
}
