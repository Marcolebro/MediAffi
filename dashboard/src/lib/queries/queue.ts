import { SupabaseClient } from "@supabase/supabase-js";
import type { ArticleQueue } from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function getQueue(supabase: Client, siteId: string) {
  const { data, error } = await supabase
    .from("article_queue")
    .select("*")
    .eq("site_id", siteId)
    .in("status", ["pending", "scraped", "writing"])
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as ArticleQueue[];
}

export async function addToQueue(
  supabase: Client,
  items: (Partial<ArticleQueue> & Pick<ArticleQueue, "site_id" | "keyword" | "type">)[]
) {
  const { data, error } = await supabase
    .from("article_queue")
    .insert(items)
    .select();
  if (error) throw error;
  return data as ArticleQueue[];
}

export async function updateQueuePriority(supabase: Client, id: string, priority: number) {
  const { error } = await supabase
    .from("article_queue")
    .update({ priority })
    .eq("id", id);
  if (error) throw error;
}

export async function updateQueueItem(
  supabase: Client,
  id: string,
  updates: Partial<ArticleQueue>
) {
  const { error } = await supabase
    .from("article_queue")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}
