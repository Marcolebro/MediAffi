import { supabase, callGemini } from './supabase.js';

const RESEND_BASE = 'https://api.resend.com';

// ============================================
// Generate newsletter content via Gemini
// ============================================

export async function generateNewsletter(siteId) {
  console.log(`\n📰 Generating newsletter for site ${siteId}`);

  // 1. Get site config
  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .single();

  if (siteErr) throw new Error(`site query: ${siteErr.message}`);

  // 2. Get top 3 articles of the week (by performance_score)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const startDate = weekAgo.toISOString().split('T')[0];

  const { data: topMetrics } = await supabase
    .from('metrics')
    .select('article_id, performance_score')
    .eq('site_id', siteId)
    .gte('date', startDate)
    .order('performance_score', { ascending: false })
    .limit(20);

  // Deduplicate by article_id, keep best score
  const seen = new Set();
  const uniqueArticleIds = [];
  for (const m of topMetrics || []) {
    if (!seen.has(m.article_id)) {
      seen.add(m.article_id);
      uniqueArticleIds.push(m.article_id);
    }
    if (uniqueArticleIds.length >= 3) break;
  }

  const { data: topArticles } = await supabase
    .from('articles')
    .select('id, title, slug, meta_description, type')
    .in('id', uniqueArticleIds.length ? uniqueArticleIds : ['00000000-0000-0000-0000-000000000000']);

  // Sort articles to match score order
  const articlesOrdered = uniqueArticleIds
    .map(id => topArticles?.find(a => a.id === id))
    .filter(Boolean);

  // 3. Get active sponsor
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('*')
    .eq('site_id', siteId)
    .eq('active', true)
    .lte('start_date', new Date().toISOString().split('T')[0])
    .gte('end_date', new Date().toISOString().split('T')[0])
    .limit(1)
    .single();

  // 4. Get the weekly_recap prompt
  const { data: prompt } = await supabase
    .from('prompts')
    .select('*')
    .eq('type', 'weekly_recap')
    .eq('category', 'newsletter')
    .eq('is_active', true)
    .or(`site_id.eq.${siteId},site_id.is.null`)
    .order('site_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();

  if (!prompt) throw new Error('No weekly_recap prompt found');

  // 5. Build the prompt with template variables
  const articlesText = articlesOrdered.map((a, i) =>
    `${i + 1}. "${a.title}" (${a.type}) — ${a.meta_description || ''}\n   Lien : /${a.slug}`
  ).join('\n');

  const sponsorText = sponsor
    ? `Sponsor actif (placement: ${sponsor.placement}) :\n- Nom : ${sponsor.name}\n- Contenu : ${sponsor.content}\n- Lien : ${sponsor.link}\n- Image : ${sponsor.image_url || 'N/A'}`
    : 'Aucun sponsor actif cette semaine';

  const filledTemplate = prompt.template
    .replace('{{site_name}}', site.name)
    .replace('{{articles}}', articlesText)
    .replace('{{news}}', 'Pas de news externes cette semaine')
    .replace('{{resource}}', 'Pas de ressource sélectionnée cette semaine')
    .replace('{{sponsor}}', sponsorText);

  // 6. Call Gemini to generate content
  const geminiPrompt = `${filledTemplate}

IMPORTANT : Génère le résultat en JSON strict avec cette structure :
{
  "subject": "Objet de l'email (50 chars max)",
  "content_sections": [
    {"type": "intro", "html": "<p>...</p>"},
    {"type": "sponsor_top", "html": "<div>...</div>"},
    {"type": "articles", "html": "<div>...</div>"},
    {"type": "sponsor_middle", "html": "<div>...</div>"},
    {"type": "news", "html": "<div>...</div>"},
    {"type": "resource", "html": "<div>...</div>"},
    {"type": "sponsor_bottom", "html": "<div>...</div>"},
    {"type": "cta", "html": "<p>...</p>"}
  ]
}

Utilise du HTML inline-style compatible email (pas de classes CSS, pas de flexbox/grid).
Styles : font-family sans-serif, max-width 600px, couleur primaire ${site.primary_color || '#2563eb'}.`;

  const raw = await callGemini(geminiPrompt, {
    model: prompt.model || 'gemini-2.5-flash',
    temperature: prompt.temperature || 0.7,
    maxTokens: prompt.max_tokens || 3000,
    systemPrompt: prompt.system_prompt || '',
  });

  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    throw new Error('Failed to parse Gemini newsletter response as JSON');
  }

  if (!parsed?.subject || !parsed?.content_sections) {
    throw new Error('Invalid newsletter structure from Gemini');
  }

  // 7. Wrap content in responsive email HTML template
  const bodyHtml = parsed.content_sections
    .filter(s => s.html && s.html.trim())
    .map(s => s.html)
    .join('\n');

  const fullHtml = buildEmailTemplate({
    body: bodyHtml,
    siteName: site.name,
    primaryColor: site.primary_color || '#2563eb',
    accentColor: site.accent_color || '#059669',
  });

  // 8. Save to newsletters table
  const { data: newsletter, error: insertErr } = await supabase
    .from('newsletters')
    .insert({
      site_id: siteId,
      subject: parsed.subject,
      content_html: fullHtml,
      articles_included: articlesOrdered.map(a => a.id),
      sponsor_id: sponsor?.id || null,
      status: 'draft',
    })
    .select('id')
    .single();

  if (insertErr) throw new Error(`newsletter insert: ${insertErr.message}`);

  console.log(`  ✓ Newsletter generated: "${parsed.subject}"`);
  return newsletter.id;
}

