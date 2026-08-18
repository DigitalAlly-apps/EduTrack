import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getTodaySchedules, getActiveSession, getNextSession,
  skipSession, applyEarlyDismissal, timeToMin, currentMin, fmt, fmtCountdown,
  todayNum, DAYS_ID, isTodayHolidayGlobal,
  getTasks, toggleTask, addTask, updateSessionNote, getData, generateDailyJournal, applySmartReschedule,
  dateKey, getTeachingPosition, applySubjectDismissal, getInsights, getTomorrowKbmSchedules, getMaterials,
  getLastPageReached, getNextStartPage, composeSessionNote, splitSessionNote,
  recordTeachingSession, getMissingTeachingSessions, skipSessionForDate, updateMaterialEstimate, markMaterialCompleted,
} from '@/lib/data';
import { TodayScheduleItem, MissingTeachingSession } from '@/lib/types';
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
import { clearSessionDraft, loadSessionDraft, saveSessionDraft } from '@/lib/sessionDraft';

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
  const missingSessions = getMissingTeachingSessions().slice(0, 3);
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
  // Tracker halaman terakhir: di-input setelah sesi selesai
  const [lastPageDraft, setLastPageDraft] = useState(''); // untuk expanded note section (timeline)
  const [lastPageHero, setLastPageHero] = useState('');   // untuk hero card quick input
  const [recordSheet, setRecordSheet] = useState<{ scheduleId: string; date: string; classId: string; subjectId: string; className: string; subjectName: string } | null>(null);
  const [recordMaterialId, setRecordMaterialId] = useState('');
  const [recordMaterialCompleted, setRecordMaterialCompleted] = useState(false);
  const [recordNote, setRecordNote] = useState('');
  const [estimateSheet, setEstimateSheet] = useState<Material | null>(null);
  const [estimateDraft, setEstimateDraft] = useState('1');
  const [finishBabConfirm, setFinishBabConfirm] = useState<{ schedule: TodayScheduleItem; material: any } | null>(null);

  const getPrevReminder = (classId: string, subjectId: string, todayStr: string): string => {
    try {
      const data = getData();
      const lastSess = data.sessions
        .filter(s => s.classId === classId && s.subjectId === subjectId && s.date < todayStr && s.materialId !== 'SKIPPED')
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!lastSess?.note) return '';
      return splitSessionNote(lastSess.note).reminder;
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

  const [statusBarOpen, setStatusBarOpen] = useState(false);
  const [agendaBesokOpen, setAgendaBesokOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [adminActionsOpen, setAdminActionsOpen] = useState(false);
  const [showKbmDuringExam, setShowKbmDuringExam] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  // Setelah semua sesi selesai, guru tetap bisa kembali untuk
  // melengkapi catatan pertemuan berikutnya tanpa membatalkan centang sesi.
  const [showCompletedSchedule, setShowCompletedSchedule] = useState(false);
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

  const openNoteEditor = (item: TodayScheduleItem) => {
    const { mainNote, reminder } = splitSessionNote(item.note);
    const session = getData().sessions.find(s => s.id === item.sessionId);
    const draft = item.sessionId ? loadSessionDraft(item.sessionId) : null;
    setExpandedNoteId(item.id);
    setNoteDraft(draft?.nextTopic ?? mainNote);
    setBelumKumpulDraft(draft?.supportingNote ?? reminder);
    setLastPageDraft(draft?.lastPage ?? session?.lastPageReached ?? '');
  };

  const closeNoteEditor = (discardDraft = true) => {
    const sessionId = items.find(item => item.id === expandedNoteId)?.sessionId;
    if (discardDraft && sessionId) clearSessionDraft(sessionId);
    setExpandedNoteId(null);
    setNoteDraft('');
    setBelumKumpulDraft('');
    setLastPageDraft('');
  };

  const openRecordSheet = useCallback((item: TodayScheduleItem | MissingTeachingSession) => {
    const source = 'schedule' in item ? { ...item.schedule, className: item.className, subjectName: item.subjectName } as TodayScheduleItem : item;
    const date = 'date' in item ? item.date : dateKey();
    const position = getTeachingPosition(source.classId, source.subjectId);
    setRecordSheet({ scheduleId: source.id, date, classId: source.classId, subjectId: source.subjectId, className: source.className, subjectName: source.subjectName });
    setRecordMaterialId(position.material?.id ?? '');
    setRecordMaterialCompleted(false);
    setRecordNote('');
  }, []);

  const saveRecordedSession = () => {
    if (!recordSheet) return;
    recordTeachingSession(recordSheet.scheduleId, recordSheet.date, recordMaterialId || null, recordMaterialCompleted, recordNote);
    setRecordSheet(null);
    onRefresh();
    toast({ title: '✓ Pertemuan tersimpan', description: recordSheet.date === dateKey() ? 'Progres materi diperbarui.' : 'Pertemuan lama berhasil dicatat.' });
  };

  const handleHeroDone = useCallback((id: string) => {
    const item = items.find(x => x.id === id);
    if (item) openRecordSheet(item);
  }, [items, openRecordSheet]);

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
    const item = items.find(x => x.id === id);
    if (item) openRecordSheet(item);
  }, [items, openRecordSheet]);

  const handleSaveNote = (sessionId: string) => {
    updateSessionNote(sessionId, composeSessionNote(noteDraft, belumKumpulDraft), lastPageDraft);
    clearSessionDraft(sessionId);
    closeNoteEditor();
    onRefresh();
    toast({ title: 'Catatan disimpan' });
  };

  const editingSessionId = items.find(item => item.id === expandedNoteId)?.sessionId;
  useEffect(() => {
    if (!editingSessionId) return;
    saveSessionDraft(editingSessionId, {
      nextTopic: noteDraft,
      supportingNote: belumKumpulDraft,
      lastPage: lastPageDraft,
    });
  }, [editingSessionId, noteDraft, belumKumpulDraft, lastPageDraft]);



  const handleTurnOffExamMode = () => {
    setExamDayMode(false);
    setExamModeBanner(false);
    setShowKbmDuringExam(false);
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

  if (getExamDayMode() && !showKbmDuringExam) {
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
              Dashboard sedang berfokus pada ujian. Jadwal KBM tetap bisa dibuka dan dicatat bila diperlukan.
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
              onClick={() => setShowKbmDuringExam(true)}
              className="w-full min-h-[48px] rounded-xl bg-surface border border-primary/30 text-[12px] font-bold text-primary flex items-center justify-center gap-2 hover:bg-primary/10 transition-all"
            >
              📅 Tampilkan Jadwal KBM
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
            Anda dapat kembali ke fokus ujian atau menonaktifkan mode ini kapan saja.
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
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('set-tab', { detail: 'setup' }))}
          className="mt-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-[12px] font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          + Atur jadwal mengajar
        </button>
      </div>
    );
  }

  if (items.every(x => x.done) && !showCompletedSchedule) {
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
              <div className="text-[10px] font-bold uppercase text-text3 mb-2">Catatan Pertemuan Berikutnya:</div>
              <div className="space-y-2">
                {items.filter(it => !it.skipped).map((it, i) => {
                  const { mainNote, reminder } = splitSessionNote(it.note);
                  const sessionData = getData().sessions.find(s => s.id === it.sessionId);
                  const lastPage = sessionData?.lastPageReached;
                  const hasReminder = reminder.trim().length > 0;
                  const hasNote = mainNote.trim().length > 0;
                  const isEditing = expandedNoteId === it.id;
                  const notePreview = [
                    lastPage ? `📄 s/d hal. ${lastPage}` : '',
                    hasNote ? `"${mainNote.length > 45 ? mainNote.slice(0, 45) + '…' : mainNote}"` : '',
                    hasReminder ? `📌 ${reminder.length > 45 ? reminder.slice(0, 45) + '…' : reminder}` : '',
                  ].filter(Boolean).join(' · ');
                  return (
                    <div key={i} className="rounded-xl border border-border/50 bg-surface/35 p-2.5">
                      <div className="flex items-start gap-2 text-[11px]">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-text2 truncate">{it.className}</span>
                            <span className="text-text3">·</span>
                            <span className="text-text3 truncate">{it.subjectName}</span>
                            {hasReminder && (
                              <span className="flex-shrink-0 text-[9px] bg-amber/15 text-amber border border-amber/25 rounded-full px-1.5 py-0.5 font-bold">📌</span>
                            )}
                          </div>
                          <div className="text-foreground/70 leading-snug mt-1">
                            {notePreview || <span className="italic text-text3">Belum ada catatan pertemuan berikutnya</span>}
                          </div>
                        </div>
                        {it.sessionId && (
                          <button
                            onClick={() => isEditing ? closeNoteEditor() : openNoteEditor(it)}
                            className="flex-shrink-0 rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                          >
                            {isEditing ? 'Tutup' : 'Edit'}
                          </button>
                        )}
                      </div>

                      {isEditing && it.sessionId && (
                        <div className="mt-3 border-t border-border/50 pt-3 space-y-3 animate-slide-up">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-primary">Bab / subbab pertemuan berikutnya</label>
                            <textarea
                              autoFocus
                              value={noteDraft}
                              onChange={e => setNoteDraft(e.target.value)}
                              placeholder="Mis. Lanjut subbab adab kepada guru..."
                              className="mt-1.5 w-full min-h-[54px] resize-none rounded-lg border border-border2 bg-surface p-2 text-[13px] focus:border-green focus:outline-none placeholder:text-text3"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-base">📄</span>
                            <label className="text-[11px] font-bold text-primary" htmlFor={`last-page-${it.id}`}>Sampai halaman</label>
                            <input
                              id={`last-page-${it.id}`}
                              type="number"
                              min="1"
                              value={lastPageDraft}
                              onChange={e => setLastPageDraft(e.target.value)}
                              placeholder="mis. 10"
                              className="w-24 rounded-lg border border-primary/30 bg-surface px-2.5 py-1 text-[13px] font-bold focus:border-primary focus:outline-none"
                            />
                            {lastPageDraft && (
                              <span className="text-[10px] font-semibold text-green">→ mulai {getNextStartPage(lastPageDraft).nextPage}</span>
                            )}
                          </div>

                          <div>
                            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber">
                              <span className="text-sm">📌</span> Catatan pendukung pertemuan berikutnya
                            </label>
                            <p className="mt-0.5 text-[10px] leading-snug text-text3">Mis. siswa belum mengumpulkan tugas atau perlu membahas PR.</p>
                            <textarea
                              value={belumKumpulDraft}
                              onChange={e => setBelumKumpulDraft(e.target.value)}
                              placeholder="Mis. Fulan belum kumpul soal, bahas PR hal. 15..."
                              className="mt-1.5 w-full min-h-[58px] resize-none rounded-lg border border-amber/30 bg-surface p-2 text-[13px] focus:border-amber focus:outline-none placeholder:text-text3"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button onClick={() => closeNoteEditor()} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-text2">Batal</button>
                            <button onClick={() => handleSaveNote(it.sessionId!)} className="rounded-lg bg-green px-3 py-1.5 text-[11px] font-bold text-surface shadow-sm">Simpan</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowCompletedSchedule(true)}
          className="w-full rounded-xl border border-green/30 bg-green/10 px-4 py-3 text-[12px] font-bold text-green transition-colors hover:bg-green/20"
        >
          📝 Kembali ke jadwal untuk lengkapi catatan pertemuan berikutnya
        </button>


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
  const lastTeachingEndTime = items.reduce(
    (latest, item) => !latest || timeToMin(item.endTime) > timeToMin(latest) ? item.endTime : latest,
    '',
  );

  return (
    <div>
      {examModeBanner && showKbmDuringExam && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber/30 bg-amber/10 px-3.5 py-3">
          <span className="mt-0.5 text-base">📋</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-amber">Mode fokus ujian aktif</div>
            <div className="text-[11px] leading-snug text-text2">Jadwal KBM tetap dapat dicatat dari halaman ini.</div>
          </div>
          <button
            onClick={() => setShowKbmDuringExam(false)}
            className="flex-shrink-0 rounded-lg border border-amber/30 bg-surface px-2.5 py-1.5 text-[10px] font-bold text-amber hover:bg-amber/10"
          >
            Fokus ujian
          </button>
        </div>
      )}
      {items.every(x => x.done) && showCompletedSchedule && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-green/25 bg-green/10 px-3.5 py-3">
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-green">Semua sesi sudah selesai</div>
            <div className="text-[11px] text-text2">Tambahkan atau ubah catatan pertemuan berikutnya di tiap sesi.</div>
          </div>
          <button
            onClick={() => setShowCompletedSchedule(false)}
            className="flex-shrink-0 rounded-lg border border-green/30 bg-surface px-2.5 py-1.5 text-[10px] font-bold text-green transition-colors hover:bg-green/10"
          >
            Ringkasan
          </button>
        </div>
      )}
      {/* Satu alur baca: ringkasan → fokus sekarang → jadwal lengkap. */}
      <div className="mx-auto w-full max-w-3xl">
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
                📚 {doneCount}/{items.length} KBM · selesai {fmt(lastTeachingEndTime)}
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

        <div className="flex flex-col">
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
                    {activeMaterial && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <button onClick={() => { setEstimateDraft(String(activeMaterial.sessions ?? 1)); setEstimateSheet(activeMaterial); }} className="text-[10px] font-bold text-primary border border-primary/20 rounded-lg px-2 py-1">Ubah estimasi</button>
                        <button onClick={() => setFinishBabConfirm({ schedule: active, material: activeMaterial })} className="text-[10px] font-bold text-amber bg-amber/10 border border-amber/25 rounded-lg px-2 py-1 flex items-center gap-1">⚡ Selesaikan bab ini</button>
                      </div>
                    )}
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

                  <div className="mt-2.5">
                    <button
                      onClick={() => {
                        setSubjectDismissSubjectId(active.subjectId);
                        setSubjectDismissClassId('');
                        setSubjectDismissSheet(true);
                      }}
                       className="w-full min-h-[38px] rounded-xl bg-surface border border-border text-[12px] font-bold text-text2 flex items-center justify-center gap-1.5 hover:bg-surface2 transition-colors"
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
            {next.nextMat && <div className="text-[11px] text-text2 mt-[1px] leading-snug break-words [overflow-wrap:anywhere] line-clamp-2">📖 {next.nextMat.name}{getMaterialPageLabel(next.nextMat) ? ` · ${getMaterialPageLabel(next.nextMat)}` : ''}</div>}
          </div>
          <div className="bg-teal-dim border border-teal rounded-[9px] p-[6px_10px] text-center flex-shrink-0">
            <span className="text-[13px] font-semibold text-teal tabular-nums block leading-tight">{fmt(next.startTime)}</span>
            <div className="text-[9px] text-text3">{fmtCountdown(timeToMin(next.startTime) - currentMin())}</div>
          </div>
        </div>
      )}

      <div className="order-20 mt-2 mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-text3">Info lainnya</div>

      {/* Informasi tambahan tetap tersedia setelah jadwal. */}
      {(() => {
        const attention = insights.filter(ins => ins.type === 'warn');
        const suggestions = insights.filter(ins => ins.type === 'tip');
        const renderInsights = (list: typeof insights) => list.map((ins, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 flex items-start gap-[10px] ${
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
        ));

        return (
          <div className="order-20 space-y-2 mb-4 animate-slide-up-delay-2">
            {attention.length > 0 && (
              <div className="rounded-xl border border-amber/20 bg-amber/5 overflow-hidden">
                <button
                  onClick={() => setAttentionOpen(open => !open)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                  aria-expanded={attentionOpen}
                >
                  <span className="text-[11px] font-bold text-amber">💡 Perlu diperhatikan ({attention.length})</span>
                  <ChevronDown className={`h-4 w-4 text-amber transition-transform ${attentionOpen ? 'rotate-180' : ''}`} />
                </button>
                {attentionOpen && <div className="space-y-2 border-t border-amber/15 p-2.5 animate-slide-up">{renderInsights(attention)}</div>}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                <button
                  onClick={() => setSuggestionsOpen(open => !open)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                  aria-expanded={suggestionsOpen}
                >
                  <span className="text-[11px] font-bold text-primary">📌 Disarankan hari ini ({suggestions.length})</span>
                  <ChevronDown className={`h-4 w-4 text-primary transition-transform ${suggestionsOpen ? 'rotate-180' : ''}`} />
                </button>
                {suggestionsOpen && <div className="space-y-2 border-t border-primary/15 p-2.5 animate-slide-up">{renderInsights(suggestions)}</div>}
              </div>
            )}
          </div>
        );
      })()}

      {/* Task Inbox */}
      {pendingTasks.length > 0 && (
        <div className="order-20 mb-4 animate-slide-up-delay-2">
          <button
            onClick={() => setTasksOpen(open => !open)}
            className="w-full rounded-xl border border-amber/20 bg-amber/5 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.7px] text-amber transition-colors hover:bg-amber/10 flex items-center justify-between"
            aria-expanded={tasksOpen}
          >
            <span>Tugas tertunda ({pendingTasks.length})</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${tasksOpen ? 'rotate-180' : ''}`} />
          </button>
          {tasksOpen && (
            <div className="mt-2 bg-surface border border-border2 rounded-xl overflow-hidden shadow-sm animate-slide-up">
              {pendingTasks.map((t, i) => {
                const cls = getData().classes.find(c => c.id === t.classId);
                const sub = getData().subjects.find(s => s.id === t.subjectId);
                return (
                  <div key={t.id} className={`p-3 flex items-start gap-3 ${i < pendingTasks.length - 1 ? 'border-b border-border2' : ''}`}>
                    <button onClick={() => { toggleTask(t.id); onRefresh(); toast({ title: 'Tugas selesai!' }); }} aria-label={`Tandai tugas ${t.title} selesai`} className="mt-[2px] w-5 h-5 rounded-md border-2 border-border grid place-items-center flex-shrink-0 text-transparent hover:border-amber transition-colors">
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
          )}
        </div>
      )}

      {/* Secondary day actions stay available without competing with the teaching flow. */}
      <div className="order-20 bg-surface border border-border2/80 rounded-2xl p-2.5 mb-4 shadow-sm">
        <button
          onClick={() => setAdminActionsOpen(open => !open)}
          className="w-full flex items-center justify-between px-1 py-1 text-[11px] font-semibold text-text2"
          aria-expanded={adminActionsOpen}
        >
          <span>Aksi hari ini</span>
          <ChevronDown className={`h-4 w-4 text-text3 transition-transform ${adminActionsOpen ? 'rotate-180' : ''}`} />
        </button>
        {adminActionsOpen && (
          <div className="mt-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none animate-slide-up">
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
        )}
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

      {missingSessions.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber/30 bg-amber/10 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[12px] font-black text-amber">⚠️ Ada {missingSessions.length} pertemuan belum dicatat</div>
            <span className="text-[10px] text-text3">60 hari terakhir</span>
          </div>
          <div className="space-y-2">
            {missingSessions.map(missing => (
              <div key={`${missing.schedule.id}-${missing.date}`} className="flex items-center gap-2 rounded-xl bg-surface/70 border border-amber/15 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-foreground truncate">{missing.className} · {missing.subjectName}</div>
                  <div className="text-[10px] text-text3">{new Date(`${missing.date}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                </div>
                <button onClick={() => openRecordSheet(missing)} className="rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground">Catat</button>
                <button onClick={() => { skipSessionForDate(missing.schedule.id, missing.date); onRefresh(); }} className="rounded-lg border border-border2 px-2.5 py-1.5 text-[10px] font-semibold text-text2">Lewati</button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                   <div className={`text-[9px] font-medium tabular-nums mt-0.5 ${item.active ? 'text-primary font-bold' : 'text-text3'}`}>{fmt(item.endTime)}</div>
                   {!item.active && !item.done && (
                     <div className="text-[9px] font-medium text-teal tabular-nums">{fmtCountdown(timeToMin(item.startTime) - currentMin())}</div>
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
                    const { mainNote, reminder } = splitSessionNote(item.note);
                    const lastPage = sessionData?.lastPageReached;
                    const hasReminder = reminder.trim().length > 0;
                    const hasNote = mainNote.trim().length > 0;
                    if (!hasNote && !hasReminder && !lastPage) {
                      return (
                        <button
                          onClick={() => openNoteEditor(item)}
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
                            <span className="text-[10px] font-semibold text-amber">Ada catatan pendukung pertemuan berikutnya</span>
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
                          if (expandedNoteId === item.id) closeNoteEditor();
                          else openNoteEditor(item);
                        }}
                        aria-label={`${expandedNoteId === item.id ? 'Tutup' : 'Edit'} catatan ${item.className} ${item.subjectName}`}
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
                      aria-label={`Tandai sesi ${item.className} ${item.subjectName} selesai`}
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
                return (
                <div className="mt-1 bg-surface2 border border-border2 rounded-xl p-3 animate-slide-up origin-top">
                  <div className="text-[10px] font-semibold text-primary uppercase tracking-[0.5px] mb-2">Bab / subbab pertemuan berikutnya</div>
                  <textarea
                    autoFocus
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    placeholder="Mis. Lanjut subbab adab kepada guru..."
                    className="w-full bg-surface border border-border2 rounded-md p-2 text-[13px] min-h-[50px] resize-none focus:border-green focus:outline-none placeholder:text-text3"
                  />
                  
                  {/* Input halaman terakhir */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-base flex-shrink-0">📄</span>
                    <span className="text-[11px] font-bold text-primary flex-shrink-0">Sampai halaman:</span>
                    <input
                      type="number"
                      min="1"
                      value={lastPageDraft}
                      onChange={e => setLastPageDraft(e.target.value)}
                      placeholder="mis. 10"
                      className="w-24 bg-surface border border-primary/30 rounded-lg px-2.5 py-1 text-[13px] font-bold text-foreground focus:border-primary focus:outline-none placeholder:text-text3"
                    />
                    {lastPageDraft && (
                      <span className="text-[11px] text-green font-semibold">
                        → minggu depan mulai hal. {getNextStartPage(lastPageDraft).nextPage}
                      </span>
                    )}
                  </div>

                  {/* Reminder Pertemuan Depan */}
                  <div className="mt-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm">📌</span>
                      <span className="text-[10px] font-bold text-amber uppercase tracking-wider">Catatan Pendukung Pertemuan Berikutnya</span>
                    </div>
                    <p className="text-[10px] text-text3 mb-1.5 leading-snug">Otomatis muncul saat kelas ini berlangsung lagi — mis. "Fulan belum kumpul soal", "Bahas PR hal. 15".</p>
                    <textarea
                      value={belumKumpulDraft}
                      onChange={e => setBelumKumpulDraft(e.target.value)}
                      placeholder="mis. Fulan belum kumpul soal, lanjut hal. 46 minggu depan..."
                      className="w-full bg-surface border border-amber/30 rounded-md p-2 text-[13px] min-h-[55px] resize-none focus:border-amber focus:outline-none placeholder:text-text3"
                    />
                  </div>


                  <div className="flex justify-end gap-2 mt-2.5">
                    <span className="mr-auto self-center text-[10px] text-text3">Draft tersimpan otomatis</span>
                    <button onClick={() => closeNoteEditor()} className="px-3 py-1.5 rounded bg-surface border border-border text-[11px] font-semibold text-text2">
                      Batal
                    </button>
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
          <div key={`exam-${i}`} className="order-20 flex items-stretch gap-[10px] mb-1 animate-slide-up">
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
          <div key={`proctor-${i}`} className="order-20 flex items-stretch gap-[10px] mb-1 animate-slide-up">
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
        <div className="order-20 mt-2 mb-3">
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

      {recordSheet && (
        <div className="app-overlay z-[520]" onClick={() => setRecordSheet(null)}>
          <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="app-sheet-handle" />
            <div className="app-sheet-title mb-1">Catat Posisi Materi</div>
            <p className="text-[12px] text-text2 mb-4">
              {recordSheet.className} · {recordSheet.subjectName} · {new Date(`${recordSheet.date}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <label className="text-[11px] font-bold text-text3 uppercase tracking-wide block mb-2">Materi yang diajarkan</label>
            <select value={recordMaterialId} onChange={e => setRecordMaterialId(e.target.value)} className="form-select-style mb-3">
              <option value="">Belum memilih materi</option>
              {getMaterials(recordSheet.subjectId, recordSheet.classId).map(material => (
                <option key={material.id} value={material.id}>{material.name} · {material.sessions ?? 1} pertemuan</option>
              ))}
            </select>
            <label className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-[12px] text-text2 mb-3">
              <input type="checkbox" checked={recordMaterialCompleted} onChange={e => setRecordMaterialCompleted(e.target.checked)} className="accent-primary mt-0.5" />
              <span><strong className="text-foreground">Materi selesai hari ini</strong><span className="block text-[11px] text-text3 mt-0.5">Sistem akan langsung lanjut ke materi berikutnya, walau estimasi awal belum habis.</span></span>
            </label>
            <textarea value={recordNote} onChange={e => setRecordNote(e.target.value)} className="form-input-style min-h-[68px] resize-none mb-4" placeholder="Catatan opsional..." />
            <button onClick={saveRecordedSession} className="btn-primary-style bg-primary text-primary-foreground font-bold">Simpan Pertemuan</button>
            <button onClick={() => setRecordSheet(null)} className="w-full py-3 text-text2 text-[13px] mt-1">Batal</button>
          </div>
        </div>
      )}

      {estimateSheet && (
        <div className="app-overlay z-[520]" onClick={() => setEstimateSheet(null)}>
          <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="app-sheet-handle" />
            <div className="app-sheet-title mb-1">Ubah Estimasi Pertemuan</div>
            <p className="text-[12px] text-text2 mb-4">{estimateSheet.name}</p>
            <label className="text-[11px] font-bold text-text3 uppercase tracking-wide block mb-2">Butuh berapa pertemuan?</label>
            <input type="number" min="1" value={estimateDraft} onChange={e => setEstimateDraft(e.target.value)} className="form-input-style mb-4" autoFocus />
            <button onClick={() => {
              const parsed = Number(estimateDraft);
              if (!Number.isInteger(parsed) || parsed < 1) {
                toast({ title: 'Jumlah pertemuan minimal 1', variant: 'destructive' });
                return;
              }
              updateMaterialEstimate(estimateSheet.id, parsed);
              setEstimateSheet(null);
              onRefresh();
              toast({ title: 'Estimasi diperbarui' });
            }} className="btn-primary-style bg-primary text-primary-foreground font-bold">Simpan Estimasi</button>
            <button onClick={() => setEstimateSheet(null)} className="w-full py-3 text-text2 text-[13px] mt-1">Batal</button>
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
      {finishBabConfirm && (
        <div className="app-overlay z-[520]" onClick={() => setFinishBabConfirm(null)}>
          <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="app-sheet-handle" />
            <div className="app-sheet-title mb-1 flex items-center gap-2">⚡ Selesaikan Bab Ini Lebih Cepat?</div>
            <p className="text-[13px] text-text2 mb-3 leading-relaxed">
              Bab <strong className="text-foreground">"{finishBabConfirm.material.name}"</strong> akan ditandai selesai. Pertemuan berikutnya akan langsung pindah ke bab selanjutnya.
            </p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setFinishBabConfirm(null)} className="flex-1 py-3 bg-surface border border-border2 rounded-xl text-sm font-medium">Batal</button>
              <button
                onClick={() => {
                  markMaterialCompleted(finishBabConfirm.schedule.classId, finishBabConfirm.schedule.subjectId, finishBabConfirm.material.id);
                  setFinishBabConfirm(null);
                  onRefresh();
                  toast({ title: `Bab "${finishBabConfirm.material.name}" ditandai selesai!` });
                }}
                className="flex-1 py-3 bg-amber/15 border border-amber/30 text-amber rounded-xl text-sm font-bold"
              >
                Ya, Selesaikan Bab
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
