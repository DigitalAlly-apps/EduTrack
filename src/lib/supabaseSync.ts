import { supabase, type SupabaseUser } from './supabase';
import { getData, saveData, setOnDataSaved } from './data';
import type { AppData } from './types';

const SYNC_TABLE = 'app_sync';
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let currentUserId: string | null = null;

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  unsubscribeRealtime();
  currentUserId = null;
  setOnDataSaved(null);
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<SupabaseUser | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name,
    avatarUrl: data.user.user_metadata?.avatar_url,
  };
}

// ── Push Local Data to Cloud ──────────────────────────────────────────────────

export async function pushLocalToCloud(userId: string) {
  const localData = getData();
  const { error } = await supabase.from(SYNC_TABLE).upsert({
    id: userId,
    data: localData,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ── Pull Cloud Data to Local ──────────────────────────────────────────────────

export async function pullCloudToLocal(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(SYNC_TABLE)
    .select('data, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return false; // No cloud data yet — first time login

  const cloudData = data.data as AppData;
  saveData(cloudData);
  return true;
}

// ── Realtime Subscription ─────────────────────────────────────────────────────

export function initCloudSync(userId: string, onRemoteUpdate: (data: AppData) => void) {
  currentUserId = userId;
  setOnDataSaved((appData) => {
    syncDataToCloud(userId, appData);
  });
  subscribeRealtime(userId, onRemoteUpdate);
}

export function subscribeRealtime(userId: string, onRemoteUpdate: (data: AppData) => void) {
  unsubscribeRealtime();
  currentUserId = userId;

  realtimeChannel = supabase
    .channel(`sync-${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: SYNC_TABLE, filter: `id=eq.${userId}` },
      (payload) => {
        const remoteData = (payload.new as { data: AppData }).data;
        if (remoteData) {
          saveData(remoteData);
          onRemoteUpdate(remoteData);
        }
      }
    )
    .subscribe();
}

export function unsubscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ── Sync on save (dipanggil setelah saveData lokal) ──────────────────────────

export async function syncDataToCloud(userId: string, appData: AppData) {
  try {
    await supabase.from(SYNC_TABLE).upsert({
      id: userId,
      data: appData,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[EduTrack Sync] Gagal sync ke cloud:', e);
  }
}

// ── Merge Strategy: Pilih data yang lebih baru ─────────────────────────────

export function shouldUseCloudData(localData: AppData, cloudData: AppData): boolean {
  const localSessions = localData.sessions?.length ?? 0;
  const cloudSessions = cloudData.sessions?.length ?? 0;
  // Cloud lebih baru jika punya lebih banyak sesi, atau lastBackup lebih baru
  if (cloudData.lastBackup && localData.lastBackup) {
    return cloudData.lastBackup > localData.lastBackup;
  }
  return cloudSessions >= localSessions;
}
