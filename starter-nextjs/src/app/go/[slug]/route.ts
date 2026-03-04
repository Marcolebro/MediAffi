import { NextResponse } from "next/server";
import { getProduct } from "@/lib/products";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const product = getProduct(slug);

  if (!product || !product.affiliate_url) {
    return NextResponse.json(
      { error: "Product not found" },
      { status: 404 }
    );
  }

  // Fire-and-forget Supabase click tracking
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      };

      // Don't await — fire and forget
      fetch(`${supabaseUrl}/rest/v1/affiliate_clicks`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          product_slug: product.slug,
          site_domain: "kazwin.fr",
          referrer: request.headers.get("referer") ?? "",
          user_agent: request.headers.get("user-agent") ?? "",
          clicked_at: new Date().toISOString(),
        }),
      }).catch(() => {
        // Silently ignore tracking errors
      });
    }
  } catch {
    // Never crash the redirect for tracking failures
  }

  return NextResponse.redirect(product.affiliate_url, 302);
}
