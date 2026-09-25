import { useState, useEffect, type ElementType } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getAllExamSubjects,
  upsertCorrection, getExamDayMode, setExamDayMode,
  getExamSchedules, addExamSchedule, deleteExamSchedule, updateExamSchedule,
  getExamReminderSettings, updateExamReminderSetting,
  
  getCorrectionQueue, getCorrectionStats,
  fmtDate, fmtDayLabel, dayLabelColor,
  ExamSubjectItem, CorrectionQueueItem, ExamReminderSettingKey, getExamStatus,
  fmt, resetAllExamData,
} from '@/lib/examData';
import { currentMin, timeToMin, dateKey, getData } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, ChevronDown, AlertTriangle, CalendarDays, Pencil, History, RotateCcw, X, MapPin, StickyNote, Sun, UserCheck, CheckCircle2 } from 'lucide-react';

type ExamTab = 'today' | 'jadwal' | 'ngawas' | 'koreksi';

interface ExamViewProps { refreshKey: number; onRefresh: () => void; initialTab: string; }

export default function ExamView({ onRefresh, initialTab }: ExamViewProps) {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const section = params.get('section');
  const validTabs: ExamTab[] = ['today', 'jadwal', 'ngawas', 'koreksi'];
  let tab: ExamTab = 'today';
  if (section && validTabs.includes(section as ExamTab)) tab = section as ExamTab;
  else if (initialTab && validTabs.includes(initialTab as ExamTab)) tab = initialTab as ExamTab;
  else if (section === 'agenda' || initialTab === 'agenda') tab = 'today';

  const setTab = (nextTab: ExamTab) => setParams(previous => { const next = new URLSearchParams(previous); next.set('section', nextTab); return next; });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [examFormOpen, setExamFormOpen] = useState(false);

  const [showPastExam, setShowPastExam] = useState(false);
  
  const examMode = getExamDayMode();

  // Form: jadwal ujian mapel sendiri
  const [eEditId, setEEditId] = useState<string | null>(null);
  const [eDate, setEDate] = useState(dateKey());
  const [eClassId, setEClassId] = useState('');
  const [eSubjectId, setESubjectId] = useState('');
  const [eType, setEType] = useState<'UTS' | 'UAS' | 'Umum'>('UTS');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');
  const [eLocation, setELocation] = useState('');
  const [eNote, setENote] = useState('');

  // Form: ngawas (dari tab agenda digabung)
  const [nSubject, setNSubject] = useState('');


  useEffect(() => {
    const id = setInterval(() => onRefresh(), 60_000);
    return () => clearInterval(id);
  }, [onRefresh]);

  const allSubjects = getAllExamSubjects();
  const data = getData();
  const examSchedules = getExamSchedules();
  const past = allSubjects.filter(s => s.daysLeft < 0);
  const correctionStats = getCorrectionStats();

  const todayStr = dateKey();
  const todayExamSchedules = examSchedules.filter(s => s.date === todayStr);
  const futureExamSchedules = examSchedules.filter(s => s.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || timeToMin(a.startTime) - timeToMin(b.startTime));
  const pastExamSchedules = examSchedules.filter(s => s.date < todayStr)
    .sort((a, b) => b.date.localeCompare(a.date) || timeToMin(a.startTime) - timeToMin(b.startTime));

  const handleCorrectionStatus = (subjectId: string, classId: string, examDate: string, status: 'sedang' | 'selesai' | null) => {
    upsertCorrection(subjectId, classId, examDate, status);
    onRefresh();
  };



  const handleAddExam = () => {
    if (!eClassId || !eSubjectId || !eDate || !eStart || !eEnd) {
      toast({ title: 'Lengkapi kelas, mapel, tanggal, dan jam ujian' }); return;
    }
    if (eSubjectId === 'proctor_only' && !nSubject.trim()) {
      toast({ title: 'Masukkan nama mapel yang diawasi' }); return;
    }
    if (timeToMin(eEnd) <= timeToMin(eStart)) {
      toast({ title: 'Jam selesai harus setelah jam mulai' }); return;
    }
    
    const draft = {
      classId: eClassId, subjectId: eSubjectId, date: eDate,
      startTime: eStart, endTime: eEnd,
      subjectName: eSubjectId === 'proctor_only' ? nSubject.trim() : undefined,
      location: eLocation.trim() || undefined,
      note: eNote.trim() || undefined,
      examType: eType,
      supervisorId: eSubjectId === 'proctor_only' ? (data.teacherName || 'Pengawas') : undefined
    };

    if (eEditId) {
      updateExamSchedule(eEditId, draft);
      toast({ title: '✓ Jadwal ujian diperbarui' });
    } else {
      addExamSchedule(draft);
      toast({ title: '✓ Jadwal ujian ditambahkan' });
    }

    setEEditId(null);
    setEStart(''); setEEnd(''); setELocation(''); setENote('');
    if (eSubjectId === 'proctor_only') setNSubject('');
    setExamFormOpen(false);
    onRefresh();
  };

  const handleEditExam = (s: ReturnType<typeof getExamSchedules>[number]) => {
    setEEditId(s.id);
    setEClassId(s.classId);
    setESubjectId(s.subjectId);
    setEDate(s.date);
    setEStart(s.startTime);
    setEEnd(s.endTime);
    setEType(s.examType || 'UTS');
    setELocation(s.location || '');
    setENote(s.note || '');
    if (s.subjectId === 'proctor_only' && s.subjectName) {
      setNSubject(s.subjectName);
    }
    setExamFormOpen(true);
  };

  const handleDeleteExam = (id: string) => {
    deleteExamSchedule(id);
    onRefresh();
    toast({ title: 'Jadwal ujian dihapus' });
  };


  const ExamScheduleCard = ({ s }: { s: ReturnType<typeof getExamSchedules>[number] }) => {
    const cls = data.classes.find(c => c.id === s.classId);
    const sub = data.subjects.find(x => x.id === s.subjectId);
    
    const status = getExamStatus(s.date, s.startTime, s.endTime);
    const isActive = status === 'BERLANGSUNG';
    const isDone = status === 'SELESAI' || status === 'TERLEWAT';

    const examTypeBadge = s.examType
      ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
          s.examType === 'UTS' ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
          : s.examType === 'UAS' ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
        }`}>{s.examType}</span>
      : null;

    return (
      <div className={`border rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
        isActive ? 'bg-amber/10 border-amber/30 shadow-[inset_0_0_20px_rgba(251,191,36,0.05)]' : isDone ? 'bg-green/10 border-green/30' : 'bg-surface2/40 border-border2/60 hover:bg-surface2/80'
      }`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-bold text-sm bg-surface3 px-2 py-0.5 rounded-md border border-border2 text-text2 uppercase">{cls?.name || '?'}</span>
            {examTypeBadge}
            {isActive && <span className="text-xs font-black bg-amber/20 text-amber border border-amber/30 px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">Sedang Berlangsung</span>}
            {isDone && <span className="text-xs font-black bg-green/10 text-green border border-green/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Selesai</span>}
          </div>
          <div className="text-[15px] font-bold text-foreground leading-snug">{s.subjectName || sub?.name || '?'}</div>
          <div className="text-[13px] font-medium text-text2 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-text3" /> {fmtDate(s.date)}</span>
            <span className="flex items-center gap-1 text-primary/90">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
              {s.startTime} - {s.endTime}
            </span>
          </div>
          {(s.location || s.note) && (
            <div className="text-xs text-text3 mt-1.5 flex flex-wrap gap-3">
              {s.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-text3" /> {s.location}</span>}
              {s.note && <span className="flex items-center gap-1"><StickyNote className="w-3.5 h-3.5 text-text3" /> {s.note}</span>}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => handleEditExam(s)}
            className="w-11 h-11 rounded-xl bg-surface border border-border2 text-text2 grid place-items-center hover:bg-surface2 hover:text-primary transition-all"
            title="Edit Jadwal"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => { deleteExamSchedule(s.id); onRefresh(); }}
            className="w-11 h-11 rounded-xl bg-red/10 border border-red/20 text-red grid place-items-center hover:bg-red/20 transition-all"
            title="Hapus Jadwal"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  const SubjectCard = ({ item }: { item: ExamSubjectItem }) => {
    const expandKey = `${item.subjectId}-${item.examDate}`;
    const isExp = expanded === expandKey;
    return (
      <div className="bg-surface border border-border2 rounded-2xl overflow-hidden">
        <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => setExpanded(isExp ? null : expandKey)}>
          <div>
            <div className="text-sm font-semibold">{item.subjectName}</div>
            <div className={`text-xs mt-0.5 ${dayLabelColor(item.daysLeft)}`}>
              {fmtDate(item.examDate)} · {fmtDayLabel(item.daysLeft)}
            </div>
          </div>
          <span className="text-text3 text-xs">{isExp ? '▲' : '▼'}</span>
        </button>
        {isExp && (
          <div className="border-t border-border px-4 pb-3 pt-2 space-y-2">
            <div className="text-xs text-text3 font-bold uppercase tracking-wide mb-1">Jadwal per Kelas</div>
            {item.classes.map(cls => (
              <div key={`${cls.classId}-${cls.startTime || ''}`} className="py-1.5">
                <div className="text-sm font-semibold">{cls.className}</div>
                {(cls.startTime || cls.location || cls.note) && (
                  <div className="text-xs text-text3 leading-snug mt-0.5">
                    {cls.startTime && cls.endTime && <span>{fmt(cls.startTime)}–{fmt(cls.endTime)}</span>}
                    {cls.location && <span>{cls.startTime && cls.endTime ? ' · ' : ''}{cls.location}</span>}
                    {cls.note && <span>{(cls.startTime && cls.endTime) || cls.location ? ' · ' : ''}{cls.note}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const CorrectionRow = ({ item }: { item: CorrectionQueueItem }) => {
    const corrSt = item.status;
    const isFuture = item.isScheduled && !item.isExamFinished;

    return (
      <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 transition-all ${
        corrSt === 'selesai' ? 'bg-green-dim/15 border-green/30' :
        corrSt ? 'bg-amber/8 border-amber/25' :
        item.isOverdue ? 'bg-red/5 border-red/25' :
        'bg-surface border-border2'
      }`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            {item.isOverdue && corrSt !== 'selesai' && (
              <span className="text-xs font-black bg-red/15 text-red border border-red/25 px-2 py-0.5 rounded-full uppercase tracking-wide">Terlambat</span>
            )}
            {item.daysLeft === 0 && item.isScheduled && (
              <span className="text-xs font-black bg-amber/15 text-amber border border-amber/25 px-2 py-0.5 rounded-full uppercase tracking-wide">Hari Ini</span>
            )}
            {isFuture && item.daysLeft !== 0 && (
               <span className="text-xs font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Menunggu Ujian</span>
            )}
          </div>
          <div className="text-sm font-bold leading-snug">{item.className}</div>
          <div className="text-xs text-text2">{item.subjectName}</div>
          {item.isScheduled && (
            <div className="text-xs text-text3 mt-0.5">
              {fmtDate(item.examDate!)}
              {item.daysLeft !== 0 && <span> · {fmtDayLabel(item.daysLeft!)}</span>}
              {item.startTime && item.endTime && <span> · {item.startTime}-{item.endTime}</span>}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {!item.isScheduled ? (
            <button
              onClick={() => {
                setEClassId(item.classId);
                setESubjectId(item.subjectId);
                setEDate(dateKey());
                setEStart(''); setEEnd(''); setEEditId(null);
                setExamFormOpen(true);
              }}
              className="text-sm px-4 min-h-[44px] flex items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary font-bold transition-all active:scale-95"
            >
              Set Waktu
            </button>
          ) : (
            <>
              {item.scheduleId && corrSt !== 'selesai' && (
                <button
                  onClick={() => {
                    const s = examSchedules.find(x => x.id === item.scheduleId);
                    if (s) handleEditExam(s);
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border border-border2 bg-surface hover:bg-surface2 text-text3 transition-all active:scale-95"
                  title="Edit Jadwal"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {isFuture ? null : corrSt === 'selesai' ? (
                <button
                  onClick={() => handleCorrectionStatus(item.subjectId, item.classId, item.examDate!, 'sedang')}
                  className="text-sm px-4 min-h-[44px] rounded-full border border-green/30 bg-green/10 text-green font-bold flex items-center justify-center gap-2 hover:bg-green/20 transition-all active:scale-95"
                  title="Batal selesai"
                >
                  Selesai <RotateCcw className="w-3.5 h-3.5" />
                </button>
              ) : corrSt === 'sedang' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCorrectionStatus(item.subjectId, item.classId, item.examDate!, null)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border border-border2 bg-surface hover:bg-surface2 text-text3 transition-all active:scale-95"
                    title="Batal koreksi"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCorrectionStatus(item.subjectId, item.classId, item.examDate!, 'selesai')}
                    className="text-sm px-4 min-h-[44px] flex items-center justify-center rounded-full border border-green/30 bg-green/10 text-green font-bold transition-all active:scale-95"
                  >
                    Tandai selesai
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleCorrectionStatus(item.subjectId, item.classId, item.examDate!, 'sedang')}
                  className="text-sm px-4 min-h-[44px] flex items-center justify-center rounded-full border border-amber/30 bg-amber/10 text-amber font-bold transition-all active:scale-95"
                >
                  Mulai koreksi
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };
  const renderAddExamForm = (mode: 'jadwal' | 'ngawas', title = 'Tambah') => {
    const noPrereq = data.classes.length === 0 || (mode === 'jadwal' && data.subjects.length === 0);
    const isNgawas = mode === 'ngawas';
    
    return (
      <div className="bg-surface border border-border2 rounded-3xl overflow-hidden">
        <button
          onClick={() => {
            setExamFormOpen(open => !open);
            if (!examFormOpen) {
              if (isNgawas) setESubjectId('proctor_only');
              else if (eSubjectId === 'proctor_only') setESubjectId('');
            }
          }}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface2/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-primary/10 border border-primary-border/30 grid place-items-center text-primary"><Plus className="h-4 w-4" /></span>
            <div>
              <div className="text-[13px] font-bold">{title}</div>
              <div className="text-xs text-text3 mt-0.5">Atur kelas, {isNgawas ? 'mapel ngawas' : 'mapel'}, tanggal, dan jam</div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-text3 transition-transform ${examFormOpen ? 'rotate-180' : ''}`} />
        </button>

        {examFormOpen && (
          <div className="border-t border-border2/60 px-4 py-4 space-y-3">
            {noPrereq ? (
              <div className="rounded-xl bg-amber/10 border border-amber/25 p-3 text-xs text-amber">Tambahkan kelas {mode === 'jadwal' ? 'dan mata pelajaran ' : ''}terlebih dahulu di menu Kelola.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Kelas <span className="text-red">*</span></label>
                    <select aria-label="Kelas ujian" value={eClassId} onChange={e => setEClassId(e.target.value)} className="form-input-style min-w-0 w-full">
                      <option value="">Pilih kelas</option>
                      {data.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Mapel {isNgawas ? 'yang diawasi' : ''} <span className="text-red">*</span></label>
                    {isNgawas ? (
                      <input aria-label="Nama mapel lain" value={nSubject} onChange={e => setNSubject(e.target.value)} placeholder="Ketik nama mapel (cth: Biologi)" className="form-input-style min-w-0 w-full" />
                    ) : (
                      <select aria-label="Mata pelajaran ujian" value={eSubjectId} onChange={e => setESubjectId(e.target.value)} className="form-input-style min-w-0 w-full">
                        <option value="">Pilih mapel</option>
                        {data.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Tanggal <span className="text-red">*</span></label>
                    <input type="date" aria-label="Tanggal ujian" value={eDate} onChange={e => setEDate(e.target.value)} className="form-input-style min-w-0 w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Tipe</label>
                    <select aria-label="Tipe ujian" value={eType} onChange={e => setEType(e.target.value as typeof eType)} className="form-input-style min-w-0 w-full">
                      <option value="UTS">UTS</option><option value="UAS">UAS</option><option value="Umum">Umum</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Mulai <span className="text-red">*</span></label><input type="time" aria-label="Jam mulai ujian" value={eStart} onChange={e => setEStart(e.target.value)} className="form-input-style min-w-0 w-full" /></div>
                  <div><label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Selesai <span className="text-red">*</span></label><input type="time" aria-label="Jam selesai ujian" value={eEnd} onChange={e => setEEnd(e.target.value)} className="form-input-style min-w-0 w-full" /></div>
                </div>
                <details className="rounded-xl border border-border2 bg-surface2/30 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-text2">Ruangan dan catatan (opsional)</summary>
                  <div className="space-y-2 pt-3">
                    <input aria-label="Ruangan ujian" value={eLocation} onChange={e => setELocation(e.target.value)} placeholder="Ruangan" className="form-input-style min-w-0 w-full" />
                    <input aria-label="Catatan ujian" value={eNote} onChange={e => setENote(e.target.value)} placeholder="Catatan" className="form-input-style min-w-0 w-full" />
                  </div>
                </details>
                <button onClick={() => {
                  if (isNgawas) setESubjectId('proctor_only');
                  setTimeout(handleAddExam, 0);
                }} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold active:scale-[0.98]">Simpan jadwal</button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderToday = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = dateKey(tomorrow);
    const tomorrowSchedules = futureExamSchedules.filter(s => s.date === tomorrowStr);
    
    return (
      <div className="space-y-3 animate-slide-up pb-20">
        {todayExamSchedules.length === 0 && tomorrowSchedules.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-3xl px-6 py-10 text-center">
            <Sun aria-hidden="true" className="h-10 w-10 mx-auto mb-4 text-primary" />
            <div className="text-sm font-bold">Hari ini tidak ada agenda</div>
            <div className="text-xs text-text3 mt-1">Anda bisa bersantai sejenak.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {todayExamSchedules.length > 0 && (
              <section className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-text3 px-1">Hari Ini · {todayExamSchedules.length} ujian</div>
                <div className="space-y-2">{todayExamSchedules.map(s => <ExamScheduleCard key={s.id} s={s} />)}</div>
              </section>
            )}
            {tomorrowSchedules.length > 0 && (
              <section className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-text3 px-1">Besok · {tomorrowSchedules.length} ujian</div>
                <div className="space-y-2">{tomorrowSchedules.map(s => <ExamScheduleCard key={s.id} s={s} />)}</div>
              </section>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderJadwal = () => {
    const mySchedules = examSchedules.filter(s => s.subjectId !== 'proctor_only');
    const myFuture = mySchedules.filter(s => s.date >= todayStr);
    const myPast = mySchedules.filter(s => s.date < todayStr);
    const legacyPast = allSubjects.filter(s => s.daysLeft < 0 && s.subjectId !== 'proctor_only');
    
    return (
      <div className="space-y-3 animate-slide-up pb-20">
        {renderAddExamForm('jadwal', 'Tambah Jadwal Ujian')}
        
        {myFuture.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-3xl px-6 py-8 text-center">
            <CalendarDays aria-hidden="true" className="h-10 w-10 mx-auto mb-3 text-text3" />
            <div className="text-sm font-bold">Belum ada jadwal mapelmu</div>
            <div className="text-xs text-text3 mt-1">Jadwal ujian mapel yang Anda ampu akan muncul di sini.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {myFuture.map(s => <ExamScheduleCard key={s.id} s={s} />)}
          </div>
        )}

        {(myPast.length > 0 || legacyPast.length > 0) && (
          <details className="group bg-surface border border-border2 rounded-2xl overflow-hidden mt-4">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5">
              <div><div className="text-[13px] font-bold">Riwayat Jadwal Ujian</div><div className="text-xs text-text3 mt-0.5">{myPast.length || legacyPast.length} ujian terdahulu</div></div>
              <ChevronDown className="h-4 w-4 text-text3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border2/60 p-3 space-y-2">
              {myPast.length > 0
                ? myPast.map(s => <ExamScheduleCard key={s.id} s={s} />)
                : legacyPast.map(item => <SubjectCard key={`${item.subjectId}-${item.examDate}`} item={item} />)}
            </div>
          </details>
        )}
      </div>
    );
  };

  const renderNgawas = () => {
    const procSchedules = examSchedules.filter(s => s.subjectId === 'proctor_only');
    const procFuture = procSchedules.filter(s => s.date >= todayStr);
    const procPast = procSchedules.filter(s => s.date < todayStr);
    
    return (
      <div className="space-y-3 animate-slide-up pb-20">
        {renderAddExamForm('ngawas', 'Tambah Tugas Ngawas')}
        
        {procFuture.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-3xl px-6 py-8 text-center">
            <UserCheck aria-hidden="true" className="h-10 w-10 mx-auto mb-3 text-text3" />
            <div className="text-sm font-bold">Belum ada tugas ngawas</div>
            <div className="text-xs text-text3 mt-1">Jadwal pengawasan ujian kelas lain akan muncul di sini.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {procFuture.map(s => <ExamScheduleCard key={s.id} s={s} />)}
          </div>
        )}

        {procPast.length > 0 && (
          <details className="group bg-surface border border-border2 rounded-2xl overflow-hidden mt-4">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5">
              <div><div className="text-[13px] font-bold">Riwayat Tugas Ngawas</div><div className="text-xs text-text3 mt-0.5">{procPast.length} ujian terdahulu</div></div>
              <ChevronDown className="h-4 w-4 text-text3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border2/60 p-3 space-y-2">
              {procPast.map(s => <ExamScheduleCard key={s.id} s={s} />)}
            </div>
          </details>
        )}
      </div>
    );
  };

  const renderKoreksi = () => {
    const queue = getCorrectionQueue();
    const { done, total, pending, overdue } = correctionStats;
    const progressPct = total > 0 ? Math.max(4, (done / total) * 100) : 0;
    const completed = getCorrectionQueue({ includeCompleted: true }).filter(item => item.status === 'selesai');

    return (
      <div className="space-y-3 animate-slide-up pb-20">
        <div className={`rounded-2xl border p-4 ${pending > 0 ? 'bg-red/5 border-red/25' : 'bg-green-dim/15 border-green/30'}`}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-text3 mb-1">Progres Koreksi</div>
              <div className={`text-2xl font-black tabular-nums ${pending > 0 ? 'text-red' : 'text-green'}`}>{done}/{total}</div>
            </div>
            {overdue > 0 && <span className="text-xs font-black bg-red/15 text-red border border-red/25 px-2.5 py-1 rounded-full uppercase tracking-wide">{overdue} terlambat</span>}
          </div>
          <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${pending === 0 ? 'bg-green' : done > 0 ? 'bg-amber' : 'bg-red/50'}`} style={{ width: `${progressPct}%` }} />
          </div>
          <div className="text-xs text-text3 mt-2">{pending > 0 ? `${pending} kelas belum selesai dikoreksi` : 'Semua koreksi sudah beres'}</div>
        </div>

        {queue.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-3xl px-6 py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-green mx-auto mb-4" />
            <div className="text-sm font-bold mb-1">Semua koreksi beres</div>
            <div className="text-xs text-text3">Tidak ada ujian yang perlu dikoreksi saat ini.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map(item => <CorrectionRow key={`${item.subjectId}-${item.classId}-${item.examDate}`} item={item} />)}
          </div>
        )}

        <details className="group bg-surface border border-border2 rounded-2xl overflow-hidden mt-4">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5">
            <div><div className="text-[13px] font-bold">Koreksi Selesai</div><div className="text-xs text-text3 mt-0.5">{completed.length} kelas sudah dikoreksi</div></div>
            <ChevronDown className="h-4 w-4 text-text3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border2/60 p-3 space-y-2">
            {completed.length ? completed.map(item => <CorrectionRow key={`${item.subjectId}-${item.classId}-${item.examDate}`} item={item} />) : <p className="text-xs text-text3 text-center py-3">Belum ada koreksi yang selesai.</p>}
          </div>
        </details>
      </div>
    );
  };

  const tabItems: { id: ExamTab; label: string; icon: ElementType; badge?: number }[] = [
    { id: 'today', label: 'Hari Ini', icon: Sun },
    { id: 'jadwal', label: 'Jadwal', icon: CalendarDays },
    { id: 'ngawas', label: 'Ngawas', icon: UserCheck },
    { id: 'koreksi', label: 'Koreksi', icon: Pencil, badge: correctionStats.pending > 0 ? correctionStats.pending : undefined },
  ];

  return (
    <div className="exam-workspace space-y-3 animate-slide-up pb-8">
      <div className="bg-surface/70 border border-border2 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wide text-primary">Menu Ujian</div>
            <div className="text-xs text-text3 truncate">
              {correctionStats.pending > 0 ? `${correctionStats.pending} koreksi perlu dikerjakan` : 'Agenda ujian dan koreksi'}
            </div>
          </div>
          <span className={`px-2.5 py-1.5 rounded-full border text-xs font-black uppercase tracking-wide flex-shrink-0 ${examMode ? 'bg-amber/15 border-amber/30 text-amber' : 'bg-surface2 border-border2 text-text3'}`}>
            {examMode ? 'Mode Aktif' : 'KBM Normal'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1 sm:gap-2 bg-surface2/60 border border-border2 rounded-xl p-1.5">
          {tabItems.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative min-h-[56px] flex flex-col justify-center items-center rounded-lg px-1 py-1.5 text-xs sm:text-sm font-bold transition-all duration-200 active:scale-[0.98] ${
                tab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-text3 hover:text-foreground hover:bg-surface2'
              }`}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.badge !== undefined && (
                <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-black flex items-center justify-center leading-none shadow-sm z-10">
                  {t.badge}
                </span>
              )}
              <t.icon aria-hidden="true" className="h-5 w-5 mb-1.5" />
              <span className="block leading-none truncate w-full text-center tracking-wide">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'today' && renderToday()}
      {tab === 'jadwal' && renderJadwal()}
      {tab === 'ngawas' && renderNgawas()}
      {tab === 'koreksi' && renderKoreksi()}
    </div>
  );
}
