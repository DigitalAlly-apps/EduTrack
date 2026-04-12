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
  onOpenLeave: () => void;
  theme: string;
}

export default function Header({ onToggleTheme, onOpenLeave, theme }: HeaderProps) {
  const data = getData();
  const name = data.teacherName || 'Guru';
  const displayName = data.teacherName ? name.split(' ')[0] : 'Guru';
  const dateStr = now().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex-shrink-0 px-6 pt-6 pb-4 bg-background/80 backdrop-blur-md border-b border-border/40 sticky top-0 z-40 transition-all">
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-4">
          <div className="mb-1">
            <span className="text-[10px] text-text3 font-bold tracking-[0.15em] uppercase opacity-50">
              {dateStr}
            </span>
          </div>
          <div className="font-display text-2xl font-black tracking-tighter text-foreground leading-none">
            {displayName}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenLeave}
            className="group relative w-11 h-11 rounded-2xl bg-red/5 hover:bg-red/10 text-red border border-red/10 flex items-center justify-center transition-all active:scale-90"
            title="Ajukan Izin/Sakit"
          >
            <span className="group-hover:scale-110 transition-transform text-lg">🏥</span>
          </button>
          
          <div className="w-[1px] h-7 bg-border/40" />

          <Dialog>
            <DialogTrigger asChild>
              <button className="w-11 h-11 rounded-2xl bg-surface/50 hover:bg-surface border border-border2 flex items-center justify-center text-lg transition-all active:scale-90">
                ℹ️
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[420px] rounded-[32px] border-border/40 bg-background/95 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-4 font-display">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl">📖</div>
                  <div>
                    <div className="text-2xl font-black tracking-tight">EduTrack</div>
                    <div className="text-[10px] text-text3 font-bold tracking-widest uppercase opacity-60">Guru Assistant v5.0</div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="py-5 space-y-6">
                <div className="bg-primary/5 p-5 rounded-[24px] border border-primary/10">
                  <div className="text-sm text-text2 leading-relaxed font-medium">
                    <strong>EduTrack</strong> adalah asisten pengajar digital yang didesain untuk menyederhanakan pelacakan progres materi dan manajemen jadwal secara saksama.
                  </div>
                </div>
                
                <div className="space-y-4 px-1">
                  {[
                    { icon: '🚀', t: 'Efisiensi Maksimal', d: 'Fokus mengajar, biar kami yang urus jadwal.' },
                    { icon: '📊', t: 'Presisi Data', d: 'Pantau sisa materi vs tanggal ujian secara akurat.' },
                    { icon: '🔐', t: 'Privasi Terjamin', d: 'Data disimpan 100% di perangkat Anda.' },
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 text-sm">{f.icon}</div>
                      <div>
                        <div className="text-[12px] font-bold text-foreground leading-tight">{f.t}</div>
                        <div className="text-[11px] text-text3 leading-tight mt-0.5">{f.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="text-center pt-3 border-t border-border/40">
                  <div className="text-[11px] text-text2 font-black uppercase tracking-[0.2em] bg-gradient-to-r from-primary to-primary-border bg-clip-text text-transparent">Digital Ally Project</div>
                  <div className="text-[10px] text-text3 font-bold mt-2 opacity-50">BY MIQDAD ABDUSSALAM</div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <button
            onClick={onToggleTheme}
            className="w-11 h-11 rounded-2xl bg-surface/50 hover:bg-surface border border-border2 flex items-center justify-center text-lg transition-all active:scale-90 shadow-sm"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
    </div>
  );
}
