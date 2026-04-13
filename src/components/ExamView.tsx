import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getTodayExamItems, getAllExamSubjects,
  upsertCorrection,
  fmtDate, fmtDayLabel, dayLabelColor,
  STATUS_LABEL, STATUS_NEXT, STATUS_CLS,
  ExamWatchItem, ExamSubjectItem, CorrectionStatus,
  fmt,
} from '@/lib/examData';
import { currentMin, timeToMin } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

interface ExamViewProps { refreshKey: number; onRefresh: () => void; }

export default function ExamView({ refreshKey, onRefresh }: ExamViewProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'hari-ini' | 'semua'>('hari-ini');
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Re-render tiap menit supaya isActive/isDone otomatis update
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayItems = getTodayExamItems();
  const allSubjects = getAllExamSubjects();
  const upcoming = allSubjects.filter(s => s.daysLeft >= 0);
  const past = allSubjects.filter(s => s.daysLeft < 0);

  const handleCycle = (subjectId: string, classId: string, examDate: string, cur: CorrectionStatus | null) => {
    upsertCorrection(subjectId, classId, examDate, cur ? STATUS_NEXT[cur] : 'sedang');
    onRefresh();
  };

  // ── Hari Ini Tab ──────────────────────────────────────────────────────────
  const renderHariIni = () => {
    const active = todayItems.find(i => i.isActive);
    const next = todayItems.find(i => !i.isDone && !i.isActive);

    if (todayItems.length === 0) {
      // Fallback: tampilkan ujian terdekat dalam 14 hari
      const soon = allSubjects.filter(s => s.daysLeft > 0 && s.daysLeft <= 14);
      return (
        <div className="space-y-3 animate-slide-up">
          <div className="text-center py-6">
            <span className="text-4xl block mb-2">📅</span>
            <div className="text-base font-bold">Tidak ada ujian hari ini</div>
            <div className="text-xs text-text2 mt-1">Ujian mendatang dalam 14 hari:</div>
          </div>
          {soon.length === 0 ? (
            <div className="text-center text-sm text-text3 pb-6">Belum ada jadwal ujian. Atur di Kelola → Mapel.</div>
          ) : (
            <div className="space-y-2">
              {soon.map(item => (
                <div key={item.subjectId} className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${item.daysLeft <= 3 ? 'bg-red/5 border-red/20' : item.daysLeft <= 7 ? 'bg-amber/5 border-amber/20' : 'bg-surface border-border2'}`}>
                  <div>
                    <div className="text-sm font-semibold">{item.subjectName}</div>
                    <div className="text-xs text-text3">{fmtDate(item.examDate)}</div>
                  </div>
                  <div className={`text-right`}>
                    <div className={`text-xl font-black tabular-nums ${item.daysLeft <= 3 ? 'text-red' : item.daysLeft <= 7 ? 'text-amber' : 'text-primary'}`}>{item.daysLeft}</div>
                    <div className="text-[9px] text-text3 font-bold uppercase">Hari Lagi</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3 animate-slide-up">
        {/* Hero: ujian sedang berlangsung */}
        {active && (
          <div className="bg-surface/60 backdrop-blur-md border border-amber/30 rounded-[20px] overflow-hidden relative shadow-sm">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_0%,hsl(40_80%_60%/0.08)_0%,transparent_60%)] pointer-events-none" />
            <div className="p-5">
              <div className="inline-flex items-center gap-2 bg-amber/10 border border-amber/30 text-[10px] text-amber font-bold tracking-wider uppercase px-3 py-1.5 rounded-full mb-4">
                <span className="w-1.5 h-1.5 bg-amber rounded-full animate-pulse" />
                Sedang Berlangsung
              </div>
              <div className="font-display text-3xl font-bold tracking-tight leading-none mb-1">{active.className}</div>
              <div className="text-sm font-medium text-text2 mb-4">{active.subjectName} · {fmt(active.startTime)} – {fmt(active.endTime)}</div>
              <div className="bg-amber/8 border border-amber/20 rounded-xl p-3 flex items-center justify-between">
                <div className="text-xs text-text2">Sisa waktu</div>
                <div className="font-mono font-bold text-amber text-lg">
                  {(() => { const rem = timeToMin(active.endTime) - currentMin(); return rem > 0 ? `${rem} menit` : 'Selesai'; })()}
                </div>
              </div>
              {/* Koreksi langsung di hero */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-text3">Status koreksi setelah ujian:</span>
                <button
                  onClick={() => handleCycle(active.subjectId, active.classId, active.examDate, active.correction?.status ?? null)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${active.correction ? STATUS_CLS[active.correction.status] : 'text-text3 bg-surface border-border2'}`}
                >
                  {active.correction ? STATUS_LABEL[active.correction.status] : 'Belum'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Berikutnya card */}
        {!active && next && (
          <div className="bg-surface/50 backdrop-blur-xl border border-teal-border/40 rounded-[20px] p-5 relative overflow-hidden shadow-sm">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_0%,hsl(var(--teal-glow))_0%,transparent_60%)] pointer-events-none opacity-60" />
            <div className="relative">
              <div className="inline-flex items-center gap-1.5 bg-teal-dim border border-teal/40 text-[10px] text-teal font-bold tracking-wider uppercase px-3 py-1.5 rounded-full mb-3">
                🕐 Ujian Berikutnya
              </div>
              <div className="font-display text-2xl font-bold tracking-tight">{next.className}</div>
              <div className="text-sm text-text2 mt-1 mb-3">{next.subjectName}</div>
              <div className="bg-teal-dim border border-teal/30 rounded-xl p-3 flex items-center gap-3">
                <span className="text-xl">⏱</span>
                <div>
                  <div className="text-[10px] text-teal/80 font-bold uppercase tracking-wide">Mulai pukul {fmt(next.startTime)}</div>
                  <div className="text-lg font-bold text-teal">
                    {(() => { const diff = timeToMin(next.startTime) - currentMin(); if (diff <= 0) return 'Sebentar lagi'; if (diff < 60) return `${diff} mnt lagi`; return `${Math.floor(diff/60)}j ${diff%60}m lagi`; })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline semua ujian hari ini */}
        <div className="text-[11px] font-semibold tracking-wide uppercase text-text3 px-1">
          Semua Ujian Hari Ini
        </div>
        {todayItems.map((item, i) => {
          const state = item.isActive ? 'active' : item.isDone ? 'done' : '';
          const corrSt = item.correction?.status ?? null;
          return (
            <div key={`${item.subjectId}-${item.classId}`} className="flex items-stretch gap-3 mb-1 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
              {/* Spine */}
              <div className="flex flex-col items-center w-12 flex-shrink-0 py-3 gap-1.5">
                <div className="text-[11px] font-semibold text-text2 tabular-nums text-center">{fmt(item.startTime)}</div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-500 relative ${
                  state === 'active' ? 'bg-amber shadow-[0_0_10px_hsl(40_80%_60%/0.5)]' :
                  state === 'done' ? 'bg-green' : 'bg-border3'
                }`}>
                  {state === 'active' && <div className="absolute inset-0 rounded-full border border-amber animate-ping opacity-50" />}
                </div>
                {i < todayItems.length - 1 && <div className="flex-1 w-0.5 bg-gradient-to-b from-border2 to-transparent min-h-3" />}
              </div>
              {/* Card */}
              <div className="flex-1 mb-3">
                <div className={`border rounded-[18px] p-4 flex items-center gap-3 transition-all ${
                  state === 'active' ? 'bg-amber/8 border-amber/30' :
                  state === 'done' ? 'bg-green-dim/20 border-green-dim' : 'bg-surface2/40 border-border2/60'
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{item.className}</div>
                    <div className="text-xs text-text2">{item.subjectName} · {fmt(item.startTime)}–{fmt(item.endTime)}</div>
                    {state === 'done' && <div className="text-[11px] text-green mt-1 font-semibold">✓ Selesai</div>}
                  </div>
                  <button
                    onClick={() => handleCycle(item.subjectId, item.classId, item.examDate, corrSt)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all flex-shrink-0 ${corrSt ? STATUS_CLS[corrSt] : 'text-text3 bg-surface border-border2 hover:border-border3'}`}
                  >
                    {corrSt ? STATUS_LABEL[corrSt] : 'Koreksi?'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Semua Ujian Tab ───────────────────────────────────────────────────────
  const SubjectCard = ({ item }: { item: ExamSubjectItem }) => {
    const isExp = expanded === item.subjectId;
    const done = item.classes.filter(c => c.correction?.status === 'selesai').length;
    return (
      <div className="bg-surface border border-border2 rounded-2xl overflow-hidden">
        <button className="w-full flex items-center justify-between px-4 py-3 text-left"
          onClick={() => setExpanded(isExp ? null : item.subjectId)}>
          <div>
            <div className="text-sm font-semibold">{item.subjectName}</div>
            <div className={`text-xs mt-0.5 ${dayLabelColor(item.daysLeft)}`}>
              {fmtDate(item.examDate)} · {fmtDayLabel(item.daysLeft)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {item.daysLeft < 0 && item.classes.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${done === item.classes.length ? 'text-green bg-green-dim border-green' : 'text-amber bg-amber/10 border-amber/25'}`}>
                {done}/{item.classes.length} ✓
              </span>
            )}
            <span className="text-text3 text-xs">{isExp ? '▲' : '▼'}</span>
          </div>
        </button>
        {isExp && (
          <div className="border-t border-border px-4 pb-3 pt-2 space-y-2">
            <div className="text-xs text-text3 font-bold uppercase tracking-wide mb-1">Koreksi per Kelas</div>
            {item.classes.map(cls => {
              const st = cls.correction?.status ?? null;
              return (
                <div key={cls.classId} className="flex items-center justify-between py-1">
                  <span className="text-sm">{cls.className}</span>
                  <button
                    onClick={() => handleCycle(item.subjectId, cls.classId, item.examDate, st)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${st ? STATUS_CLS[st] : 'text-text3 bg-surface border-border2'}`}
                  >
                    {st ? STATUS_LABEL[st] : 'Belum'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Tabs */}
      <div className="flex gap-1.5 bg-surface rounded-2xl p-1">
        <button onClick={() => setTab('hari-ini')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === 'hari-ini' ? 'bg-primary text-primary-foreground' : 'text-text3 hover:text-text2'}`}>
          📅 Hari Ini
        </button>
        <button onClick={() => setTab('semua')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === 'semua' ? 'bg-primary text-primary-foreground' : 'text-text3 hover:text-text2'}`}>
          📋 Semua Ujian
        </button>
      </div>

      {tab === 'hari-ini' && renderHariIni()}

      {tab === 'semua' && (
        <div className="space-y-2">
          {allSubjects.length === 0 && (
            <div className="bg-surface border border-border2 rounded-2xl p-6 text-center text-sm text-text3">
              Belum ada jadwal ujian. Atur di Kelola → Mapel.
            </div>
          )}
          {upcoming.length > 0 && (
            <>
              <div className="text-xs font-bold text-text3 uppercase tracking-wide px-1">Akan Datang</div>
              {upcoming.map(item => <SubjectCard key={item.subjectId} item={item} />)}
            </>
          )}
          {past.length > 0 && (
            <>
              <div className="text-xs font-bold text-text3 uppercase tracking-wide px-1 mt-3">Sudah Lewat</div>
              {past.map(item => <SubjectCard key={item.subjectId} item={item} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
