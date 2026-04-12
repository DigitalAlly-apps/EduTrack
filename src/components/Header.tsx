import { getGreeting, getData, now } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HeaderProps {
  onToggleTheme: () => void;
  onQuickAdd: () => void;
  onOpenLeave: () => void;
  theme: string;
}

export default function Header({ onToggleTheme, onQuickAdd, onOpenLeave, theme }: HeaderProps) {
  const data = getData();
  const name = data.teacherName || 'Guru';
  const displayName = data.teacherName ? `Pak/Bu ${name.split(' ')[0]}` : 'Guru';
  const dateStr = now().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex-shrink-0 px-4 pt-4 pb-2 bg-header border-b border-border/40 transition-colors relative z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-dim border border-primary-border/40 rounded-xl grid place-items-center text-lg flex-shrink-0 relative overflow-hidden">
            <span className="drop-shadow-sm">📖</span>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-text3 font-bold tracking-wider uppercase leading-none mb-1 opacity-70">{getGreeting()}</div>
            <div className="font-display text-lg font-bold tracking-tight leading-none text-foreground">{displayName}</div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onOpenLeave}
            className="w-9 h-9 rounded-lg bg-red/10 hover:bg-red/20 text-red border border-red/20 grid place-items-center text-sm transition-all active:scale-95 shadow-sm"
            title="Ajukan Izin/Sakit"
          >
            🏥
          </button>
          
          <Dialog>
            <DialogTrigger asChild>
              <button className="w-9 h-9 rounded-lg bg-surface hover:bg-surface2 border border-border2 grid place-items-center text-sm transition-all active:scale-95">
                ℹ️
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[420px] rounded-[24px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <span className="text-2xl">📖</span> Tentang EduTrack
                </DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-5">
                <div>
                  <div className="text-[13px] text-text2 leading-relaxed font-medium">
                    EduTrack merupakan asisten pengajar (Teaching Assistant) personal yang didesain untuk menyederhanakan pelacakan progres materi dan manajemen jadwal secara saksama. Fokus utama sistem ini adalah menghadirkan presisi data dalam setiap sesi pengajaran Anda.
                  </div>
                </div>
                
                <div className="text-center pt-2">
                  <div className="text-[11px] text-text3">EduTrack v5.0 • Digital Ally Project</div>
                  <div className="text-[10px] text-text3/60 mt-1">Dibuat oleh Miqdad Abdussalam</div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <button
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-lg bg-surface hover:bg-surface2 border border-border2 grid place-items-center text-sm transition-all active:scale-95"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <button
            onClick={onQuickAdd}
            className="h-9 rounded-lg bg-surface hover:bg-surface2 border border-border2 inline-flex items-center justify-center text-[12px] font-bold text-foreground px-3 gap-1.5 transition-all active:scale-95 shadow-sm"
          >
            ＋ Jadwal
          </button>

          {/* Personal App - No Auth/Login needed */}
        </div>
      </div>
      <div className="text-[11px] font-medium text-text3 mt-1.5 pl-[48px] opacity-60">{dateStr}</div>
    </div>
  );
}
