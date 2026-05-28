import { useState, useEffect } from 'react';
import {
  getTodayExamItems, getTomorrowExamItems, getAllExamSubjects,
  upsertCorrection, getExamDayMode, toggleExamDayMode,
  getExamSchedules, addExamSchedule, deleteExamSchedule,
  getExamReminderSettings, updateExamReminderSetting,
  getTodayProctorSessions, getTomorrowProctorSessions, getProctorSessions, addProctorSession, deleteProctorSession,
  fmtDate, fmtDayLabel, dayLabelColor,
  STATUS_LABEL, STATUS_NEXT, STATUS_CLS,
  ExamSubjectItem, CorrectionStatus, ProctorSession, ExamReminderSettingKey,
  fmt, resetAllExamData,
} from '@/lib/examData';
import { currentMin, timeToMin, dateKey, getData } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, ChevronDown, AlertTriangle } from 'lucide-react';

interface ExamViewProps { refreshKey: number; onRefresh: () => void; }

type ExamTab = 'today' | 'manage';

export default function ExamView({ onRefresh }: ExamViewProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<ExamTab>(() => {
    const todayHasContent = getTodayExamItems().length > 0 || getTodayProctorSessions().length > 0;
    return todayHasContent ? 'today' : 'manage';
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [examFormOpen, setExamFormOpen] = useState(false);
  const [proctorFormOpen, setProctorFormOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPastExam, setShowPastExam] = useState(false);
  const [examMode, setExamMode] = useState(getExamDayMode());
  const [reminderSettings, setReminderSettings] = useState(getExamReminderSettings());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Form: jadwal ujian mapel sendiri
  const [eDate, setEDate] = useState(dateKey());
  const [eClassId, setEClassId] = useState('');
  const [eSubjectId, setESubjectId] = useState('');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');
  const [eLocation, setELocation] = useState('');
  const [eNote, setENote] = useState('');

  // Form: ngawas
  const [nDate, setNDate] = useState(dateKey());
  const [nStart, setNStart] = useState('');
  const [nEnd, setNEnd] = useState('');
  const [nSubject, setNSubject] = useState('');
  const [nLocation, setNLocation] = useState('');
  const [nNote, setNNote] = useState('');

  useEffect(() => {
    const id = setInterval(() => onRefresh(), 60_000);
    return () => clearInterval(id);
  }, [onRefresh]);

  const todayItems = getTodayExamItems();
  const tomorrowItems = getTomorrowExamItems();
  const allSubjects = getAllExamSubjects();
  const data = getData();
  const examSchedules = getExamSchedules();
  const upcoming = allSubjects.filter(s => s.daysLeft >= 0);
  const past = allSubjects.filter(s => s.daysLeft < 0);
  const todayProctor = getTodayProctorSessions();
  const tomorrowProctor = getTomorrowProctorSessions();
  const allProctor = getProctorSessions().sort((a, b) => b.date.localeCompare(a.date));
  const pastProctor = allProctor.filter(s => s.date !== dateKey());

  const todayStr = dateKey();
  const todayExamSchedules = examSchedules.filter(s => s.date === todayStr);
  const futureExamSchedules = examSchedules.filter(s => s.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || timeToMin(a.startTime) - timeToMin(b.startTime));
  const pastExamSchedules = examSchedules.filter(s => s.date < todayStr)
    .sort((a, b) => b.date.localeCompare(a.date) || timeToMin(a.startTime) - timeToMin(b.startTime));

  const handleCycle = (subjectId: string, classId: string, examDate: string, cur: CorrectionStatus | null) => {
    upsertCorrection(subjectId, classId, examDate, cur ? STATUS_NEXT[cur] : 'sedang');
    onRefresh();
  };

  const handleToggleExamMode = () => {
    toggleExamDayMode();
    const next = getExamDayMode();
    setExamMode(next);
    onRefresh();
    toast({ title: next ? '📋 Mode Ujian Aktif' : '📚 Mode KBM Normal' });
  };

  const handleToggleReminder = (key: ExamReminderSettingKey) => {
    setReminderSettings(updateExamReminderSetting(key, !reminderSettings[key]));
    onRefresh();
  };

  const handleAddExam = () => {
    if (!eClassId || !eSubjectId || !eDate || !eStart || !eEnd) {
      toast({ title: 'Lengkapi kelas, mapel, tanggal, dan jam ujian' }); return;
    }
    if (timeToMin(eEnd) <= timeToMin(eStart)) {
      toast({ title: 'Jam selesai harus setelah jam mulai' }); return;
    }
    addExamSchedule({
      classId: eClassId, subjectId: eSubjectId, date: eDate,
      startTime: eStart, endTime: eEnd,
      location: eLocation.trim() || undefined,
      note: eNote.trim() || undefined,
    });
    setEStart(''); setEEnd(''); setELocation(''); setENote('');
    onRefresh();
    toast({ title: '✓ Jadwal ujian ditambahkan' });
  };

  const handleDeleteExam = (id: string) => {
    deleteExamSchedule(id);
    onRefresh();
    toast({ title: 'Jadwal ujian dihapus' });
  };

  const handleAddProctor = () => {
    if (!nStart || !nEnd || !nSubject.trim()) {
      toast({ title: 'Lengkapi jam mulai, selesai, dan nama mapel' }); return;
    }
    if (timeToMin(nEnd) <= timeToMin(nStart)) {
      toast({ title: 'Jam selesai harus setelah jam mulai' }); return;
    }
    addProctorSession({
      date: nDate, startTime: nStart, endTime: nEnd,
      subjectName: nSubject.trim(),
      location: nLocation.trim() || undefined,
      note: nNote.trim() || undefined,
    });
    setNStart(''); setNEnd(''); setNSubject(''); setNLocation(''); setNNote('');
    onRefresh();
    toast({ title: '✓ Sesi ngawas ditambahkan' });
  };

  const handleDeleteProctor = (id: string) => {
    deleteProctorSession(id);
    onRefresh();
    toast({ title: 'Sesi ngawas dihapus' });
  };

  const handleResetExamData = () => {
    resetAllExamData();
    setShowResetConfirm(false);
    setExamMode(false);
    setReminderSettings(getExamReminderSettings());
    onRefresh();
    toast({ title: '🗑️ Semua data ujian berhasil direset' });
  };

  // ─── Card components ─────────────────────────────────────────────────────
  const ProctorCard = ({ s, showDelete = true }: { s: ProctorSession; showDelete?: boolean }) => {
    const today = dateKey();
    const curMin = currentMin();
    const startMin = timeToMin(s.startTime);
    const endMin = timeToMin(s.endTime);
    const isToday = s.date === today;
    const isActive = isToday && curMin >= startMin && curMin < endMin;
    const isDone = isToday && curMin >= endMin;

    return (
      <div className={`border rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
        isActive ? 'bg-amber/10 border-amber/30' : isDone ? 'bg-green-dim/20 border-green-dim' : 'bg-surface2/40 border-border2/60'
      }`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            {isActive && <span className="text-[9px] font-black bg-amber/20 text-amber border border-amber/30 px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">Sedang Berlangsung</span>}
            {isDone && <span className="text-[9px] font-black bg-green/10 text-green border border-green/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Selesai</span>}
          </div>
          <div className="text-sm font-bold">{s.subjectName}</div>
          <div className="text-xs text-text2">
            {!isToday && <span className="mr-1">{fmtDate(s.date)} ·</span>}
            {fmt(s.startTime)} – {fmt(s.endTime)}
            {s.location && ` · ${s.location}`}
          </div>
          {s.note && <div className="text-[11px] text-text3 mt-0.5 italic">{s.note}</div>}
        </div>
        {showDelete && (
          <button
            onClick={() => handleDeleteProctor(s.id)}
            className="w-8 h-8 rounded-xl bg-red/10 border border-red/20 text-red grid place-items-center flex-shrink-0 hover:bg-red/20 transition-all"
            aria-label="Hapus sesi ngawas"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  const ExamScheduleCard = ({ s }: { s: ReturnType<typeof getExamSchedules>[number] }) => {
    const cls = data.classes.find(c => c.id === s.classId);
    const sub = data.subjects.find(x => x.id === s.subjectId);
    const isToday = s.date === dateKey();
    const curMin = currentMin();
    const startMin = timeToMin(s.startTime);
    const endMin = timeToMin(s.endTime);
    const isActive = isToday && curMin >= startMin && curMin < endMin;
    const isDone = isToday && curMin >= endMin;

    return (
      <div className={`border rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
        isActive ? 'bg-amber/10 border-amber/30' : isDone ? 'bg-green-dim/20 border-green-dim' : 'bg-surface2/40 border-border2/60'
      }`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            {isActive && <span className="text-[9px] font-black bg-amber/20 text-amber border border-amber/30 px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">Sedang Berlangsung</span>}
            {isDone && <span className="text-[9px] font-black bg-green/10 text-green border border-green/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Selesai</span>}
          </div>
          <div className="text-sm font-bold">{cls?.name || '?'} · {sub?.name || '?'}</div>
          <div className="text-xs text-text2">
            {fmtDate(s.date)} · {fmt(s.startTime)} – {fmt(s.endTime)}
            {s.location && ` · ${s.location}`}
          </div>
          {s.note && <div className="text-[11px] text-text3 mt-0.5 italic">{s.note}</div>}
        </div>
        <button
          onClick={() => handleDeleteExam(s.id)}
          className="w-8 h-8 rounded-xl bg-red/10 border border-red/20 text-red grid place-items-center flex-shrink-0 hover:bg-red/20 transition-all"
          aria-label="Hapus jadwal ujian"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const SubjectCard = ({ item }: { item: ExamSubjectItem }) => {
    const expandKey = `${item.subjectId}-${item.examDate}`;
    const isExp = expanded === expandKey;
    const done = item.classes.filter(c => c.correction?.status === 'selesai').length;
    return (
      <div className="bg-surface border border-border2 rounded-2xl overflow-hidden">
        <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => setExpanded(isExp ? null : expandKey)}>
          <div>
            <div className="text-sm font-semibold">{item.subjectName}</div>
            <div className={`text-xs mt-0.5 ${dayLabelColor(item.daysLeft)}`}>
              {fmtDate(item.examDate)} · {fmtDayLabel(item.daysLeft)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {item.daysLeft < 0 && item.classes.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                done === item.classes.length ? 'text-green bg-green-dim border-green' : 'text-amber bg-amber/10 border-amber/25'
              }`}>{done}/{item.classes.length} ✓</span>
            )}
            <span className="text-text3 text-xs">{isExp ? '▲' : '▼'}</span>
          </div>
        </button>
        {isExp && (
          <div className="border-t border-border px-4 pb-3 pt-2 space-y-2">
            <div className="text-xs text-text3 font-bold uppercase tracking-wide mb-1">Jadwal & Koreksi per Kelas</div>
            {item.classes.map(cls => {
              const st = cls.correction?.status ?? null;
              return (
                <div key={`${cls.classId}-${cls.startTime || ''}`} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{cls.className}</div>
                    {(cls.startTime || cls.location || cls.note) && (
                      <div className="text-[11px] text-text3 leading-snug mt-0.5">
                        {cls.startTime && cls.endTime && <span>{fmt(cls.startTime)}–{fmt(cls.endTime)}</span>}
                        {cls.location && <span>{cls.startTime && cls.endTime ? ' · ' : ''}{cls.location}</span>}
                        {cls.note && <span>{(cls.startTime && cls.endTime) || cls.location ? ' · ' : ''}{cls.note}</span>}
                      </div>
                    )}
                  </div>
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

  const ReminderToggle = ({ settingKey, title, desc }: { settingKey: ExamReminderSettingKey; title: string; desc: string }) => {
    const active = reminderSettings[settingKey];
    const disabled = settingKey !== 'enabled' && !reminderSettings.enabled;
    return (
      <button
        onClick={() => handleToggleReminder(settingKey)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all ${
          disabled ? 'bg-surface2/20 border-border/40 opacity-50' : active ? 'bg-primary/10 border-primary-border text-foreground' : 'bg-surface2/50 border-border2 text-text2 hover:border-border3'
        }`}
      >
        <div className="min-w-0">
          <div className="text-[12px] font-bold leading-tight">{title}</div>
          <div className="text-[10px] text-text3 mt-0.5 leading-snug">{desc}</div>
        </div>
        <span className={`w-10 h-6 rounded-full border flex-shrink-0 relative transition-all ${active && !disabled ? 'bg-primary border-primary' : 'bg-surface border-border2'}`}>
          <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all ${active && !disabled ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
      </button>
    );
  };

  // ─── Tab: Agenda 2 Hari ───────────────────────────────────────────────────
  const renderToday = () => {
    const correctionItems = todayItems.filter(item => item.isDone || item.correction?.status);
    const corrDone = correctionItems.filter(i => i.correction?.status === 'selesai').length;
    const corrPending = correctionItems.length - corrDone;

    const hasActiveProctor = todayProctor.some(s => {
      const cur = currentMin();
      return cur >= timeToMin(s.startTime) && cur < timeToMin(s.endTime);
    });
    const hasActiveExam = todayItems.some(i => i.isActive);
    const allExamDone = todayItems.length > 0 && todayItems.every(i => i.isDone);
    const hasAnythingToday = todayItems.length > 0 || todayProctor.length > 0;
    const hasAnythingTomorrow = tomorrowItems.length > 0 || tomorrowProctor.length > 0;
    const hasAnything = hasAnythingToday || hasAnythingTomorrow;

    return (
    <div className="space-y-3 animate-slide-up pb-20">

      {/* ── Hero Summary Bar ── */}
      {hasAnythingToday && (
        <div className="grid grid-cols-3 gap-2">
          {/* Ngawas */}
          <div className={`relative rounded-2xl border p-3 text-center overflow-hidden transition-all ${
            hasActiveProctor ? 'bg-amber/10 border-amber/40' :
            todayProctor.length > 0 ? 'bg-surface border-border2' :
            'bg-surface/40 border-border/30 opacity-40'
          }`}>
            {hasActiveProctor && <div className="absolute inset-0 bg-amber/5 animate-pulse" />}
            <div className="relative">
              <div className="text-base leading-none mb-1.5">👁</div>
              <div className={`text-2xl font-black leading-none tabular-nums ${hasActiveProctor ? 'text-amber' : 'text-foreground'}`}>
                {todayProctor.length}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-text3 mt-1.5">Ngawas</div>
              <div className={`text-[8px] font-black uppercase tracking-wide mt-0.5 h-3 ${hasActiveProctor ? 'text-amber animate-pulse' : 'text-transparent'}`}>
                ● Aktif
              </div>
            </div>
          </div>

          {/* Ujian */}
          <div className={`relative rounded-2xl border p-3 text-center overflow-hidden transition-all ${
            hasActiveExam ? 'bg-amber/10 border-amber/40' :
            allExamDone ? 'bg-green-dim/20 border-green-dim' :
            todayItems.length > 0 ? 'bg-surface border-border2' :
            'bg-surface/40 border-border/30 opacity-40'
          }`}>
            {hasActiveExam && <div className="absolute inset-0 bg-amber/5 animate-pulse" />}
            <div className="relative">
              <div className="text-base leading-none mb-1.5">📚</div>
              <div className={`text-2xl font-black leading-none tabular-nums ${hasActiveExam ? 'text-amber' : allExamDone ? 'text-green' : 'text-foreground'}`}>
                {todayItems.length}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-text3 mt-1.5">Ujian</div>
              <div className={`text-[8px] font-black uppercase tracking-wide mt-0.5 h-3 ${
                hasActiveExam ? 'text-amber animate-pulse' : allExamDone ? 'text-green' : 'text-transparent'
              }`}>
                {hasActiveExam ? '● Aktif' : allExamDone ? '✓ Beres' : '·'}
              </div>
            </div>
          </div>

          {/* Koreksi */}
          <div className={`relative rounded-2xl border p-3 text-center overflow-hidden transition-all ${
            corrPending > 0 ? 'bg-red/8 border-red/30' :
            corrDone > 0 ? 'bg-green-dim/20 border-green-dim' :
            'bg-surface/40 border-border/30 opacity-40'
          }`}>
            <div className="relative">
              <div className="text-base leading-none mb-1.5">✏️</div>
              <div className={`text-2xl font-black leading-none tabular-nums ${corrPending > 0 ? 'text-red' : corrDone > 0 ? 'text-green' : 'text-text3'}`}>
                {correctionItems.length > 0 ? `${corrDone}/${correctionItems.length}` : '–'}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-text3 mt-1.5">Koreksi</div>
              <div className={`text-[8px] font-black uppercase tracking-wide mt-0.5 h-3 ${
                corrPending > 0 ? 'text-red' : corrDone > 0 ? 'text-green' : 'text-transparent'
              }`}>
                {corrPending > 0 ? `${corrPending} pending` : corrDone > 0 ? '✓ Beres' : '·'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!hasAnything && (
        <div className="bg-surface border border-border2 rounded-3xl px-6 py-10 text-center">
          <div className="text-5xl mb-4">📭</div>
          <div className="text-sm font-bold mb-1">Tidak ada agenda ujian 2 hari ke depan</div>
          <div className="text-xs text-text3 mb-5">Tidak ada ujian mapelmu maupun jadwal ngawas hari ini dan besok.</div>
          <button
            onClick={() => setTab('manage')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all active:scale-[0.97] hover:brightness-105"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Jadwal
          </button>
        </div>
      )}

      {/* ── SECTION: HARI INI ── */}
      {hasAnythingToday && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground">📅 Hari Ini</span>
          <div className="flex-1 h-px bg-gradient-to-r from-border2 to-transparent" />
        </div>
      )}

      {/* ── 1. NGAWAS ── */}
      {todayProctor.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-1 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">👁 Ngawas</span>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
            <span className="text-[10px] text-text3 font-bold">{todayProctor.length} sesi</span>
          </div>
          <div className="space-y-2">
            {todayProctor.map(s => {
              const cur = currentMin();
              const startMin = timeToMin(s.startTime);
              const endMin = timeToMin(s.endTime);
              const isToday = s.date === dateKey();
              const isActive = isToday && cur >= startMin && cur < endMin;
              const isDone = isToday && cur >= endMin;
              return (
                <div key={s.id} className={`rounded-2xl border p-4 transition-all ${
                  isActive ? 'bg-amber/10 border-amber/35' :
                  isDone ? 'bg-green-dim/15 border-green-dim/60' :
                  'bg-surface border-border2'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        {isActive && <span className="text-[9px] font-black bg-amber text-white px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">Berlangsung</span>}
                        {isDone && <span className="text-[9px] font-black bg-green/15 text-green border border-green/25 px-2 py-0.5 rounded-full uppercase tracking-wide">Selesai</span>}
                      </div>
                      <div className="text-sm font-bold leading-snug">{s.subjectName}</div>
                      <div className="text-xs text-text2 mt-0.5">
                        {fmt(s.startTime)}–{fmt(s.endTime)}
                        {s.location && <span className="text-text3"> · {s.location}</span>}
                      </div>
                      {s.note && <div className="text-[11px] text-text3 mt-1 italic">{s.note}</div>}
                    </div>
                    <button
                      onClick={() => handleDeleteProctor(s.id)}
                      className="w-7 h-7 rounded-xl bg-red/8 border border-red/20 text-red grid place-items-center flex-shrink-0 hover:bg-red/15 transition-all"
                      aria-label="Hapus"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. UJIAN MAPELKU ── */}
      {todayItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-1 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">📚 Ujian Mapelku</span>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
            <span className="text-[10px] text-text3 font-bold">{todayItems.length} sesi</span>
          </div>

          {todayItems.length > 3 ? (
            /* Compact list kalau banyak */
            <div className="bg-surface border border-border2 rounded-2xl overflow-hidden divide-y divide-border2/50">
              {todayItems.map(item => {
                const state = item.isActive ? 'active' : item.isDone ? 'done' : '';
                return (
                  <div key={`${item.subjectId}-${item.classId}`} className={`flex items-center gap-3 px-4 py-3 transition-all ${
                    state === 'active' ? 'bg-amber/8' : state === 'done' ? 'bg-green-dim/10' : ''
                  }`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      state === 'active' ? 'bg-amber shadow-[0_0_6px_hsl(40_80%_60%/0.7)]' :
                      state === 'done' ? 'bg-green' : 'bg-border3'
                    }`} />
                    <div className="text-xs font-semibold tabular-nums text-text2 w-9 flex-shrink-0">{fmt(item.startTime)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold">{item.className}</span>
                      <span className="text-xs text-text3 ml-1.5">{item.subjectName}</span>
                    </div>
                    {state === 'active' && <span className="text-[9px] font-black text-amber animate-pulse">Aktif</span>}
                    {state === 'done' && <span className="text-[9px] font-black text-green">✓</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Timeline kalau ≤3 */
            <div className="space-y-1.5">
              {todayItems.map((item, i) => {
                const state = item.isActive ? 'active' : item.isDone ? 'done' : '';
                return (
                  <div key={`${item.subjectId}-${item.classId}`} className="flex items-stretch gap-3">
                    {/* Spine */}
                    <div className="flex flex-col items-center w-11 flex-shrink-0 pt-3.5 gap-1">
                      <div className="text-[10px] font-bold text-text3 tabular-nums leading-none">{fmt(item.startTime)}</div>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 transition-all relative ${
                        state === 'active' ? 'bg-amber shadow-[0_0_10px_hsl(40_80%_60%/0.5)]' :
                        state === 'done' ? 'bg-green' : 'bg-border3'
                      }`}>
                        {state === 'active' && <div className="absolute inset-0 rounded-full border-2 border-amber animate-ping opacity-40" />}
                      </div>
                      {i < todayItems.length - 1 && <div className="flex-1 w-px bg-gradient-to-b from-border2 to-transparent mt-1 min-h-4" />}
                    </div>
                    {/* Card */}
                    <div className="flex-1 pb-1.5">
                      <div className={`rounded-2xl border px-4 py-3 transition-all ${
                        state === 'active' ? 'bg-amber/10 border-amber/35' :
                        state === 'done' ? 'bg-green-dim/15 border-green-dim/60' :
                        'bg-surface border-border2'
                      }`}>
                        <div className="text-sm font-bold leading-snug">{item.className}</div>
                        <div className="text-xs text-text2 mt-0.5">
                          {item.subjectName} · {fmt(item.startTime)}–{fmt(item.endTime)}
                          {item.location && <span className="text-text3"> · {item.location}</span>}
                        </div>
                        {item.note && <div className="text-[11px] text-text3 mt-0.5 italic">{item.note}</div>}
                        {state === 'active' && <div className="text-[11px] text-amber font-bold mt-1.5 animate-pulse">⏱ Sedang berlangsung</div>}
                        {state === 'done' && <div className="text-[11px] text-green font-bold mt-1.5">✓ Selesai</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 3. KOREKSI ── */}
      {correctionItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-1 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">✏️ Koreksi</span>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
            <span className={`text-[10px] font-bold ${corrPending > 0 ? 'text-red' : 'text-green'}`}>
              {corrDone}/{correctionItems.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-surface2 rounded-full overflow-hidden mb-2.5 mx-1">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                corrPending === 0 ? 'bg-green' : corrDone > 0 ? 'bg-amber' : 'bg-red/50'
              }`}
              style={{ width: `${correctionItems.length > 0 ? Math.max(4, (corrDone / correctionItems.length) * 100) : 0}%` }}
            />
          </div>
          <div className="space-y-2">
            {correctionItems.map(item => {
              const corrSt = item.correction?.status ?? null;
              return (
                <div key={`corr-${item.subjectId}-${item.classId}`} className={`rounded-2xl border px-4 py-3 flex items-center gap-3 transition-all ${
                  corrSt === 'selesai' ? 'bg-green-dim/15 border-green-dim/60' :
                  corrSt ? 'bg-amber/8 border-amber/25' :
                  'bg-surface border-border2'
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-snug">{item.className}</div>
                    <div className="text-xs text-text2">{item.subjectName}</div>
                  </div>
                  <button
                    onClick={() => handleCycle(item.subjectId, item.classId, item.examDate, corrSt)}
                    className={`text-xs px-3.5 py-1.5 rounded-full border font-bold transition-all flex-shrink-0 active:scale-95 ${
                      corrSt ? STATUS_CLS[corrSt] : 'text-text3 bg-surface2 border-border2 hover:border-border3'
                    }`}
                  >
                    {corrSt ? STATUS_LABEL[corrSt] : 'Belum'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION: BESOK ── */}
      {hasAnythingTomorrow && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1 mt-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-text2">🌅 Besok</span>
            <div className="flex-1 h-px bg-gradient-to-r from-border2 to-transparent" />
            <span className="text-[10px] text-text3 font-bold">
              {tomorrowItems.length + tomorrowProctor.length} agenda
            </span>
          </div>

          {/* Ngawas besok */}
          {tomorrowProctor.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-text3">👁 Ngawas</span>
                <div className="flex-1 h-px bg-gradient-to-r from-border2/50 to-transparent" />
                <span className="text-[10px] text-text3 font-bold">{tomorrowProctor.length} sesi</span>
              </div>
              <div className="space-y-2">
                {tomorrowProctor.map(s => (
                  <div key={s.id} className="rounded-2xl border bg-surface/60 border-border2/70 p-3.5 opacity-80">
                    <div className="text-sm font-bold leading-snug">{s.subjectName}</div>
                    <div className="text-xs text-text2 mt-0.5">
                      {fmt(s.startTime)}–{fmt(s.endTime)}
                      {s.location && <span className="text-text3"> · {s.location}</span>}
                    </div>
                    {s.note && <div className="text-[11px] text-text3 mt-0.5 italic">{s.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ujian besok */}
          {tomorrowItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-text3">📚 Ujian Mapelku</span>
                <div className="flex-1 h-px bg-gradient-to-r from-border2/50 to-transparent" />
                <span className="text-[10px] text-text3 font-bold">{tomorrowItems.length} sesi</span>
              </div>
              {tomorrowItems.length > 3 ? (
                <div className="bg-surface/60 border border-border2/70 rounded-2xl overflow-hidden divide-y divide-border2/40 opacity-80">
                  {tomorrowItems.map(item => (
                    <div key={`tmr-${item.subjectId}-${item.classId}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-border3" />
                      <div className="text-xs font-semibold tabular-nums text-text2 w-9 flex-shrink-0">{fmt(item.startTime)}</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold">{item.className}</span>
                        <span className="text-xs text-text3 ml-1.5">{item.subjectName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5 opacity-80">
                  {tomorrowItems.map((item, i) => (
                    <div key={`tmr-${item.subjectId}-${item.classId}`} className="flex items-stretch gap-3">
                      <div className="flex flex-col items-center w-11 flex-shrink-0 pt-3.5 gap-1">
                        <div className="text-[10px] font-bold text-text3 tabular-nums leading-none">{fmt(item.startTime)}</div>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 bg-border3" />
                        {i < tomorrowItems.length - 1 && <div className="flex-1 w-px bg-gradient-to-b from-border2 to-transparent mt-1 min-h-4" />}
                      </div>
                      <div className="flex-1 pb-1.5">
                        <div className="rounded-2xl border bg-surface/60 border-border2/70 px-4 py-3">
                          <div className="text-sm font-bold leading-snug">{item.className}</div>
                          <div className="text-xs text-text2 mt-0.5">
                            {item.subjectName} · {fmt(item.startTime)}–{fmt(item.endTime)}
                            {item.location && <span className="text-text3"> · {item.location}</span>}
                          </div>
                          {item.note && <div className="text-[11px] text-text3 mt-0.5 italic">{item.note}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}



    </div>
    );
  };


  // ─── Tab: Kelola — Section Ujian ──────────────────────────────────────────
  const renderManageExam = () => {
    const uniqueExamDays = new Set(examSchedules.map(s => s.date)).size;
    const noPrereq = data.classes.length === 0 || data.subjects.length === 0;

    return (
      <div className="space-y-3">
        {/* Stats */}
        {examSchedules.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface border border-border2 rounded-2xl p-3 text-center">
              <div className="text-lg font-black leading-none">{examSchedules.length}</div>
              <div className="text-[10px] text-text3 font-bold uppercase tracking-wide mt-1">Sesi</div>
            </div>
            <div className="bg-surface border border-border2 rounded-2xl p-3 text-center">
              <div className="text-lg font-black leading-none">{uniqueExamDays}</div>
              <div className="text-[10px] text-text3 font-bold uppercase tracking-wide mt-1">Hari</div>
            </div>
            <div className="bg-surface border border-border2 rounded-2xl p-3 text-center">
              <div className="text-lg font-black leading-none">{todayExamSchedules.length}</div>
              <div className="text-[10px] text-text3 font-bold uppercase tracking-wide mt-1">Hari Ini</div>
            </div>
          </div>
        )}

        {/* Form (collapsible) */}
        <div className="bg-surface/60 border border-border2 rounded-3xl overflow-hidden">
          <button
            onClick={() => setExamFormOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface2/30 transition-colors"
          >
            <div className="flex items-center gap-2.5 text-left">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary-border/30 grid place-items-center text-primary flex-shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold leading-tight">Tambah Jadwal Ujian Mapelku</div>
                <div className="text-[11px] text-text3 mt-0.5">Per kelas dan jam ujian mapelmu</div>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-text3 transition-transform ${examFormOpen ? 'rotate-180' : ''}`} />
          </button>

          {examFormOpen && (
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border2/60">
              {noPrereq && (
                <div className="bg-amber/10 border border-amber/25 rounded-xl p-3 text-xs text-amber leading-snug">
                  Tambahkan kelas dan mapel dulu di tab Setup supaya jadwal bisa disimpan.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Kelas <span className="text-red">*</span></label>
                  <select value={eClassId} onChange={e => setEClassId(e.target.value)} className="form-select-style text-xs h-10 w-full">
                    <option value="">Pilih kelas</option>
                    {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Mapel <span className="text-red">*</span></label>
                  <select value={eSubjectId} onChange={e => setESubjectId(e.target.value)} className="form-select-style text-xs h-10 w-full">
                    <option value="">Pilih mapel</option>
                    {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Tanggal <span className="text-red">*</span></label>
                <input type="date" value={eDate} onChange={e => setEDate(e.target.value)} className="form-input-style text-sm h-10 w-full" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Jam Mulai <span className="text-red">*</span></label>
                  <input type="time" value={eStart} onChange={e => setEStart(e.target.value)} className="form-input-style text-sm h-10 w-full" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Jam Selesai <span className="text-red">*</span></label>
                  <input type="time" value={eEnd} onChange={e => setEEnd(e.target.value)} className="form-input-style text-sm h-10 w-full" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Ruangan <span className="text-text3 font-normal">(opsional)</span></label>
                <input value={eLocation} onChange={e => setELocation(e.target.value)} placeholder="cth: R. 12, Lab IPA..." className="form-input-style text-sm h-10 w-full" />
              </div>
              <div>
                <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Catatan <span className="text-text3 font-normal">(opsional)</span></label>
                <input value={eNote} onChange={e => setENote(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddExam()} placeholder="cth: PTS, PAS, kisi-kisi khusus..." className="form-input-style text-sm h-10 w-full" />
              </div>
              <button onClick={handleAddExam} disabled={noPrereq} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold transition-all active:scale-[0.98] hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed">
                ＋ Simpan Jadwal Ujian
              </button>
            </div>
          )}
        </div>

        {/* List jadwal */}
        {examSchedules.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-2xl p-6 text-center text-sm text-text3">
            Belum ada jadwal ujian. Tambah lewat form di atas.
          </div>
        ) : (
          <div className="space-y-3">
            {todayExamSchedules.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text3 px-1 mb-1.5">Hari Ini ({todayExamSchedules.length})</div>
                <div className="space-y-2">{todayExamSchedules.map(s => <ExamScheduleCard key={s.id} s={s} />)}</div>
              </div>
            )}
            {futureExamSchedules.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text3 px-1 mb-1.5">Akan Datang ({futureExamSchedules.length})</div>
                <div className="space-y-2">{futureExamSchedules.map(s => <ExamScheduleCard key={s.id} s={s} />)}</div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text3 px-1 mb-1.5">Per Mapel ({upcoming.length} aktif)</div>
                <div className="space-y-2">{upcoming.map(item => <SubjectCard key={`${item.subjectId}-${item.examDate}`} item={item} />)}</div>
              </div>
            )}
            {(pastExamSchedules.length > 0 || past.length > 0) && (
              <div>
                <button
                  onClick={() => setShowPastExam(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-surface border border-border2 rounded-2xl text-xs font-semibold text-text2 hover:bg-surface2 transition-colors"
                >
                  <span>📁 Riwayat Ujian ({pastExamSchedules.length || past.length})</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-text3 transition-transform ${showPastExam ? 'rotate-180' : ''}`} />
                </button>
                {showPastExam && (
                  <div className="space-y-2 mt-2">
                    {pastExamSchedules.length > 0
                      ? pastExamSchedules.slice(0, 20).map(s => <ExamScheduleCard key={s.id} s={s} />)
                      : past.map(item => <SubjectCard key={`${item.subjectId}-${item.examDate}`} item={item} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Tab: Kelola — Section Ngawas ─────────────────────────────────────────
  const renderManageProctor = () => {
    const todayStr = dateKey();
    const futureProctor = allProctor.filter(s => s.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date) || timeToMin(a.startTime) - timeToMin(b.startTime));
    const uniqueProctorDays = new Set(allProctor.map(s => s.date)).size;
    const totalDuration = allProctor.reduce((acc, s) => acc + Math.max(0, timeToMin(s.endTime) - timeToMin(s.startTime)), 0);
    const totalHours = Math.floor(totalDuration / 60);
    const totalMins = totalDuration % 60;

    return (
    <div className="space-y-4 animate-slide-up">

      {/* Stats */}
      {allProctor.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface border border-border2 rounded-2xl p-3 text-center">
            <div className="text-lg font-black leading-none">{allProctor.length}</div>
            <div className="text-[10px] text-text3 font-bold uppercase tracking-wide mt-1">Sesi</div>
          </div>
          <div className="bg-surface border border-border2 rounded-2xl p-3 text-center">
            <div className="text-lg font-black leading-none">{uniqueProctorDays}</div>
            <div className="text-[10px] text-text3 font-bold uppercase tracking-wide mt-1">Hari</div>
          </div>
          <div className="bg-surface border border-border2 rounded-2xl p-3 text-center">
            <div className="text-lg font-black leading-none tabular-nums">
              {totalHours > 0 ? `${totalHours}j` : `${totalMins}m`}
            </div>
            <div className="text-[10px] text-text3 font-bold uppercase tracking-wide mt-1">Total</div>
          </div>
        </div>
      )}

      {/* Form (collapsible) */}
      <div className="bg-surface/60 border border-border2 rounded-3xl overflow-hidden">
        <button
          onClick={() => setProctorFormOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface2/30 transition-colors"
        >
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary-border/30 grid place-items-center text-primary flex-shrink-0">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[13px] font-bold leading-tight">Tambah Sesi Ngawas</div>
              <div className="text-[11px] text-text3 mt-0.5">Mapel di luar yang kamu ajar</div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-text3 transition-transform ${proctorFormOpen ? 'rotate-180' : ''}`} />
        </button>

        {proctorFormOpen && (
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border2/60">
            <div>
              <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Tanggal</label>
              <input type="date" value={nDate} onChange={e => setNDate(e.target.value)} className="form-input-style text-sm h-10 w-full" />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Jam Mulai <span className="text-red">*</span></label>
                <input type="time" value={nStart} onChange={e => setNStart(e.target.value)} className="form-input-style text-sm h-10 w-full" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Jam Selesai <span className="text-red">*</span></label>
                <input type="time" value={nEnd} onChange={e => setNEnd(e.target.value)} className="form-input-style text-sm h-10 w-full" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Mapel yang Diawasi <span className="text-red">*</span></label>
              <input value={nSubject} onChange={e => setNSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddProctor()}
                placeholder="cth: Bahasa Indonesia, Matematika..." className="form-input-style text-sm h-10 w-full" />
            </div>

            <div>
              <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Ruangan <span className="text-text3 font-normal">(opsional)</span></label>
              <input value={nLocation} onChange={e => setNLocation(e.target.value)} placeholder="cth: R. 12, Lab IPA..." className="form-input-style text-sm h-10 w-full" />
            </div>

            <div>
              <label className="block text-[10px] text-text3 font-bold uppercase tracking-wider mb-1">Catatan <span className="text-text3 font-normal">(opsional)</span></label>
              <input value={nNote} onChange={e => setNNote(e.target.value)} placeholder="cth: Gantikan Bu Ani, dll." className="form-input-style text-sm h-10 w-full" />
            </div>

            <button onClick={handleAddProctor} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold transition-all active:scale-[0.98] hover:brightness-105">
              ＋ Simpan Sesi Ngawas
            </button>
          </div>
        )}
      </div>

      {/* Upcoming proctor */}
      {futureProctor.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-text3 px-1 mb-1.5">Akan Datang ({futureProctor.length})</div>
          <div className="space-y-2">{futureProctor.map(s => <ProctorCard key={s.id} s={s} />)}</div>
        </div>
      )}

      {allProctor.length === 0 && (
        <div className="bg-surface border border-border2 rounded-2xl p-6 text-center text-sm text-text3">
          Belum ada sesi ngawas. Tambah lewat form di atas.
        </div>
      )}

      {/* History */}
      {pastProctor.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-surface border border-border2 rounded-2xl text-xs font-semibold text-text2 hover:bg-surface2 transition-colors"
          >
            <span>📁 Riwayat Ngawas ({pastProctor.length})</span>
            <ChevronDown className={`h-3.5 w-3.5 text-text3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>
          {showHistory && (
            <div className="space-y-2 mt-2">
              {pastProctor.slice(0, 20).map(s => <ProctorCard key={s.id} s={s} />)}
            </div>
          )}
        </div>
      )}
    </div>
    );
  };

  // ─── Tab: Kelola — Section Mode & Reminder ────────────────────────────────
  const renderManageMode = () => (
    <div className="space-y-3">
      {/* Hero Toggle */}
      <div className={`relative rounded-3xl overflow-hidden border transition-all duration-500 ${
        examMode ? 'bg-amber/10 border-amber/30 shadow-[0_0_30px_hsl(40_80%_60%/0.08)]' : 'bg-surface/60 border-border2'
      }`}>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-text3 mb-1">Mode Ujian Hari Ini</div>
              <div className={`text-xl font-bold mb-1 ${examMode ? 'text-amber' : 'text-foreground'}`}>
                {examMode ? '🔕 KBM Dihentikan' : '📚 KBM Normal'}
              </div>
              <div className="text-[12px] text-text2 leading-snug">
                {examMode
                  ? 'Tracking KBM hari ini dinonaktifkan. Banner ujian muncul di tab Hari Ini.'
                  : 'Aktifkan saat hari ujian — tracking KBM dihentikan sementara untuk hari ini.'}
              </div>
            </div>
            <button
              onClick={handleToggleExamMode}
              aria-label="Toggle mode ujian"
              className={`relative flex-shrink-0 w-14 h-7 rounded-full border-2 transition-all duration-300 ${
                examMode ? 'bg-amber border-amber/60' : 'bg-surface2 border-border2'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-all duration-300 ${
                examMode ? 'left-[30px] bg-white' : 'left-0.5 bg-text3'
              }`} />
            </button>
          </div>
          {examMode && (
            <div className="mt-4 bg-amber/10 border border-amber/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-amber">⚡</span>
              <span className="text-xs text-amber font-medium">Mode ini otomatis reset besok pagi.</span>
            </div>
          )}
        </div>
      </div>

      {/* Reminders */}
      <div className="bg-surface/60 border border-border2 rounded-3xl p-4 space-y-2">
        <div className="mb-2">
          <div className="text-[11px] font-black uppercase tracking-widest text-primary">Reminder Ujian</div>
          <div className="text-[12px] text-text3 mt-1 leading-snug">Notifikasi lokal saat app pernah dibuka dan izin notifikasi aktif. Server push menyusul nanti.</div>
        </div>
        <ReminderToggle settingKey="enabled" title="Aktifkan Reminder" desc="Master switch untuk semua pengingat ujian dan ngawas." />
        <ReminderToggle settingKey="dayBefore" title="H-1 Sore" desc="Ingatkan ujian besok sekitar pukul 18.00." />
        <ReminderToggle settingKey="fiveHoursBefore" title="5 Jam Sebelum" desc="Pengingat awal untuk siap-siap sebelum sesi ujian." />
        <ReminderToggle settingKey="oneHourBefore" title="1 Jam Sebelum" desc="Pengingat dekat sebelum ujian dimulai." />
        <ReminderToggle settingKey="atStart" title="Saat Mulai" desc="Pengingat tepat saat jadwal ujian masuk waktu mulai." />
        <ReminderToggle settingKey="proctorThirtyMinutes" title="Ngawas 30 Menit" desc="Ingatkan jadwal ngawas 30 menit sebelumnya." />
      </div>
    </div>
  );

  // ─── Tab: Kelola (single scroll, section headers) ────────────────────────
  const renderManage = () => (
    <div className="space-y-6 animate-slide-up">
      {/* ── Section: Ngawas ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <span className="text-base">👁</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-primary">Ngawas</span>
          <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
        </div>
        {renderManageProctor()}
      </div>

      {/* ── Section: Ujian Mapel ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <span className="text-base">📚</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-primary">Ujian Mapel</span>
          <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
        </div>
        {renderManageExam()}
      </div>

      {/* ── Section: Mode & Reminder ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <span className="text-base">⚙️</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-primary">Mode &amp; Reminder</span>
          <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
        </div>
        {renderManageMode()}
      </div>

      {/* ── Section: Reset Data Ujian ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <span className="text-base">🗑️</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-red">Reset Data</span>
          <div className="flex-1 h-px bg-gradient-to-r from-red/20 to-transparent" />
        </div>

        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-red/20 bg-red/5 hover:bg-red/10 transition-all text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-red/10 border border-red/20 grid place-items-center flex-shrink-0">
              <Trash2 className="h-4 w-4 text-red" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-red">Reset Semua Data Ujian</div>
              <div className="text-[11px] text-text3 mt-0.5">Hapus jadwal ujian, ngawas, koreksi, dan mode ujian</div>
            </div>
          </button>
        ) : (
          <div className="rounded-2xl border-2 border-red/30 bg-red/5 p-4 space-y-3 animate-slide-up">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-red">Yakin reset semua data ujian?</div>
                <div className="text-xs text-text2 mt-1 leading-relaxed">
                  Ini akan menghapus:<br />
                  • Semua jadwal ujian mapel<br />
                  • Semua sesi ngawas<br />
                  • Semua status koreksi<br />
                  • Mode ujian & pengaturan reminder
                </div>
                <div className="text-[11px] text-red/80 font-semibold mt-2">⚠️ Aksi ini tidak bisa dibatalkan.</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border2 bg-surface text-sm font-bold text-text2 hover:bg-surface2 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleResetExamData}
                className="flex-1 py-2.5 rounded-xl bg-red text-white text-sm font-bold hover:brightness-110 transition-all active:scale-[0.97]"
              >
                Ya, Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Main shell ───────────────────────────────────────────────────────────
  const tabItems: { id: ExamTab; label: string; emoji: string }[] = [
    { id: 'today', label: 'Agenda 2 Hari', emoji: '📅' },
    { id: 'manage', label: 'Kelola', emoji: '⚙️' },
  ];

  return (
    <div className="space-y-3 animate-slide-up pb-8">
      {/* Status header */}
      <div className="bg-surface/70 border border-border2 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">Menu Ujian</div>
            <div className="text-[11px] text-text3 truncate">
              {examSchedules.length} jadwal · {todayItems.length} mapel hari ini · {tomorrowItems.length} besok · {todayProctor.length} ngawas
            </div>
          </div>
          <button
            onClick={() => { setTab('manage'); }}
            className={`px-2.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wide flex-shrink-0 ${
              examMode ? 'bg-amber/15 border-amber/30 text-amber' : 'bg-surface2 border-border2 text-text3'
            }`}
          >
            {examMode ? 'Mode Aktif' : 'KBM Normal'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-surface2/60 border border-border2 rounded-xl p-1">
          {tabItems.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[42px] rounded-lg px-1 text-[11px] font-black transition-all duration-200 active:scale-[0.98] ${
                tab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-text3 hover:text-foreground hover:bg-surface2'
              }`}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              <span className="block text-sm leading-none mb-0.5">{t.emoji}</span>
              <span className="block leading-none truncate">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'today' && renderToday()}
      {tab === 'manage' && renderManage()}
    </div>
  );
}
