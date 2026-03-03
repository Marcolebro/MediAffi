import { SupabaseClient } from "@supabase/supabase-js";
import type { Newsletter, Sponsor } from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function getNewsletters(supabase: Client) {
  const { data, error } = await supabase
    .from("newsletters")
    .select("*, sites(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as (Newsletter & { sites: { name: string } | null })[];
}

export async function getSponsors(supabase: Client) {
  const { data, error } = await supabase
    .from("sponsors")
    .select("*, sites(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as (Sponsor & { sites: { name: string } | null })[];
}

export async function createSponsor(
  supabase: Client,
  sponsor: Partial<Sponsor> & Pick<Sponsor, "site_id" | "name" | "content" | "link">
) {
  const { data, error } = await supabase
    .from("sponsors")
    .insert(sponsor)
    .select()
    .single();
  if (error) throw error;
  return data as Sponsor;
}

export async function updateSponsor(
  supabase: Client,
  id: string,
  updates: Partial<Sponsor>
) {
  const { error } = await supabase
    .from("sponsors")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}
