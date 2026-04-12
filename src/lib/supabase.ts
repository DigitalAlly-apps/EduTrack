import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const pushUserData = async (userId: string, data: any) => {
  try {
    const { error } = await supabase
      .from('user_data')
      .upsert({ user_id: userId, data_payload: data }, { onConflict: 'user_id' });

    if (error) {
      console.error('[EduTrack Sync] Error pushing user data:', error);
    }
  } catch (err) {
    console.error('[EduTrack Sync] Exception pushing user data:', err);
  }
};

export const pullUserData = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data_payload')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('[EduTrack Sync] Error pulling user data:', error);
      return {};
    }

    return data?.data_payload || {};
  } catch (err) {
    console.error('[EduTrack Sync] Exception pulling user data:', err);
    return {};
  }
};
