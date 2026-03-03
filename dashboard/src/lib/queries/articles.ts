import { SupabaseClient } from "@supabase/supabase-js";
import type { Article } from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

type ArticleFilters = {
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export async function getArticles(supabase: Client, siteId: string, filters: ArticleFilters = {}) {
  const { page = 1, perPage = 25, sortBy = "created_at", sortDir = "desc" } = filters;

  let query = supabase
    .from("articles")
    .select("*", { count: "exact" })
    .eq("site_id", siteId);

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  query = query
    .order(sortBy, { ascending: sortDir === "asc" })
    .range((page - 1) * perPage, page * perPage - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { articles: data as Article[], total: count ?? 0 };
}

export async function getArticleDetail(supabase: Client, articleId: string) {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .single();
  if (error) throw error;
  return data as Article;
}

export async function getLatestArticles(supabase: Client, limit = 5) {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Article[];
}

export async function getSiteArticleCount(supabase: Client, siteId: string) {
  const { count, error } = await supabase
    .from("articles")
    .select("*", { count: "exact", head: true })
    .eq("site_id", siteId);
  if (error) throw error;
  return count ?? 0;
}
