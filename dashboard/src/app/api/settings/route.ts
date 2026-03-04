import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ai_settings")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    return Response.json({ default_site_model: "gemini-2.5-flash", default_article_model: "gemini-2.5-flash" });
  }

  return Response.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { default_site_model, default_article_model } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Try update first, then insert
  const { data: existing } = await client
    .from("ai_settings")
    .select("id")
    .limit(1)
    .single();

  if (existing) {
    const { error } = await client
      .from("ai_settings")
      .update({ default_site_model, default_article_model })
      .eq("id", existing.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await client
      .from("ai_settings")
      .insert({ default_site_model, default_article_model });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  return Response.json({ success: true });
}
