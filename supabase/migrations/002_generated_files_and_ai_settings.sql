-- Add columns to sites for multi-step creation
ALTER TABLE sites ADD COLUMN IF NOT EXISTS generated_files JSONB;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS creation_step TEXT DEFAULT 'init';

-- AI settings singleton table
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_site_model TEXT DEFAULT 'gemini-2.5-flash',
  default_article_model TEXT DEFAULT 'gemini-2.5-flash',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ai_settings"
  ON ai_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert ai_settings"
  ON ai_settings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update ai_settings"
  ON ai_settings FOR UPDATE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert default row
INSERT INTO ai_settings (default_site_model, default_article_model)
VALUES ('gemini-2.5-flash', 'gemini-2.5-flash')
ON CONFLICT DO NOTHING;
