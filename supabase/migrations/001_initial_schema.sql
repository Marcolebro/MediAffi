-- ============================================
-- MediAffi — Initial Schema
-- 11 tables + indexes + RLS
-- ============================================

-- ============================================
-- 1. SITES
-- ============================================
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  niche TEXT NOT NULL,
  description TEXT,

  -- Config
  github_repo TEXT,
  vercel_project TEXT,

  -- Design
  primary_color TEXT DEFAULT '#2563eb',
  accent_color TEXT DEFAULT '#059669',
  logo_url TEXT,

  -- Monetization
  adsense_id TEXT,
  auto_ads BOOLEAN DEFAULT true,

  -- Social accounts
  instagram TEXT,
  twitter TEXT,
  linkedin TEXT,
  pinterest TEXT,
  tiktok TEXT,

  -- Newsletter (Resend)
  resend_audience_id TEXT,

  -- SEO / Analytics
  plausible_site_id TEXT,
  gsc_property TEXT,

  -- Settings
  articles_per_day INTEGER DEFAULT 1,
  auto_social BOOLEAN DEFAULT true,
  auto_newsletter BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. AFFILIATE PROGRAMS (par site)
-- ============================================
CREATE TABLE affiliate_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  commission TEXT,
  category TEXT,
  logo_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. PROMPTS (versionnés, par site ou globaux)
-- ============================================
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE, -- NULL = global

  type TEXT NOT NULL,       -- review/comparatif/top_list/guide/actu/carousel/tweet/linkedin/pinterest/weekly_recap/meta_description
  category TEXT NOT NULL,   -- article/social/newsletter/seo

  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,

  system_prompt TEXT,
  template TEXT NOT NULL,

  model TEXT DEFAULT 'gemini-2.5-flash',
  temperature FLOAT DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4000,

  tone TEXT,
  target_length TEXT,
  language TEXT DEFAULT 'fr',

  articles_generated INTEGER DEFAULT 0,
  avg_performance_score FLOAT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. ARTICLE QUEUE (pipeline)
-- ============================================
CREATE TABLE article_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,

  keyword TEXT NOT NULL,
  type TEXT NOT NULL,

  search_volume INTEGER,
  keyword_difficulty FLOAT,
  secondary_keywords TEXT[],
  search_intent TEXT,

  scraped_data JSONB,
  scraped_at TIMESTAMPTZ,

  target_product TEXT,

  status TEXT DEFAULT 'pending', -- pending/scraped/writing/published/failed
  priority INTEGER DEFAULT 5,
  scheduled_date DATE,

  article_id UUID, -- FK ajoutée après création de articles
  error_log TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. ARTICLES (publiés)
-- ============================================
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  tags TEXT[],

  content_markdown TEXT,
  meta_description TEXT,
  word_count INTEGER,

  target_keyword TEXT,
  secondary_keywords TEXT[],

  featured_image TEXT,
  images TEXT[],

  affiliate_program_id UUID REFERENCES affiliate_programs(id) ON DELETE SET NULL,

  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_version INTEGER,

  model_used TEXT,
  generation_cost FLOAT,

  status TEXT DEFAULT 'draft', -- draft/published/archived
  published_at TIMESTAMPTZ,

  git_commit TEXT,
  file_path TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(site_id, slug)
);

-- FK article_queue → articles
ALTER TABLE article_queue
  ADD CONSTRAINT fk_article_queue_article
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL;

-- ============================================
-- 6. METRICS (1 row par article par jour)
-- ============================================
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  pageviews INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_time_seconds INTEGER,
  bounce_rate FLOAT,

  google_position FLOAT,
  impressions INTEGER DEFAULT 0,
  organic_clicks INTEGER DEFAULT 0,
  ctr FLOAT,

  affiliate_clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue FLOAT DEFAULT 0,

  performance_score FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(article_id, date)
);

-- ============================================
-- 7. SOCIAL POSTS
-- ============================================
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,

  platform TEXT NOT NULL,  -- instagram/twitter/linkedin/pinterest/tiktok
  type TEXT NOT NULL,       -- carousel/image/text/pin

  content TEXT,
  media_urls TEXT[],
  hashtags TEXT[],

  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,

  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  buffer_post_id TEXT,

  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,

  status TEXT DEFAULT 'pending', -- pending/scheduled/posted/failed

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. AFFILIATE CLICKS (tracking /go/)
-- ============================================
CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  program_id UUID REFERENCES affiliate_programs(id) ON DELETE SET NULL,
  article_slug TEXT,
  referrer TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. NEWSLETTERS (Resend)
-- ============================================
CREATE TABLE newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,

  subject TEXT NOT NULL,
  content_html TEXT,

  articles_included UUID[],
  sponsor_id UUID, -- FK ajoutée après création de sponsors

  sent_at TIMESTAMPTZ,
  recipients INTEGER DEFAULT 0,
  opens INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,

  status TEXT DEFAULT 'draft', -- draft/sent/failed

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. SPONSORS (newsletter)
-- ============================================
CREATE TABLE sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  content TEXT NOT NULL,
  link TEXT NOT NULL,
  image_url TEXT,

  placement TEXT DEFAULT 'top', -- top/middle/bottom
  start_date DATE,
  end_date DATE,
  price FLOAT,

  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK newsletters → sponsors
ALTER TABLE newsletters
  ADD CONSTRAINT fk_newsletters_sponsor
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE SET NULL;

-- ============================================
-- 11. WEEKLY ANALYSIS (performance reports)
-- ============================================
CREATE TABLE weekly_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,

  week_start DATE NOT NULL,

  articles_published INTEGER,
  total_pageviews INTEGER,
  total_affiliate_clicks INTEGER,
  total_revenue FLOAT,

  top_patterns JSONB,
  prompt_suggestions JSONB,
  next_week_priorities JSONB,

  top_articles JSONB,
  flop_articles JSONB,

  best_social_format TEXT,
  social_insights JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(site_id, week_start)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_articles_site ON articles(site_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_metrics_article_date ON metrics(article_id, date);
CREATE INDEX idx_metrics_site_date ON metrics(site_id, date);
CREATE INDEX idx_queue_site_status ON article_queue(site_id, status);
CREATE INDEX idx_social_article ON social_posts(article_id);
CREATE INDEX idx_clicks_site ON affiliate_clicks(site_id);
CREATE INDEX idx_prompts_site_type ON prompts(site_id, type, category);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_analysis ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================
-- Authenticated users: full access (single-tenant, owner = authenticated user)
-- Service role: bypasses RLS automatically (used by pipeline scripts)

-- Helper: create CRUD policies for authenticated users
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'sites', 'affiliate_programs', 'prompts', 'article_queue',
      'articles', 'metrics', 'social_posts', 'affiliate_clicks',
      'newsletters', 'sponsors', 'weekly_analysis'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY "auth_select_%1$s" ON %1$s FOR SELECT TO authenticated USING (true)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "auth_insert_%1$s" ON %1$s FOR INSERT TO authenticated WITH CHECK (true)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "auth_update_%1$s" ON %1$s FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "auth_delete_%1$s" ON %1$s FOR DELETE TO authenticated USING (true)',
      tbl
    );
  END LOOP;
END $$;

-- Public insert for affiliate_clicks (tracking from public sites, no auth required)
CREATE POLICY "anon_insert_clicks" ON affiliate_clicks
  FOR INSERT TO anon WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sites_updated_at BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_prompts_updated_at BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_article_queue_updated_at BEFORE UPDATE ON article_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_articles_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
