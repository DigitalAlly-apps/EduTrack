import { useState, useEffect } from 'react';
import { Cloud, CloudOff, LogOut, RefreshCw, Wifi } from 'lucide-react';
import {
  signInWithGoogle,
  signOut,
  getCurrentUser,
  pushLocalToCloud,
  pullCloudToLocal,
  shouldUseCloudData,
} from '@/lib/supabaseSync';
import { getData } from '@/lib/data';
import type { SupabaseUser } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface SyncModalProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  syncStatus: 'idle' | 'connected' | 'syncing' | 'offline';
  user: SupabaseUser | null;
  onUserChange: (u: SupabaseUser | null) => void;
}

export default function SyncModal({ open, onClose, onRefresh, syncStatus, user, onUserChange }: SyncModalProps) {
  const [loading, setLoading] = useState(false);
  const [mergeChoice, setMergeChoice] = useState<null | 'local' | 'cloud'>(null);
  const [cloudDataExists, setCloudDataExists] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      // Halaman akan di-redirect ke OAuth Google — state akan dipulihkan di onAuthStateChange
    } catch (e: any) {
      toast({ title: 'Gagal masuk', description: e.message });
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    onUserChange(null);
    toast({ title: 'Berhasil keluar dari sync Cloud' });
    setLoading(false);
    onClose();
  };

  const handleManualSync = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await pushLocalToCloud(user.id);
      toast({ title: '✅ Data berhasil dikirim ke Cloud' });
    } catch (e: any) {
      toast({ title: 'Gagal sync', description: e.message });
    }
    setLoading(false);
  };

  const statusConfig = {
    connected: { color: 'text-green', bg: 'bg-green/10 border-green/20', icon: '🟢', label: 'Terhubung & Tersinkronisasi' },
    syncing: { color: 'text-primary', bg: 'bg-primary/10 border-primary/20', icon: '🔄', label: 'Menyinkronkan...' },
    offline: { color: 'text-amber', bg: 'bg-amber/10 border-amber/20', icon: '📶', label: 'Mode Offline — Data Lokal' },
    idle: { color: 'text-text3', bg: 'bg-surface2/60 border-border', icon: '☁️', label: 'Belum Terhubung' },
  }[syncStatus];

  return (
    <div className="app-overlay z-[600]" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="app-bottom-sheet max-h-[80dvh]">
        <div className="app-sheet-handle" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
            ☁️
          </div>
          <div>
            <div className="app-sheet-title">Sinkronisasi Multi-Device</div>
            <div className="app-sheet-desc">Data tersinkron otomatis di HP & Laptop</div>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`flex items-center gap-2.5 p-3 rounded-2xl border mb-4 ${statusConfig.bg}`}>
          <span className="text-lg">{syncStatus === 'syncing' ? '🔄' : statusConfig.icon}</span>
          <div>
            <div className={`text-[12px] font-bold ${statusConfig.color}`}>{statusConfig.label}</div>
            {user && (
              <div className="text-xs text-text3 mt-0.5">{user.email}</div>
            )}
          </div>
        </div>

        {!user ? (
          /* — Belum Login — */
          <div className="space-y-3">
            <p className="text-[13px] text-text2 leading-relaxed text-center">
              Masuk dengan akun Google Anda untuk menyinkronkan data EduTrack secara otomatis di semua perangkat yang Anda gunakan.
            </p>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white text-gray-700 font-bold text-[14px] border border-gray-200 shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
            >
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {loading ? 'Mengalihkan...' : 'Masuk dengan Google'}
            </button>

            <p className="text-xs text-text3 text-center leading-relaxed">
              Data Anda yang sudah ada di perangkat ini akan tetap aman dan otomatis diunggah ke akun Anda setelah masuk.
            </p>
          </div>
        ) : (
          /* — Sudah Login — */
          <div className="space-y-3">
            {/* User Card */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface2 border border-border">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-xl flex-shrink-0">👤</div>
              )}
              <div className="min-w-0">
                <div className="font-bold text-[14px] text-foreground truncate">{user.name || 'Pengguna'}</div>
                <div className="text-xs text-text3 truncate">{user.email}</div>
              </div>
            </div>

            {/* Manual Push Sync Button */}
            <button
              onClick={handleManualSync}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary/10 border border-primary/25 text-primary font-bold text-[13px] hover:bg-primary/15 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Menyinkronkan...' : 'Kirim Data Lokal ke Cloud Sekarang'}
            </button>

            <div className="text-xs text-text3 leading-relaxed p-3 rounded-xl bg-surface2/50 border border-border">
              💡 <span className="font-bold text-foreground">Cara pakai di perangkat lain:</span><br />
              Buka EduTrack di Laptop, klik ikon ☁️, lalu masuk dengan akun Google yang sama. Data akan otomatis tersinkron!
            </div>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-text3 text-[12px] font-semibold hover:text-red hover:bg-red/5 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              Keluar dari Sync Cloud
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
