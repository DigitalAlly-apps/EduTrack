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
    <div className="flex-shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sticky top-0 z-40 transition-all bg-background/80 backdrop-blur-xl border-b border-border/40">
      <div className="flex items-center justify-between gap-3 pb-2 relative">

        <div className="min-w-0 pr-2 relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
            <span className="text-xs text-text3 font-medium uppercase tracking-wider">
              {dateStr}
            </span>
          </div>
          <div className={`font-display font-bold text-foreground leading-none truncate max-w-full ${displayName.length > 15 ? 'text-[18px]' : displayName.length > 10 ? 'text-[21px]' : 'text-2xl'}`}>
            {displayName}
          </div>
          <div className="text-xs font-semibold text-text2 mt-1.5 flex flex-wrap items-center gap-1.5">
            {activeClassCount > 0 ? (
              <>
                <span className="bg-surface2 px-2 py-0.5 rounded-full">{activeClassCount} Kelas Aktif</span>
                {streak > 0 && (
                  <span className="flex items-center gap-1 text-amber bg-amber/10 px-2 py-0.5 rounded-full">
                    <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber"></span></span>
                    {streak} hari
                  </span>
                )}
              </>
            ) : 'Guru Pengampu'}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 relative z-10">
          <button
            onClick={onOpenSync}
            className={`app-icon-button h-10 w-10 flex items-center justify-center shadow-sm transition-all active:scale-[0.92] ${
              syncStatus === 'connected' ? 'border-green/40 bg-green/10 text-green' : 'bg-surface2/50 text-text2 hover:text-foreground'
            }`}
            aria-label="Sinkronisasi antar perangkat"
            title={user ? `Sinkronisasi aktif (${user.email})` : 'Sinkronisasi antar perangkat'}
          >
            {syncStatus === 'syncing' ? <LoaderCircle aria-hidden="true" className="h-[18px] w-[18px] animate-spin" /> : syncStatus === 'connected' ? <Cloud aria-hidden="true" className="h-[18px] w-[18px]" /> : syncStatus === 'offline' ? <CloudOff aria-hidden="true" className="h-[18px] w-[18px]" /> : <Cloud aria-hidden="true" className="h-[18px] w-[18px]" />}
          </button>

          <button
            onClick={onToggleTheme}
            className="app-icon-button h-10 w-10 flex items-center justify-center shadow-sm transition-all active:scale-[0.92] bg-surface2/50 text-text2 hover:text-foreground"
            aria-label={theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
            title={theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
          >
            {theme === 'dark' ? <Sun aria-hidden="true" className="h-[18px] w-[18px]" /> : <Moon aria-hidden="true" className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}
