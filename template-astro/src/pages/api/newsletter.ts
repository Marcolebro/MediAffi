export const prerender = false;

import type { APIRoute } from 'astro';
import { config } from '../../lib/config';

export const POST: APIRoute = async ({ request }) => {
  try {
    let body: { email?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Corps de requête invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const email = body?.email?.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Email invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const audienceId = config.newsletter.resend_audience_id;
    if (audienceId) {
      const resendResponse = await fetch(
        `https://api.resend.com/audiences/${audienceId}/contacts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({ email, unsubscribed: false }),
        }
      );

      if (!resendResponse.ok) {
        console.error('[newsletter] Resend error:', resendResponse.status, await resendResponse.text());
        return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Inscription réussie !' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[newsletter] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
