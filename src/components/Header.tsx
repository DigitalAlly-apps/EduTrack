import { getData, now, getTeacherStreak } from '@/lib/data';
import { Moon, Sun, Cloud, CloudOff, LoaderCircle } from 'lucide-react';
import type { SupabaseUser } from '@/lib/supabase';

interface HeaderProps {
  onToggleTheme: () => void;
  theme: string;
  syncStatus?: 'idle' | 'connected' | 'syncing' | 'offline';
  user?: SupabaseUser | null;
  onOpenSync?: () => void;
}

export default function Header({ onToggleTheme, theme, syncStatus = 'idle', user, onOpenSync }: HeaderProps) {
  const data = getData();
  const rawName = data.teacherName || 'Guru';
  // Hapus gelar akademik (S.H, M.Pd, S.Pd, dll) untuk header
  const nameWithoutTitle = rawName.replace(/,?\s*[A-Z][A-Za-z]*\.[A-Za-z]+(\s*,?\s*[A-Z][A-Za-z]*\.[A-Za-z]+)*/g, '').trim();
  const parts = nameWithoutTitle.split(' ').filter(Boolean);
  const displayName = parts.length >= 2
    ? (parts[0] + ' ' + parts[parts.length - 1]).length <= 20
      ? parts[0] + ' ' + parts[parts.length - 1]
      : parts[0]
    : parts[0] || 'Guru';
  const dateStr = now().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  const activeClassCount = data.classes.length;
  const streak = getTeacherStreak();

  return (
    <div className="flex-shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sticky top-0 z-40 transition-all">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3 relative">

        <div className="min-w-0 pr-2 relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_16px_hsl(var(--primary))]" />
            <span className="text-xs text-text3 font-medium">
              {dateStr}
            </span>
          </div>
          <div className={`font-display font-bold text-foreground leading-none truncate max-w-full ${displayName.length > 15 ? 'text-[18px]' : displayName.length > 10 ? 'text-[21px]' : 'text-2xl'}`}>
            {displayName}
          </div>
          <div className="text-xs font-semibold text-text2 mt-1 flex flex-wrap items-center gap-1.5">
            {activeClassCount > 0 ? (
              <>
                {activeClassCount} Kelas Aktif
                {streak > 0 && (
                  <>
                    <span className="opacity-30">•</span>
                    <span className="flex items-center gap-0.5 text-amber">
                      {streak} hari konsisten
                    </span>
                  </>
                )}
              </>
            ) : 'Guru Pengampu'}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 relative z-10">
          <button
            onClick={onOpenSync}
            className={`app-icon-button h-11 w-11 flex items-center justify-center shadow-sm transition-all ${
              syncStatus === 'connected' ? 'border-green/40 bg-green/10 text-green' : ''
            }`}
            aria-label="Sinkronisasi antar perangkat"
            title={user ? `Sinkronisasi aktif (${user.email})` : 'Sinkronisasi antar perangkat'}
          >
            {syncStatus === 'syncing' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : syncStatus === 'connected' ? <Cloud aria-hidden="true" className="h-4 w-4" /> : syncStatus === 'offline' ? <CloudOff aria-hidden="true" className="h-4 w-4" /> : <Cloud aria-hidden="true" className="h-4 w-4" />}
          </button>

          <button
            onClick={onToggleTheme}
            className="app-icon-button h-11 w-11 flex items-center justify-center"
            aria-label={theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
            title={theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
          >
            {theme === 'dark' ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
