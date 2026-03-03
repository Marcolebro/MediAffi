import { createClient } from '@supabase/supabase-js';
import { config } from './config';

export const supabase = config.supabase.url && config.supabase.anon_key
  ? createClient(config.supabase.url, config.supabase.anon_key)
  : null;
