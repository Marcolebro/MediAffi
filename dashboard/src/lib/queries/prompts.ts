import { SupabaseClient } from "@supabase/supabase-js";
import type { Prompt } from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function getPromptsByCategory(supabase: Client, category: string) {
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("category", category)
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Prompt[];
}

export async function getAllPrompts(supabase: Client) {
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Prompt[];
}

export async function updatePrompt(
  supabase: Client,
  id: string,
  updates: Partial<Prompt>
) {
  const { data, error } = await supabase
    .from("prompts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Prompt;
}

export async function getPromptById(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Prompt;
}
