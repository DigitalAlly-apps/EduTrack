import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getTodaySchedules, getActiveSession, getNextSession, getInsights,
  markDone, skipSession, postponeSchedule, applyShortDayOverride, applyEarlyDismissal, timeToMin, currentMin, fmt, fmtCountdown,
  todayNum, DAYS_ID, getExamCountdowns, shouldShowBackupReminder, dismissBackupReminder, isTodayHolidayGlobal,
  getTasks, toggleTask, addTask, updateSessionNote, getData, generateDailyJournal, suggestDayReschedule, applySmartReschedule
} from '@/lib/data';
import { TodayScheduleItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import DailyBriefing from './DailyBriefing';
import SmartReschedulerModal from './SmartReschedulerModal';

interface TodayViewProps {
  refreshKey: number;
  onRefresh: () => void;
}

export default function TodayView({ refreshKey, onRefresh }: TodayViewProps) {
  const items = getTodaySchedules();
  const active = getActiveSession(items);
  const next = getNextSession(items);
  const insights = getInsights();
  const { toast } = useToast();

  // Smart Rescheduler state
  const [reschedulerOpen, setReschedulerOpen] = useState(false);
  const [reschedulerDate, setReschedulerDate] = useState('');

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [undoProgress, setUndoProgress] = useState(0);
  
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [belumKumpulDraft, setBelumKumpulDraft] = useState('');

  // Helpers for reminder pertemuan depan
  const REMINDER_PREFIX = '\n---REMINDER_DEPAN---\n';
  const extractReminder = (note?: string) => {
    if (!note) return { mainNote: '', reminder: '' };
    // Support both old prefix and new
    const oldIdx = note.indexOf('\n---BELUM_KUMPUL---\n');
    if (oldIdx !== -1) return { mainNote: note.slice(0, oldIdx), reminder: note.slice(oldIdx + '\n---BELUM_KUMPUL---\n'.length) };
    const idx = note.indexOf(REMINDER_PREFIX);
    if (idx === -1) return { mainNote: note, reminder: '' };
    return { mainNote: note.slice(0, idx), reminder: note.slice(idx + REMINDER_PREFIX.length) };
  };
  const getPrevReminder = (classId: string, subjectId: string, todayStr: string): string => {
    try {
      const data = getData();
      const lastSess = data.sessions
        .filter(s => s.classId === classId && s.subjectId === subjectId && s.date < todayStr && s.materialId !== 'SKIPPED')
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!lastSess?.note) return '';
      return extractReminder(lastSess.note).reminder;
    } catch { return ''; }
  };
  
  const tasks = getTasks();
  const [briefingOpen, setBriefingOpen] = useState(() => !getActiveSession(getTodaySchedules()));
  const [endedBanner, setEndedBanner] = useState<string | null>(null); // scheduleId of ended class
  const endedNotifiedRef = useRef<Set<string>>(new Set());

  // Tick every 30s to detect class ending
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Detect class just ended (within 10 min) and not yet marked done
  useEffect(() => {
    const curMin = currentMin();
    for (const item of items) {
      if (item.done) continue;
      const endMin = timeToMin(item.endTime);
      if (curMin >= endMin && curMin <= endMin + 10) {
        const key = item.id + item.endTime;
        if (!endedNotifiedRef.current.has(key)) {
          endedNotifiedRef.current.add(key);
          setEndedBanner(item.id);
        }
      }
    }
  }, [tick, items]);
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  const handleHeroDone = useCallback((id: string) => {
    if (pendingId === id) {
      setPendingId(null);
      setUndoProgress(0);
      toast({ title: 'Aksi dibatalkan' });
      return;
    }
    setPendingId(id);
    setUndoProgress(0);
    const start = Date.now();
    const duration = 4000;
    
    const tick = () => {
      setPendingId(prev => {
        if (prev !== id) return prev; // cancelled
        const now = Date.now();
        const p = Math.min(100, ((now - start) / duration) * 100);
        setUndoProgress(p);
        if (p < 100) {
          requestAnimationFrame(tick);
          return prev;
        } else {
          markDone(id);
          onRefresh();
          toast({ title: '✓ Tersimpan' });
          return null;
        }
      });
    };
    requestAnimationFrame(tick);
  }, [pendingId, onRefresh, toast]);

  const handleSkip = (id: string, className: string, subjectName: string, classId: string, subjectId: string) => {
    skipSession(id);
    onRefresh();
    // Smart Reschedule: offer to add makeup task
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
    const deadline = nextWeek.toISOString().slice(0, 10);
    toast({
      title: `⏭ Sesi ${className} dilewati`,
      description: 'Tandai untuk dikejar minggu depan?',
      action: (
        <button
          onClick={() => {
            addTask(classId, subjectId, `Kejar sesi ${className} – ${subjectName} yang terlewat`, deadline);
            onRefresh();
            toast({ title: '📌 Ditambahkan ke Inbox Tugas!' });
          }}
          className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 whitespace-nowrap"
        >
          + Kejar
        </button>
      ) as any,
    });
  };

  const handlePostpone = (id: string, mins: number) => {
    postponeSchedule(id, mins);
    onRefresh();
    toast({ title: `Jadwal digeser ${mins} menit` });
  };

  const handleTLDone = (id: string) => {
    setMarkingId(id);
    setTimeout(() => {
      markDone(id);
      setMarkingId(null);
      onRefresh();
      toast({ title: '✓ Tersimpan' });
    }, 320);
  };

  const handleSaveNote = (sessionId: string) => {
    const combinedNote = belumKumpulDraft.trim()
      ? `${noteDraft}${REMINDER_PREFIX}${belumKumpulDraft.trim()}`
      : noteDraft;
    updateSessionNote(sessionId, combinedNote);
    setExpandedNoteId(null);
    setBelumKumpulDraft('');
    onRefresh();
    toast({ title: 'Catatan disimpan' });
  };

  if (isTodayHolidayGlobal()) {
    return (
      <div className="text-center py-12 px-6 animate-slide-up flex flex-col items-center">
        <div className="w-20 h-20 bg-primary-dim rounded-full grid place-items-center mb-6 shadow-sm">
          <span className="text-4xl">☕</span>
        </div>
        <div className="font-display text-2xl font-bold tracking-tight mb-2">Hari Ini Libur!</div>
        <div className="text-sm text-text2 leading-relaxed max-w-[280px] mx-auto">
          Kamu sudah mencatat hari ini sebagai hari libur (dadakan). Waktunya istirahat sejenak atau selesaikan urusan lain di luar kelas.
        </div>
        <div className="mt-8 px-4 py-2 bg-surface2 border border-border rounded-full text-[13px] font-medium text-text3 italic">
          "Istirahat bukan berarti berhenti, tapi menyiapkan energi buat besok."
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 px-6 animate-slide-up">
        <span className="text-5xl block mb-4">📅</span>
        <div className="font-display text-2xl font-medium tracking-tight mb-2">Tidak ada jadwal hari ini</div>
        <div className="text-sm text-text2 leading-relaxed max-w-[280px] mx-auto">
          Hari ini {DAYS_ID[todayNum()]}. Kayaknya hari santai buat kamu.
        </div>
      </div>
    );
  }

  if (items.every(x => x.done)) {
    const doneItems = items.filter(x => !x.skipped);
    const skippedItems = items.filter(x => x.skipped);
    return (
      <div className="py-8 px-6 animate-slide-up">
        <div className="text-center mb-10">
          <span className="text-6xl block mb-4">🎉</span>
          <div className="font-display text-3xl font-bold tracking-tight mb-2 text-foreground">Semua Beres!</div>
          <div className="text-sm text-text2 leading-relaxed max-w-[280px] mx-auto opacity-80">
            Luar biasa, {getData().teacherName || 'Guru'}. Semua agenda hari ini sudah tuntas.
          </div>
        </div>

        <div className="bg-surface/60 border border-border rounded-2xl p-5 mb-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text3 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green" />
            Ringkasan Hari Ini
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text2">Sesi Selesai</span>
              <span className="text-sm font-bold text-foreground">{doneItems.length} Kelas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text2">Sesi Dilewati</span>
              <span className="text-sm font-bold text-text3">{skippedItems.length} Kelas</span>
            </div>
            <div className="pt-3 border-t border-border/50">
              <div className="text-[10px] font-bold uppercase text-text3 mb-2">Materi yang diajarkan:</div>
              <div className="flex flex-wrap gap-1.5">
                {doneItems.map((it, i) => (
                  <div key={i} className="px-2.5 py-1 bg-green-dim text-green text-[11px] font-semibold rounded-md border border-green/20">
                    {it.className}
                  </div>
                ))}
                {doneItems.length === 0 && <span className="text-[11px] text-text3 italic">Tidak ada materi baru</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => {
              const journal = generateDailyJournal();
              navigator.clipboard.writeText(journal);
              toast({ title: '📋 Jurnal Berhasil Disalin!', description: 'Siap di-paste ke WhatsApp/Laporan' });
            }}
            className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold transition-all shadow-md active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
          >
            📋 Salin Jurnal Harian
          </button>
          
          <button 
            onClick={() => window.location.reload()}
            className="flex-[0.4] py-3.5 rounded-xl bg-surface2 border border-border text-sm font-bold text-text2 transition-all hover:bg-surface3 active:scale-[0.98] mt-2"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  const doneCount = items.filter(x => x.done).length;
  const showBackupBtn = shouldShowBackupReminder();
  const countdowns = getExamCountdowns();

  return (
    <div>
      {/* Daily Briefing — collapsible */}
      <div className={`mb-3 border rounded-2xl overflow-hidden transition-all ${briefingOpen ? 'border-border2' : 'border-transparent'}`}>
        <button
          onClick={() => setBriefingOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface2/40 transition-colors"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-text3 flex items-center gap-1.5">
            🗂️ Briefing Harian
          </span>
          <span className={`text-text3 text-[14px] transition-transform duration-300 ${briefingOpen ? 'rotate-180' : ''}`}>⌄</span>
        </button>
        {briefingOpen && <div className="px-1 pb-1"><DailyBriefing /></div>}
      </div>
      {/* Backup Reminder Banner */}
      {showBackupBtn && (
        <div className="bg-amber/10 border border-amber/30 rounded-lg p-3 mb-[10px] flex items-center justify-between animate-slide-up">
          <div className="flex items-center gap-2 max-w-[70%]">
            <span className="text-lg">⚠️</span>
            <span className="text-[11px] font-medium leading-snug">Sudah 7+ hari belum backup data Anda.</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { dismissBackupReminder(); onRefresh(); }} className="px-2 py-1.5 text-[10px] font-semibold text-text2 bg-surface rounded shadow-sm">Nanti</button>
            <button onClick={() => { window.document.querySelector('.tab-data-btn')?.dispatchEvent(new MouseEvent('click')); dismissBackupReminder(); onRefresh(); }} className="px-2 py-1.5 text-[10px] font-bold text-amber-950 bg-amber rounded shadow-sm">Backup</button>
          </div>
        </div>
      )}

      {/* In-app banner: kelas baru saja selesai dan belum ditandai */}
      {endedBanner && (() => {
        const endedItem = items.find(i => i.id === endedBanner);
        if (!endedItem || endedItem.done) return null;
        return (
          <div className="flex items-center justify-between bg-primary/10 border border-primary-border rounded-2xl px-4 py-3 mb-3 animate-slide-up">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <div>
                <div className="text-[11px] font-bold text-primary uppercase tracking-wide">Pelajaran Selesai</div>
                <div className="text-xs text-text2">{endedItem.className} · {endedItem.subjectName}</div>
              </div>
            </div>
            <div className="flex gap-2 relative">
              <button onClick={() => { handleHeroDone(endedBanner); }} className="text-[11px] font-bold bg-primary text-primary-foreground px-4 py-1.5 rounded-xl transition-all relative overflow-hidden flex items-center justify-center min-w-[80px]">
                {pendingId === endedBanner ? (
                  <>
                    <div className="absolute left-0 top-0 bottom-0 bg-black/20" style={{ width: `${undoProgress}%`, transition: 'width 0.1s linear' }} />
                    <span className="relative z-10 flex items-center gap-1"><span className="text-[10px]">✕</span> Batal</span>
                  </>
                ) : (
                  "✓ Selesai"
                )}
              </button>
              <button onClick={() => setEndedBanner(null)} className="text-[11px] text-text3 px-3 py-1.5 hover:bg-surface2 rounded-xl transition-colors">✕ Tutup</button>
            </div>
          </div>
        );
      })()}

      {/* Unified Hero Area: Active Session, Upcoming, or Exams */}
      {(() => {
        const hasExams = countdowns.length > 0;
        
        // State 1: Active Session (Highest Priority)
        if (active) {
          const totalDuration = active.duration || 45;
          const elapsed = currentMin() - timeToMin(active.startTime);
          const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
          const isOvertime = currentMin() >= timeToMin(active.endTime);

          return (
            <div className={`bg-surface/60 backdrop-blur-xl border rounded-[32px] overflow-hidden relative shadow-lg mb-4 animate-slide-up group transition-all duration-500 ${isOvertime ? 'border-red/40 ring-1 ring-red/20' : 'border-primary-border/30'}`}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
              
              {/* Time Up Notification Banner */}
              {isOvertime && (
                <div className="bg-red text-white py-2 px-4 text-center text-[11px] font-bold uppercase tracking-[2px] animate-pulse">
                  ⚡ Waktu Pelajaran Selesai
                </div>
              )}
              
              <div className="p-5 relative">
                {/* Status + Exam Badges at Top */}
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className={`inline-flex items-center gap-2 border text-[10px] font-bold tracking-wider uppercase px-2.5 py-1.5 rounded-md flex-shrink-0 ${isOvertime ? 'bg-red/10 border-red/30 text-red' : 'bg-primary-dim border-primary-border/30 text-primary'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOvertime ? 'bg-red animate-pulse' : 'bg-primary'}`} />
                    <span>{isOvertime ? 'Waktu Habis' : 'Sedang Berlangsung'}</span>
                  </div>
                  
                  <div className="flex gap-1 overflow-x-auto scrollbar-none ml-auto">
                    {hasExams && countdowns.slice(0, 1).map((cd, i) => (
                      <div key={i} className={`whitespace-nowrap px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-tight flex-shrink-0 ${cd.daysLeft <= 7 ? 'bg-red/10 border-red/20 text-red' : 'bg-amber/10 border-amber/20 text-amber'}`}>
                        {cd.subject}: {cd.daysLeft}h
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-surface2 rounded-full mb-6 overflow-hidden border border-border/30">
                  <div 
                    className={`h-full transition-all duration-1000 ease-linear ${isOvertime ? 'bg-red' : 'bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)]'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="font-display text-3xl font-extrabold tracking-tight leading-none mb-3 text-foreground break-words">{active.className}</div>
                <div className="text-[15px] font-semibold text-text2 mb-6 flex flex-wrap items-center gap-2.5 w-full">
                  <span className="opacity-90">{active.subjectName}</span>
                  <span className="opacity-20">•</span>
                  <span className="font-bold text-primary">
                    {active.totalMats > 0 
                      ? `Pertemuan ${Math.min(active.materialsDone + 1, active.totalMats)} dari ${active.totalMats}`
                      : 'Belum ada materi'}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-6">
                   <div className={`flex-1 p-4 rounded-2xl border flex items-center gap-4 ${isOvertime ? 'bg-red/10 border-red/20' : 'bg-surface2/60 border-border/40'}`}>
                      <div className="w-10 h-10 rounded-xl bg-surface/50 flex items-center justify-center text-xl">
                        {isOvertime ? '⏰' : '⏳'}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-text3 mb-0.5">
                          {isOvertime ? 'Kelebihan Waktu' : 'Sisa Waktu'}
                        </div>
                        <div className={`text-2xl font-black tabular-nums leading-none ${isOvertime ? 'text-red' : 'text-primary'}`}>
                           {Math.abs(timeToMin(active.endTime) - currentMin())}m
                        </div>
                      </div>
                   </div>
                   <div className="bg-surface2/40 border border-border/40 rounded-2xl p-3 px-4 min-w-[100px] text-center">
                      <div className="text-[9px] font-bold uppercase text-text3 mb-1">Jadwal Selesai</div>
                      <div className="text-sm font-bold opacity-90">{fmt(active.endTime)}</div>
                   </div>
                </div>

                <div className="bg-surface2/40 backdrop-blur-sm border border-border/40 rounded-2xl p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl flex-shrink-0">📖</div>
                  <div>
                    <div className="text-[10px] font-bold tracking-wider uppercase text-text3 mb-0.5">Materi Hari Ini</div>
                    <div className="text-[15px] font-bold leading-tight text-foreground/90">{active.nextMat ? active.nextMat.name : 'Semua materi selesai 🎉'}</div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-1">
                <div className="flex gap-2 relative">
                  <button
                    onClick={() => handleHeroDone(active.id)}
                    className={`flex-1 py-4.5 rounded-2xl text-[15px] font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 active:translate-y-0.5 active:shadow-none hover:brightness-105 ${
                      pendingId === active.id
                        ? 'bg-surface3 text-text2 border border-border'
                        : isOvertime 
                          ? 'bg-red text-white' 
                          : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {pendingId === active.id ? (
                      <>
                        <div className="absolute left-0 top-0 bottom-0 bg-primary/20" style={{ width: `${undoProgress}%`, transition: 'width 0.1s linear' }} />
                        <span className="relative z-10 flex items-center gap-2 text-sm">✕ BATALKAN</span>
                      </>
                    ) : <>{isOvertime ? '🔥 SELESAI' : '✓ SELESAI'}</>}
                  </button>
                  <button
                    onClick={() => handleSkip(active.id, active.className, active.subjectName, active.classId, active.subjectId)}
                    className="w-[58px] h-[58px] rounded-2xl bg-surface2 border border-border2 text-text2 text-2xl grid place-items-center flex-shrink-0 transition-all hover:bg-surface3 hover:border-border3 active:scale-95 shadow-sm"
                    title="Lewati sesi ini"
                  >
                    ⏭
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // State 2: No active session, show Upcoming (Wait)
        const upcoming = items.find(x => !x.done);
        if (upcoming) {
          const diff = timeToMin(upcoming.startTime) - currentMin();
          return (
            <div className="bg-surface/50 backdrop-blur-xl border border-teal-border/40 rounded-[32px] p-5 overflow-hidden relative mb-4 animate-slide-up shadow-xl group">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_0%,hsl(var(--teal-glow))_0%,transparent_70%)] pointer-events-none mix-blend-screen opacity-60" />
              <div className="absolute inset-x-0 top-0 h-[100px] bg-gradient-to-b from-teal/10 to-transparent pointer-events-none" />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="inline-flex items-center gap-[6px] bg-teal-dim border border-teal/40 text-[10px] text-teal font-extrabold tracking-[0.9px] uppercase px-[14px] py-[8px] rounded-full shadow-[0_0_15px_hsl(var(--teal-glow))]">
                    🕐 Berikutnya
                  </div>
                  {hasExams && (
                    <div className="flex gap-1">
                      {countdowns.slice(0, 1).map((cd, i) => (
                        <div key={i} className={`whitespace-nowrap px-2.5 py-1 rounded-lg border text-[10px] font-bold ${cd.daysLeft <= 7 ? 'bg-red/10 border-red/20 text-red' : 'bg-amber/10 border-amber/20 text-amber'}`}>
                          📅 {cd.subject}: {cd.daysLeft}h
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="font-display text-3xl font-black tracking-[-0.04em] leading-[0.95] bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent mb-2">{upcoming.className}</div>
                <div className="text-[16px] font-bold text-text2/80 mb-5 flex items-center gap-2">
                  <span>{upcoming.subjectName}</span>
                  <span className="opacity-30">•</span>
                  <span className="text-[14px] text-teal">Sesi {Math.min(upcoming.materialsDone + 1, upcoming.totalMats)}/{upcoming.totalMats}</span>
                </div>
                
                <div className="bg-teal-dim/60 backdrop-blur-md border border-teal/20 rounded-[24px] p-5 flex items-center gap-5 shadow-inner">
                  <div className="w-12 h-12 rounded-2xl bg-teal/10 border border-teal/30 flex items-center justify-center text-[28px]">⏱</div>
                  <div className="flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-teal/70 mb-1">Mulai Pukul {fmt(upcoming.startTime)}</div>
                    <div className="flex items-baseline gap-2">
                       <div className="text-3xl font-black text-teal tabular-nums leading-none tracking-tighter">{fmtCountdown(diff)}</div>
                    </div>
                  </div>
                </div>

                {upcoming.nextMat && (
                  <div className="mt-5 text-[13px] font-semibold text-text3 flex items-center gap-2.5 px-2">
                    <span className="opacity-50">Persiapan:</span> 
                    <strong className="text-foreground/70 bg-surface3/40 px-2 py-0.5 rounded-md border border-border/20">{upcoming.nextMat.name}</strong>
                  </div>
                )}
                
                <div className="mt-4 flex items-center justify-between border-t border-teal/20 pt-3 relative z-10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal/70">Geser Jadwal:</span>
                  <div className="flex gap-2">
                    <button onClick={() => handlePostpone(upcoming.id, 15)} className="px-2.5 py-1 bg-teal/10 border border-teal/20 rounded-lg text-[11px] font-bold text-teal hover:bg-teal/20 transition-all">+15m</button>
                    <button onClick={() => handlePostpone(upcoming.id, 30)} className="px-2.5 py-1 bg-teal/10 border border-teal/20 rounded-lg text-[11px] font-bold text-teal hover:bg-teal/20 transition-all">+30m</button>
                    <button onClick={() => handlePostpone(upcoming.id, 60)} className="px-2.5 py-1 bg-teal/10 border border-teal/20 rounded-lg text-[11px] font-bold text-teal hover:bg-teal/20 transition-all">+1j</button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // State 3: No sessions today, but Exams exist
        if (hasExams) {
          return (
             <div className="bg-surface/50 backdrop-blur-xl border border-border rounded-[32px] p-7 mb-4 animate-slide-up shadow-lg">
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-2xl">⚡</span>
                   <div className="text-[11px] font-black uppercase tracking-widest text-text3">Fokus Ujian Mendatang</div>
                </div>
                <div className="space-y-4">
                  {countdowns.slice(0, 3).map((cd, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border ${cd.daysLeft <= 7 ? 'bg-red/5 border-red/20' : 'bg-surface2/60 border-border'}`}>
                      <div>
                        <div className="text-[14px] font-extrabold text-foreground">{cd.subject}</div>
                        <div className="text-[11px] font-bold text-text3 uppercase mt-0.5">Mata Pelajaran</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-black tabular-nums leading-none ${cd.daysLeft <= 7 ? 'text-red' : cd.daysLeft <= 14 ? 'text-amber' : 'text-primary'}`}>{cd.daysLeft}</div>
                        <div className="text-[9px] font-black text-text3 uppercase mt-1">Hari Lagi</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('set-tab', { detail: 'exam' }))}
                  className="w-full mt-6 py-3 text-[11px] font-black text-primary uppercase tracking-widest hover:bg-primary/5 rounded-xl transition-colors"
                >
                  Lihat Kalender Ujian →
                </button>
             </div>
          );
        }

        return null; // Should not happen given logic above
      })()}


      {/* Next Card */}
      {active && next && next.id !== active.id && (
        <div className="bg-surface border border-border rounded-lg p-[13px_15px] flex items-center gap-3 mb-[10px] relative overflow-hidden animate-slide-up-delay-1">
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-teal rounded-r" />
          <div className="w-[38px] h-[38px] rounded-[10px] bg-teal-dim border border-teal grid place-items-center text-base flex-shrink-0">📚</div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-bold tracking-[0.8px] uppercase text-teal mb-[2px]">Setelah ini</div>
            <div className="text-sm font-semibold">{next.className} — {next.subjectName} <span className="opacity-50 font-normal ml-1">(Sesi ke-{Math.min(next.materialsDone + 1, next.totalMats)}/{next.totalMats})</span></div>
            {next.nextMat && <div className="text-[11px] text-text2 mt-[1px]">📖 {next.nextMat.name}</div>}
          </div>
          <div className="bg-teal-dim border border-teal rounded-[9px] p-[6px_10px] text-center flex-shrink-0">
            <span className="text-[13px] font-semibold text-teal tabular-nums block leading-tight">{fmt(next.startTime)}</span>
            <div className="text-[9px] text-text3">{fmtCountdown(timeToMin(next.startTime) - currentMin())}</div>
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.map((ins, i) => (
        <div
          key={i}
          className={`rounded-lg p-3 flex items-start gap-[10px] mb-2 animate-slide-up-delay-2 ${
            ins.type === 'warn'
              ? 'bg-[hsl(45_93%_56%/0.05)] border border-[hsl(45_93%_56%/0.14)]'
              : 'bg-[hsl(199_89%_60%/0.05)] border border-[hsl(199_89%_60%/0.12)]'
          }`}
        >
          <div className="text-[15px] flex-shrink-0 mt-[1px]">{ins.type === 'warn' ? '💡' : '📌'}</div>
          <div>
            <div className="text-[9px] font-bold tracking-[0.7px] uppercase text-text3 mb-[2px]">{ins.directive}</div>
            <div className="text-[13px] text-text2 leading-relaxed" dangerouslySetInnerHTML={{ __html: ins.text }} />
          </div>
        </div>
      ))}

      {/* Task Inbox */}
      {pendingTasks.length > 0 && (
        <div className="mb-4 animate-slide-up-delay-2">
          <div className="text-[11px] font-semibold tracking-[0.7px] uppercase text-amber mb-2 flex items-center justify-between">
            <span>Inbox Tugas ({pendingTasks.length})</span>
          </div>
          <div className="bg-surface border border-border2 rounded-xl overflow-hidden shadow-sm">
            {pendingTasks.map((t, i) => {
              const cls = getData().classes.find(c => c.id === t.classId);
              const sub = getData().subjects.find(s => s.id === t.subjectId);
              return (
                <div key={t.id} className={`p-3 flex items-start gap-3 ${i < pendingTasks.length - 1 ? 'border-b border-border2' : ''}`}>
                  <button onClick={() => { toggleTask(t.id); onRefresh(); toast({ title: 'Tugas selesai!' }); }} className="mt-[2px] w-5 h-5 rounded-md border-2 border-border grid place-items-center flex-shrink-0 text-transparent hover:border-amber transition-colors">
                    <span className="text-[12px]">✓</span>
                  </button>
                  <div>
                    <div className="text-[13px] font-semibold leading-tight mb-1">{t.title}</div>
                    <div className="text-[11px] text-text2">{cls?.name} • {sub?.name} <span className="mx-1">•</span> <span className="text-amber">Batas: {t.deadline}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex items-center justify-between mt-4 mb-2 sticky top-0 z-30 bg-background/95 backdrop-blur-xl py-3 px-3 shadow-sm border border-border/40 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold tracking-[0.7px] uppercase text-text3">Jadwal Hari Ini</div>
           {!active && items.length > 0 && !items.every(x => x.done) && (
             <div className="flex gap-2 flex-wrap">
               <button 
                 onClick={() => {
                   const input = prompt('Mulai jam berapa jadwal akan diliburkan? (contoh: 10:00 atau 10:30)');
                   if(input) {
                     if (/^\d{1,2}:\d{2}$/.test(input.trim())) {
                       const count = applyEarlyDismissal(new Date().toISOString().slice(0, 10), input.trim());
                       onRefresh();
                       toast({ title: `🏠 ${count} kelas setelah ${input.trim()} diliburkan` });
                     } else {
                       toast({ variant: 'destructive', title: 'Format waktu salah (harus HH:MM)' });
                     }
                   }
                 }}
                 className="text-[9px] font-bold text-blue-500 px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 transition-colors hover:bg-blue-500/20 whitespace-nowrap"
               >
                 🏠 Pulang Awal
               </button>
               <button
                 onClick={() => {
                   const today = new Date().toISOString().slice(0, 10);
                   setReschedulerDate(today);
                   setReschedulerOpen(true);
                 }}
                 className="text-[9px] font-bold text-amber-600 px-2 py-0.5 rounded-full border border-amber-600/30 bg-amber-600/10 transition-colors hover:bg-amber-600/20 whitespace-nowrap"
               >
                 🏥 Izin/Cuti
               </button>
             </div>
           )}
        </div>
        <div className="flex items-center gap-2">
          {active && (
            <span className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 px-3 py-1 rounded-full animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),0.2)]">
              ● {Math.max(0, timeToMin(active.endTime) - currentMin())} mnt tersisa
            </span>
          )}
          <div className="text-[11px] text-text3 font-medium px-2 py-1 bg-surface border border-border rounded-full">{doneCount}/{items.length} Selesai</div>
        </div>
      </div>

      {items.map((item, i) => {
        const state = item.active ? 'active' : item.done ? 'done' : '';
        const todayStr = new Date().toISOString().slice(0, 10);
        const prevReminder = !item.done ? getPrevReminder(item.classId, item.subjectId, todayStr) : '';
        return (
          <div
            key={item.id}
            className="flex items-stretch gap-[10px] mb-1 animate-slide-up"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {/* Spine */}
            <div className="flex flex-col items-center w-[48px] flex-shrink-0 py-[12px] gap-[6px]">
              {state === 'done' ? (
                <div className="flex flex-col items-center">
                  <div className="text-[11px] font-bold text-text2 tabular-nums text-center">{fmt(item.startTime)}</div>
                  <div className={`text-[9px] font-bold tabular-nums text-center opacity-80 ${item.skipped ? 'text-text3' : 'text-green'}`}>{fmt(item.endTime)}</div>
                </div>
               ) : (
                 <div className="flex flex-col items-center">
                   <div className="text-[11px] font-semibold text-text2 tabular-nums whitespace-nowrap">{fmt(item.startTime)}</div>
                   {!item.active && !item.done && (
                     <div className="text-[9px] font-medium text-teal tabular-nums mt-0.5">{fmtCountdown(timeToMin(item.startTime) - currentMin())}</div>
                   )}
                 </div>
               )}
              <div className={`w-[8px] h-[8px] rounded-full flex-shrink-0 mt-[2px] transition-all duration-500 relative ${
                state === 'active' ? 'bg-primary shadow-[0_0_12px_hsl(var(--primary-glow))]' :
                state === 'done' ? (item.skipped ? 'bg-text3' : 'bg-green') : 'bg-border3'
              }`}>
                {state === 'active' && <div className="absolute inset-0 rounded-full border border-primary animate-ping opacity-50" />}
              </div>
              {i < items.length - 1 && <div className="flex-1 w-[2px] bg-gradient-to-b from-border2 to-transparent min-h-[12px]" />}
            </div>

            {/* Card */}
            <div className="flex-1 mb-4">
              <div className={`group bg-surface/40 backdrop-blur-md border rounded-[24px] p-3 pr-[60px] flex flex-col justify-center transition-all duration-300 min-h-[72px] relative shadow-sm hover:shadow-md ${
                state === 'active' ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/10' :
                state === 'done' 
                   ? (item.skipped 
                       ? 'border-amber/40 bg-amber/10 opacity-100 shadow-sm' 
                       : 'border-green/50 bg-green/10 opacity-100') 
                   : 'border-border/60 hover:border-border hover:bg-surface/60'
              } ${markingId === item.id ? 'scale-[0.98] opacity-70' : ''}`}>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                     <div className={`text-[15px] font-bold tracking-tight leading-tight truncate ${item.skipped ? 'text-text2' : 'text-foreground'}`}>
                       {item.className}
                     </div>
                    {state === 'done' && (
                      item.skipped
                        ? <span className="text-[9px] font-bold text-amber bg-amber/10 px-1.5 py-0.5 rounded-full uppercase">Dilewati</span>
                        : <span className="text-[9px] font-bold text-green bg-green/10 px-1.5 py-0.5 rounded-full uppercase">Selesai</span>
                    )}
                  </div>
                  
                  <div className="text-[12px] text-text2 font-medium flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                    <span className="flex-shrink-0">{item.subjectName}</span>
                    <span className="opacity-30">•</span>
                    <span className="font-bold text-foreground flex-shrink-0">
                      {item.totalMats > 0 
                        ? `Sesi ${Math.min(item.materialsDone + (item.done ? 0 : 1), item.totalMats)}/${item.totalMats}`
                        : 'Belum ada materi'}
                    </span>
                    {!item.done && item.nextMat && (
                      <span className="text-text3/70 truncate max-w-full">📖 {item.nextMat.name}</span>
                    )}
                  </div>
                </div>

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex-shrink-0">
                  {item.done ? (
                    !item.skipped && (
                      <button
                        onClick={() => {
                          if (expandedNoteId === item.id) { setExpandedNoteId(null); setBelumKumpulDraft(''); }
                          else {
                            setExpandedNoteId(item.id);
                            const { mainNote, reminder } = extractReminder(item.note);
                            setNoteDraft(mainNote);
                            setBelumKumpulDraft(reminder);
                          }
                        }}
                        className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-all ${
                          item.note ? 'bg-green/10 border-green/20 text-green shadow-inner' : 'bg-surface2/50 border-border/40 text-text3 hover:border-green/40 hover:text-green'
                        }`}
                      >
                        <span className="text-lg">📝</span>
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handleTLDone(item.id)}
                      className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary text-lg flex items-center justify-center transition-all hover:bg-primary hover:text-white hover:scale-105 active:scale-95 shadow-sm"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>

            {/* Reminder pertemuan depan dari sesi lalu */}
            {prevReminder && (
              <div className="mt-1.5 bg-amber/8 border border-amber/25 rounded-xl px-3 py-2 flex items-start gap-2 animate-slide-up">
                <span className="text-base flex-shrink-0 mt-0.5">📌</span>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-amber mb-0.5">📋 Catatan dari Pertemuan Lalu</div>
                  <div className="text-[12px] text-foreground/80 font-medium leading-snug whitespace-pre-wrap">{prevReminder}</div>
                </div>
              </div>
            )}
              
              {/* Expandable Note Section */}
              {item.done && expandedNoteId === item.id && item.sessionId && (
                <div className="mt-1 bg-surface2 border border-border2 rounded-xl p-3 animate-slide-up origin-top">
                  <div className="text-[10px] font-semibold text-text3 uppercase tracking-[0.5px] mb-2">Jurnal Sesi / Catatan</div>
                  <textarea
                    autoFocus
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    placeholder="Catatan umum (mis. Budi remedial, tugas hal 12)..."
                    className="w-full bg-surface border border-border2 rounded-md p-2 text-[13px] min-h-[50px] resize-none focus:border-green focus:outline-none placeholder:text-text3"
                  />
                  
                  {/* Reminder Pertemuan Depan */}
                  <div className="mt-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-sm">📌</span>
                      <span className="text-[10px] font-bold text-amber uppercase tracking-wider">Reminder Pertemuan Depan</span>
                    </div>
                    <textarea
                      value={belumKumpulDraft}
                      onChange={e => setBelumKumpulDraft(e.target.value)}
                      placeholder="Contoh: Lanjut Bab 3 hal 45, Ahmad belum kumpul, Budi perlu remedial..."
                      className="w-full bg-surface border border-amber/30 rounded-md p-2 text-[13px] min-h-[55px] resize-none focus:border-amber focus:outline-none placeholder:text-text3"
                    />
                  </div>

                  <div className="flex justify-end gap-2 mt-2.5">
                    <button onClick={() => {
                       const title = prompt('Nama tugas (mis. Koreksi tugas matriks):');
                       if (title) {
                         const d = new Date(); d.setDate(d.getDate() + 7);
                         addTask(item.classId, item.subjectId, title, d.toISOString().slice(0, 10));
                         onRefresh();
                         toast({ title: 'Tugas ditambahkan' });
                       }
                    }} className="px-3 py-1.5 rounded bg-surface border border-border text-[11px] font-semibold text-amber flex items-center gap-1">
                      + Tugas Baru
                    </button>
                    <button onClick={() => handleSaveNote(item.sessionId!)} className="px-4 py-1.5 rounded bg-green text-surface shadow-sm text-[11px] font-bold">
                      Simpan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      {/* Smart Rescheduler Modal */}
      <SmartReschedulerModal
        open={reschedulerOpen}
        onOpenChange={setReschedulerOpen}
        dateStr={reschedulerDate}
        onSuccess={onRefresh}
      />
    </div>
  );
}
