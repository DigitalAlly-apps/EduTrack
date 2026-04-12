import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, Crown, Loader2, Zap, Globe, ShieldCheck, ArrowLeft } from 'lucide-react';

interface PricingViewProps {
  onBack?: () => void;
}

export default function PricingView({ onBack }: PricingViewProps) {
  const { membershipStatus, user } = useAuth();
  const [processing, setProcessing] = React.useState(false);

  const isPro = membershipStatus === 'pro' || membershipStatus === 'enterprise';

  const handleUpgrade = () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('edutrack-open-auth'));
      return;
    }
    setProcessing(true);
    // Midtrans Snap stub — replace with real initiation
    setTimeout(() => {
      setProcessing(false);
      alert('Gateway pembayaran Midtrans akan muncul di sini. Hubungi admin untuk aktivasi.');
    }, 1500);
  };

  const features = [
    'Cloud Database Sync otomatis',
    'Backup & restore data kapan saja',
    'Semua kelas & mapel, tanpa batas',
    'Riwayat sesi & laporan lengkap',
    'Countdown ujian & AI insights',
    'Prioritas dukungan teknis',
    'Akses semua fitur baru kedepannya',
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="max-w-2xl mx-auto w-full px-6 pt-10 pb-4 flex items-center gap-4">
        {onBack && (
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">EduTrack Intelligence</p>
          <h1 className="text-2xl font-black tracking-tight">Upgrade ke Pro</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full px-6 py-8 flex-1">
        {/* Already Pro Banner */}
        {isPro && (
          <div className="mb-8 p-5 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center gap-3">
            <Crown className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-black text-green-600 dark:text-green-400">Anda sudah berlangganan Pro!</p>
              <p className="text-sm text-muted-foreground">Semua fitur cloud sudah aktif pada akun Anda.</p>
            </div>
          </div>
        )}

        {/* Main Pricing Card */}
        <div className="relative bg-surface/40 backdrop-blur-xl border-2 border-primary/30 rounded-[32px] p-8 shadow-2xl shadow-primary/10 overflow-hidden">
          {/* Glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
          
          {/* Badge */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-blue-400 text-white text-[10px] font-black uppercase tracking-[0.15em] px-5 py-1.5 rounded-full shadow-lg shadow-primary/30">
            🚀 Paling Populer
          </div>

          <div className="w-14 h-14 bg-primary/10 rounded-2xl grid place-items-center text-primary mb-6">
            <Zap className="w-7 h-7" />
          </div>

          <h2 className="text-2xl font-black text-foreground mb-1">EduTrack Pro</h2>
          <p className="text-sm text-muted-foreground mb-8 font-medium leading-snug">
            Asisten pengajar digital penuh dengan cloud sync & analitik AI.
          </p>

          <div className="flex items-baseline gap-1 mb-8">
            <span className="text-5xl font-black text-foreground">Rp39.000</span>
            <span className="text-sm text-muted-foreground font-bold uppercase tracking-widest">/bulan</span>
          </div>

          {/* Features */}
          <div className="space-y-4 mb-10">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                <span className="text-[14px] text-muted-foreground font-semibold">{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          {isPro ? (
            <button disabled className="w-full py-4 rounded-2xl text-[15px] font-black bg-green-500/20 text-green-600 dark:text-green-400 border-2 border-green-500/30 flex items-center justify-center gap-2 cursor-default">
              <Crown className="w-5 h-5" />
              SUDAH AKTIF
            </button>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={processing}
              className="w-full py-4 rounded-2xl text-[15px] font-black bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
            >
              {processing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> MEMPROSES...</>
              ) : (
                'MULAI BERLANGGANAN'
              )}
            </button>
          )}
        </div>

        {/* Trust Indicators */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: <ShieldCheck className="w-5 h-5 mx-auto mb-2 text-green-500" />, label: 'Enkripsi AES-256' },
            { icon: <Globe className="w-5 h-5 mx-auto mb-2 text-primary" />, label: 'Cloud Multi-device' },
            { icon: <Crown className="w-5 h-5 mx-auto mb-2 text-amber-400" />, label: 'Batalkan kapan saja' },
          ].map((item, i) => (
            <div key={i} className="bg-muted/40 rounded-2xl p-4">
              {item.icon}
              <p className="text-[11px] font-bold text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Social Proof */}
        <div className="mt-6 p-6 bg-muted/30 border border-border/40 rounded-[24px] text-center">
          <div className="flex justify-center -space-x-2 mb-3">
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="w-9 h-9 rounded-full border-2 border-background bg-slate-700 overflow-hidden">
                <img src={`https://i.pravatar.cc/100?u=edu${idx}`} alt="avatar" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <p className="text-[13px] text-foreground font-bold mb-1">Dipercaya 2.000+ Pengajar Indonesia</p>
          <p className="text-[11px] text-muted-foreground">Bergabunglah bersama guru-guru profesional yang telah mengoptimalkan kelas mereka.</p>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Pertanyaan? Hubungi{' '}
          <a href="mailto:support@digitalally.com" className="underline hover:text-primary transition-colors">support@digitalally.com</a>
        </p>
      </div>
    </div>
  );
}
