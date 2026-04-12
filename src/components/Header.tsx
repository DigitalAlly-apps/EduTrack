import { getGreeting, getData, now } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from '@/context/AuthContext';
import { LogIn, LogOut, Cloud } from 'lucide-react';

interface HeaderProps {
  onToggleTheme: () => void;
  onQuickAdd: () => void;
  onOpenAuth: () => void;
  theme: string;
}

export default function Header({ onToggleTheme, onQuickAdd, onOpenAuth, theme }: HeaderProps) {
  const { user, membershipStatus, signOut } = useAuth();
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

          {/* Auth indicator */}
          {user ? (
            <div className="flex items-center gap-1.5">
              {membershipStatus !== 'free' && (
                <Cloud className="w-3.5 h-3.5 text-primary" title="Cloud Sync aktif" />
              )}
              <button
                onClick={() => signOut()}
                title={`Keluar (${user.email})`}
                className="w-9 h-9 rounded-lg bg-surface hover:bg-surface2 border border-border2 grid place-items-center transition-all active:scale-95"
              >
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="avatar" className="w-6 h-6 rounded-full" />
                ) : (
                  <LogOut className="w-4 h-4 text-text3" />
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="h-9 px-3 rounded-lg bg-primary text-white border border-primary/20 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm shadow-primary/20"
            >
              <LogIn className="w-3.5 h-3.5" />
              Login
            </button>
          )}
        </div>
      </div>
      <div className="text-[11px] font-medium text-text3 mt-1.5 pl-[48px] opacity-60">{dateStr}</div>
    </div>
  );
}
