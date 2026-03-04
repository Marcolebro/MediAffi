export type Site = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  niche: string;
  description: string | null;
  github_repo: string | null;
  vercel_project: string | null;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
  adsense_id: string | null;
  auto_ads: boolean;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
  pinterest: string | null;
  tiktok: string | null;
  resend_audience_id: string | null;
  plausible_site_id: string | null;
  gsc_property: string | null;
  articles_per_day: number;
  auto_social: boolean;
  auto_newsletter: boolean;
  generated_files: Record<string, unknown> | null;
  creation_step: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AISettings = {
  id: string;
  default_site_model: string;
  default_article_model: string;
  updated_at: string;
};

export type AffiliateProgram = {
  id: string;
  site_id: string;
  name: string;
  url: string;
  commission: string | null;
  category: string | null;
  logo_url: string | null;
  active: boolean;
  created_at: string;
};

export type Prompt = {
  id: string;
  site_id: string | null;
  type: string;
  category: string;
  name: string;
  version: number;
  system_prompt: string | null;
  template: string;
  model: string;
  temperature: number;
  max_tokens: number;
  tone: string | null;
  target_length: string | null;
  language: string;
  articles_generated: number;
  avg_performance_score: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ArticleQueue = {
  id: string;
  site_id: string;
  keyword: string;
  type: string;
  search_volume: number | null;
  keyword_difficulty: number | null;
  secondary_keywords: string[] | null;
  search_intent: string | null;
  scraped_data: Record<string, unknown> | null;
  scraped_at: string | null;
  target_product: string | null;
  status: "pending" | "scraped" | "writing" | "published" | "failed";
  priority: number;
  scheduled_date: string | null;
  article_id: string | null;
  error_log: string | null;
  created_at: string;
  updated_at: string;
};

export type Article = {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  type: string;
  category: string | null;
  tags: string[] | null;
  content_markdown: string | null;
  meta_description: string | null;
  word_count: number | null;
  target_keyword: string | null;
  secondary_keywords: string[] | null;
  featured_image: string | null;
  images: string[] | null;
  affiliate_program_id: string | null;
  prompt_id: string | null;
  prompt_version: number | null;
  model_used: string | null;
  generation_cost: number | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  git_commit: string | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
};

export type Metric = {
  id: string;
  article_id: string;
  site_id: string;
  date: string;
  pageviews: number;
  unique_visitors: number;
  avg_time_seconds: number | null;
  bounce_rate: number | null;
  google_position: number | null;
  impressions: number;
  organic_clicks: number;
  ctr: number | null;
  affiliate_clicks: number;
  conversions: number;
  revenue: number;
  performance_score: number | null;
  created_at: string;
};

export type SocialPost = {
  id: string;
  article_id: string;
  site_id: string;
  platform: string;
  type: string;
  content: string | null;
  media_urls: string[] | null;
  hashtags: string[] | null;
  prompt_id: string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  buffer_post_id: string | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  clicks: number;
  status: "pending" | "scheduled" | "posted" | "failed";
  created_at: string;
};

export type AffiliateClick = {
  id: string;
  site_id: string;
  program_id: string | null;
  article_slug: string | null;
  referrer: string | null;
  clicked_at: string;
};

export type Newsletter = {
  id: string;
  site_id: string;
  subject: string;
  content_html: string | null;
  articles_included: string[] | null;
  sponsor_id: string | null;
  sent_at: string | null;
  recipients: number;
  opens: number;
  clicks: number;
  status: "draft" | "sent" | "failed";
  created_at: string;
};

export type Sponsor = {
  id: string;
  site_id: string;
  name: string;
  content: string;
  link: string;
  image_url: string | null;
  placement: "top" | "middle" | "bottom";
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  active: boolean;
  created_at: string;
};

export type WeeklyAnalysis = {
  id: string;
  site_id: string;
  week_start: string;
  articles_published: number | null;
  total_pageviews: number | null;
  total_affiliate_clicks: number | null;
  total_revenue: number | null;
  top_patterns: Record<string, unknown> | null;
  prompt_suggestions: Record<string, unknown> | null;
  next_week_priorities: Record<string, unknown> | null;
  top_articles: Record<string, unknown> | null;
  flop_articles: Record<string, unknown> | null;
  best_social_format: string | null;
  social_insights: Record<string, unknown> | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      sites: { Row: Site; Insert: Partial<Site> & Pick<Site, "name" | "slug" | "niche">; Update: Partial<Site> };
      affiliate_programs: { Row: AffiliateProgram; Insert: Partial<AffiliateProgram> & Pick<AffiliateProgram, "site_id" | "name" | "url">; Update: Partial<AffiliateProgram> };
      prompts: { Row: Prompt; Insert: Partial<Prompt> & Pick<Prompt, "type" | "category" | "name" | "template">; Update: Partial<Prompt> };
      article_queue: { Row: ArticleQueue; Insert: Partial<ArticleQueue> & Pick<ArticleQueue, "site_id" | "keyword" | "type">; Update: Partial<ArticleQueue> };
      articles: { Row: Article; Insert: Partial<Article> & Pick<Article, "site_id" | "title" | "slug" | "type">; Update: Partial<Article> };
      metrics: { Row: Metric; Insert: Partial<Metric> & Pick<Metric, "article_id" | "site_id" | "date">; Update: Partial<Metric> };
      social_posts: { Row: SocialPost; Insert: Partial<SocialPost> & Pick<SocialPost, "article_id" | "site_id" | "platform" | "type">; Update: Partial<SocialPost> };
      affiliate_clicks: { Row: AffiliateClick; Insert: Partial<AffiliateClick> & Pick<AffiliateClick, "site_id">; Update: Partial<AffiliateClick> };
      newsletters: { Row: Newsletter; Insert: Partial<Newsletter> & Pick<Newsletter, "site_id" | "subject">; Update: Partial<Newsletter> };
      sponsors: { Row: Sponsor; Insert: Partial<Sponsor> & Pick<Sponsor, "site_id" | "name" | "content" | "link">; Update: Partial<Sponsor> };
      weekly_analysis: { Row: WeeklyAnalysis; Insert: Partial<WeeklyAnalysis> & Pick<WeeklyAnalysis, "site_id" | "week_start">; Update: Partial<WeeklyAnalysis> };
      ai_settings: { Row: AISettings; Insert: Partial<AISettings>; Update: Partial<AISettings> };
    };
  };
};
