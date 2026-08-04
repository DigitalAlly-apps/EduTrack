import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getTodaySchedules, getActiveSession, getNextSession,
  markDone, unmarkDone, skipSession, applyEarlyDismissal, timeToMin, currentMin, fmt, fmtCountdown,
  todayNum, DAYS_ID, shouldShowBackupReminder, dismissBackupReminder, isTodayHolidayGlobal,
  getTasks, toggleTask, addTask, updateSessionNote, getData, generateDailyJournal, applySmartReschedule,
  dateKey, getTeachingPosition, applySubjectDismissal, getInsights, getTomorrowKbmSchedules, getMaterials,
  getLastPageReached, getNextStartPage,
} from '@/lib/data';
import { TodayScheduleItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import SmartReschedulerModal from './SmartReschedulerModal';
import { Check, ChevronDown, FilePenLine, HeartPulse, Home, SkipForward, X } from 'lucide-react';
import {
  getExamDayMode, setExamDayMode,
  getTodayExamItems, getTodayProctorSessions,
  getTomorrowExamItems, getTomorrowProctorSessions,
} from '@/lib/examData';
import { getDailyBriefing } from '@/lib/briefing';
import { requestNotifPermission } from '@/lib/notifications';

interface TodayViewProps {
  refreshKey: number;
  onRefresh: () => void;
}

function getMaterialPageLabel(material?: { pageStart?: string; pageEnd?: string } | null) {
  if (!material?.pageStart) return '';
  return material.pageEnd ? `Hal. ${material.pageStart}-${material.pageEnd}` : `Hal. ${material.pageStart}`;
}

export default function TodayView({ refreshKey, onRefresh }: TodayViewProps) {
  const items = getTodaySchedules();
  const active = getActiveSession(items);
  const next = getNextSession(items);
  const { toast } = useToast();

  const [examModeBanner, setExamModeBanner] = useState(getExamDayMode());
  const [notifPermission, setNotifPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));

  // Smart Rescheduler state
  const [reschedulerOpen, setReschedulerOpen] = useState(false);
  const [reschedulerDate, setReschedulerDate] = useState('');

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [undoProgress, setUndoProgress] = useState(0);
  // TL undo — same mechanism as hero
  const [tlPendingId, setTlPendingId] = useState<string | null>(null);
  const [tlUndoProgress, setTlUndoProgress] = useState(0);

  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [belumKumpulDraft, setBelumKumpulDraft] = useState('');

  // Bottom sheet states (replacing prompt())
  const [earlyDismissSheet, setEarlyDismissSheet] = useState(false);
  const [earlyDismissTime, setEarlyDismissTime] = useState('10:00');
  const [subjectDismissSheet, setSubjectDismissSheet] = useState(false);
  const [subjectDismissSubjectId, setSubjectDismissSubjectId] = useState('');
  const [subjectDismissClassId, setSubjectDismissClassId] = useState('');
  const [subjectDismissTime, setSubjectDismissTime] = useState('11:20');
  const [subjectDismissUseTime, setSubjectDismissUseTime] = useState(true);
  const [newTaskSheet, setNewTaskSheet] = useState<{ classId: string; subjectId: string } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  // Orange fixes
  const [skipConfirm, setSkipConfirm] = useState<TodayScheduleItem | null>(null);
  const [liveNoteOpen, setLiveNoteOpen] = useState(false);
  const [liveNoteDraft, setLiveNoteDraft] = useState('');
  // Tracker halaman terakhir: di-input setelah sesi selesai
  const [lastPageDraft, setLastPageDraft] = useState(''); // untuk expanded note section (timeline)
  const [lastPageHero, setLastPageHero] = useState('');   // untuk hero card quick input

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
  const todayExamItems = getTodayExamItems();
  const todayProctorSessions = getTodayProctorSessions();
  const tomorrowExamItems = getTomorrowExamItems();
  const tomorrowProctorSessions = getTomorrowProctorSessions();
  const tomorrowKbmSchedules = getTomorrowKbmSchedules();
  const insights = getInsights();
  const briefingItems = getDailyBriefing();
  const hasUrgentBriefing = briefingItems.some(b => b.urgent && b.type !== 'semua-beres');
  const showBackupBtn = shouldShowBackupReminder();

  const [statusBarOpen, setStatusBarOpen] = useState(false);
  const [agendaBesokOpen, setAgendaBesokOpen] = useState(false);
  const [endedBanner, setEndedBanner] = useState<string | null>(null);
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
    const isLastItem = getTodaySchedules().filter(x => !x.done).length === 1;
    markDone(id);
    onRefresh();
    toast({
      title: '✓ KBM Selesai',
      action: (
        <button
          onClick={() => {
            unmarkDone(id);
            onRefresh();
            toast({ title: '↩️ Dibatalkan' });
          }}
          className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 whitespace-nowrap"
        >
          Urungkan
        </button>
      ) as any,
    });
    if (isLastItem) {
      setExpandedNoteId(id);
      setNoteDraft('');
      setBelumKumpulDraft('');
    }
  }, [onRefresh, toast]);

  const handleSkip = (id: string, className: string, subjectName: string, classId: string, subjectId: string) => {
    skipSession(id);
    onRefresh();
    // Smart Reschedule: offer to add makeup task
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
    const deadline = dateKey(nextWeek);
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

  const handleTLDone = useCallback((id: string) => {
    const isLastItem = getTodaySchedules().filter(x => !x.done).length === 1;
    markDone(id);
    onRefresh();
    toast({
      title: '✓ KBM Selesai',
      action: (
        <button
          onClick={() => {
            unmarkDone(id);
            onRefresh();
            toast({ title: '↩️ Dibatalkan' });
          }}
          className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 whitespace-nowrap"
        >
          Urungkan
        </button>
      ) as any,
    });
    if (isLastItem) {
      setExpandedNoteId(id);
      setNoteDraft('');
      setBelumKumpulDraft('');
    }
  }, [onRefresh, toast]);

  const handleSaveNote = (sessionId: string) => {
    const combinedNote = belumKumpulDraft.trim()
      ? `${noteDraft}${REMINDER_PREFIX}${belumKumpulDraft.trim()}`
      : noteDraft;
    updateSessionNote(sessionId, combinedNote, lastPageDraft || undefined);
    setExpandedNoteId(null);
    setBelumKumpulDraft('');
    setLastPageDraft('');
    onRefresh();
    toast({ title: 'Catatan disimpan' });
  };



  const handleTurnOffExamMode = () => {
    setExamDayMode(false);
    setExamModeBanner(false);
    onRefresh();
    toast({ title: '📚 Mode KBM Normal kembali aktif' });
  };

  const handleTurnOnExamMode = () => {
    setExamDayMode(true);
    setExamModeBanner(true);
    onRefresh();
    toast({ title: '📋 Mode Ujian Aktif' });
  };

  const handleOpenExam = () => window.dispatchEvent(new CustomEvent('set-tab', { detail: 'exam' }));

  const handleEnableExamNotifications = async () => {
    const ok = await requestNotifPermission();
    setNotifPermission('Notification' in window ? Notification.permission : 'unsupported');
    toast({ title: ok ? '🔔 Notifikasi ujian aktif' : 'Notifikasi belum diizinkan' });
  };

  if (getExamDayMode()) {
    return (
      <div className="space-y-6 py-4 animate-slide-up pb-28">
        {/* Header Card */}
        <div className="glass-panel rounded-[34px] overflow-hidden relative border-amber/20 p-6 shadow-xl shadow-amber/5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--amber)/0.12),transparent_60%)] pointer-events-none" />
          <div className="absolute right-5 top-5 text-[80px] leading-none opacity-[0.045] font-display font-black pointer-events-none">EXAM</div>
          
          <div className="relative text-center py-6">
            <div className="w-20 h-20 rounded-full bg-amber/10 border border-amber/30 flex items-center justify-center text-4xl mx-auto mb-5 shadow-[0_0_25px_rgba(245,158,11,0.15)] animate-pulse">
              🔕
            </div>
            
            <h1 className="font-display text-3xl font-bold tracking-tight leading-tight text-foreground mb-3">
              Mode Ujian Aktif
            </h1>
            
            <p className="text-[13px] font-semibold text-text2 leading-relaxed max-w-sm mx-auto mb-6 px-2">
              Kegiatan Belajar Mengajar (KBM) dan pelacakan jadwal harian dinonaktifkan sementara.
            </p>
            
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-3">
              <div className="bg-surface/65 backdrop-blur-md border border-border2/60 rounded-2xl p-3.5 text-center">
                <div className="text-2xl font-black text-amber leading-none">{todayExamItems.length}</div>
                <div className="text-[10px] text-text3 font-bold uppercase tracking-wider mt-1.5">Sesi Ujian</div>
              </div>
              <div className="bg-surface/65 backdrop-blur-md border border-border2/60 rounded-2xl p-3.5 text-center">
                <div className="text-2xl font-black text-primary leading-none">{todayProctorSessions.length}</div>
                <div className="text-[10px] text-text3 font-bold uppercase tracking-wider mt-1.5">Sesi Ngawas</div>
              </div>
            </div>
          </div>
          
          <div className="px-2 pb-2 relative z-10 space-y-2.5">
            <button
              onClick={handleOpenExam}
              className="w-full min-h-[54px] rounded-2xl bg-gradient-to-r from-amber to-amber-600 text-amber-950 font-black text-[14px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber/20 active:translate-y-0.5 active:shadow-none hover:brightness-105"
            >
              📖 Buka Agenda Ujian
            </button>
            <button
              onClick={handleTurnOffExamMode}
              className="w-full min-h-[48px] rounded-xl bg-surface border border-border text-[12px] font-bold text-text2 flex items-center justify-center gap-2 hover:bg-surface2 transition-all"
            >
              🔄 Kembali ke KBM Normal
            </button>
          </div>
        </div>

        {/* Small Elegant Note */}
        <div className="bg-surface/30 border border-border/50 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-base mt-0.5">💡</span>
          <div className="text-[12px] text-text3 leading-relaxed">
            Anda dapat menonaktifkan Mode Ujian kapan saja melalui tombol di atas atau melalui tab <strong>Ujian</strong> → <strong>Kelola</strong>.
          </div>
        </div>

        {/* Agenda Ujian & Ngawas Hari Ini */}
        {(todayExamItems.length > 0 || todayProctorSessions.length > 0) && (
          <div className="space-y-3">
            <div className="text-[12px] font-bold text-text3 uppercase tracking-wide px-1">Agenda Hari Ini</div>
            <div className="space-y-3">
              {todayExamItems.map((exam, i) => {
                const isActive = (() => {
                  const cur = currentMin();
                  return cur >= timeToMin(exam.startTime) && cur < timeToMin(exam.endTime);
                })();
                return (
                  <div key={`exam-${i}`} className={`bg-amber/5 border rounded-3xl p-4 transition-all ${isActive ? 'border-amber/50 ring-1 ring-amber/10' : 'border-border/60'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber bg-amber/15 px-1.5 py-0.5 rounded-full">UJIAN</span>
                      {isActive && <span className="text-[9px] font-black text-amber animate-pulse">● Berlangsung</span>}
                    </div>
                    <div className="text-[15px] font-bold text-foreground leading-snug">{exam.subjectName}</div>
                    <div className="text-[12px] text-text2 mt-1 flex flex-wrap gap-2">
                      <span className="font-semibold text-text1">{fmt(exam.startTime)}–{fmt(exam.endTime)}</span>
                      <span className="opacity-30">•</span>
                      <span>Kelas: {exam.className}</span>
                      {exam.location && (
                        <>
                          <span className="opacity-30">•</span>
                          <span>📍 {exam.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {todayProctorSessions.map((proctor, i) => {
                const isActive = (() => {
                  const cur = currentMin();
                  return cur >= timeToMin(proctor.startTime) && cur < timeToMin(proctor.endTime);
                })();
                return (
                  <div key={`proctor-${i}`} className={`bg-primary/5 border rounded-3xl p-4 transition-all ${isActive ? 'border-primary/50 ring-1 ring-primary/10' : 'border-border/60'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">NGAWAS</span>
                      {isActive && <span className="text-[9px] font-black text-primary animate-pulse">● Berlangsung</span>}
                    </div>
                    <div className="text-[15px] font-bold text-foreground leading-snug">{proctor.subjectName}</div>
                    <div className="text-[12px] text-text2 mt-1 flex flex-wrap gap-2">
                      <span className="font-semibold text-text1">{fmt(proctor.startTime)}–{fmt(proctor.endTime)}</span>
                      {proctor.location && (
                        <>
                          <span className="opacity-30">•</span>
                          <span>📍 {proctor.location}</span>
                        </>
                      )}
                      {proctor.note && (
                        <>
                          <span className="opacity-30">•</span>
                          <span className="italic">{proctor.note}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Agenda Ujian & Ngawas/KBM Besok */}
        {(tomorrowExamItems.length > 0 || tomorrowProctorSessions.length > 0 || tomorrowKbmSchedules.length > 0) && (
          <div className="mt-4">
            <button
              onClick={() => setAgendaBesokOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-surface/60 border border-border2 rounded-2xl text-xs font-semibold text-text2 hover:bg-surface2 transition-colors"
            >
              <span>
                📅 Agenda Besok
                <span className="ml-2 text-text3 font-normal">
                  {[
                    tomorrowExamItems.length > 0 && `${tomorrowExamItems.length} ujian`,
                    tomorrowProctorSessions.length > 0 && `${tomorrowProctorSessions.length} ngawas`,
                    tomorrowKbmSchedules.length > 0 && `${tomorrowKbmSchedules.length} KBM`,
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-text3 transition-transform ${agendaBesokOpen ? 'rotate-180' : ''}`} />
            </button>
            {agendaBesokOpen && (
              <div className="mt-2 space-y-2 animate-slide-up">
                {tomorrowExamItems.map((exam, i) => (
                  <div key={`tomorrow-exam-${i}`} className="bg-amber/5 border border-amber/20 rounded-2xl p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber bg-amber/15 px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0">UJIAN</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold leading-snug">{exam.subjectName}</div>
                        <div className="text-[11px] text-text2 mt-0.5">
                          {fmt(exam.startTime)}–{fmt(exam.endTime)} · Kelas {exam.className}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {tomorrowProctorSessions.map((p, i) => (
                  <div key={`tomorrow-proctor-${i}`} className="bg-primary/5 border border-primary/20 rounded-2xl p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0">NGAWAS</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold leading-snug">{p.subjectName}</div>
                        <div className="text-[11px] text-text2 mt-0.5">
                          {fmt(p.startTime)}–{fmt(p.endTime)}{p.location ? ` · 📍${p.location}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {tomorrowKbmSchedules.map((sched, i) => (
                  <div key={`tomorrow-kbm-${i}`} className="bg-teal/5 border border-teal/20 rounded-2xl p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-[9px] font-black uppercase tracking-wider text-teal bg-teal/10 px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0">KBM</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold leading-snug">{sched.className} — {sched.subjectName}</div>
                        <div className="text-[11px] text-text2 mt-0.5">
                          ⏰ {fmt(sched.startTime)}–{fmt(sched.endTime)}
                          {sched.nextMat && <span className="text-text3 block mt-0.5">📖 Sesi ke-{Math.min(sched.materialsDone + 1, sched.totalMats)}: {sched.nextMat.name}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

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

  if (items.every(x => x.done) && !expandedNoteId) {
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

            {/* Ringkasan catatan per sesi */}
            <div className="pt-3 border-t border-border/50">
              <div className="text-[10px] font-bold uppercase text-text3 mb-2">Catatan Sesi:</div>
              <div className="space-y-2">
                {items.filter(it => !it.skipped).map((it, i) => {
                  const { mainNote, reminder } = extractReminder(it.note);
                  const sessionData = getData().sessions.find(s => s.id === it.sessionId);
                  const lastPage = sessionData?.lastPageReached;
                  const hasReminder = reminder.trim().length > 0;
                  const hasNote = mainNote.trim().length > 0;
                  const notePreview = [
                    lastPage ? `📄 s/d hal. ${lastPage}` : '',
                    hasNote ? `"${mainNote.length > 45 ? mainNote.slice(0, 45) + '…' : mainNote}"` : ''
                  ].filter(Boolean).join(' · ');
                  return (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <span className="flex-shrink-0 font-bold text-text2 w-[56px] truncate">{it.className}</span>
                      <span className="text-text3 flex-shrink-0">—</span>
                      <span className="text-foreground/70 flex-1 min-w-0 leading-snug">
                        {notePreview || <span className="italic text-text3">(tidak ada catatan)</span>}
                      </span>
                      {hasReminder && (
                        <span className="flex-shrink-0 text-[9px] bg-amber/15 text-amber border border-amber/25 rounded-full px-1.5 py-0.5 font-bold">📌</span>
                      )}
                    </div>
                  );
                })}
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

  return (
    <div>
      {/* ── Desktop: 2-column layout (hero + timeline side by side) ── */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6 lg:items-start">
        {/* LEFT COLUMN: Status bar + Hero card */}
        <div>
      <div className={`mb-3 rounded-2xl border overflow-hidden transition-all ${hasUrgentBriefing ? 'border-amber/30 bg-amber/5' : 'border-border2/60 bg-surface/50'}`}>
        <button
          onClick={() => setStatusBarOpen(o => !o)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left"
        >
          {/* Counts */}
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            {items.length > 0 && (
              <span className="text-[11px] font-bold text-text2">
                📚 {doneCount}/{items.length} KBM
              </span>
            )}
            {todayExamItems.length > 0 && (
              <span className="text-[11px] font-bold text-amber">
                📝 {todayExamItems.length} Ujian
              </span>
            )}
            {todayProctorSessions.length > 0 && (
              <span className="text-[11px] font-bold text-primary">
                👁 {todayProctorSessions.length} Ngawas
              </span>
            )}
            {showBackupBtn && (
              <span className="text-[10px] font-bold text-amber bg-amber/10 border border-amber/25 px-1.5 py-0.5 rounded-full">⚠️ Backup</span>
            )}
          </div>
          {hasUrgentBriefing && (
            <span className="text-[9px] font-black bg-amber/20 text-amber border border-amber/30 px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">!</span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-text3 flex-shrink-0 transition-transform duration-200 ${statusBarOpen ? 'rotate-180' : ''}`} />
        </button>

        {statusBarOpen && (
          <div className="px-3.5 pb-3 space-y-1.5 border-t border-border2/40">
            {briefingItems.filter(b => b.type !== 'semua-beres').map((item, i) => (
              <div key={i} className={`flex items-start gap-2 px-2.5 py-2 rounded-xl border text-[11px] ${
                item.urgent ? 'bg-amber/10 border-amber/20 text-foreground' : 'bg-surface2/50 border-border/40 text-text2'
              }`}>
                <span className="flex-shrink-0">{item.emoji}</span>
                <div className="min-w-0">
                  <span className={`font-bold ${item.urgent ? 'text-amber' : 'text-text3'}`}>{item.label}: </span>
                  <span className="leading-snug">{item.text}</span>
                </div>
              </div>
            ))}
            {briefingItems.every(b => b.type === 'semua-beres') && (
              <div className="text-[11px] text-text3 px-2.5 py-2">✅ Tidak ada ujian mendekat atau koreksi pending.</div>
            )}
            {showBackupBtn && (
              <div className="flex items-center justify-between bg-amber/10 border border-amber/25 rounded-xl px-2.5 py-2">
                <span className="text-[11px] font-medium text-foreground/80">Sudah 7+ hari belum backup.</span>
                <div className="flex gap-1.5">
                  <button onClick={() => { dismissBackupReminder(); onRefresh(); }} className="px-2 py-1 text-[10px] font-semibold text-text2 bg-surface rounded-lg">Nanti</button>
                  <button onClick={() => { window.document.querySelector('.tab-data-btn')?.dispatchEvent(new MouseEvent('click')); dismissBackupReminder(); onRefresh(); }} className="px-2 py-1 text-[10px] font-bold text-amber-950 bg-amber rounded-lg">Backup</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
              <button onClick={() => { handleHeroDone(endedBanner); }} className="text-[11px] font-bold bg-primary text-primary-foreground px-4 py-1.5 rounded-xl transition-all flex items-center justify-center min-w-[80px]">
                ✓ Selesai
              </button>
              <button onClick={() => setEndedBanner(null)} className="text-[11px] text-text3 px-3 py-1.5 hover:bg-surface2 rounded-xl transition-colors">✕ Tutup</button>
            </div>
          </div>
        );
      })()}

        </div>

        {/* RIGHT COLUMN: KBM Timeline */}
        <div>
      {/* Unified Hero Area: Active Session, Upcoming, or Exams */}
      {(() => {
        const hasExams = todayExamItems.length > 0;
        
        // State 1: Active Session (Highest Priority)
        if (active) {
          const teachingPosition = getTeachingPosition(active.classId, active.subjectId);
          const activeMaterial = teachingPosition.material;
          const activePageLabel = getMaterialPageLabel(activeMaterial);
          const totalDuration = active.duration || 45;
          const elapsed = currentMin() - timeToMin(active.startTime);
          const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
          const isOvertime = currentMin() >= timeToMin(active.endTime);

          return (
            <div className={`glass-panel rounded-[34px] overflow-hidden relative mb-4 animate-slide-up group transition-all duration-500 ${isOvertime ? 'border-red/40 ring-1 ring-red/20' : 'border-primary-border/40'}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,hsl(var(--primary-glow)),transparent_42%),radial-gradient(circle_at_90%_22%,hsl(var(--teal-glow)),transparent_36%)] pointer-events-none" />
              <div className="absolute right-5 top-5 text-[80px] leading-none opacity-[0.045] font-display font-black pointer-events-none">{active.className.slice(0, 2).toUpperCase()}</div>
              
              {/* Time Up Notification Banner */}
              {isOvertime && (
                <div className="bg-red text-white py-2 px-4 text-center text-[11px] font-bold uppercase tracking-[2px] animate-pulse">
                  ⚡ Waktu Pelajaran Selesai
                </div>
              )}
              
              <div className="p-5 relative">
                {/* Status at Top */}
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className={`inline-flex items-center gap-2 border text-[10px] font-black tracking-wider uppercase px-3 py-2 rounded-full flex-shrink-0 ${isOvertime ? 'bg-red/10 border-red/30 text-red' : 'bg-primary-dim border-primary-border/30 text-primary'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOvertime ? 'bg-red animate-pulse' : 'bg-primary'}`} />
                    <span>{isOvertime ? 'Waktu Habis' : 'Sedang Berlangsung'}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-surface2 rounded-full mb-6 overflow-hidden border border-border/30">
                  <div 
                    className={`h-full transition-all duration-1000 ease-linear ${isOvertime ? 'bg-red' : 'bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.35)]'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="font-display text-[34px] font-bold tracking-tight leading-none mb-3 text-foreground break-words">{active.className}</div>
                <div className="text-[15px] font-semibold text-text2 mb-6 flex flex-wrap items-center gap-2.5 w-full">
                  <span className="opacity-90">{active.subjectName}</span>
                  <span className="opacity-20">•</span>
                  <span className="font-bold text-primary">
                    {teachingPosition.totalSessionsAll > 0 && !teachingPosition.isComplete
                      ? `Pertemuan ${teachingPosition.sessionIndex}/${teachingPosition.totalSessionsInMaterial} di bab ini`
                      : teachingPosition.isComplete
                        ? 'Semua materi selesai'
                      : 'Belum ada materi'}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-6">
                   <div className={`flex-1 p-4 rounded-[24px] border flex items-center gap-4 ${isOvertime ? 'bg-red/10 border-red/20' : 'bg-surface2/70 border-border/40'}`}>
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
                    <div className="bg-surface2/70 border border-border/40 rounded-[24px] p-3 px-4 min-w-[100px] text-center">
                      <div className="text-[9px] font-bold uppercase text-text3 mb-1">Jadwal Selesai</div>
                      <div className="text-sm font-bold opacity-90">{fmt(active.endTime)}</div>
                   </div>
                </div>

                <div className="bg-surface2/65 backdrop-blur-sm border border-border/40 rounded-[26px] p-4 flex items-start gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-xl flex-shrink-0">📖</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold tracking-wider uppercase text-text3 mb-0.5">Materi Hari Ini</div>
                    <div className="text-[15px] font-bold leading-tight text-foreground/90 break-words [overflow-wrap:anywhere]">{activeMaterial ? activeMaterial.name : 'Semua materi selesai 🎉'}</div>
                    {activePageLabel && <div className="text-[12px] font-semibold text-text2 mt-1 break-words">{activePageLabel}</div>}
                    {activeMaterial?.note && <div className="text-[12px] text-text3 mt-1 leading-snug break-words">Catatan: {activeMaterial.note}</div>}
                    {/* Info halaman dari sesi sebelumnya */}
                    {(() => {
                      const lastPage = getLastPageReached(active.classId, active.subjectId);
                      if (!lastPage) return null;
                      const { nextPage } = getNextStartPage(lastPage);
                      return (
                        <div className="mt-2 inline-flex items-center gap-1.5 bg-primary/10 border border-primary/25 rounded-full px-2.5 py-1">
                          <span className="text-[11px]">📄</span>
                          <span className="text-[12px] font-bold text-primary">Mulai hal. {nextPage}</span>
                          <span className="text-[10px] text-text3">· lanjut dari hal. {lastPage}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

                 <div className="px-6 pb-6 pt-1">
                 {/* Main action buttons */}
                 <div className="flex gap-2 relative">
                   <button
                      onClick={() => handleHeroDone(active.id)}
                      className={`flex-1 min-h-[58px] rounded-2xl text-[15px] font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 active:translate-y-0.5 active:shadow-none hover:brightness-105 ${
                        isOvertime 
                          ? 'bg-red text-white' 
                          : 'bg-primary text-primary-foreground'
                     }`}
                   >
                      <Check className="h-5 w-5" /> {isOvertime ? 'SELESAI' : 'SELESAI'}
                    </button>
                   {/* Skip — now opens confirmation sheet */}
                   <button
                     onClick={() => setSkipConfirm(active)}
                      className="app-icon-button w-[58px] h-[58px] flex-shrink-0 shadow-sm"
                      title="Lewati sesi ini"
                    >
                      <SkipForward className="h-5 w-5" />
                    </button>
                 </div>

                  {/* Compact secondary actions row */}
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    {/* Live note button — #4 */}
                    <button
                      onClick={() => { setLiveNoteDraft(''); setLiveNoteOpen(true); }}
                       className="min-h-[38px] rounded-xl bg-surface border border-border text-[12px] font-bold text-text2 flex items-center justify-center gap-1.5 hover:bg-surface2 transition-colors"
                    >
                      <FilePenLine className="h-4 w-4" /> Catat
                    </button>
                    <button
                      onClick={() => {
                        setSubjectDismissSubjectId(active.subjectId);
                        setSubjectDismissClassId('');
                        setSubjectDismissSheet(true);
                      }}
                       className="min-h-[38px] rounded-xl bg-surface border border-border text-[12px] font-bold text-text2 flex items-center justify-center gap-1.5 hover:bg-surface2 transition-colors"
                    >
                      <SkipForward className="h-4 w-4" /> Libur
                    </button>
                  </div>
               </div>
            </div>
          );
        }

        // State 2: No active session, show Upcoming (Wait)
        const upcoming = items.find(x => !x.done);
        if (upcoming) {
          const teachingPosition = getTeachingPosition(upcoming.classId, upcoming.subjectId);
          const upcomingMaterial = teachingPosition.material;
          const upcomingPageLabel = getMaterialPageLabel(upcomingMaterial);
          const diff = timeToMin(upcoming.startTime) - currentMin();
          return (
            <div className="bg-surface/50 backdrop-blur-xl border border-teal-border/40 rounded-3xl p-5 overflow-hidden relative mb-4 animate-slide-up shadow-xl group">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_0%,hsl(var(--teal-glow))_0%,transparent_70%)] pointer-events-none mix-blend-screen opacity-60" />
              <div className="absolute inset-x-0 top-0 h-[100px] bg-gradient-to-b from-teal/10 to-transparent pointer-events-none" />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="inline-flex items-center gap-[6px] bg-teal-dim border border-teal/40 text-[10px] text-teal font-extrabold tracking-[0.9px] uppercase px-[14px] py-[8px] rounded-full shadow-[0_0_15px_hsl(var(--teal-glow))]">
                    🕐 Berikutnya
                  </div>
                </div>

                <div className="font-display text-3xl font-black tracking-[-0.04em] leading-[0.95] bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent mb-2">{upcoming.className}</div>
                <div className="text-[16px] font-bold text-text2/80 mb-5 flex items-center gap-2">
                  <span>{upcoming.subjectName}</span>
                  <span className="opacity-30">•</span>
                  <span className="text-[14px] text-teal">
                    {teachingPosition.totalSessionsAll > 0 && !teachingPosition.isComplete
                      ? `Pertemuan ${teachingPosition.sessionIndex}/${teachingPosition.totalSessionsInMaterial}`
                      : teachingPosition.isComplete
                        ? 'Selesai'
                        : 'Belum ada materi'}
                  </span>
                </div>
                {upcomingMaterial && (
                  <div className="bg-surface/50 border border-teal/20 rounded-2xl px-4 py-3 mb-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-teal/80 mb-1">Materi Berikutnya</div>
                    <div className="text-[14px] font-bold text-foreground leading-snug">{upcomingMaterial.name}</div>
                    {upcomingPageLabel && <div className="text-[12px] font-semibold text-text2 mt-1">{upcomingPageLabel}</div>}
                    {upcomingMaterial.note && <div className="text-[12px] text-text3 mt-1 leading-snug">Catatan: {upcomingMaterial.note}</div>}
                  </div>
                )}
                
                <div className="bg-teal-dim/60 backdrop-blur-md border border-teal/20 rounded-3xl p-5 flex items-center gap-5 shadow-inner">
                  <div className="w-12 h-12 rounded-2xl bg-teal/10 border border-teal/30 flex items-center justify-center text-[28px]">⏱</div>
                  <div className="flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-teal/70 mb-1">Mulai Pukul {fmt(upcoming.startTime)}</div>
                    <div className="flex items-baseline gap-2">
                       <div className="text-3xl font-black text-teal tabular-nums leading-none tracking-tighter">{fmtCountdown(diff)}</div>
                    </div>
                  </div>
                </div>

                {upcoming.nextMat && (
                  <div className="mt-5 text-[13px] font-semibold text-text3 flex items-start gap-2.5 px-2 min-w-0">
                    <span className="opacity-50 flex-shrink-0">Persiapan:</span> 
                    <strong className="min-w-0 text-foreground/70 bg-surface3/40 px-2 py-0.5 rounded-md border border-border/20 break-words [overflow-wrap:anywhere] line-clamp-2">{upcoming.nextMat.name}</strong>
                  </div>
                )}
                
              </div>
            </div>
          );
        }

        return null;
      })()}


      {/* Next Card */}
      {active && next && next.id !== active.id && (
        <div className="bg-surface border border-border rounded-lg p-[13px_15px] flex items-center gap-3 mb-[10px] relative overflow-hidden animate-slide-up-delay-1">
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-teal rounded-r" />
          <div className="w-[38px] h-[38px] rounded-[10px] bg-teal-dim border border-teal grid place-items-center text-base flex-shrink-0">📚</div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-bold tracking-[0.8px] uppercase text-teal mb-[2px]">Setelah ini</div>
            <div className="text-sm font-semibold truncate">{next.className} — {next.subjectName} <span className="opacity-50 font-normal ml-1">(Sesi ke-{Math.min(next.materialsDone + 1, next.totalMats)}/{next.totalMats})</span></div>
            {next.nextMat && <div className="text-[11px] text-text2 mt-[1px] leading-snug break-words [overflow-wrap:anywhere] line-clamp-2">📖 {next.nextMat.name}</div>}
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

      {/* Static Quick Actions Panel Container (Pulang Awal, Libur Mapel, Izin/Cuti) */}
      <div className="bg-surface border border-border2/80 rounded-2xl p-2.5 mb-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setEarlyDismissSheet(true)}
            className="flex-1 min-w-[105px] text-[11px] font-bold text-blue-500 bg-blue-500/10 border border-blue-500/25 px-3 py-2 rounded-xl transition-all hover:bg-blue-500/20 active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
            title="Diliburkan setelah jam tertentu"
          >
            <Home className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Pulang Awal</span>
          </button>

          <button
            onClick={() => {
              const firstSubject = items.find(i => !i.done)?.subjectId || items[0]?.subjectId || '';
              setSubjectDismissSubjectId(firstSubject);
              setSubjectDismissClassId('');
              setSubjectDismissSheet(true);
            }}
            className="flex-1 min-w-[110px] text-[11px] font-bold text-teal bg-teal/10 border border-teal/25 px-3 py-2 rounded-xl transition-all hover:bg-teal/20 active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
            title="Diliburkan mapel tertentu saja"
          >
            <SkipForward className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Libur Mapel</span>
          </button>

          <button
            onClick={() => {
              const today = dateKey();
              setReschedulerDate(today);
              setReschedulerOpen(true);
            }}
            className="flex-1 min-w-[100px] text-[11px] font-bold text-amber-600 bg-amber-600/10 border border-amber-600/25 px-3 py-2 rounded-xl transition-all hover:bg-amber-600/20 active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
            title="Input izin mengajar atau cuti"
          >
            <HeartPulse className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Izin / Cuti</span>
          </button>
        </div>
      </div>

      {/* Timeline Header Title */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="app-section-title px-0 text-foreground font-black text-base">Jadwal Hari Ini</div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {active && (
            <span className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 px-3 py-1 rounded-full animate-pulse shadow-[0_0_10px_hsl(var(--primary)/0.2)]">
              ● {Math.max(0, timeToMin(active.endTime) - currentMin())} mnt tersisa
            </span>
          )}
          <div className="text-[11px] text-text3 font-bold px-2.5 py-1 bg-surface border border-border rounded-full whitespace-nowrap">
            {doneCount}/{items.length} Selesai
          </div>
        </div>
      </div>

      {items.map((item, i) => {
        const state = item.active ? 'active' : item.done ? 'done' : '';
        const todayStr = dateKey();
        const prevReminder = !item.done ? getPrevReminder(item.classId, item.subjectId, todayStr) : '';
        const teachingPosition = !item.done ? getTeachingPosition(item.classId, item.subjectId) : null;
        const itemMaterial = teachingPosition?.material;
        const itemPageLabel = getMaterialPageLabel(itemMaterial);

        const remainingSessionsInBab = teachingPosition && itemMaterial 
          ? Math.max(0, teachingPosition.totalSessionsInMaterial - teachingPosition.sessionIndex)
          : 0;

        let nextSessionPageInfo = '';
        if (!item.done && teachingPosition && itemMaterial) {
          const { sessionIndex, totalSessionsInMaterial } = teachingPosition;
          if (sessionIndex < totalSessionsInMaterial) {
            const nextSessNum = sessionIndex + 1;
            nextSessionPageInfo = `Pertemuan berikut: Sesi ${nextSessNum}/${totalSessionsInMaterial} ${itemPageLabel ? `(${itemPageLabel})` : 'bab ini'}`;
          } else {
            const mats = getMaterials(item.subjectId, item.classId);
            const currIdx = mats.findIndex(m => m.id === itemMaterial.id);
            const nextMat = currIdx !== -1 && currIdx + 1 < mats.length ? mats[currIdx + 1] : null;
            if (nextMat) {
              const nextMatPage = getMaterialPageLabel(nextMat);
              nextSessionPageInfo = `Pertemuan berikut: Bab "${nextMat.name}" ${nextMatPage ? `(${nextMatPage})` : ''}`;
            } else {
              nextSessionPageInfo = `Pertemuan berikut: Semua bab tuntas 🎉`;
            }
          }
        }

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
            <div className="flex-1 min-w-0 mb-4">
              <div className={`group bg-surface/40 backdrop-blur-md border rounded-3xl p-3 pr-[60px] flex flex-col justify-center transition-all duration-300 min-h-[72px] relative shadow-sm hover:shadow-md overflow-hidden ${
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
                  
                  <div className="text-[12px] text-text2 font-medium flex items-center flex-wrap gap-x-1.5 gap-y-0.5 min-w-0">
                    <span className="min-w-0 max-w-full truncate">{item.subjectName}</span>
                    <span className="opacity-30">•</span>
                    <span className="font-bold text-foreground flex-shrink-0">
                      {item.totalMats > 0 
                        ? `Sesi ${Math.min(item.materialsDone + (item.done ? 0 : 1), item.totalMats)}/${item.totalMats}`
                        : 'Belum ada materi'}
                    </span>
                    {!item.done && itemMaterial && (
                      <span className="basis-full min-w-0 text-text3/80 leading-snug break-words line-clamp-2">📖 {itemMaterial.name}</span>
                    )}
                  </div>
                  {!item.done && (
                    <div className="text-[11px] text-text3 mt-1 leading-snug space-y-0.5">
                      {(itemPageLabel || itemMaterial?.note) && (
                        <div className="line-clamp-2">
                          {[
                            itemPageLabel ? `📄 ${teachingPosition?.sessionIndex && teachingPosition.sessionIndex > 1 ? 'Lanjut' : 'Mulai'} ${itemPageLabel}` : '',
                            itemMaterial?.note ? `Catatan: ${itemMaterial.note}` : ''
                          ].filter(Boolean).join(' • ')}
                        </div>
                      )}
                      {teachingPosition && !teachingPosition.isComplete && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] pt-0.5">
                          <span className={remainingSessionsInBab === 0 ? 'text-green font-bold' : 'text-amber font-medium'}>
                            {remainingSessionsInBab === 0 ? '⭐ Pertemuan terakhir bab ini' : `⏳ Sisa ${remainingSessionsInBab} pertemuan bab ini`}
                          </span>
                          {nextSessionPageInfo && (
                            <span className="text-text3/80">· {nextSessionPageInfo}</span>
                          )}
                        </div>
                      )}
                      {/* Badge halaman terakhir dari sesi sebelumnya */}
                      {(() => {
                        const lastPage = getLastPageReached(item.classId, item.subjectId);
                        if (!lastPage) return null;
                        const { nextPage } = getNextStartPage(lastPage);
                        return (
                          <div className="inline-flex items-center gap-1 mt-0.5 bg-primary/8 border border-primary/20 rounded-full px-2 py-0.5 w-fit">
                            <span className="text-[10px]">📄</span>
                            <span className="text-[11px] font-bold text-primary">Mulai hal. {nextPage}</span>
                            <span className="text-[10px] text-text3">(lanjut dari hal. {lastPage})</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ── Preview catatan sesi yang sudah selesai ── */}
                  {item.done && !item.skipped && (() => {
                    const sessionData = getData().sessions.find(s => s.id === item.sessionId);
                    const { mainNote, reminder } = extractReminder(item.note);
                    const lastPage = sessionData?.lastPageReached;
                    const hasReminder = reminder.trim().length > 0;
                    const hasNote = mainNote.trim().length > 0;
                    if (!hasNote && !hasReminder && !lastPage) {
                      return (
                        <button
                          onClick={() => {
                            setExpandedNoteId(item.id);
                            setNoteDraft('');
                            setBelumKumpulDraft('');
                          }}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-text3 border border-dashed border-border2 rounded-full px-2.5 py-0.5 hover:border-green/40 hover:text-green transition-colors"
                        >
                          <span>+</span> Tambah catatan
                        </button>
                      );
                    }
                    return (
                      <div className="mt-1.5 space-y-1">
                        {(lastPage || hasNote) && (
                          <div className="flex items-start gap-1.5 text-[11px] text-text2 leading-snug flex-wrap">
                            {lastPage && (
                              <span className="font-bold text-primary flex-shrink-0">📄 s/d hal. {lastPage}</span>
                            )}
                            {lastPage && hasNote && <span className="text-border3 flex-shrink-0">·</span>}
                            {hasNote && (
                              <span className="text-text3 line-clamp-1">&ldquo;{mainNote.length > 55 ? mainNote.slice(0, 55) + '…' : mainNote}&rdquo;</span>
                            )}
                          </div>
                        )}
                        {hasReminder && (
                          <div className="inline-flex items-center gap-1 bg-amber/10 border border-amber/25 rounded-full px-2 py-0.5">
                            <span className="text-[10px]">📌</span>
                            <span className="text-[10px] font-semibold text-amber">Ada reminder pertemuan depan</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
                      className="w-11 h-11 rounded-2xl border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-white text-sm font-bold flex items-center justify-center transition-all shadow-sm hover:scale-105 active:scale-95"
                    >
                      <span>✓</span>
                    </button>
                  )}
                </div>
              </div>

            {/* Reminder pertemuan depan dari sesi lalu */}
            {prevReminder && (
              <div className="mt-1.5 bg-amber/10 border border-amber/25 rounded-xl px-3 py-2 flex items-start gap-2 animate-slide-up">
                <span className="text-base flex-shrink-0 mt-0.5">📌</span>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-amber mb-0.5">📋 Catatan dari Pertemuan Lalu</div>
                  <div className="text-[12px] text-foreground/80 font-medium leading-snug whitespace-pre-wrap">{prevReminder}</div>
                </div>
              </div>
            )}
              
              {/* Expandable Note Section */}
              {item.done && expandedNoteId === item.id && item.sessionId && (() => {
                // Pre-fill lastPageDraft dari data session yang sudah ada
                const sessionData = getData().sessions.find(s => s.id === item.sessionId);
                const existingLastPage = sessionData?.lastPageReached ?? '';
                return (
                <div className="mt-1 bg-surface2 border border-border2 rounded-xl p-3 animate-slide-up origin-top">
                  <div className="text-[10px] font-semibold text-text3 uppercase tracking-[0.5px] mb-2">Jurnal Sesi / Catatan</div>
                  <textarea
                    autoFocus
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    placeholder="Catatan umum (mis. Budi remedial, tugas hal 12)..."
                    className="w-full bg-surface border border-border2 rounded-md p-2 text-[13px] min-h-[50px] resize-none focus:border-green focus:outline-none placeholder:text-text3"
                  />
                  
                  {/* Input halaman terakhir */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-base flex-shrink-0">📄</span>
                    <span className="text-[11px] font-bold text-primary flex-shrink-0">Sampai halaman:</span>
                    <input
                      type="number"
                      min="1"
                      value={lastPageDraft || existingLastPage}
                      onChange={e => setLastPageDraft(e.target.value)}
                      placeholder="mis. 10"
                      className="w-24 bg-surface border border-primary/30 rounded-lg px-2.5 py-1 text-[13px] font-bold text-foreground focus:border-primary focus:outline-none placeholder:text-text3"
                    />
                    {(lastPageDraft || existingLastPage) && (
                      <span className="text-[11px] text-green font-semibold">
                        → minggu depan mulai hal. {getNextStartPage(lastPageDraft || existingLastPage).nextPage}
                      </span>
                    )}
                  </div>

                  {/* Reminder Pertemuan Depan */}
                  <div className="mt-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm">📌</span>
                      <span className="text-[10px] font-bold text-amber uppercase tracking-wider">Reminder Pertemuan Depan</span>
                    </div>
                    <p className="text-[10px] text-text3 mb-1.5 leading-snug">Otomatis muncul di awal kelas ini minggu depan — mis. "Fulan belum kumpul soal", "Bahas PR hal. 15".</p>
                    <textarea
                      value={belumKumpulDraft}
                      onChange={e => setBelumKumpulDraft(e.target.value)}
                      placeholder="mis. Fulan belum kumpul soal, lanjut hal. 46 minggu depan..."
                      className="w-full bg-surface border border-amber/30 rounded-md p-2 text-[13px] min-h-[55px] resize-none focus:border-amber focus:outline-none placeholder:text-text3"
                    />
                  </div>


                  <div className="flex justify-end gap-2 mt-2.5">
                    <button onClick={() => {
                       setNewTaskTitle('');
                       setNewTaskSheet({ classId: item.classId, subjectId: item.subjectId });
                    }} className="px-3 py-1.5 rounded bg-surface border border-border text-[11px] font-semibold text-amber flex items-center gap-1">
                      + Tugas Baru
                    </button>
                    <button onClick={() => handleSaveNote(item.sessionId!)} className="px-4 py-1.5 rounded bg-green text-surface shadow-sm text-[11px] font-bold">
                      Simpan
                    </button>
                  </div>
                </div>
                );
              })()}
            </div>
          </div>

        );
      })}
      {/* ── Ujian Hari Ini (unified timeline) ── */}
      {todayExamItems.map((exam, i) => {
        const isActive = (() => {
          const cur = currentMin();
          return cur >= timeToMin(exam.startTime) && cur < timeToMin(exam.endTime);
        })();
        return (
          <div key={`exam-${i}`} className="flex items-stretch gap-[10px] mb-1 animate-slide-up">
            <div className="flex flex-col items-center w-[48px] flex-shrink-0 py-[12px] gap-[6px]">
              <div className="flex flex-col items-center">
                <div className="text-[11px] font-semibold text-text2 tabular-nums whitespace-nowrap">{fmt(exam.startTime)}</div>
                <div className="text-[9px] font-medium text-amber tabular-nums mt-0.5">{fmt(exam.endTime)}</div>
              </div>
              <div className={`w-[8px] h-[8px] rounded-full flex-shrink-0 mt-[2px] relative ${isActive ? 'bg-amber shadow-[0_0_12px_hsl(40_80%_60%/0.5)]' : 'bg-amber/40'}`}>
                {isActive && <div className="absolute inset-0 rounded-full border border-amber animate-ping opacity-50" />}
              </div>
              {(items.length > 0 || i < todayExamItems.length - 1 || todayProctorSessions.length > 0) && (
                <div className="flex-1 w-[2px] bg-gradient-to-b from-amber/20 to-transparent min-h-[12px]" />
              )}
            </div>
            <div className="flex-1 min-w-0 mb-4">
              <div className={`bg-amber/5 border rounded-3xl p-3 flex flex-col justify-center transition-all min-h-[72px] relative shadow-sm ${isActive ? 'border-amber/50 ring-1 ring-amber/10' : 'border-amber/20'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber bg-amber/15 px-1.5 py-0.5 rounded-full">UJIAN</span>
                      {isActive && <span className="text-[9px] font-black text-amber animate-pulse">● Berlangsung</span>}
                    </div>
                    <div className="text-[14px] font-bold text-foreground leading-snug">{exam.subjectName}</div>
                    <div className="text-[11px] text-text2 mt-0.5">
                      Kelas {exam.className}
                      {exam.location && <span className="text-text3"> · 📍{exam.location}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Ngawas Hari Ini (unified timeline) ── */}
      {todayProctorSessions.map((proctor, i) => {
        const isActive = (() => {
          const cur = currentMin();
          return cur >= timeToMin(proctor.startTime) && cur < timeToMin(proctor.endTime);
        })();
        return (
          <div key={`proctor-${i}`} className="flex items-stretch gap-[10px] mb-1 animate-slide-up">
            <div className="flex flex-col items-center w-[48px] flex-shrink-0 py-[12px] gap-[6px]">
              <div className="flex flex-col items-center">
                <div className="text-[11px] font-semibold text-text2 tabular-nums whitespace-nowrap">{fmt(proctor.startTime)}</div>
                <div className="text-[9px] font-medium text-primary tabular-nums mt-0.5">{fmt(proctor.endTime)}</div>
              </div>
              <div className={`w-[8px] h-[8px] rounded-full flex-shrink-0 mt-[2px] relative ${isActive ? 'bg-primary shadow-[0_0_12px_hsl(var(--primary-glow))]' : 'bg-primary/40'}`}>
                {isActive && <div className="absolute inset-0 rounded-full border border-primary animate-ping opacity-50" />}
              </div>
              {i < todayProctorSessions.length - 1 && (
                <div className="flex-1 w-[2px] bg-gradient-to-b from-primary/20 to-transparent min-h-[12px]" />
              )}
            </div>
            <div className="flex-1 min-w-0 mb-4">
              <div className={`bg-primary/5 border rounded-3xl p-3 flex flex-col justify-center transition-all min-h-[72px] relative shadow-sm ${isActive ? 'border-primary/50 ring-1 ring-primary/10' : 'border-primary/20'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">NGAWAS</span>
                    {isActive && <span className="text-[9px] font-black text-primary animate-pulse">● Berlangsung</span>}
                  </div>
                  <div className="text-[14px] font-bold text-foreground leading-snug">{proctor.subjectName}</div>
                  <div className="text-[11px] text-text2 mt-0.5">
                    {fmt(proctor.startTime)}–{fmt(proctor.endTime)}
                    {proctor.location && <span className="text-text3"> · 📍{proctor.location}</span>}
                    {proctor.note && <span className="text-text3"> · {proctor.note}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Agenda Besok (collapsible) ── */}
      {(tomorrowExamItems.length > 0 || tomorrowProctorSessions.length > 0 || tomorrowKbmSchedules.length > 0) && (
        <div className="mt-2 mb-3">
          <button
            onClick={() => setAgendaBesokOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-surface/60 border border-border2 rounded-2xl text-xs font-semibold text-text2 hover:bg-surface2 transition-colors"
          >
            <span>
              📅 Agenda Besok
              <span className="ml-2 text-text3 font-normal">
                {[
                  tomorrowExamItems.length > 0 && `${tomorrowExamItems.length} ujian`,
                  tomorrowProctorSessions.length > 0 && `${tomorrowProctorSessions.length} ngawas`,
                  tomorrowKbmSchedules.length > 0 && `${tomorrowKbmSchedules.length} KBM`,
                ].filter(Boolean).join(' · ')}
              </span>
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-text3 transition-transform ${agendaBesokOpen ? 'rotate-180' : ''}`} />
          </button>
          {agendaBesokOpen && (
            <div className="mt-2 space-y-2 animate-slide-up">
              {tomorrowExamItems.map((exam, i) => (
                <div key={`tomorrow-exam-${i}`} className="bg-amber/5 border border-amber/20 rounded-2xl p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber bg-amber/15 px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0">UJIAN</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-snug">{exam.subjectName}</div>
                      <div className="text-[11px] text-text2 mt-0.5">
                        {fmt(exam.startTime)}–{fmt(exam.endTime)} · Kelas {exam.className}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {tomorrowProctorSessions.map((p, i) => (
                <div key={`tomorrow-proctor-${i}`} className="bg-primary/5 border border-primary/20 rounded-2xl p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0">NGAWAS</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-snug">{p.subjectName}</div>
                      <div className="text-[11px] text-text2 mt-0.5">
                        {fmt(p.startTime)}–{fmt(p.endTime)}{p.location ? ` · 📍${p.location}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {tomorrowKbmSchedules.map((sched, i) => (
                <div key={`tomorrow-kbm-${i}`} className="bg-teal/5 border border-teal/20 rounded-2xl p-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-teal bg-teal/10 px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0">KBM</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-snug">{sched.className} — {sched.subjectName}</div>
                      <div className="text-[11px] text-text2 mt-0.5">
                        ⏰ {fmt(sched.startTime)}–{fmt(sched.endTime)}
                        {sched.nextMat && <span className="text-text3 block mt-0.5">📖 Sesi ke-{Math.min(sched.materialsDone + 1, sched.totalMats)}: {sched.nextMat.name}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

        </div>
      </div>
      {/* End desktop grid */}

      {/* Smart Rescheduler Modal */}
      <SmartReschedulerModal
        open={reschedulerOpen}
        onOpenChange={setReschedulerOpen}
        dateStr={reschedulerDate}
        onSuccess={onRefresh}
      />

      {/* ─── Bottom Sheet: Pulang Awal ─────────────────────────────────── */}
      {earlyDismissSheet && (
        <div className="app-overlay z-[500]" onClick={() => setEarlyDismissSheet(false)}>
          <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="app-sheet-handle" />
            <div className="app-sheet-title mb-1 flex items-center gap-2"><Home className="h-5 w-5 text-primary" /> Pulang Awal</div>
            <p className="text-[12px] text-text2 mb-4">Jadwal setelah jam ini akan dicoret dan tidak dihitung sebagai sesi terlewat.</p>
            <label className="text-[11px] font-bold text-text3 uppercase tracking-wide block mb-2">Mulai libur dari jam:</label>
            <input
              type="time"
              value={earlyDismissTime}
              onChange={e => setEarlyDismissTime(e.target.value)}
              className="form-input-style mb-4"
              autoFocus
            />
            <button
              onClick={() => {
                const count = applyEarlyDismissal(dateKey(), earlyDismissTime);
                onRefresh();
                setEarlyDismissSheet(false);
                toast({ title: `🏠 ${count} kelas setelah ${earlyDismissTime} diliburkan` });
              }}
              className="btn-primary-style bg-primary text-primary-foreground font-bold"
            >
              Terapkan
            </button>
            <button onClick={() => setEarlyDismissSheet(false)} className="w-full py-3 text-text2 text-[13px] mt-2">Batal</button>
          </div>
        </div>
      )}

      {/* ─── Bottom Sheet: Liburkan Mapel ──────────────────────────────── */}
      {subjectDismissSheet && (() => {
        const data = getData();
        const availableSubjects = data.subjects.filter(sub => items.some(item => item.subjectId === sub.id && !item.done));
        const availableClasses = data.classes.filter(cls => items.some(item => item.classId === cls.id && item.subjectId === subjectDismissSubjectId && !item.done));
        return (
          <div className="app-overlay z-[500]" onClick={() => setSubjectDismissSheet(false)}>
            <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
              <div className="app-sheet-handle" />
              <div className="app-sheet-title mb-1 flex items-center gap-2"><SkipForward className="h-5 w-5 text-primary" /> Liburkan Mapel</div>
              <p className="text-[12px] text-text2 mb-4">Coret jadwal mapel tertentu hari ini tanpa menambah progres materi.</p>

              <label className="text-[11px] font-bold text-text3 uppercase tracking-wide block mb-2">Mapel:</label>
              <select value={subjectDismissSubjectId} onChange={e => { setSubjectDismissSubjectId(e.target.value); setSubjectDismissClassId(''); }} className="form-select-style mb-3">
                <option value="">Pilih mapel</option>
                {availableSubjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>

              <label className="text-[11px] font-bold text-text3 uppercase tracking-wide block mb-2">Kelas:</label>
              <select value={subjectDismissClassId} onChange={e => setSubjectDismissClassId(e.target.value)} className="form-select-style mb-3">
                <option value="">Semua kelas untuk mapel ini</option>
                {availableClasses.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>

              <label className="flex items-center gap-2 text-[12px] text-text2 font-semibold mb-2">
                <input type="checkbox" checked={subjectDismissUseTime} onChange={e => setSubjectDismissUseTime(e.target.checked)} className="accent-primary" />
                Hanya jadwal mulai setelah jam tertentu
              </label>
              {subjectDismissUseTime && (
                <input
                  type="time"
                  value={subjectDismissTime}
                  onChange={e => setSubjectDismissTime(e.target.value)}
                  className="form-input-style mb-4"
                />
              )}

              <button
                onClick={() => {
                  if (!subjectDismissSubjectId) {
                    toast({ title: 'Pilih mapel dulu' });
                    return;
                  }
                  const count = applySubjectDismissal(
                    dateKey(),
                    subjectDismissSubjectId,
                    subjectDismissUseTime ? subjectDismissTime : undefined,
                    subjectDismissClassId || undefined,
                  );
                  onRefresh();
                  setSubjectDismissSheet(false);
                  toast({ title: `📚 ${count} jadwal mapel diliburkan` });
                }}
                className="btn-primary-style bg-primary text-primary-foreground font-bold"
              >
                Terapkan
              </button>
              <button onClick={() => setSubjectDismissSheet(false)} className="w-full py-3 text-text2 text-[13px] mt-2">Batal</button>
            </div>
          </div>
        );
      })()}

      {/* ─── Bottom Sheet: Tugas Baru ──────────────────────────────────── */}
      {newTaskSheet && (
        <div className="app-overlay z-[500]" onClick={() => setNewTaskSheet(null)}>
          <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="app-sheet-handle" />
            <div className="app-sheet-title mb-1 flex items-center gap-2"><FilePenLine className="h-5 w-5 text-primary" /> Tugas Baru</div>
            <p className="text-[12px] text-text2 mb-4">Deadline otomatis 7 hari ke depan. Akan muncul di Inbox Tugas.</p>
            <label className="text-[11px] font-bold text-text3 uppercase tracking-wide block mb-2">Nama Tugas:</label>
            <input
              type="text"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newTaskTitle.trim()) {
                  const d = new Date(); d.setDate(d.getDate() + 7);
                  addTask(newTaskSheet.classId, newTaskSheet.subjectId, newTaskTitle.trim(), dateKey(d));
                  onRefresh();
                  setNewTaskSheet(null);
                  toast({ title: 'Tugas ditambahkan' });
                }
              }}
              placeholder="cth: Koreksi tugas matriks..."
              className="form-input-style mb-4"
              autoFocus
            />
            <button
              onClick={() => {
                if (!newTaskTitle.trim()) return;
                const d = new Date(); d.setDate(d.getDate() + 7);
                addTask(newTaskSheet.classId, newTaskSheet.subjectId, newTaskTitle.trim(), dateKey(d));
                onRefresh();
                setNewTaskSheet(null);
                toast({ title: 'Tugas ditambahkan' });
              }}
              className="btn-primary-style bg-amber text-black font-bold"
            >
              Tambah Tugas
            </button>
            <button onClick={() => setNewTaskSheet(null)} className="w-full py-3 text-text2 text-[13px] mt-2">Batal</button>
          </div>
        </div>
      )}

      {/* ─── Bottom Sheet: Skip Confirmation (#5) ────────────────────── */}
      {skipConfirm && (
        <div className="app-overlay z-[500]" onClick={() => setSkipConfirm(null)}>
          <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="app-sheet-handle" />
            <div className="app-sheet-title mb-1 flex items-center gap-2"><SkipForward className="h-5 w-5 text-amber" /> Lewati Sesi Ini?</div>
            <p className="text-[13px] text-text2 mb-2 leading-relaxed">
              Sesi <strong>{skipConfirm.className} — {skipConfirm.subjectName}</strong> akan ditandai dilewati.
            </p>
            <p className="text-[12px] text-amber/90 bg-amber/10 border border-amber/20 rounded-2xl px-3 py-2 mb-5">
              Materi tidak akan tercatat. Gunakan ini hanya jika kelas tidak jadi berlangsung.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setSkipConfirm(null)} className="flex-1 py-3 bg-surface border border-border2 rounded-xl text-sm font-medium">Batal</button>
              <button
                onClick={() => {
                  handleSkip(skipConfirm.id, skipConfirm.className, skipConfirm.subjectName, skipConfirm.classId, skipConfirm.subjectId);
                  setSkipConfirm(null);
                }}
                className="flex-1 py-3 bg-amber/15 border border-amber/30 text-amber rounded-xl text-sm font-bold"
              >
                Ya, Lewati
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bottom Sheet: Catatan Real-time (#4) ────────────────────── */}
      {liveNoteOpen && active && (
        <div className="app-overlay z-[500]" onClick={() => setLiveNoteOpen(false)}>
          <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="app-sheet-handle" />
            <div className="flex items-center gap-2 mb-1">
              <FilePenLine className="h-5 w-5 text-primary" />
              <div className="app-sheet-title text-[20px]">Catatan Sesi</div>
              <span className="ml-auto text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{active.className}</span>
            </div>
            <p className="text-[11px] text-text3 mb-3">Akan tersimpan ke jurnal sesi setelah kelas selesai.</p>
            <textarea
              autoFocus
              value={liveNoteDraft}
              onChange={e => setLiveNoteDraft(e.target.value)}
              placeholder="cth: Siswa ramai, lanjut dari hal 45, Ahmad belum hadir..."
              className="form-input-style min-h-[120px] resize-none mb-4 font-mono text-[13px]"
            />
            <button
              onClick={() => {
                if (active.sessionId) {
                  updateSessionNote(active.sessionId, liveNoteDraft);
                  toast({ title: '📝 Catatan disimpan' });
                } else {
                  // Store in a temp key, applied when markDone
                  localStorage.setItem(`pending_note_${active.id}`, liveNoteDraft);
                  toast({ title: '📝 Catatan akan disimpan saat selesai' });
                }
                setLiveNoteOpen(false);
              }}
              className="btn-primary-style bg-green text-black font-bold"
            >
              Simpan Catatan
            </button>
            <button onClick={() => setLiveNoteOpen(false)} className="w-full py-3 text-text2 text-[13px] mt-2">Tutup</button>
          </div>
        </div>
      )}

    </div>
  );
}