// ============================================
// Send newsletter via Resend API
// ============================================

export async function sendNewsletter(newsletterId) {
  console.log(`\n📤 Sending newsletter ${newsletterId}`);

  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');

  // 1. Get newsletter
  const { data: newsletter, error: nlErr } = await supabase
    .from('newsletters')
    .select('*, sites!inner(name, resend_audience_id, domain)')
    .eq('id', newsletterId)
    .single();

  if (nlErr) throw new Error(`newsletter query: ${nlErr.message}`);
  if (newsletter.status === 'sent') {
    console.log('  Already sent, skipping');
    return;
  }

  const site = newsletter.sites;
  const audienceId = site.resend_audience_id;
  if (!audienceId) throw new Error(`No resend_audience_id configured for site`);

  // 2. Get contacts from the Resend audience
  const contactsRes = await fetch(`${RESEND_BASE}/audiences/${audienceId}/contacts`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });

  if (!contactsRes.ok) {
    const err = await contactsRes.text();
    throw new Error(`Resend get contacts ${contactsRes.status}: ${err}`);
  }

  const { data: contacts } = await contactsRes.json();
  const recipients = (contacts || [])
    .filter(c => !c.unsubscribed)
    .map(c => c.email);

  if (recipients.length === 0) {
    console.log('  No active subscribers, skipping');
    return;
  }

  // 3. Send via Resend batch API (max 100 per batch)
  const fromAddress = `${site.name} <newsletter@${site.domain || 'example.com'}>`;
  const batchSize = 100;
  let totalSent = 0;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);

    const emails = batch.map(to => ({
      from: fromAddress,
      to,
      subject: newsletter.subject,
      html: newsletter.content_html,
    }));

    const sendRes = await fetch(`${RESEND_BASE}/emails/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emails),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      throw new Error(`Resend batch send ${sendRes.status}: ${err}`);
    }

    const { data: results } = await sendRes.json();
    totalSent += results?.length || batch.length;
  }

  // 4. Update newsletter status
  const { error: updateErr } = await supabase
    .from('newsletters')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipients: totalSent,
    })
    .eq('id', newsletterId);

  if (updateErr) throw new Error(`newsletter update: ${updateErr.message}`);

  console.log(`  ✓ Newsletter sent via Resend to ${totalSent} recipients`);
}

// ============================================
// Responsive email template
// ============================================

function buildEmailTemplate({ body, siteName, primaryColor, accentColor }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:${primaryColor};padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${siteName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;color:#333333;font-size:16px;line-height:1.6;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:13px;color:#888888;border-top:1px solid #eee;">
              <p style="margin:0 0 8px;">Vous recevez cet email car vous êtes abonné(e) à ${siteName}.</p>
              <a href="{{unsubscribe}}" style="color:${accentColor};text-decoration:underline;">Se désabonner</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
