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
  const dateStr = now().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  const activeClassCount = data.classes.length;
  const streak = getTeacherStreak();

  return (
    <div className="flex-shrink-0 px-4 pt-4 pb-3 sticky top-0 z-40 transition-all">
      <div className="glass-panel rounded-[28px] px-4 py-3 flex items-center justify-between overflow-hidden relative">
        <div className="absolute -left-8 -top-10 h-24 w-24 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
        <div className="min-w-0 pr-2 relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_16px_hsl(var(--primary))]" />
            <span className="text-[10px] text-text3 font-black tracking-[0.16em] uppercase">
              {dateStr}
            </span>
          </div>
          <div className={`font-display font-bold text-foreground leading-none truncate max-w-[190px] ${displayName.length > 15 ? 'text-[18px]' : displayName.length > 10 ? 'text-[21px]' : 'text-2xl'}`}>
            {displayName}
          </div>
          <div className="text-[10px] font-black text-primary mt-2 flex items-center gap-1.5 uppercase tracking-[0.14em]">
            {activeClassCount > 0 ? (
              <>
                {activeClassCount} Kelas Aktif
                {streak > 0 && (
                  <>
                    <span className="opacity-30">•</span>
                    <span className="flex items-center gap-0.5 text-amber">
                      {streak} Hari Streak
                    </span>
                  </>
                )}
              </>
            ) : 'Guru Pengampu'}
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <Dialog>
            <DialogTrigger asChild>
              <button className="px-3 h-11 rounded-2xl bg-surface2 hover:bg-surface3 border border-border2 flex items-center justify-center gap-1.5 transition-all active:scale-95 text-text2 hover:text-foreground shadow-sm">
                <span className="text-sm font-black">i</span>
                <span className="text-[11px] font-bold tracking-wider hidden sm:inline">Info</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[420px] h-[85vh] overflow-hidden flex flex-col rounded-3xl border-border/40 bg-background/95 backdrop-blur-xl p-0">
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
            className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground border border-primary-border flex items-center justify-center transition-all active:scale-95 shadow-primary hover:brightness-105"
            title="Ganti Tema"
          >
            <span className="text-base">{theme === 'dark' ? '☾' : '☀'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
