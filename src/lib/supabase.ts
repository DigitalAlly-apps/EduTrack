import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dkuakivxjpzrjwesalls.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Qi2LM9jjqkzPjzLd2l36tA_KkNXsD7-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type SupabaseUser = {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
};
