import { SupabaseClient } from "@supabase/supabase-js";
import type { SocialPost } from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function getSocialPosts(supabase: Client, siteId: string, limit = 20) {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as SocialPost[];
}

export async function getArticleSocialPosts(supabase: Client, articleId: string) {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as SocialPost[];
}
