import { SupabaseClient } from "@supabase/supabase-js";
import type { Site, AffiliateProgram } from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function getAllSites(supabase: Client) {
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Site[];
}

export async function getSiteById(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Site;
}

export async function getSiteAffiliatePrograms(supabase: Client, siteId: string) {
  const { data, error } = await supabase
    .from("affiliate_programs")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as AffiliateProgram[];
}

export async function createSite(supabase: Client, site: Partial<Site> & Pick<Site, "name" | "slug" | "niche">) {
  const { data, error } = await supabase
    .from("sites")
    .insert(site)
    .select()
    .single();
  if (error) throw error;
  return data as Site;
}

export async function updateSite(supabase: Client, id: string, updates: Partial<Site>) {
  const { data, error } = await supabase
    .from("sites")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Site;
}

export async function createAffiliateProgram(
  supabase: Client,
  program: Partial<AffiliateProgram> & Pick<AffiliateProgram, "site_id" | "name" | "url">
) {
  const { data, error } = await supabase
    .from("affiliate_programs")
    .insert(program)
    .select()
    .single();
  if (error) throw error;
  return data as AffiliateProgram;
}
