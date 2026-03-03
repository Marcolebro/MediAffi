import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Call Gemini API with a prompt and optional system instruction.
 * Uses the REST API — no extra dependency needed.
 */
async function callGemini(prompt, { model = 'gemini-2.5-flash', temperature = 0.7, maxTokens = 4000, systemPrompt = '' } = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  const body = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ============================================
// DB Helpers
// ============================================

async function getActiveSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('active', true);

  if (error) throw new Error(`getActiveSites: ${error.message}`);
  return data || [];
}

async function dequeueArticle(siteId) {
  const { data: task, error: fetchErr } = await supabase
    .from('article_queue')
    .select('*')
    .eq('site_id', siteId)
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (fetchErr || !task) return null;

  const { error: updateErr } = await supabase
    .from('article_queue')
    .update({ status: 'scraped' })
    .eq('id', task.id);

  if (updateErr) throw new Error(`dequeueArticle update: ${updateErr.message}`);
  return task;
}

async function updateQueueStatus(queueId, status, extraData = {}) {
  const { error } = await supabase
    .from('article_queue')
    .update({ status, ...extraData })
    .eq('id', queueId);

  if (error) throw new Error(`updateQueueStatus: ${error.message}`);
}

async function insertArticle(articleData) {
  const { data, error } = await supabase
    .from('articles')
    .insert(articleData)
    .select('id')
    .single();

  if (error) throw new Error(`insertArticle: ${error.message}`);
  return data.id;
}

export { supabase, callGemini, getActiveSites, dequeueArticle, updateQueueStatus, insertArticle };
