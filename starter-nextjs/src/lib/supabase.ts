import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createBrowserClient(url, key);
}

/** Fire-and-forget affiliate click tracking. Graceful if Supabase not configured. */
export async function trackAffiliateClick(
  slug: string,
  referrer?: string,
  userAgent?: string
): Promise<void> {
  try {
    const client = createClient();
    if (!client) return;

    await client.from("affiliate_clicks").insert({
      slug,
      referrer: referrer ?? null,
      user_agent: userAgent ?? null,
      clicked_at: new Date().toISOString(),
    });
  } catch {
    // Fire-and-forget — never block the redirect
  }
}
