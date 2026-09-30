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
import { Trash2, Plus, ChevronDown, AlertTriangle, CalendarDays, Pencil, History, RotateCcw, X, MapPin, StickyNote, Sun, UserCheck, CheckCircle2, Check } from 'lucide-react';

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


  const ScheduleRow = ({ s, isClosest }: { s: ReturnType<typeof getExamSchedules>[number], isClosest?: boolean }) => {
    const cls = data.classes.find(c => c.id === s.classId);
    
    const status = getExamStatus(s.date, s.startTime, s.endTime);
    const isActive = status === 'BERLANGSUNG';
    const isDone = status === 'SELESAI' || status === 'TERLEWAT';

    const corr = data.corrections?.find(c => c.subjectId === s.subjectId && c.classId === s.classId && c.examDate === s.date);
    const isCorrected = corr?.status === 'selesai' && s.subjectId !== 'proctor_only';

    return (
      <div className={`px-4 py-3 flex items-center justify-between gap-3 transition-colors hover:bg-surface2/30 ${isActive ? 'bg-amber/5' : isDone ? 'bg-green/5 opacity-80' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-[13px] uppercase">{cls?.name || '?'}</span>
            {s.examType && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                s.examType === 'UTS' ? 'bg-blue-500/15 text-blue-500'
                : s.examType === 'UAS' ? 'bg-purple-500/15 text-purple-500'
                : 'bg-emerald-500/15 text-emerald-500'
              }`}>{s.examType}</span>
            )}
            {isActive && <span className="text-[10px] font-black bg-amber/20 text-amber px-2 py-0.5 rounded-full uppercase tracking-wide">Live</span>}
            {isClosest && !isActive && <span className="text-[10px] font-black bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full uppercase tracking-wide">Berikutnya</span>}
            {isDone && (
              <span className="text-[10px] font-black bg-green/10 text-green px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-0.5">
                Selesai {isCorrected && <CheckCircle2 className="w-3 h-3 text-green" />}
              </span>
            )}
          </div>
          <div className="text-xs font-medium flex items-center gap-2 text-text2">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-text3/70" /> {fmtDate(s.date)}</span>
            <span className="flex items-center gap-1 text-primary/80">
              {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />}
              {s.startTime} - {s.endTime}
            </span>
          </div>
          {(s.location || s.note) && (
            <div className="text-[11px] text-text3 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location}</span>}
              {s.note && <span className="flex items-center gap-1"><StickyNote className="w-3 h-3" /> {s.note}</span>}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <button
            onClick={() => handleEditExam(s)}
            className="w-8 h-8 rounded-full border border-transparent bg-transparent hover:bg-surface2 text-text3 hover:text-primary grid place-items-center transition-all"
            title="Edit Jadwal"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { deleteExamSchedule(s.id); onRefresh(); }}
            className="w-8 h-8 rounded-full border border-transparent bg-transparent hover:bg-red/10 text-text3 hover:text-red grid place-items-center transition-all"
            title="Hapus Jadwal"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const groupSchedulesBySubject = (items: ReturnType<typeof getExamSchedules>) => {
    const map = new Map<string, { subjectName: string, items: typeof items }>();
    items.forEach(s => {
      const name = s.subjectId === 'proctor_only' ? 'Tugas Ngawas' : (s.subjectName || data.subjects.find(x => x.id === s.subjectId)?.name || 'Mapel tidak diketahui');
      if (!map.has(s.subjectId)) {
        map.set(s.subjectId, { subjectName: name, items: [] });
      }
      map.get(s.subjectId)!.items.push(s);
    });
    return Array.from(map.values());
  };

  const groupSchedulesByDate = (items: ReturnType<typeof getExamSchedules>) => {
    const map = new Map<string, typeof items>();
    items.forEach(s => {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    });
    return Array.from(map.entries()).sort((a,b) => b[0].localeCompare(a[0])).map(([date, items]) => ({ date, items }));
  };

  const renderScheduleGroup = (title: string, subtitle: React.ReactNode, schedules: ReturnType<typeof getExamSchedules>, closestId?: string | null) => {
    return (
      <div className="bg-surface border border-border2 rounded-2xl overflow-hidden mb-3">
        <div className="px-4 py-2.5 bg-surface2/40 border-b border-border2/60 flex items-center justify-between">
          <div className="text-sm font-bold text-foreground">{title}</div>
          {subtitle && <div className="text-[11px] text-text3 font-medium">{subtitle}</div>}
        </div>
        <div className="divide-y divide-border2/60">
          {schedules.map(s => <ScheduleRow key={s.id} s={s} isClosest={s.id === closestId} />)}
        </div>
      </div>
    );
  };

  const CorrectionRow = ({ item }: { item: CorrectionQueueItem }) => {
    const isDone = item.status === 'selesai';
    const isFuture = item.isScheduled && !item.isExamFinished;

    return (
      <div className={`px-4 py-3 flex items-center justify-between gap-3 transition-colors ${isDone ? 'bg-green/5' : 'hover:bg-surface2/30'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-[13px] uppercase">{item.className}</span>
            {item.isOverdue && !isDone && (
              <span className="text-[10px] font-black bg-red/15 text-red border border-red/25 px-2 py-0.5 rounded-full uppercase tracking-wide">Terlambat</span>
            )}
            {item.daysLeft === 0 && item.isScheduled && (
              <span className="text-[10px] font-black bg-amber/15 text-amber border border-amber/25 px-2 py-0.5 rounded-full uppercase tracking-wide">Hari Ini</span>
            )}
            {isFuture && item.daysLeft !== 0 && (
              <span className="text-[10px] font-black bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Menunggu</span>
            )}
          </div>
          {item.isScheduled && (
            <div className="text-xs text-text3 flex items-center gap-1.5 mt-0.5">
              <CalendarDays className="w-3.5 h-3.5 text-text3/70" />
              {fmtDate(item.examDate!)}
              {item.daysLeft !== 0 && <span>· {fmtDayLabel(item.daysLeft!)}</span>}
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
              className="text-xs px-3 min-h-[36px] flex items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary font-bold active:scale-95 transition-all"
            >
              Set Jadwal
            </button>
          ) : (
            <button
              onClick={() => handleCorrectionStatus(item.subjectId, item.classId, item.examDate!, isDone ? null : 'selesai')}
              disabled={isFuture}
              className={`w-10 h-10 rounded-full border-2 grid place-items-center transition-all ${
                isFuture ? 'border-border2 bg-surface2/30 text-border2 cursor-not-allowed opacity-50'
                : isDone ? 'bg-green border-green text-white shadow-sm scale-[0.98]'
                : 'border-border2 bg-surface hover:border-primary/40 text-primary/0 hover:text-primary/30 active:scale-95'
              }`}
              title={isDone ? "Batal selesai" : "Tandai selesai"}
            >
              <Check className={`w-5 h-5 transition-opacity ${isDone ? 'opacity-100' : isFuture ? 'opacity-0' : 'opacity-100'}`} />
            </button>
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
    
    const activeOrUpcoming = todayExamSchedules
      .filter(s => {
        const st = getExamStatus(s.date, s.startTime, s.endTime);
        return st !== 'SELESAI' && st !== 'TERLEWAT';
      })
      .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
    const closestScheduleId = activeOrUpcoming.length > 0 ? activeOrUpcoming[0].id : null;

    const myToday = todayExamSchedules.filter(s => s.subjectId !== 'proctor_only').sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
    const procToday = todayExamSchedules.filter(s => s.subjectId === 'proctor_only').sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
    const myTomorrow = tomorrowSchedules.filter(s => s.subjectId !== 'proctor_only');
    const procTomorrow = tomorrowSchedules.filter(s => s.subjectId === 'proctor_only');

    return (
      <div className="space-y-4 animate-slide-up pb-20">
        {todayExamSchedules.length === 0 && tomorrowSchedules.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-3xl px-6 py-10 text-center">
            <Sun aria-hidden="true" className="h-10 w-10 mx-auto mb-4 text-primary" />
            <div className="text-sm font-bold">Hari ini tidak ada agenda</div>
            <div className="text-xs text-text3 mt-1">Anda bisa bersantai sejenak.</div>
          </div>
        ) : (
          <div>
            {todayExamSchedules.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-black uppercase tracking-widest text-text3 px-1 mb-2">Hari Ini · {todayExamSchedules.length} Ujian</div>
                {groupSchedulesBySubject(myToday).map(g => renderScheduleGroup(g.subjectName, '', g.items, closestScheduleId))}
                {procToday.length > 0 && renderScheduleGroup('Tugas Ngawas', '', procToday, closestScheduleId)}
              </div>
            )}
            {tomorrowSchedules.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-black uppercase tracking-widest text-text3 px-1 mb-2">Besok · {tomorrowSchedules.length} Ujian</div>
                {groupSchedulesBySubject(myTomorrow).map(g => renderScheduleGroup(g.subjectName, '', g.items, null))}
                {procTomorrow.length > 0 && renderScheduleGroup('Tugas Ngawas', '', procTomorrow, null)}
              </div>
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
      <div className="space-y-4 animate-slide-up pb-20">
        {renderAddExamForm('jadwal', 'Tambah Jadwal Ujian')}
        
        {myFuture.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-3xl px-6 py-8 text-center mt-2">
            <CalendarDays aria-hidden="true" className="h-10 w-10 mx-auto mb-3 text-text3" />
            <div className="text-sm font-bold">Belum ada jadwal mapelmu</div>
            <div className="text-xs text-text3 mt-1">Jadwal ujian mapel yang Anda ampu akan muncul di sini.</div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="text-xs font-black uppercase tracking-widest text-text3 px-1 mb-2">Akan Datang</div>
            {groupSchedulesBySubject(myFuture).map(g => renderScheduleGroup(g.subjectName, `${g.items.length} ujian`, g.items, null))}
          </div>
        )}

        {(myPast.length > 0 || legacyPast.length > 0) && (
          <details className="group bg-surface border border-border2 rounded-2xl overflow-hidden mt-6">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface2/30 transition-colors">
              <div>
                <div className="text-[13px] font-bold">Riwayat Jadwal Ujian</div>
                <div className="text-xs text-text3 mt-0.5">{myPast.length || legacyPast.length} ujian terdahulu</div>
              </div>
              <ChevronDown className="h-4 w-4 text-text3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border2/60 bg-surface3/30 p-3">
              {myPast.length > 0
                ? groupSchedulesBySubject(myPast).map(g => renderScheduleGroup(g.subjectName, '', g.items, null))
                : legacyPast.map(item => (
                    <div key={`${item.subjectId}-${item.examDate}`} className="bg-surface border border-border2 rounded-2xl overflow-hidden mb-3 p-3 text-sm">
                      <div className="font-bold">{item.subjectName}</div>
                      <div className="text-xs text-text3">{fmtDate(item.examDate)} (Data lama)</div>
                    </div>
                  ))
              }
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
      <div className="space-y-4 animate-slide-up pb-20">
        {renderAddExamForm('ngawas', 'Tambah Tugas Ngawas')}
        
        {procFuture.length === 0 ? (
          <div className="bg-surface border border-border2 rounded-3xl px-6 py-8 text-center mt-2">
            <UserCheck aria-hidden="true" className="h-10 w-10 mx-auto mb-3 text-text3" />
            <div className="text-sm font-bold">Belum ada tugas ngawas</div>
            <div className="text-xs text-text3 mt-1">Jadwal pengawasan ujian kelas lain akan muncul di sini.</div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="text-xs font-black uppercase tracking-widest text-text3 px-1 mb-2">Akan Datang</div>
            {renderScheduleGroup('Tugas Ngawas', '', procFuture, null)}
          </div>
        )}

        {procPast.length > 0 && (
          <details className="group bg-surface border border-border2 rounded-2xl overflow-hidden mt-6">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface2/30 transition-colors">
              <div>
                <div className="text-[13px] font-bold">Riwayat Tugas Ngawas</div>
                <div className="text-xs text-text3 mt-0.5">{procPast.length} ujian terdahulu</div>
              </div>
              <ChevronDown className="h-4 w-4 text-text3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border2/60 bg-surface3/30 p-3">
              {groupSchedulesByDate(procPast).map(g => renderScheduleGroup(fmtDate(g.date), '', g.items, null))}
            </div>
          </details>
        )}
      </div>
    );
  };

  const groupBySubject = (items: CorrectionQueueItem[]) => {
    const map = new Map<string, { subjectId: string, subjectName: string, items: CorrectionQueueItem[] }>();
    items.forEach(item => {
      if (!map.has(item.subjectId)) {
        map.set(item.subjectId, { subjectId: item.subjectId, subjectName: item.subjectName, items: [] });
      }
      map.get(item.subjectId)!.items.push(item);
    });
    return Array.from(map.values());
  };

  const renderCorrectionGroups = (groups: ReturnType<typeof groupBySubject>) => {
    return groups.map(g => (
      <div key={g.subjectId} className="bg-surface border border-border2 rounded-2xl overflow-hidden mb-3">
        <div className="px-4 py-2.5 bg-surface2/40 border-b border-border2/60">
          <div className="text-sm font-bold text-foreground">{g.subjectName}</div>
        </div>
        <div className="divide-y divide-border2/60">
          {g.items.map(item => (
            <CorrectionRow key={`${item.subjectId}-${item.classId}-${item.examDate}`} item={item} />
          ))}
        </div>
      </div>
    ));
  };

  const renderKoreksi = () => {
    const queue = getCorrectionQueue();
    const { done, total, pending, overdue } = correctionStats;
    const progressPct = total > 0 ? Math.max(4, (done / total) * 100) : 0;
    const completed = getCorrectionQueue({ includeCompleted: true }).filter(item => item.status === 'selesai');

    const scheduledQueue = queue.filter(q => q.isScheduled);
    const unscheduledQueue = queue.filter(q => !q.isScheduled);

    const scheduledGroups = groupBySubject(scheduledQueue);
    const completedGroups = groupBySubject(completed);

    return (
      <div className="space-y-4 animate-slide-up pb-20">
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
          <div className="bg-surface border border-border2 rounded-3xl px-6 py-10 text-center mt-2">
            <CheckCircle2 className="h-12 w-12 text-green mx-auto mb-4" />
            <div className="text-sm font-bold mb-1">Semua koreksi beres</div>
            <div className="text-xs text-text3">Tidak ada ujian yang perlu dikoreksi saat ini.</div>
          </div>
        ) : (
          <div className="mt-2">
            {scheduledGroups.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-black uppercase tracking-widest text-text3 px-1 mb-2">Perlu Dikoreksi</div>
                {renderCorrectionGroups(scheduledGroups)}
              </div>
            )}
            
            {unscheduledQueue.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-black uppercase tracking-widest text-text3 px-1 mb-2">Perlu Dijadwalkan</div>
                <div className="bg-surface border border-border2 rounded-2xl overflow-hidden divide-y divide-border2/60">
                  {unscheduledQueue.map(item => (
                    <CorrectionRow key={`${item.subjectId}-${item.classId}-${item.examDate}`} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {completed.length > 0 && (
          <details className="group bg-surface border border-border2 rounded-2xl overflow-hidden mt-6">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface2/30 transition-colors">
              <div>
                <div className="text-[13px] font-bold">Koreksi Selesai</div>
                <div className="text-xs text-text3 mt-0.5">{completed.length} kelas sudah dikoreksi</div>
              </div>
              <ChevronDown className="h-4 w-4 text-text3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border2/60 bg-surface3/30 p-3">
              {renderCorrectionGroups(completedGroups)}
            </div>
          </details>
        )}
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
