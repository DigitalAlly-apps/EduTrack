import { useState } from 'react';
import { updateData, genId } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

const STEPS = [
  { emoji: '👋', title: 'Halo, selamat datang!', sub: 'EduTrack adalah asisten pengajar pribadi Anda — tahu apa yang harus dilakukan sekarang, tanpa perlu berpikir dua kali.', hint: null, field: null },
  { emoji: '🪪', title: 'Siapa nama Anda?', sub: 'Nama Anda akan ditampilkan sebagai sapaan di setiap sesi.', hint: 'Contoh: Budi Santoso, S.Pd.', field: { key: 'teacher', placeholder: 'Nama lengkap Anda...' } },
  { emoji: '🏫', title: 'Tambahkan kelas Anda', sub: 'Contoh: 10A, 10B, XI IPA 2. Anda bisa tambah lebih banyak nanti.', hint: 'Kelas adalah kelompok siswa yang Anda ajar.', field: { key: 'class', placeholder: 'cth: 10A' } },
  { emoji: '📚', title: 'Mata pelajaran apa yang Anda ajar?', sub: 'Contoh: Matematika, Fisika, Bahasa Indonesia.', hint: 'Anda bisa atur tanggal ujian setelah ini.', field: { key: 'subject', placeholder: 'cth: Matematika' } },
  { emoji: '✅', title: 'Siap! Aplikasi sudah bisa digunakan', sub: 'Tambahkan materi dan jadwal di menu Kelola. Atau muat data demo dulu.', hint: null, field: null },
];

interface OnboardingProps {
  onComplete: () => void;
  onLoadDemo: () => void;
}

export default function Onboarding({ onComplete, onLoadDemo }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [fieldVal, setFieldVal] = useState('');
  const { toast } = useToast();
  const current = STEPS[step];

  const next = () => {
    if (step === 1) {
      if (!fieldVal.trim()) { toast({ title: 'Masukkan nama Anda dulu' }); return; }
      updateData(d => d.teacherName = fieldVal.trim());
    }
    if (step === 2) {
      if (!fieldVal.trim()) { toast({ title: 'Masukkan nama kelas dulu' }); return; }
      updateData(d => d.classes.push({ id: genId(), name: fieldVal.trim(), color: 'blue' }));
    }
    if (step === 3) {
      if (!fieldVal.trim()) { toast({ title: 'Masukkan nama mata pelajaran dulu' }); return; }
      updateData(d => d.subjects.push({ id: genId(), name: fieldVal.trim(), examDate: null }));
    }
    if (step === STEPS.length - 1) { finish(); return; }
    setFieldVal('');
    setStep(s => s + 1);
  };

  const back = () => { if (step > 0) { setFieldVal(''); setStep(s => s - 1); } };
  const finish = () => { localStorage.setItem('pengajar_onboarded', '1'); onComplete(); };
  const skip = () => finish();
  const alt = () => { onLoadDemo(); finish(); };

  return (
    <div className="fixed inset-0 z-[900] bg-background flex flex-col max-w-[430px] mx-auto overflow-y-auto">
      <div className="px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-[10px]">
          <div className="w-8 h-8 bg-primary rounded-[9px] grid place-items-center text-[15px] shadow-[0_0_20px_hsl(var(--primary-glow))] flex-shrink-0">📖</div>
          <div className="font-display text-[19px] font-medium tracking-tight">EduTrack</div>
        </div>
        <button onClick={skip} className="text-xs text-text2 p-2">Lewati</button>
      </div>

      {/* Progress track */}
      <div className="flex gap-[3px] px-6 pt-4">
        {STEPS.map((_, i) => (
          <div key={i} className={`flex-1 h-[2px] rounded-full transition-colors ${
            i < step ? 'bg-primary' : i === step ? 'bg-primary opacity-45' : 'bg-[hsl(var(--border2))]'
          }`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col px-6 pt-9">
        <div className="text-[52px] mb-5 animate-ob-illo" key={step}>{current.emoji}</div>
        <div className="font-display text-[30px] font-medium tracking-tight leading-[1.12] mb-[10px]">{current.title}</div>
        <div className="text-sm text-text2 leading-[1.7] mb-7" dangerouslySetInnerHTML={{ __html: current.sub }} />
        {current.hint && (
          <div className="bg-surface border border-border2 rounded-lg p-[13px_15px] text-xs text-text2 flex gap-[9px] mb-[18px] leading-relaxed">
            <span className="text-sm flex-shrink-0">💡</span>
            <span>{current.hint}</span>
          </div>
        )}
        {current.field && (
          <input
            value={fieldVal}
            onChange={e => setFieldVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && next()}
            placeholder={current.field.placeholder}
            className="form-input-style mb-4"
            autoFocus
          />
        )}
      </div>

      <div className="px-6 pb-10 flex flex-col gap-2">
        <button onClick={next} className="w-full py-4 rounded-lg bg-primary text-primary-foreground text-[15px] font-bold transition-all shadow-[0_4px_24px_hsl(var(--primary-glow))] hover:brightness-105 hover:-translate-y-[1px] active:scale-[0.98]">
          {step === 0 ? 'Mulai Setup →' : step === STEPS.length - 1 ? 'Buka Aplikasi →' : step < 4 ? 'Tambah & Lanjut →' : 'Lanjut →'}
        </button>
        {step === STEPS.length - 1 && (
          <button onClick={alt} className="w-full py-3 text-[13px] text-text2 transition-colors hover:text-foreground">
            Muat Data Demo
          </button>
        )}
        {step > 0 && (
          <button onClick={back} className="w-full py-3 text-[13px] text-text2 transition-colors hover:text-foreground">
            ← Kembali
          </button>
        )}
      </div>
    </div>
  );
}
