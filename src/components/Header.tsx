import { getGreeting, getData, now, getTeacherStreak } from '@/lib/data';
import InfoView from '@/components/InfoView';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HeaderProps {
  onToggleTheme: () => void;
  theme: string;
}

export default function Header({ onToggleTheme, theme }: HeaderProps) {
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
  const isLongName = displayName.length > 12;
  const dateStr = now().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  const activeClassCount = data.classes.length;
  const streak = getTeacherStreak();

  return (
    <div className="flex-shrink-0 px-5 pt-4 pb-3 bg-background/80 backdrop-blur-md border-b border-border/40 sticky top-0 z-40 transition-all shadow-sm">
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] text-text3 font-extrabold tracking-[0.12em] uppercase opacity-60">
              {dateStr}
            </span>
          </div>
          <div className={`font-display font-black tracking-tight text-foreground leading-tight truncate max-w-[200px] ${isLongName ? 'text-[16px]' : 'text-xl'}`}>
            {displayName}
          </div>
          <div className="text-[10px] font-bold text-primary/80 mt-0.5 flex items-center gap-1.5 uppercase tracking-wider">
            {activeClassCount > 0 ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
                {activeClassCount} Kelas Aktif
                {streak > 0 && (
                  <>
                    <span className="opacity-30">•</span>
                    <span className="flex items-center gap-0.5 text-amber-500">
                      <span className="text-xs -mt-[1px]">🔥</span> {streak} Hari
                    </span>
                  </>
                )}
              </>
            ) : 'Guru Pengampu'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <button className="px-3 h-11 rounded-2xl bg-surface/50 hover:bg-surface border border-border2 flex items-center justify-center gap-1.5 transition-all active:scale-90 text-text2 hover:text-foreground">
                <span className="text-lg">ℹ️</span>
                <span className="text-[11px] font-bold tracking-wider hidden sm:inline">Info</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[420px] h-[85vh] overflow-hidden flex flex-col rounded-[32px] border-border/40 bg-background/95 backdrop-blur-xl p-0">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="flex items-center gap-4 font-display">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl">📖</div>
                  <div>
                    <div className="text-2xl font-black tracking-tight">EduTrack</div>
                    <div className="text-[10px] text-text3 font-bold tracking-widest uppercase opacity-60">Pusat Informasi & Panduan</div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 scrollbar-thin">
                <InfoView />
              </div>
            </DialogContent>
          </Dialog>

          <button
            onClick={onToggleTheme}
            className="w-11 h-11 rounded-2xl bg-surface/50 hover:bg-surface border border-border2 flex items-center justify-center transition-all active:scale-90 shadow-sm text-text2 hover:text-foreground"
            title="Ganti Tema"
          >
            <span className="text-lg">{theme === 'dark' ? '🌙' : '☀️'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
