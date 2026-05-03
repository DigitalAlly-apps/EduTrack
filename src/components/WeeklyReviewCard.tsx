import { useMemo } from 'react';
import { getWeeklyStats, generateDailyJournal } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCopy, LineChart } from 'lucide-react';

export default function WeeklyReviewCard() {
  const { toast } = useToast();
  const st = useMemo(() => getWeeklyStats(), []);

  const diff = st.completed - st.prevCompleted;
  const diffLabel = diff > 0 ? `+${diff} vs minggu lalu` : diff < 0 ? `${diff} vs minggu lalu` : '= sama dengan minggu lalu';
  const diffColor = diff > 0 ? 'text-green' : diff < 0 ? 'text-red' : 'text-text3';

  const dateLabel = (() => {
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const s = new Date(st.weekStartStr).toLocaleDateString('id-ID', opts);
    const e = new Date(st.weekEndStr).toLocaleDateString('id-ID', opts);
    return `${s} – ${e}`;
  })();

  return (
    <div className="app-card-soft p-4 mb-3 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 text-primary grid place-items-center">
            <LineChart className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-text3">Laporan Minggu Ini</div>
            <div className="text-[10px] text-text3 opacity-60">{dateLabel}</div>
          </div>
        </div>
        <button
          onClick={() => {
            const text = generateDailyJournal();
            navigator.clipboard.writeText(text);
            toast({ title: '📋 Jurnal Disalin!' });
          }}
          className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-xl hover:bg-primary/20 transition-colors flex items-center gap-1.5"
        >
          <ClipboardCopy className="h-3.5 w-3.5" /> Salin
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Completed */}
        <div className="bg-green/10 border border-green/20 rounded-xl p-2.5 text-center">
          <div className="text-2xl font-black text-green leading-none mb-0.5">{st.completed}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text3">Selesai</div>
          <div className={`text-[9px] font-bold mt-0.5 ${diffColor}`}>{diffLabel}</div>
        </div>

        {/* Skipped */}
        <div className="bg-amber/10 border border-amber/20 rounded-xl p-2.5 text-center">
          <div className="text-2xl font-black text-amber leading-none mb-0.5">{st.skipped}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text3">Dilewati</div>
          <div className="text-[9px] text-text3 mt-0.5">{st.total > 0 ? Math.round((st.skipped / st.total) * 100) : 0}% dari total</div>
        </div>

        {/* Materials */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-2.5 text-center">
          <div className="text-2xl font-black text-primary leading-none mb-0.5">{st.materialsCovered}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text3">Materi</div>
          <div className="text-[9px] text-text3 mt-0.5">{st.uniqueClasses} kelas aktif</div>
        </div>
      </div>

      {/* Progress bar */}
      {st.total > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-text3 mb-1">
            <span>Tingkat Kehadiran</span>
            <span className="font-bold text-foreground">{Math.round((st.completed / st.total) * 100)}%</span>
          </div>
          <div className="h-2 bg-surface2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green to-primary rounded-full transition-all duration-700"
              style={{ width: `${Math.round((st.completed / st.total) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
