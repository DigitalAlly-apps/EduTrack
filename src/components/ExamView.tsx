import { useState, useEffect, type ElementType } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getAllExamSubjects,
  upsertCorrection, getExamDayMode, setExamDayMode,
  getExamSchedules, addExamSchedule, deleteExamSchedule,
  getExamReminderSettings, updateExamReminderSetting,
  
  getCorrectionQueue, getCorrectionStats,
  fmtDate, fmtDayLabel, dayLabelColor,
  ExamSubjectItem, CorrectionQueueItem, ExamReminderSettingKey, getExamStatus,
  fmt, resetAllExamData,
} from '@/lib/examData';
import { currentMin, timeToMin, dateKey, getData } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, ChevronDown, AlertTriangle, CalendarDays, Pencil, History, RotateCcw, X } from 'lucide-react';

type ExamTab = 'agenda' | 'koreksi' | 'riwayat';

interface ExamViewProps { refreshKey: number; onRefresh: () => void; initialTab: ExamTab; }

export default function ExamView({ onRefresh, initialTab }: ExamViewProps) {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const section = params.get('section');
  const tab: ExamTab = section === 'koreksi' || section === 'riwayat' || section === 'agenda' ? section : initialTab;
  const setTab = (nextTab: ExamTab) => setParams(previous => { const next = new URLSearchParams(previous); next.set('section', nextTab); return next; });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [examFormOpen, setExamFormOpen] = useState(false);

  const [showPastExam, setShowPastExam] = useState(false);
  
  const examMode = getExamDayMode();

  // Form: jadwal ujian mapel sendiri
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
    addExamSchedule({
      classId: eClassId, subjectId: eSubjectId, date: eDate,
      startTime: eStart, endTime: eEnd,
      subjectName: eSubjectId === 'proctor_only' ? nSubject.trim() : undefined,
      location: eLocation.trim() || undefined,
      note: eNote.trim() || undefined,
      examType: eType,
      supervisorId: eSubjectId === 'proctor_only' ? (data.teacherName || 'Pengawas') : undefined
    });
    setEStart(''); setEEnd(''); setELocation(''); setENote('');
    if (eSubjectId === 'proctor_only') setNSubject('');
    setExamFormOpen(false);
    onRefresh();
    toast({ title: '✓ Jadwal ujian ditambahkan' });
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
            <div className="text-xs text-text3 mt-1.5 flex gap-3">
              {s.location && <span>📍 {s.location}</span>}
              {s.note && <span>📝 {s.note}</span>}
            </div>
          )}
        </div>
        <button
          onClick={() => { deleteExamSchedule(s.id); onRefresh(); }}
          className="w-11 h-11 rounded-xl bg-red/10 border border-red/20 text-red grid place-items-center flex-shrink-0 hover:bg-red/20 transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </button>
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
        <div className="flex-shrink-0">
          {isFuture ? null : corrSt === 'selesai' ? (
            <button
              onClick={() => handleCorrectionStatus(item.subjectId, item.classId, item.examDate!, 'sedang')}
              className="text-xs px-3.5 py-1.5 rounded-full border border-green/30 bg-green/10 text-green font-bold flex items-center gap-1.5 hover:bg-green/20 transition-all active:scale-95"
              title="Batal selesai"
            >
              Selesai <RotateCcw className="w-3 h-3" />
            </button>
          ) : corrSt === 'sedang' ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCorrectionStatus(item.subjectId, item.classId, item.examDate!, null)}
                className="p-1.5 rounded-full border border-border2 bg-surface hover:bg-surface2 text-text3 transition-all active:scale-95"
                title="Batal koreksi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleCorrectionStatus(item.subjectId, item.classId, item.examDate!, 'selesai')}
                className="text-xs px-3.5 py-1.5 rounded-full border border-green/30 bg-green/10 text-green font-bold transition-all active:scale-95"
              >
                Tandai selesai
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleCorrectionStatus(item.subjectId, item.classId, item.examDate!, 'sedang')}
              className="text-xs px-3.5 py-1.5 rounded-full border border-amber/30 bg-amber/10 text-amber font-bold transition-all active:scale-95"
            >
              Mulai koreksi
            </button>
          )}
        </div>
      </div>
    );
  };
  const renderAddExamForm = (title = 'Tambah ujian') => {
    const noPrereq = data.classes.length === 0 || data.subjects.length === 0;
    
    return (
      <div className="bg-surface border border-border2 rounded-3xl overflow-hidden">
        <button
          onClick={() => setExamFormOpen(open => !open)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface2/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-primary/10 border border-primary-border/30 grid place-items-center text-primary"><Plus className="h-4 w-4" /></span>
            <div>
              <div className="text-[13px] font-bold">{title}</div>
              <div className="text-xs text-text3 mt-0.5">Atur kelas, mapel, tanggal, dan jam</div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-text3 transition-transform ${examFormOpen ? 'rotate-180' : ''}`} />
        </button>

        {examFormOpen && (
          <div className="border-t border-border2/60 px-4 py-4 space-y-3">
            {noPrereq ? (
              <div className="rounded-xl bg-amber/10 border border-amber/25 p-3 text-xs text-amber">Tambahkan kelas dan mata pelajaran terlebih dahulu di menu Kelola.</div>
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
                    <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Mapel <span className="text-red">*</span></label>
                    <select aria-label="Mata pelajaran ujian" value={eSubjectId} onChange={e => setESubjectId(e.target.value)} className="form-input-style min-w-0 w-full">
                      <option value="">Pilih mapel</option>
                      {data.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                      <option value="proctor_only">+ Mapel Lain (Ngawas)</option>
                    </select>
                    {eSubjectId === 'proctor_only' && (
                      <input aria-label="Nama mapel lain" value={nSubject} onChange={e => setNSubject(e.target.value)} placeholder="Ketik nama mapel (cth: Biologi)" className="form-input-style min-w-0 w-full mt-2 animate-in fade-in" />
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
                <button onClick={handleAddExam} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold active:scale-[0.98]">Simpan ujian</button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };


  // ─── (Agenda 2 Hari dipindah ke TodayView) ──────────────────────────────
  // renderToday removed — agenda hari ini & besok kini tampil di tab Hari Ini

  // ─── Tab: Agenda ─────────────────────────────────────────────────────────
  const renderAgenda = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = dateKey(tomorrow);
    const tomorrowSchedules = futureExamSchedules.filter(s => s.date === tomorrowStr);
    const laterSchedules = futureExamSchedules.filter(s => s.date > tomorrowStr);
    const noPrereq = data.classes.length === 0 || data.subjects.length === 0;
    const groups = [
      { label: 'Hari ini', items: todayExamSchedules },
      { label: 'Besok', items: tomorrowSchedules },
      { label: 'Tanggal berikutnya', items: laterSchedules },
    ];

    return (
      <div className="space-y-3 animate-slide-up pb-20">
        {renderAddExamForm()}

        {examSchedules.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-3xl px-6 py-10 text-center">
            <CalendarDays aria-hidden="true" className="h-10 w-10 mx-auto mb-4 text-primary" />
            <div className="text-sm font-bold">Belum ada agenda ujian</div>
            <div className="text-xs text-text3 mt-1">Tambah jadwal agar agenda dan antrean koreksi tersusun otomatis.</div>
          </div>
        ) : groups.map(group => group.items.length > 0 && (
          <section key={group.label} className="space-y-2">
            <div className="text-xs font-black uppercase tracking-widest text-text3 px-1">{group.label} · {group.items.length} ujian</div>
            <div className="space-y-2">{group.items.map(schedule => <ExamScheduleCard key={schedule.id} s={schedule} />)}</div>
          </section>
        ))}
      </div>
    );
  };

  // ─── Tab: Koreksi ─────────────────────────────────────────────────────────
  const renderKoreksi = () => {
    const queue = getCorrectionQueue();
    const { done, total, pending, overdue } = correctionStats;
    const progressPct = total > 0 ? Math.max(4, (done / total) * 100) : 0;

    return (
      <div className="space-y-3 animate-slide-up pb-20">
        {/* Summary */}
        <div className={`rounded-2xl border p-4 ${
          pending > 0 ? 'bg-red/5 border-red/25' : 'bg-green-dim/15 border-green/30'
        }`}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-text3 mb-1">Progres Koreksi</div>
              <div className={`text-2xl font-black tabular-nums ${pending > 0 ? 'text-red' : 'text-green'}`}>
                {done}/{total}
              </div>
            </div>
            {overdue > 0 && (
              <span className="text-xs font-black bg-red/15 text-red border border-red/25 px-2.5 py-1 rounded-full uppercase tracking-wide">
                {overdue} terlambat
              </span>
            )}
          </div>
          <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${pending === 0 ? 'bg-green' : done > 0 ? 'bg-amber' : 'bg-red/50'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-xs text-text3 mt-2">
            {pending > 0 ? `${pending} kelas belum selesai dikoreksi` : 'Semua koreksi sudah beres'}
          </div>
        </div>

        {renderAddExamForm('Tambah antrean koreksi')}

        {queue.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-3xl px-6 py-10 text-center">
            <div className="text-5xl mb-4">✅</div>
            <div className="text-sm font-bold mb-1">Semua koreksi beres</div>
            <div className="text-xs text-text3">Tidak ada ujian yang perlu dikoreksi saat ini.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map(item => (
              <CorrectionRow key={`${item.subjectId}-${item.classId}-${item.examDate}`} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => {
    const completed = getCorrectionQueue({ includeCompleted: true }).filter(item => item.status === 'selesai');
    const legacyPast = examSchedules.length === 0 ? past : [];

    return (
      <div className="space-y-3 animate-slide-up pb-20">
        <details className="group bg-surface border border-border2 rounded-2xl overflow-hidden">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5">
            <div><div className="text-[13px] font-bold">Koreksi selesai</div><div className="text-xs text-text3 mt-0.5">{completed.length} kelas sudah dikoreksi</div></div>
            <ChevronDown className="h-4 w-4 text-text3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border2/60 p-3 space-y-2">
            {completed.length ? completed.map(item => <CorrectionRow key={`${item.subjectId}-${item.classId}-${item.examDate}`} item={item} />) : <p className="text-xs text-text3 text-center py-3">Belum ada koreksi yang selesai.</p>}
          </div>
        </details>

        <details className="group bg-surface border border-border2 rounded-2xl overflow-hidden">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5">
            <div><div className="text-[13px] font-bold">Jadwal yang telah lewat</div><div className="text-xs text-text3 mt-0.5">{pastExamSchedules.length || legacyPast.length} jadwal terdahulu</div></div>
            <ChevronDown className="h-4 w-4 text-text3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border2/60 p-3 space-y-2">
            {pastExamSchedules.length ? pastExamSchedules.map(schedule => <ExamScheduleCard key={schedule.id} s={schedule} />)
              : legacyPast.length ? legacyPast.map(item => <SubjectCard key={`${item.subjectId}-${item.examDate}`} item={item} />)
              : <p className="text-xs text-text3 text-center py-3">Belum ada jadwal ujian yang telah lewat.</p>}
          </div>
        </details>
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
              <div className="text-xs text-text3 font-bold uppercase tracking-wide mt-1">Sesi</div>
            </div>
            <div className="bg-surface border border-border2 rounded-2xl p-3 text-center">
              <div className="text-lg font-black leading-none">{uniqueExamDays}</div>
              <div className="text-xs text-text3 font-bold uppercase tracking-wide mt-1">Hari</div>
            </div>
            <div className="bg-surface border border-border2 rounded-2xl p-3 text-center">
              <div className="text-lg font-black leading-none">{todayExamSchedules.length}</div>
              <div className="text-xs text-text3 font-bold uppercase tracking-wide mt-1">Hari Ini</div>
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
                <div className="text-xs text-text3 mt-0.5">Per kelas dan jam ujian mapelmu</div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Kelas <span className="text-red">*</span></label>
                  <select aria-label="Kelas ujian" value={eClassId} onChange={e => setEClassId(e.target.value)} className="form-select-style text-xs h-10 w-full">
                    <option value="">Pilih kelas</option>
                    {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Mapel <span className="text-red">*</span></label>
                  <select aria-label="Mata pelajaran ujian" value={eSubjectId} onChange={e => setESubjectId(e.target.value)} className="form-select-style text-xs h-10 w-full">
                    <option value="">Pilih mapel</option>
                    {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Tanggal <span className="text-red">*</span></label>
                  <input type="date" aria-label="Tanggal ujian" value={eDate} onChange={e => setEDate(e.target.value)} className="form-input-style min-w-0 w-full" />
                </div>
                <div>
                  <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Tipe Ujian <span className="text-red">*</span></label>
                  <select aria-label="Tipe ujian" value={eType} onChange={e => setEType(e.target.value as any)} className="form-select-style text-xs h-10 w-full">
                    <option value="UTS">UTS (Tengah Semester)</option>
                    <option value="UAS">UAS (Akhir Semester)</option>
                    <option value="Umum">Umum / Lainnya</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Jam Mulai <span className="text-red">*</span></label>
                  <input type="time" aria-label="Jam mulai ujian" value={eStart} onChange={e => setEStart(e.target.value)} className="form-input-style min-w-0 w-full" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Jam Selesai <span className="text-red">*</span></label>
                  <input type="time" aria-label="Jam selesai ujian" value={eEnd} onChange={e => setEEnd(e.target.value)} className="form-input-style min-w-0 w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Ruangan <span className="text-text3 font-normal">(opsional)</span></label>
                <input aria-label="Ruangan ujian" value={eLocation} onChange={e => setELocation(e.target.value)} placeholder="cth: R. 12, Lab IPA..." className="form-input-style min-w-0 w-full" />
              </div>
              <div>
                <label className="block text-xs text-text3 font-bold uppercase tracking-wider mb-1">Catatan <span className="text-text3 font-normal">(opsional)</span></label>
                <input aria-label="Catatan ujian" value={eNote} onChange={e => setENote(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddExam()} placeholder="cth: PTS, PAS, kisi-kisi khusus..." className="form-input-style min-w-0 w-full" />
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
                <div className="text-xs font-bold uppercase tracking-wider text-text3 px-1 mb-1.5">Hari Ini ({todayExamSchedules.length})</div>
                <div className="space-y-2">{todayExamSchedules.map(s => <ExamScheduleCard key={s.id} s={s} />)}</div>
              </div>
            )}
            {futureExamSchedules.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-text3 px-1 mb-1.5">Akan Datang ({futureExamSchedules.length})</div>
                <div className="space-y-2">{futureExamSchedules.map(s => <ExamScheduleCard key={s.id} s={s} />)}</div>
              </div>
            )}
            {examSchedules.length === 0 && allSubjects.filter(s => s.daysLeft >= 0).length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-text3 px-1 mb-1.5">Dari Tanggal Mapel</div>
                <div className="bg-amber/10 border border-amber/25 rounded-xl p-3 text-xs text-amber leading-snug mb-2">
                  Tambah jadwal detail per kelas supaya jam ujian lebih akurat.
                </div>
                <div className="space-y-2">
                  {allSubjects.filter(s => s.daysLeft >= 0).map(item => (
                    <SubjectCard key={`${item.subjectId}-${item.examDate}`} item={item} />
                  ))}
                </div>
              </div>
            )}
            {(pastExamSchedules.length > 0 || (examSchedules.length === 0 && past.length > 0)) && (
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


  // ─── Main shell ───────────────────────────────────────────────────────────
  const tabItems: { id: ExamTab; label: string; icon: ElementType; badge?: number }[] = [
    { id: 'agenda', label: 'Agenda', icon: CalendarDays },
    { id: 'koreksi', label: 'Koreksi', icon: Pencil, badge: correctionStats.pending > 0 ? correctionStats.pending : undefined },
    { id: 'riwayat', label: 'Riwayat', icon: History },
  ];

  return (
    <div className="exam-workspace space-y-3 animate-slide-up pb-8">
      {/* Status header */}
      <div className="bg-surface/70 border border-border2 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wide text-primary">Menu Ujian</div>
            <div className="text-xs text-text3 truncate">
              {correctionStats.pending > 0 ? `${correctionStats.pending} koreksi perlu dikerjakan` : 'Agenda ujian dan koreksi dalam satu alur'}
            </div>
          </div>
          <span
            className={`px-2.5 py-1.5 rounded-full border text-xs font-black uppercase tracking-wide flex-shrink-0 ${
              examMode ? 'bg-amber/15 border-amber/30 text-amber' : 'bg-surface2 border-border2 text-text3'
            }`}
          >
            {examMode ? 'Mode Aktif' : 'KBM Normal'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-surface2/60 border border-border2 rounded-xl p-1">
          {tabItems.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative min-h-[42px] rounded-lg px-1 text-xs font-black transition-all duration-200 active:scale-[0.98] ${
                tab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-text3 hover:text-foreground hover:bg-surface2'
              }`}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.badge !== undefined && (
                <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-xs font-black grid place-items-center leading-none">
                  {t.badge}
                </span>
              )}
              <t.icon aria-hidden="true" className="h-4 w-4 mx-auto mb-1" />
              <span className="block leading-none truncate">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'agenda' && renderAgenda()}
      {tab === 'koreksi' && renderKoreksi()}
      {tab === 'riwayat' && renderHistory()}
    </div>
  );
}
