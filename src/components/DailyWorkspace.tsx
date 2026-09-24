import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Timer, Clock, Zap, Pin } from 'lucide-react';
import { addTask, toggleTask, applyEarlyDismissal, applySubjectDismissal, skipSessionForDate, composeSessionNote, splitSessionNote, dateFromKey, dateKey, getData, getLastPageReached, getNextStartPage, getMaterials, getNextMeetingNote, getTeachingPosition, getTodaySchedules, recordTeachingSession, getTaskDisplayTitle, formatTaskDeadline, isAutoPaceTask, shouldShowTaskInInbox, timeToMin, currentMin } from '@/lib/data';
import { getMissingTeachingSessions } from '@/lib/dataPublic';
import { getExamDayMode, getExamSchedules } from '@/lib/examData';
import { navigateTo } from '@/lib/navigation';
import { useToast } from '@/hooks/use-toast';
import type { TodayScheduleItem } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import AssistantPanel from './AssistantPanel';

const SmartRescheduler = lazy(() => import('./SmartReschedulerModal'));

export default function DailyWorkspace({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [params, setParams] = useSearchParams();
  const [clock, setClock] = useState(() => dateKey());
  const [selected, setSelected] = useState<TodayScheduleItem | null>(null);
  const [reschedule, setReschedule] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [taskDraft, setTaskDraft] = useState<{ classId: string; subjectId: string; title: string } | null>(null);
  const [dismiss, setDismiss] = useState<{ kind: 'early' | 'subject'; subjectId: string; classId: string; time: string } | null>(null);
  const [actionError, setActionError] = useState('');
  const { toast } = useToast();
  useEffect(() => {
    const timer = window.setInterval(() => { setClock(dateKey()); onRefresh(); }, 60000);
    return () => window.clearInterval(timer);
  }, [onRefresh]);
  const requestedDate = params.get('date');
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && !Number.isNaN(dateFromKey(requestedDate).getTime()) ? requestedDate : clock;
  const items = getTodaySchedules(date, true);
  const pending = items.filter(item => !item.done);
  const completed = items.filter(item => item.done);
  const focus = pending.find(item => item.active) || pending[0];
  const data = getData();
  const missing = date === clock ? getMissingTeachingSessions().slice(0, 3) : [];
  const pendingTasks = data.tasks.filter(shouldShowTaskInInbox);
  const exams = getExamSchedules().filter(exam => exam.date === date);
  const proctors = getExamSchedules().filter(exam => exam.date === date && (exam.subjectId === 'proctor_only' || (exam.supervisorId && exam.supervisorId !== data.teacherName)));
  const changeDate = (value: string) => setParams(previous => {
    const next = new URLSearchParams(previous); next.set('date', value); return next;
  });
  const move = (offset: number) => { const next = dateFromKey(date); next.setDate(next.getDate() + offset); changeDate(dateKey(next)); };
  return <div className="daily-workspace space-y-5">
    <div className="flex flex-wrap items-center gap-2" aria-label="Tanggal agenda">
      <button className="quiet-button" aria-label="Hari sebelumnya" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
      <label className="min-w-0 flex-1"><span className="sr-only">Tanggal agenda</span><input className="workspace-input" type="date" value={date} onChange={e => e.target.value && changeDate(e.target.value)} /></label>
      <button className="quiet-button" aria-label="Hari berikutnya" onClick={() => move(1)}><ChevronRight size={18} /></button>
      {date !== clock && <button className="quiet-button" onClick={() => changeDate(clock)}>Hari ini</button>}
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        {getExamDayMode() && <div className="rounded-xl bg-primary/10 p-4 text-sm">Fokus ujian aktif. Jadwal mengajar tetap bisa dicatat. <button className="font-semibold text-primary underline" onClick={() => navigateTo({ view: 'exam' })}>Buka ujian</button></div>}

        {focus ? <FocusSession item={focus} date={date} onRecord={() => setSelected(focus)} onRefresh={onRefresh} /> : <section className="work-panel space-y-3">
          <CalendarDays className="text-primary" aria-hidden="true" />
          <h2 className="text-xl font-semibold">{completed.length ? 'Agenda mengajar sudah tercatat' : 'Tidak ada jadwal mengajar'}</h2>
          <p className="text-text2">{completed.length ? 'Hasilnya sudah masuk ke progres kelas.' : 'Pilih tanggal lain atau lengkapi jadwal mengajar.'}</p>
          <button className="quiet-button" onClick={() => navigateTo({ view: 'setup', section: 'schedules' })}>Atur jadwal</button>
        </section>}
        <section aria-labelledby="daily-agenda">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="daily-agenda" className="text-lg font-semibold">Agenda mengajar</h2><span className="text-sm text-text2">{completed.length}/{items.length} tercatat</span></div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {pending.map(item => {
              const position = getTeachingPosition(item.classId, item.subjectId);
              const note = getNextMeetingNote(item.classId, item.subjectId);
              const lastPage = getLastPageReached(item.classId, item.subjectId);
              const plan = splitSessionNote(note.text);
              return (
              <div key={item.id} className="flex flex-col gap-2.5 p-3 sm:p-4 hover:bg-surface2/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-wider text-primary mb-1 tabular-nums">{item.startTime}–{item.endTime}</p>
                    <p className="text-base font-bold text-foreground leading-snug">{item.className} <span className="text-text3 mx-1 font-normal">•</span> {item.subjectName}</p>
                    <div className="text-sm text-text2 mt-1 font-semibold flex items-center">
                      {item.active ? <span className="inline-flex items-center gap-1.5 text-primary"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Sedang berlangsung</span> : date < clock || (date === clock && timeToMin(item.endTime) <= currentMin()) ? 'Menunggu dicatat' : 'Terjadwal'}
                    </div>
                  </div>
                  <button className="primary-button shrink-0 text-sm px-4 min-h-[44px] shadow-sm active:scale-95 transition-all" disabled={date > clock} onClick={() => setSelected(item)}>Catat hasil</button>
                </div>
                
                <div className="mt-1 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <BookOpen size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="text-sm">
                      <p className="font-bold text-foreground">{position.material?.name || 'Materi belum diatur / sudah selesai'}</p>
                      {(position.material || lastPage) && (
                        <p className="text-text2 text-xs mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {position.material && <span>Sesi {position.sessionIndex}/{position.totalSessionsInMaterial}</span>}
                          {position.material && lastPage && <span className="opacity-30">•</span>}
                          {lastPage && <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">Mulai hal. {getNextStartPage(lastPage).nextPage}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {note.text && (
                    <div className="bg-surface/80 rounded-xl px-4 py-3 border border-border/80 border-l-2 border-l-primary/60 shadow-sm">
                      {plan.mainNote && <p className="text-sm italic text-foreground leading-relaxed font-medium">"{plan.mainNote}"</p>}
                      {plan.reminder && <p className="text-xs text-amber font-bold mt-2 flex items-start gap-2"><Pin size={14} className="shrink-0 mt-0.5" /> <span>{plan.reminder}</span></p>}
                    </div>
                  )}
                </div>
              </div>
            )})}
            {!pending.length && <p className="p-4 text-sm text-text2">Tidak ada sesi yang menunggu pencatatan pada tanggal ini.</p>}
          </div>
          <button className="quiet-button mt-3" onClick={() => setReschedule(true)}>Sesuaikan jadwal</button>
          <details className="mt-3 rounded-xl border border-border p-3">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Aksi hari ini</summary>
            <p className="mb-2 text-sm text-text2">Berlaku untuk {date}.</p>
            <div className="flex flex-wrap gap-2">
              <button className="quiet-button" onClick={() => { setActionError(''); setDismiss({ kind: 'early', subjectId: '', classId: '', time: '10:00' }); }}>Pulang Awal</button>
              <button className="quiet-button" onClick={() => { setActionError(''); setDismiss({ kind: 'subject', subjectId: pending[0]?.subjectId || '', classId: '', time: '' }); }}>Libur Mapel</button>
            </div>
          </details>
        </section>
        {!!missing.length && <section className="work-panel space-y-3" aria-labelledby="missing-kbm">
          <h2 id="missing-kbm" className="text-lg font-semibold">KBM kemarin belum tercatat</h2>
          {missing.map(item => <div key={item.schedule.id} className="border-t border-border pt-3">
            <p className="font-semibold">{item.className} · {item.subjectName}</p><p className="text-sm text-text2">{item.date} · {item.schedule.startTime}</p>
            <div className="mt-2 flex flex-wrap gap-2"><button className="quiet-button" onClick={() => {
              const schedule = getTodaySchedules(item.date, true).find(s => s.id === item.schedule.id);
              if (schedule) { changeDate(item.date); setSelected(schedule); }
            }}>Catat KBM kemarin</button><button className="quiet-button" onClick={() => {
              try { skipSessionForDate(item.schedule.id, item.date); onRefresh(); }
              catch { toast({ title: 'Belum tersimpan. Coba lagi.', variant: 'destructive' }); }
            }}>Tidak terlaksana</button></div>
          </div>)}
        </section>}
        <section className="work-panel space-y-3" aria-labelledby="task-inbox">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="task-inbox" className="text-lg font-semibold">Inbox Tugas ({pendingTasks.length})</h2><button className="quiet-button" disabled={!data.classes.length || !data.subjects.length} onClick={() => { setActionError(''); setTaskDraft({ classId: focus?.classId || data.classes[0]?.id || '', subjectId: focus?.subjectId || data.subjects[0]?.id || '', title: '' }); }}>Tambah Tugas</button></div>
          {pendingTasks.map(task => <div key={task.id} className="flex items-start gap-3 border-t border-border pt-3">
            <button className="quiet-button shrink-0" aria-label={`Tandai tugas ${task.title} selesai`} onClick={() => {
              try { toggleTask(task.id); onRefresh(); }
              catch { toast({ title: 'Tugas belum tersimpan. Coba lagi.', variant: 'destructive' }); }
            }}><Check size={18} /></button>
            <div className="min-w-0"><p className="break-words font-semibold">{getTaskDisplayTitle(task.title)}</p><p className="text-sm text-text2">{data.classes.find(c => c.id === task.classId)?.name} · {data.subjects.find(s => s.id === task.subjectId)?.name} · {isAutoPaceTask(task.title) ? `Tinjau sebelum: ${formatTaskDeadline(task.deadline)}` : `Batas tindak lanjut: ${formatTaskDeadline(task.deadline)}`}</p></div>
          </div>)}
          {!pendingTasks.length && <p className="text-sm text-text2">Tidak ada tugas yang menunggu.</p>}
        </section>
        {!!(exams.length + proctors.length) && <section className="work-panel space-y-3"><h2 className="text-lg font-semibold">Ujian & pengawasan</h2>
          {exams.map(exam => <button key={exam.id} className="flex w-full items-center justify-between gap-3 border-t border-border py-3 text-left" onClick={() => navigateTo({ view: 'exam', section: 'agenda' })}><span><span className="block text-sm text-text2">Ujian · {exam.startTime}–{exam.endTime}</span>{exam.subjectName || data.subjects.find(s => s.id === exam.subjectId)?.name} · {exam.customClassName || data.classes.find(c => c.id === exam.classId)?.name}</span><ArrowRight size={18} /></button>)}
          {proctors.map(exam => <p key={exam.id} className="border-t border-border pt-3"><span className="block text-sm text-text2">Pengawasan · {exam.startTime}–{exam.endTime}</span>{exam.subjectName} · {exam.customClassName || data.classes.find(c => c.id === exam.classId)?.name}</p>)}
        </section>}
        {!!completed.length && <section><button className="quiet-button w-full justify-between" aria-expanded={showCompleted} onClick={() => setShowCompleted(v => !v)}>Sesi tercatat ({completed.length}) <Check size={18} /></button>
          {showCompleted && completed.map(item => <div key={item.id} className="mt-2 rounded-xl border border-border p-3"><p className="text-sm font-semibold">{item.className} · {item.subjectName}</p><p className="text-xs text-text2">{item.skipped ? 'Tidak terlaksana' : 'Sudah mengajar'}</p>{item.note && <p className="mt-1.5 whitespace-pre-wrap text-[13px]">{[splitSessionNote(item.note).mainNote, splitSessionNote(item.note).reminder].filter(Boolean).join('\n')}</p>}<button className="quiet-button mt-1 text-xs" onClick={() => navigateTo({ view: 'progress', classId: item.classId, subjectId: item.subjectId, section: 'history', date })}>Lihat / koreksi riwayat</button></div>)}
        </section>}
      </div>
      <aside className="min-w-0"><AssistantPanel key={`${refreshKey}-${clock}`} onNavigate={target => navigateTo(target)} /></aside>
    </div>
    {selected && <RecordSession key={`${date}-${selected.id}`} item={selected} date={date} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); onRefresh(); }} />}
    {reschedule && <Suspense fallback={<p>Memuat penyesuaian jadwal…</p>}><SmartRescheduler open onOpenChange={setReschedule} dateStr={date} onSuccess={onRefresh} /></Suspense>}
    {taskDraft && <Dialog open onOpenChange={open => !open && setTaskDraft(null)}><DialogContent>
      <DialogTitle>Tugas Baru</DialogTitle><DialogDescription>Batas tugas otomatis 7 hari ke depan.</DialogDescription>
      <form className="space-y-4" onSubmit={event => {
        event.preventDefault();
        if (!taskDraft.title.trim()) return;
        try {
          const deadline = new Date(); deadline.setDate(deadline.getDate() + 7);
          addTask(taskDraft.classId, taskDraft.subjectId, taskDraft.title.trim(), dateKey(deadline));
          setTaskDraft(null); onRefresh();
        } catch { setActionError('Tugas belum tersimpan. Isian tetap tersedia.'); }
      }}>
        <label className="block">Kelas tugas<select required className="workspace-input mt-1" value={taskDraft.classId} onChange={e => setTaskDraft({ ...taskDraft, classId: e.target.value })}>{data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block">Mapel tugas<select required className="workspace-input mt-1" value={taskDraft.subjectId} onChange={e => setTaskDraft({ ...taskDraft, subjectId: e.target.value })}>{data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block">Nama tugas<input required className="workspace-input mt-1" value={taskDraft.title} onChange={e => setTaskDraft({ ...taskDraft, title: e.target.value })} /></label>
        {actionError && <p role="alert" className="text-red">{actionError}</p>}
        <div className="flex gap-3"><button type="button" className="quiet-button" onClick={() => setTaskDraft(null)}>Batal</button><button className="primary-button flex-1">Simpan tugas</button></div>
      </form>
    </DialogContent></Dialog>}
    {dismiss && <Dialog open onOpenChange={open => !open && setDismiss(null)}><DialogContent>
      <DialogTitle>{dismiss.kind === 'early' ? 'Pulang Awal' : 'Libur Mapel'}</DialogTitle><DialogDescription>{dismiss.kind === 'early' ? `Coret jadwal mulai ${dismiss.time} pada ${date} tanpa menambah progres materi.` : `Coret seluruh jadwal mapel terpilih pada ${date} tanpa menambah progres materi.`}</DialogDescription>
      <form className="space-y-4" onSubmit={event => {
        event.preventDefault();
        try {
          const count = dismiss.kind === 'early' ? applyEarlyDismissal(date, dismiss.time) : applySubjectDismissal(date, dismiss.subjectId, undefined, dismiss.classId || undefined);
          setDismiss(null); onRefresh(); toast({ title: `${count} jadwal diliburkan` });
        } catch { setActionError('Perubahan belum tersimpan. Coba lagi.'); }
      }}>
        {dismiss.kind === 'subject' && <>
          <label className="block">Mapel yang diliburkan<select required className="workspace-input mt-1" value={dismiss.subjectId} onChange={e => setDismiss({ ...dismiss, subjectId: e.target.value, classId: '' })}><option value="">Pilih mapel</option>{data.subjects.filter(s => pending.some(item => item.subjectId === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="block">Kelas yang diliburkan<select className="workspace-input mt-1" value={dismiss.classId} onChange={e => setDismiss({ ...dismiss, classId: e.target.value })}><option value="">Semua kelas untuk mapel ini</option>{data.classes.filter(c => pending.some(item => item.classId === c.id && item.subjectId === dismiss.subjectId)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </>}
        {dismiss.kind === 'early' && <label className="block">Mulai libur dari jam<input required type="time" className="workspace-input mt-1" value={dismiss.time} onChange={e => setDismiss({ ...dismiss, time: e.target.value })} /></label>}
        {actionError && <p role="alert" className="text-red">{actionError}</p>}
        <div className="flex gap-3"><button type="button" className="quiet-button" onClick={() => setDismiss(null)}>Batal</button><button className="primary-button flex-1">Terapkan</button></div>
      </form>
    </DialogContent></Dialog>}
  </div>;
}

function LiveActiveSession({ 
  startTime, 
  endTime, 
  onRefresh,
  children 
}: { 
  startTime: string, 
  endTime: string, 
  onRefresh: () => void,
  children: (diffSec: number, isOvertime: boolean) => JSX.Element 
}) {
  const [nowMs, setNowMs] = useState(Date.now());
  
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const now = new Date(nowMs);
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  
  const endSec = timeToMin(endTime) * 60;
  const diffSec = Math.max(0, endSec - nowSec);
  const isOvertime = diffSec === 0;

  useEffect(() => {
    if (isOvertime) {
      const timer = setTimeout(() => onRefresh(), 500);
      return () => clearTimeout(timer);
    }
  }, [isOvertime, onRefresh]);

  return <>{children(diffSec, isOvertime)}</>;
}

function FocusSession({ item, date, onRecord, onRefresh }: { item: TodayScheduleItem; date: string; onRecord: () => void; onRefresh: () => void }) {
  const position = getTeachingPosition(item.classId, item.subjectId);
  const note = getNextMeetingNote(item.classId, item.subjectId);
  const lastPage = getLastPageReached(item.classId, item.subjectId);
  const plan = splitSessionNote(note.text);

  const renderContent = (diffSec: number | null, isOvertime: boolean | null) => (
    <section className={`work-panel daily-focus-hero space-y-4 p-4 sm:p-5 transition-all shadow-sm ${isOvertime ? 'bg-red/5 border-red/30 ring-1 ring-red/20' : 'border-primary/40 bg-primary/5 hover:shadow-md'}`} aria-labelledby="focus-class">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full uppercase tracking-widest text-[11px] ${isOvertime ? 'bg-red/10 text-red' : item.active ? 'bg-primary/10 text-primary' : 'bg-surface2 text-text3'}`}>
          {item.active ? (
            isOvertime ? (
              <><Zap className="w-3 h-3" /> Waktu Habis</>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Sedang Berlangsung</>
            )
          ) : (
            'Berikutnya / belum dicatat'
          )}
        </span>
        <div className="flex items-center gap-2">
          {item.active && diffSec !== null && (
            <span className={`tabular-nums px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 border ${isOvertime ? 'text-red bg-red/10 border-red/20' : 'text-primary bg-primary/10 border-primary/20'}`}>
              {isOvertime ? <Clock className="w-3.5 h-3.5" /> : <Timer className="w-3.5 h-3.5" />}
              {isOvertime ? '0m' : diffSec < 60 ? `${diffSec} detik` : `${Math.floor(diffSec / 60)} menit`}
            </span>
          )}
          <span className="tabular-nums text-text2 bg-surface/80 px-2.5 py-1 rounded-full text-xs border border-border/50">{item.startTime}–{item.endTime}</span>
        </div>
      </div>
      <h2 id="focus-class" className="text-2xl font-black tracking-tight text-foreground">{item.className} <span className="text-text3 mx-1 font-normal">•</span> {item.subjectName}</h2>
      <div className="bg-surface/80 rounded-2xl p-4 border border-border/60">
        <p className="flex items-start gap-3 text-base font-bold text-foreground">
          <BookOpen size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          {position.material?.name || 'Materi belum diatur / sudah selesai'}
        </p>
        {(position.material || lastPage) && (
          <div className="mt-2.5 ml-8 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-text2 font-medium">
            {position.material && <span className="bg-surface2 px-2.5 py-1 rounded-md border border-border/50">Sesi {position.sessionIndex} dari {position.totalSessionsInMaterial}</span>}
            {lastPage && <span className="text-primary bg-primary/10 px-2.5 py-1 rounded-md font-bold">Lanjut hal. {getNextStartPage(lastPage).nextPage}</span>}
          </div>
        )}
      </div>
      {note.text && (
        <div className="rounded-2xl bg-surface/90 p-4 border border-border/80 shadow-sm border-l-2 border-l-primary">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text2 flex items-center gap-1.5">
            {note.legacy ? 'Referensi catatan lama' : 'Catatan Pertemuan Berikutnya'}
          </p>
          {plan.mainNote && <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground font-medium">"{plan.mainNote}"</p>}
          {plan.reminder && <p className="mt-3 whitespace-pre-wrap text-sm font-bold text-amber flex gap-2.5 items-start"><Pin size={16} className="shrink-0 mt-0.5" /> <span className="mt-0.5">{plan.reminder}</span></p>}
        </div>
      )}
      <button className={`w-full text-base min-h-[48px] rounded-xl font-bold shadow-sm active:scale-[0.98] transition-transform ${isOvertime ? 'bg-red text-white hover:bg-red/90' : 'primary-button'}`} disabled={date > dateKey()} onClick={onRecord}>
        {isOvertime ? 'Selesai (Kelebihan Waktu)' : 'Tandai Selesai & Catat Hasil'}
      </button>
    </section>
  );

  if (item.active && date === dateKey()) {
    return (
      <LiveActiveSession startTime={item.startTime} endTime={item.endTime} onRefresh={onRefresh}>
        {(diffSec, isOvertime) => renderContent(diffSec, isOvertime)}
      </LiveActiveSession>
    );
  }

  return renderContent(null, null);
}

function RecordSession({ item, date, onClose, onSaved }: { item: TodayScheduleItem; date: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const draftKey = `edutrack_record_v1:${date}:${item.id}`;
  const [draft, setDraft] = useState(() => {
    const plan = splitSessionNote(date === dateKey() ? getNextMeetingNote(item.classId, item.subjectId).text : '');
    const initialMaterialId = getTeachingPosition(item.classId, item.subjectId).material?.id || '';
    const fallback = { outcome: 'taught', materials: [{ id: initialMaterialId, completed: false }], note: '', nextNote: plan.mainNote, supportingNote: plan.reminder, page: '' };
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (!saved || typeof saved.note !== 'string' || typeof saved.nextNote !== 'string' || typeof saved.page !== 'string' || !['taught', 'skipped'].includes(saved.outcome)) return fallback;
      const savedPlan = splitSessionNote(saved.nextNote);
      
      let materials = saved.materials;
      if (!Array.isArray(materials)) {
        if (typeof saved.materialId === 'string') {
          materials = [{ id: saved.materialId, completed: !!saved.completed }];
        } else {
          materials = fallback.materials;
        }
      }
      return { ...fallback, ...saved, materials, nextNote: savedPlan.mainNote, supportingNote: typeof saved.supportingNote === 'string' ? saved.supportingNote : savedPlan.reminder };
    } catch { return fallback; }
  });
  const [error, setError] = useState('');
  const saving = useRef(false);
  const [draftFailed, setDraftFailed] = useState(false);
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify(draft)); setDraftFailed(false); } catch { setDraftFailed(true); } }, [draft, draftKey]);
  const update = (field: keyof typeof draft, value: any) => setDraft(previous => ({ ...previous, [field]: value }));
  const save = (event: React.FormEvent) => {
    event.preventDefault(); if (saving.current) return; saving.current = true;
    try {
      const plan = composeSessionNote(draft.nextNote, draft.supportingNote);
      const materialsToPass = draft.outcome === 'skipped' ? [] : draft.materials;
      const ok = recordTeachingSession(item.id, date, materialsToPass, false, draft.note.trim() || plan, draft.outcome === 'taught' ? draft.page : undefined, plan, draft.outcome === 'skipped');
      if (!ok) { setError('Sesi sudah tercatat atau jadwal berubah. Tutup formulir dan periksa agenda.'); return; }
      try { localStorage.removeItem(draftKey); } catch { /* Session has already been saved. */ }
      toast({ title: 'Tersimpan di perangkat', description: 'Agenda dan progres kelas diperbarui.' }); onSaved();
    } catch { setError('Belum tersimpan. Periksa ruang penyimpanan perangkat lalu coba lagi; isian tetap tersedia.'); }
    finally { saving.current = false; }
  };
  return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl">
    <DialogTitle>Catat hasil</DialogTitle><DialogDescription>{item.className} · {item.subjectName} · {date}</DialogDescription>
    <form onSubmit={save} className="space-y-4">
      <label className="block">Hasil pertemuan<select className="workspace-input mt-1" value={draft.outcome} onChange={e => update('outcome', e.target.value)}><option value="taught">Sudah mengajar</option><option value="skipped">Tidak terlaksana</option></select></label>
      {draft.outcome === 'taught' && (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <p className="font-semibold text-sm">Materi yang diajarkan</p>
          {draft.materials.map((mat: { id: string; completed: boolean }, index: number) => (
            <div key={index} className="space-y-2 border-b border-border/50 pb-4 last:border-0 last:pb-0">
              <select className="workspace-input" value={mat.id} onChange={e => {
                const newMats = [...draft.materials];
                newMats[index].id = e.target.value;
                update('materials', newMats);
              }}>
                <option value="">Tanpa materi terpilih</option>
                {getMaterials(item.subjectId, item.classId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <div className="flex items-center justify-between">
                <label className="flex min-h-[44px] items-center gap-3">
                  <input type="checkbox" checked={mat.completed} onChange={e => {
                    const newMats = [...draft.materials];
                    newMats[index].completed = e.target.checked;
                    update('materials', newMats);
                  }} />
                  Bab ini selesai
                </label>
                {draft.materials.length > 1 && (
                  <button type="button" className="text-sm font-medium text-red-500 underline min-h-[44px] px-2" onClick={() => {
                    update('materials', draft.materials.filter((_, i) => i !== index));
                  }}>Hapus</button>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="quiet-button w-full border border-dashed border-border2 text-sm" onClick={() => {
            update('materials', [...draft.materials, { id: '', completed: false }]);
          }}>+ Tambah materi lain</button>
        </div>
      )}
      <label className="block">Materi selanjutnya <span className="text-sm text-text2">(opsional)</span><textarea className="workspace-input mt-1" rows={2} value={draft.nextNote} onChange={e => update('nextNote', e.target.value)} /></label>
      {draft.outcome === 'taught' && <label className="block">Pertemuan selanjutnya hal. <span className="text-sm text-text2">(opsional)</span><input type="number" className="workspace-input mt-1 max-w-[120px]" value={draft.page} onChange={e => update('page', e.target.value)} />{draft.page && <span className="mt-1 block text-sm text-text2">Mulai hal. {getNextStartPage(draft.page).nextPage}</span>}</label>}
      <label className="block">Informasi selain materi <span className="text-sm text-text2">(opsional)</span><textarea className="workspace-input mt-1" rows={2} value={draft.supportingNote} onChange={e => update('supportingNote', e.target.value)} /></label>
      {draft.note && <p className="whitespace-pre-wrap text-sm text-text2">Catatan draft lama tetap disimpan: {draft.note}</p>}
      <p className="text-sm text-text2">{draftFailed ? 'Draft belum bisa disimpan di perangkat. Tetap buka formulir ini sampai berhasil menyimpan.' : 'Isian disimpan sebagai draft jika formulir ditutup.'}</p>
      {error && <p role="alert" className="text-red-500 font-medium">{error}</p>}
      <div className="flex gap-3"><button type="button" className="quiet-button" onClick={onClose}>Tutup</button><button className="primary-button flex-1" type="submit">Simpan</button></div>
    </form>
  </DialogContent></Dialog>;
}
