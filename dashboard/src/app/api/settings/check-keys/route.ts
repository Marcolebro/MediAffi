import { createClient } from "@/lib/supabase/server";
import { getConfiguredProviders } from "@/lib/ai";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(getConfiguredProviders());
}
