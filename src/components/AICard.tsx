import { useState } from 'react';
import { getData, getSubjectStatus, getTodaySchedules, DAYS_ID, todayNum, isTodayHolidayGlobal } from '@/lib/data';

interface AIPoint {
  icon: string;
  title: string;
  text: string;
}

export default function AICard() {
  const [points, setPoints] = useState<AIPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestion = async () => {
    setLoading(true);
    setError(null);

    const data = getData();
    const progSummary: string[] = [];
    data.subjects.forEach(sub => {
      data.classes.forEach(cls => {
        if (!data.schedules.some(s => s.classId === cls.id && s.subjectId === sub.id)) return;
        const st = getSubjectStatus(sub, cls, data);
        const examInfo = sub.examDate ? `ujian ${st.daysLeft} hari lagi` : 'tidak ada tanggal ujian';
        progSummary.push(`- ${cls.name} / ${sub.name}: ${st.done}/${st.total} materi selesai (${st.pct}%), status: ${st.label}, ${examInfo}`);
      });
    });

    const todayScheds = getTodaySchedules();
    const todayInfo = todayScheds.length > 0
      ? todayScheds.map(s => `${s.className} ${s.subjectName} jam ${s.startTime}${s.done ? ' (selesai)' : s.active ? ' (aktif)' : ''}`).join(', ')
      : 'tidak ada jadwal hari ini';

    const teacherName = data.teacherName || 'Guru';

    // Generate suggestions locally based on data analysis
    try {
      const suggestions: AIPoint[] = [];
      
      // Analyze progress using richer status
      const behindItems: { cls: string; sub: string; sessionsNeeded: number; sessLeft: number; holidaysInPeriod: number }[] = [];
      const onTrackItems: { cls: string; sub: string }[] = [];
      let totalDone = 0, totalTotal = 0;
      let totalHolidayImpact = 0;

      data.subjects.forEach(sub => {
        data.classes.forEach(cls => {
          if (!data.schedules.some(s => s.classId === cls.id && s.subjectId === sub.id)) return;
          const st = getSubjectStatus(sub, cls, data);
          totalDone += st.done;
          totalTotal += st.total;
          totalHolidayImpact += st.holidaysInPeriod ?? 0;
          if (st.status === 'behind' || st.status === 'tight') {
            behindItems.push({
              cls: cls.name, sub: sub.name,
              sessionsNeeded: st.sessionsNeeded ?? st.remaining,
              sessLeft: st.sessLeft ?? 0,
              holidaysInPeriod: st.holidaysInPeriod ?? 0,
            });
          } else if (st.done > 0) {
            onTrackItems.push({ cls: cls.name, sub: sub.name });
          }
        });
      });

      // Suggestion 1: Overall status
      const overallPct = totalTotal > 0 ? Math.round((totalDone / totalTotal) * 100) : 0;
      if (overallPct >= 80) {
        suggestions.push({ icon: '🎯', title: 'Progres Mantap!', text: `${overallPct}% materi udah selesai. Terusin semangatnya ya, ${teacherName}!` });
      } else if (overallPct >= 50) {
        suggestions.push({ icon: '📊', title: 'Progres Oke', text: `${overallPct}% materi beres. Fokus ke beberapa kelas yang masih agak telat ya.` });
      } else {
        suggestions.push({ icon: '⏰', title: 'Perlu Dikebut', text: `Baru ${overallPct}% materi yang selesai. Prioritasi kelas yang paling banyak sisa sesinya.` });
      }

      // Suggestion 2: Behind items — now session-aware
      let suggestedClassId = '';
      if (behindItems.length > 0) {
        const worst = behindItems.sort((a, b) => (b.sessionsNeeded - b.sessLeft) - (a.sessionsNeeded - a.sessLeft))[0];
        const shortfall = worst.sessionsNeeded - worst.sessLeft;
        const holidayNote = worst.holidaysInPeriod > 0 ? ` (ada ${worst.holidaysInPeriod} libur dadakan)` : '';
        suggestions.push({
          icon: '🚀',
          title: `${worst.cls}: Fokus ${worst.sub}`,
          text: `Butuh ${worst.sessionsNeeded} sesi, tapi cuma ada ${worst.sessLeft}${holidayNote}. Coba padetin materinya atau atur jadwal tambahan.`,
        });
        suggestedClassId = worst.cls; // using name as simple key
      } else if (onTrackItems.length > 0) {
        suggestions.push({ icon: '✅', title: 'Semua Aman', text: 'Gak ada kelas yang katinggalan. Ritmenya udah pas banget!' });
      }

      // Suggestion 3: Global holiday impact or Today's action
      const todayHoliday = isTodayHolidayGlobal();
      if (todayHoliday) {
        suggestions.push({
          icon: '☕',
          title: 'Hari Ini Libur',
          text: 'Nikmati waktu istirahat kamu. Gak ada jadwal progres buat hari ini.',
        });
      } else if (totalHolidayImpact > 0) {
        suggestions.push({
          icon: '🗓',
          title: `${totalHolidayImpact} Sesi Terpotong Libur`,
          text: `Ada total ${totalHolidayImpact} sesi yang kegeser karena libur dadakan. Jangan lupa diitung ulang target materinya ya.`,
        });
      } else {
        const activeSched = todayScheds.find(s => !s.done && s.className !== suggestedClassId);
        if (activeSched) {
          suggestions.push({ icon: '📝', title: 'Info Hari Ini', text: `Beresin sesi ${activeSched.className} — ${activeSched.subjectName} ya kalau udah ngajar.` });
        } else if (todayScheds.length > 0 && todayScheds.every(s => s.done)) {
          suggestions.push({ icon: '🎉', title: 'Selesai!', text: 'Semua jadwal hari ini udah beres. Selamat istirahat!' });
        } else {
          suggestions.push({ icon: '📅', title: 'Gak Ada Jadwal', text: `Hari ini ${DAYS_ID[todayNum()]} — lagi kosong nih. Bisa dipake buat nyiapin materi besok.` });
        }
      }

      // Simulate slight delay for UX
      await new Promise(r => setTimeout(r, 800));
      setPoints(suggestions);
    } catch {
      setError('Gagal memuat saran. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative bg-surface/60 border border-border rounded-2xl overflow-hidden mb-4 animate-slide-up shadow-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="relative p-4 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 bg-primary-dim border border-primary-border/30 text-primary text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-dot" />
            AI Assistant
          </div>
          <span className="text-[13px] font-bold text-foreground/80">Analisis & Saran</span>
        </div>
        <button
          onClick={fetchSuggestion}
          disabled={loading}
          className={`w-8 h-8 rounded-lg bg-surface2 border border-border2 text-text2 text-[12px] grid place-items-center flex-shrink-0 transition-all hover:bg-surface3 active:scale-95 ${loading ? 'animate-spin' : ''}`}
          title="Perbarui saran"
        >
          ↻
        </button>
      </div>

      {/* Body */}
      <div className="relative p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2.5 text-text2 text-[13px] py-4">
            <div className="ai-dots flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-dot-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-dot-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-dot-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
            <span className="font-medium opacity-80">Menganalisis data...</span>
          </div>
        ) : error ? (
          <div className="text-[13px] text-red text-center py-4 font-medium">{error}</div>
        ) : points ? (
          <div className="flex flex-col gap-2.5">
            {points.map((p, i) => (
              <div key={i} className="flex items-start gap-3 bg-surface2/40 border border-border/50 rounded-xl p-3.5 transition-colors">
                <div className="text-lg flex-shrink-0 mt-0.5">{p.icon}</div>
                <div>
                  <div className="text-[12px] font-bold mb-0.5 tracking-tight">{p.title}</div>
                  <div className="text-[12px] text-text2 leading-relaxed">{p.text}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-text3 text-center py-5 font-medium bg-surface2/20 rounded-xl border border-dashed border-border">
            Ketuk ↻ untuk analisis asisten
          </div>
        )}
      </div>
    </div>
  );
}
