import { useState } from 'react';
import { getData, now, getTeacherStreak } from '@/lib/data';
import InfoView from '@/components/InfoView';
import { Info, Moon, Sun, Cloud, CloudOff, LoaderCircle, BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SupabaseUser } from '@/lib/supabase';

interface HeaderProps {
  onToggleTheme: () => void;
  theme: string;
  syncStatus?: 'idle' | 'connected' | 'syncing' | 'offline';
  user?: SupabaseUser | null;
  onOpenSync?: () => void;
}

export default function Header({ onToggleTheme, theme, syncStatus = 'idle', user, onOpenSync }: HeaderProps) {
  const [infoOpen, setInfoOpen] = useState(false);
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
    <div className="flex-shrink-0 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sticky top-0 z-40 transition-all">
      <div className="flex flex-col gap-4 border-b border-border pb-4 relative">

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
          <div className="text-xs font-semibold text-text2 mt-2 flex flex-wrap items-center gap-1.5">
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

        <div className="grid grid-cols-3 gap-2 relative z-10">
          <button
            onClick={onOpenSync}
            className={`app-icon-button h-11 px-3 flex items-center justify-center gap-1.5 shadow-sm transition-all ${
              syncStatus === 'connected' ? 'border-green/40 bg-green/10 text-green' : ''
            }`}
            aria-label="Sinkronisasi antar perangkat"
            title={user ? `Sinkronisasi aktif (${user.email})` : 'Sinkronisasi antar perangkat'}
          >
            {syncStatus === 'syncing' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : syncStatus === 'connected' ? <Cloud aria-hidden="true" className="h-4 w-4" /> : syncStatus === 'offline' ? <CloudOff aria-hidden="true" className="h-4 w-4" /> : <Cloud aria-hidden="true" className="h-4 w-4" />}
            <span className="text-xs font-semibold">{syncStatus === 'syncing' ? 'Proses…' : syncStatus === 'offline' ? 'Offline' : 'Sinkron'}</span>
          </button>

          <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
            <DialogTrigger asChild>
              <button className="app-icon-button h-11 px-3 flex items-center justify-center gap-1.5 shadow-sm" aria-label="Buka panduan EduTrack">
                <Info aria-hidden="true" className="h-4 w-4" />
                <span className="text-xs font-semibold">Panduan</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[420px] h-[85vh] overflow-hidden flex flex-col rounded-3xl border-border/40 bg-background/95 backdrop-blur-xl p-0">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="flex items-center gap-4 font-display">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl"><BookOpen aria-hidden="true" className="h-6 w-6" /></div>
                  <div>
                    <div className="text-2xl font-black tracking-tight">EduTrack</div>
                    <div className="text-[10px] text-text3 font-bold tracking-widest uppercase opacity-60">Pusat Informasi & Panduan</div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 scrollbar-thin">
                <InfoView backLabel="Tutup panduan" onBackToSetup={() => setInfoOpen(false)} />
              </div>
            </DialogContent>
          </Dialog>

          <button
            onClick={onToggleTheme}
            className="app-icon-button h-11 flex items-center justify-center gap-1.5"
            aria-label={theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
          >
            {theme === 'dark' ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}
            <span className="text-xs font-semibold">Tema</span>
          </button>
        </div>
      </div>
    </div>
  );
}
