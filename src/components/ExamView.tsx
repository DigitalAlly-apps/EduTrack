import { useState, useEffect } from 'react';
import {
  getTodayExamItems, getAllExamSubjects,
  upsertCorrection, getExamDayMode, toggleExamDayMode,
  getExamSchedules, addExamSchedule, deleteExamSchedule,
  getTodayProctorSessions, getProctorSessions, addProctorSession, deleteProctorSession,
  fmtDate, fmtDayLabel, dayLabelColor,
  STATUS_LABEL, STATUS_NEXT, STATUS_CLS,
  ExamSubjectItem, CorrectionStatus, ProctorSession,
  fmt,
} from '@/lib/examData';
import { currentMin, timeToMin, dateKey, getData } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

interface ExamViewProps { refreshKey: number; onRefresh: () => void; }

type ExamTab = 'input' | 'mode' | 'mapelku' | 'ngawas';
type MapelSubTab = 'hari-ini' | 'semua';

export default function ExamView({ refreshKey, onRefresh }: ExamViewProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<ExamTab>('mode');
  const [mapelTab, setMapelTab] = useState<MapelSubTab>('hari-ini');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [examMode, setExamMode] = useState(getExamDayMode());

  // Jadwal ujian mapel sendiri form
  const [eDate, setEDate] = useState(dateKey());
  const [eClassId, setEClassId] = useState('');
  const [eSubjectId, setESubjectId] = useState('');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');
  const [eLocation, setELocation] = useState('');
  const [eNote, setENote] = useState('');

  // Ngawas form
  const [nDate, setNDate] = useState(dateKey());
  const [nStart, setNStart] = useState('');
  const [nEnd, setNEnd] = useState('');
  const [nSubject, setNSubject] = useState('');
  const [nLocation, setNLocation] = useState('');
  const [nNote, setNNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayItems = getTodayExamItems();
  const allSubjects = getAllExamSubjects();
  const data = getData();
  const examSchedules = getExamSchedules();
  const upcoming = allSubjects.filter(s => s.daysLeft >= 0);
  const past = allSubjects.filter(s => s.daysLeft < 0);
  const todayProctor = getTodayProctorSessions();
  const allProctor = getProctorSessions().sort((a, b) => b.date.localeCompare(a.date));

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

  const handleAddExam = () => {
    if (!eClassId || !eSubjectId || !eDate || !eStart || !eEnd) {
      toast({ title: 'Lengkapi kelas, mapel, tanggal, dan jam ujian' }); return;
    }
    if (timeToMin(eEnd) <= timeToMin(eStart)) {
      toast({ title: 'Jam selesai harus setelah jam mulai' }); return;
    }
    addExamSchedule({
      classId: eClassId,
      subjectId: eSubjectId,
      date: eDate,
      startTime: eStart,
      endTime: eEnd,
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

  // ─── Tab navigation items ─────────────────────────────────────────────────
  const tabItems: { id: ExamTab; label: string; emoji: string }[] = [
    { id: 'input',   label: 'Input Ujian', emoji: '📝' },
    { id: 'mode',    label: 'Mode Ujian', emoji: '📋' },
    { id: 'mapelku', label: 'Mapelku',    emoji: '📚' },
    { id: 'ngawas',  label: 'Ngawas',     emoji: '👁' },
  ];

  // ─── ProctorCard ─────────────────────────────────────────────────────────
  const ProctorCard = ({ s, showDelete = true }: { s: ProctorSession; showDelete?: boolean }) => {
    const today = dateKey();
    const curMin = currentMin();
    const startMin = timeToMin(s.startTime);
    const endMin = timeToMin(s.endTime);
    const isToday = s.date === today;
    const isActive = isToday && curMin >= startMin && curMin < endMin;
    const isDone   = isToday && curMin >= endMin;

    return (
      <div className={`border rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
        isActive ? 'bg-amber/10 border-amber/30' : isDone ? 'bg-green-dim/20 border-green-dim' : 'bg-surface2/40 border-border2/60'
      }`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            {isActive && <span className="text-[9px] font-black bg-amber/20 text-amber border border-amber/30 px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">Sedang Berlangsung</span>}
            {isDone   && <span className="text-[9px] font-black bg-green/10 text-green border border-green/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Selesai</span>}
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

  // ─── SubjectCard ─────────────────────────────────────────────────────────
  const SubjectCard = ({ item }: { item: ExamSubjectItem }) => {
    const expandKey = `${item.subjectId}-${item.examDate}`;
    const isExp = expanded === expandKey;
    const done  = item.classes.filter(c => c.correction?.status === 'selesai').length;
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

  // ─── Tab: Input Ujian ──────────────────────────────────────────────────────
  const renderInputUjian = () => {
    const today = dateKey();
    const todayExamSchedules = examSchedules.filter(s => s.date === today);
    const futureExamSchedules = examSchedules.filter(s => s.date > today);
    const pastExamSchedules = [...examSchedules].filter(s => s.date < today).sort((a, b) => b.date.localeCompare(a.date) || timeToMin(a.startTime) - timeToMin(b.startTime));
    const uniqueExamDays = new Set(examSchedules.map(s => s.date)).size;

    return (
      <div className="space-y-4 animate-slide-up">
        <div className="bg-surface/60 border border-border2 rounded-3xl p-4 space-y-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-primary">Input Jadwal Ujian</div>
            <div className="text-[12px] text-text3 mt-1 leading-snug">Masukkan jadwal mapelmu diujikan per kelas dan jam ujian.</div>
          </div>

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

          <button onClick={handleAddExam} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold transition-all active:scale-[0.98] hover:brightness-105">
            ＋ Simpan Jadwal Ujian
          </button>
        </div>

        {data.classes.length === 0 || data.subjects.length === 0 ? (
          <div className="bg-amber/10 border border-amber/25 rounded-2xl p-4 text-sm text-amber leading-snug">
            Tambahkan kelas dan mapel dulu di Kelola supaya input jadwal ujian bisa dipakai.
          </div>
        ) : null}

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

        <div className="space-y-4">
          {examSchedules.length === 0 && (
            <div className="bg-surface border border-border2 rounded-2xl p-6 text-center text-sm text-text3">
              Belum ada jadwal ujian detail.
            </div>
          )}
          {todayExamSchedules.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-text3 px-1 mb-2">Ujian Hari Ini ({todayExamSchedules.length})</div>
              <div className="space-y-2">{todayExamSchedules.map(s => <ExamScheduleCard key={s.id} s={s} />)}</div>
            </div>
          )}
          {futureExamSchedules.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-text3 px-1 mb-2">Akan Datang ({futureExamSchedules.length})</div>
              <div className="space-y-2">{futureExamSchedules.map(s => <ExamScheduleCard key={s.id} s={s} />)}</div>
            </div>
          )}
          {pastExamSchedules.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-text3 px-1 mb-2">Sudah Lewat ({pastExamSchedules.length})</div>
              <div className="space-y-2">{pastExamSchedules.slice(0, 20).map(s => <ExamScheduleCard key={s.id} s={s} />)}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Tab: Mode Ujian ──────────────────────────────────────────────────────
  const renderModeUjian = () => (
    <div className="space-y-4 animate-slide-up">
      {/* Hero Toggle Card */}
      <div className={`relative rounded-3xl overflow-hidden border transition-all duration-500 ${
        examMode
          ? 'bg-amber/10 border-amber/30 shadow-[0_0_30px_hsl(40_80%_60%/0.08)]'
          : 'bg-surface/60 border-border2'
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
            {/* Toggle switch */}
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

      {/* Ujian hari ini sebagai konteks */}
      {todayItems.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-text3 px-1 mb-2">Ujian Hari Ini (Mapelku)</div>
          <div className="space-y-2">
            {todayItems.map(item => {
              const state = item.isActive ? 'active' : item.isDone ? 'done' : '';
              const corrSt = item.correction?.status ?? null;
              return (
                <div key={`${item.subjectId}-${item.classId}`}
                  className={`border rounded-2xl p-3.5 flex items-center gap-3 ${
                    state === 'active' ? 'bg-amber/10 border-amber/30' :
                    state === 'done'   ? 'bg-green-dim/20 border-green-dim' : 'bg-surface2/40 border-border2/60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{item.className}</div>
                    <div className="text-xs text-text2">
                      {item.subjectName} · {fmt(item.startTime)}–{fmt(item.endTime)}
                      {item.location && ` · ${item.location}`}
                    </div>
                    {item.note && <div className="text-[11px] text-text3 mt-0.5 italic">{item.note}</div>}
                    {state === 'active' && <div className="text-[10px] text-amber font-bold mt-0.5 animate-pulse">● Sedang berlangsung</div>}
                    {state === 'done'   && <div className="text-[10px] text-green font-bold mt-0.5">✓ Selesai</div>}
                  </div>
                  <button
                    onClick={() => handleCycle(item.subjectId, item.classId, item.examDate, corrSt)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all flex-shrink-0 ${
                      corrSt ? STATUS_CLS[corrSt] : 'text-text3 bg-surface border-border2'
                    }`}
                  >
                    {corrSt ? STATUS_LABEL[corrSt] : 'Koreksi?'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {todayItems.length === 0 && (
        <div className="bg-surface border border-border2 rounded-2xl p-6 text-center text-sm text-text3">
          Tidak ada ujian mapelmu hari ini.
        </div>
      )}
    </div>
  );

  // ─── Tab: Mapelku ─────────────────────────────────────────────────────────
  const renderMapelku = () => (
    <div className="space-y-4 animate-slide-up">
      {/* Sub-tab Hari Ini / Semua */}
      <div className="flex gap-2">
        {(['hari-ini', 'semua'] as MapelSubTab[]).map(t => (
          <button key={t} onClick={() => setMapelTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
              mapelTab === t ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-surface border-border2 text-text2 hover:border-border3'
            }`}
          >
            {t === 'hari-ini' ? '📅 Hari Ini' : '📋 Semua Ujian'}
          </button>
        ))}
      </div>

      {mapelTab === 'hari-ini' && (
        <div className="space-y-3">
          {todayItems.length === 0 ? (
            <div className="bg-surface border border-border2 rounded-2xl p-6 text-center text-sm text-text3">
              Tidak ada ujian mapelmu hari ini.
            </div>
          ) : todayItems.map((item, i) => {
            const state  = item.isActive ? 'active' : item.isDone ? 'done' : '';
            const corrSt = item.correction?.status ?? null;
            return (
              <div key={`${item.subjectId}-${item.classId}`} className="flex items-stretch gap-3 mb-1 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                {/* Spine */}
                <div className="flex flex-col items-center w-12 flex-shrink-0 py-3 gap-1.5">
                  <div className="text-[11px] font-semibold text-text2 tabular-nums">{fmt(item.startTime)}</div>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-500 relative ${
                    state === 'active' ? 'bg-amber shadow-[0_0_10px_hsl(40_80%_60%/0.5)]' : state === 'done' ? 'bg-green' : 'bg-border3'
                  }`}>
                    {state === 'active' && <div className="absolute inset-0 rounded-full border border-amber animate-ping opacity-50" />}
                  </div>
                  {i < todayItems.length - 1 && <div className="flex-1 w-0.5 bg-gradient-to-b from-border2 to-transparent min-h-3" />}
                </div>
                {/* Card */}
                <div className="flex-1 mb-3">
                  <div className={`border rounded-2xl p-4 flex items-center gap-3 transition-all ${
                    state === 'active' ? 'bg-amber/10 border-amber/30' : state === 'done' ? 'bg-green-dim/20 border-green-dim' : 'bg-surface2/40 border-border2/60'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{item.className}</div>
                      <div className="text-xs text-text2">
                        {item.subjectName} · {fmt(item.startTime)}–{fmt(item.endTime)}
                        {item.location && ` · ${item.location}`}
                      </div>
                      {item.note && <div className="text-[11px] text-text3 mt-0.5 italic">{item.note}</div>}
                      {state === 'done' && <div className="text-[11px] text-green mt-1 font-semibold">✓ Selesai</div>}
                    </div>
                    <button
                      onClick={() => handleCycle(item.subjectId, item.classId, item.examDate, corrSt)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all flex-shrink-0 ${
                        corrSt ? STATUS_CLS[corrSt] : 'text-text3 bg-surface border-border2 hover:border-border3'
                      }`}
                    >
                      {corrSt ? STATUS_LABEL[corrSt] : 'Koreksi?'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mapelTab === 'semua' && (
        <div className="space-y-4">
          {allSubjects.length === 0 && (
            <div className="bg-surface border border-border2 rounded-2xl p-6 text-center text-sm text-text3">
              Belum ada jadwal ujian. Atur di Kelola → Mapel.
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-text3 uppercase tracking-wider px-1 mb-2.5">Akan Datang</div>
              <div className="space-y-2">{upcoming.map(item => <SubjectCard key={`${item.subjectId}-${item.examDate}`} item={item} />)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-text3 uppercase tracking-wider px-1 mt-4 mb-2.5">Sudah Lewat</div>
              <div className="space-y-2">{past.map(item => <SubjectCard key={`${item.subjectId}-${item.examDate}`} item={item} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── Tab: Ngawas ──────────────────────────────────────────────────────────
  const renderNgawas = () => (
    <div className="space-y-4 animate-slide-up">
      {/* Form */}
      <div className="bg-surface/60 border border-border2 rounded-3xl p-4 space-y-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-primary">Tambah Sesi Ngawas</div>

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
          <input
            value={nSubject} onChange={e => setNSubject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddProctor()}
            placeholder="cth: Bahasa Indonesia, Matematika..."
            className="form-input-style text-sm h-10 w-full"
          />
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

      {/* Hari ini */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-text3 px-1 mb-2">Ngawas Hari Ini</div>
        {todayProctor.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-2xl p-4 text-center text-sm text-text3">
            Belum ada sesi ngawas hari ini.
          </div>
        ) : (
          <div className="space-y-2">{todayProctor.map(s => <ProctorCard key={s.id} s={s} />)}</div>
        )}
      </div>

      {/* Riwayat (hari-hari sebelumnya) */}
      {allProctor.filter(s => s.date !== dateKey()).length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-4 py-3 bg-surface border border-border2 rounded-2xl text-sm font-semibold text-text2 hover:bg-surface2 transition-colors"
          >
            <span>📁 Riwayat Ngawas ({allProctor.filter(s => s.date !== dateKey()).length})</span>
            <span className="text-text3 text-xs">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="space-y-2 mt-2">
              {allProctor.filter(s => s.date !== dateKey()).slice(0, 20).map(s => (
                <ProctorCard key={s.id} s={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── Main ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-slide-up pb-8">
      {/* Tab Bar */}
      <div className="flex gap-1.5 bg-surface2/60 border border-border2 rounded-2xl p-1">
        {tabItems.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all duration-200 ${
              tab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-text3 hover:text-foreground hover:bg-surface2'
            }`}
          >
            <span className="text-base leading-none">{t.emoji}</span>
            <span className="leading-none">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'input'   && renderInputUjian()}
      {tab === 'mode'    && renderModeUjian()}
      {tab === 'mapelku' && renderMapelku()}
      {tab === 'ngawas'  && renderNgawas()}
    </div>
  );
}
