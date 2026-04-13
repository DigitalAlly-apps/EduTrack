import { getGreeting, getData, now } from '@/lib/data';
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
  const name = data.teacherName || 'Guru';
  const dateStr = now().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex-shrink-0 px-5 pt-4 pb-3 bg-background/80 backdrop-blur-md border-b border-border/40 sticky top-0 z-40 transition-all shadow-sm">
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] text-text3 font-extrabold tracking-[0.12em] uppercase opacity-60">
              {dateStr}
            </span>
          </div>
          <div className="font-display text-xl font-black tracking-tight text-foreground leading-tight truncate max-w-[180px] xs:max-w-none">
            {name}
          </div>
          <div className="text-[10px] font-bold text-primary/80 mt-0.5 flex items-center gap-1 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
            Guru Pengampu
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
            className="px-3 h-11 rounded-2xl bg-surface/50 hover:bg-surface border border-border2 flex items-center justify-center gap-1.5 transition-all active:scale-90 shadow-sm text-text2 hover:text-foreground"
          >
            <span className="text-lg">{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span className="text-[11px] font-bold tracking-wider hidden sm:inline">Tema</span>
          </button>
        </div>
      </div>
    </div>
  );
}
