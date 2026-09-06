import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { addTask, toggleTask, applyEarlyDismissal, applySubjectDismissal, skipSessionForDate, composeSessionNote, splitSessionNote, dateFromKey, dateKey, getData, getLastPageReached, getNextStartPage, getMaterials, getNextMeetingNote, getTeachingPosition, getTodaySchedules, recordTeachingSession, getTaskDisplayTitle, formatTaskDeadline, shouldShowTaskInInbox } from '@/lib/data';
import { getMissingTeachingSessions } from '@/lib/dataPublic';
import { getExamDayMode, getExamSchedules, getProctorSessions } from '@/lib/examData';
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
  const [dismiss, setDismiss] = useState<{ kind: 'early' | 'subject'; subjectId: string; classId: string; time: string; useTime: boolean } | null>(null);
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
  const proctors = getProctorSessions().filter(exam => exam.date === date);
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
        {focus ? <FocusSession item={focus} date={date} onRecord={() => setSelected(focus)} /> : <section className="work-panel space-y-3">
          <CalendarDays className="text-primary" aria-hidden="true" />
          <h2 className="text-xl font-semibold">{completed.length ? 'Agenda mengajar sudah tercatat' : 'Tidak ada jadwal mengajar'}</h2>
          <p className="text-text2">{completed.length ? 'Hasilnya sudah masuk ke progres kelas.' : 'Pilih tanggal lain atau lengkapi jadwal mengajar.'}</p>
          <button className="quiet-button" onClick={() => navigateTo({ view: 'setup', section: 'schedules' })}>Atur jadwal</button>
        </section>}
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
        <section aria-labelledby="daily-agenda">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="daily-agenda" className="text-lg font-semibold">Agenda mengajar</h2><span className="text-sm text-text2">{completed.length}/{items.length} tercatat</span></div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {pending.map(item => <div key={item.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="text-sm tabular-nums text-text2">{item.startTime}–{item.endTime}</p><p className="font-semibold">{item.className} · {item.subjectName}</p><p className="text-sm text-text2">{item.active ? 'Sedang berlangsung' : date <= clock ? 'Belum dicatat' : 'Terjadwal'}</p></div>
              <button className="quiet-button shrink-0" disabled={date > clock} onClick={() => setSelected(item)}>Catat hasil</button>
            </div>)}
            {!pending.length && <p className="p-4 text-sm text-text2">Tidak ada sesi yang menunggu pencatatan pada tanggal ini.</p>}
          </div>
          <button className="quiet-button mt-3" onClick={() => setReschedule(true)}>Sesuaikan jadwal</button>
          <details className="mt-3 rounded-xl border border-border p-3">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Aksi hari ini</summary>
            <p className="mb-2 text-sm text-text2">Berlaku untuk {date}.</p>
            <div className="flex flex-wrap gap-2">
              <button className="quiet-button" onClick={() => { setActionError(''); setDismiss({ kind: 'early', subjectId: '', classId: '', time: '10:00', useTime: true }); }}>Pulang Awal</button>
              <button className="quiet-button" onClick={() => { setActionError(''); setDismiss({ kind: 'subject', subjectId: pending[0]?.subjectId || '', classId: '', time: '11:20', useTime: true }); }}>Libur Mapel</button>
            </div>
          </details>
        </section>
        <section className="work-panel space-y-3" aria-labelledby="task-inbox">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="task-inbox" className="text-lg font-semibold">Inbox Tugas ({pendingTasks.length})</h2><button className="quiet-button" disabled={!data.classes.length || !data.subjects.length} onClick={() => { setActionError(''); setTaskDraft({ classId: focus?.classId || data.classes[0]?.id || '', subjectId: focus?.subjectId || data.subjects[0]?.id || '', title: '' }); }}>Tambah Tugas</button></div>
          {pendingTasks.map(task => <div key={task.id} className="flex items-start gap-3 border-t border-border pt-3">
            <button className="quiet-button shrink-0" aria-label={`Tandai tugas ${task.title} selesai`} onClick={() => {
              try { toggleTask(task.id); onRefresh(); }
              catch { toast({ title: 'Tugas belum tersimpan. Coba lagi.', variant: 'destructive' }); }
            }}><Check size={18} /></button>
            <div className="min-w-0"><p className="break-words font-semibold">{getTaskDisplayTitle(task.title)}</p><p className="text-sm text-text2">{data.classes.find(c => c.id === task.classId)?.name} · {data.subjects.find(s => s.id === task.subjectId)?.name} · Jadwalkan: {formatTaskDeadline(task.deadline)}</p></div>
          </div>)}
          {!pendingTasks.length && <p className="text-sm text-text2">Tidak ada tugas yang menunggu.</p>}
        </section>
        {!!(exams.length + proctors.length) && <section className="work-panel space-y-3"><h2 className="text-lg font-semibold">Ujian & pengawasan</h2>
          {exams.map(exam => <button key={exam.id} className="flex w-full items-center justify-between gap-3 border-t border-border py-3 text-left" onClick={() => navigateTo({ view: 'exam', section: 'agenda' })}><span><span className="block text-sm text-text2">Ujian · {exam.startTime}–{exam.endTime}</span>{data.subjects.find(s => s.id === exam.subjectId)?.name} · {data.classes.find(c => c.id === exam.classId)?.name}</span><ArrowRight size={18} /></button>)}
          {proctors.map(exam => <p key={exam.id} className="border-t border-border pt-3"><span className="block text-sm text-text2">Pengawasan · {exam.startTime}–{exam.endTime}</span>{exam.subjectName}</p>)}
        </section>}
        {!!completed.length && <section><button className="quiet-button w-full justify-between" aria-expanded={showCompleted} onClick={() => setShowCompleted(v => !v)}>Sesi tercatat ({completed.length}) <Check size={18} /></button>
          {showCompleted && completed.map(item => <div key={item.id} className="mt-3 rounded-xl border border-border p-4"><p className="font-semibold">{item.className} · {item.subjectName}</p><p className="text-sm text-text2">{item.skipped ? 'Tidak terlaksana' : 'Sudah mengajar'}</p>{item.note && <p className="mt-2 whitespace-pre-wrap text-sm">{[splitSessionNote(item.note).mainNote, splitSessionNote(item.note).reminder].filter(Boolean).join('\n')}</p>}<button className="quiet-button mt-2" onClick={() => navigateTo({ view: 'progress', classId: item.classId, subjectId: item.subjectId, section: 'history', date })}>Lihat / koreksi riwayat</button></div>)}
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
      <DialogTitle>{dismiss.kind === 'early' ? 'Pulang Awal' : 'Libur Mapel'}</DialogTitle><DialogDescription>Coret jadwal pada {date} tanpa menambah progres materi.</DialogDescription>
      <form className="space-y-4" onSubmit={event => {
        event.preventDefault();
        try {
          const count = dismiss.kind === 'early' ? applyEarlyDismissal(date, dismiss.time) : applySubjectDismissal(date, dismiss.subjectId, dismiss.useTime ? dismiss.time : undefined, dismiss.classId || undefined);
          setDismiss(null); onRefresh(); toast({ title: `${count} jadwal diliburkan` });
        } catch { setActionError('Perubahan belum tersimpan. Coba lagi.'); }
      }}>
        {dismiss.kind === 'subject' && <>
          <label className="block">Mapel yang diliburkan<select required className="workspace-input mt-1" value={dismiss.subjectId} onChange={e => setDismiss({ ...dismiss, subjectId: e.target.value, classId: '' })}><option value="">Pilih mapel</option>{data.subjects.filter(s => pending.some(item => item.subjectId === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="block">Kelas yang diliburkan<select className="workspace-input mt-1" value={dismiss.classId} onChange={e => setDismiss({ ...dismiss, classId: e.target.value })}><option value="">Semua kelas untuk mapel ini</option>{data.classes.filter(c => pending.some(item => item.classId === c.id && item.subjectId === dismiss.subjectId)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={dismiss.useTime} onChange={e => setDismiss({ ...dismiss, useTime: e.target.checked })} />Hanya jadwal mulai setelah jam tertentu</label>
        </>}
        {dismiss.useTime && <label className="block">Mulai libur dari jam<input required type="time" className="workspace-input mt-1" value={dismiss.time} onChange={e => setDismiss({ ...dismiss, time: e.target.value })} /></label>}
        {actionError && <p role="alert" className="text-red">{actionError}</p>}
        <div className="flex gap-3"><button type="button" className="quiet-button" onClick={() => setDismiss(null)}>Batal</button><button className="primary-button flex-1">Terapkan</button></div>
      </form>
    </DialogContent></Dialog>}
  </div>;
}

function FocusSession({ item, date, onRecord }: { item: TodayScheduleItem; date: string; onRecord: () => void }) {
  const position = getTeachingPosition(item.classId, item.subjectId);
  const note = getNextMeetingNote(item.classId, item.subjectId);
  const lastPage = getLastPageReached(item.classId, item.subjectId);
  const plan = splitSessionNote(note.text);
  return <section className="work-panel daily-focus-hero space-y-3 border-primary/30" aria-labelledby="focus-class">
    <div className="flex flex-wrap justify-between gap-2 text-sm text-text2"><span>{item.active ? 'Sekarang' : 'Berikutnya / belum dicatat'}</span><span className="tabular-nums">{item.startTime}–{item.endTime}</span></div>
    <h2 id="focus-class" className="text-xl font-semibold">{item.className} · {item.subjectName}</h2>
    <div><p className="flex items-start gap-2"><BookOpen size={18} className="mt-1 shrink-0 text-primary" aria-hidden="true" />{position.material?.name || 'Materi belum diatur / sudah selesai'}</p><p className="mt-1 text-sm text-text2">{position.material && `Pertemuan ${position.sessionIndex} dari ${position.totalSessionsInMaterial}`}{lastPage && ` · Pertemuan selanjutnya hal. ${getNextStartPage(lastPage).nextPage}`}</p></div>
    {note.text && <div className="rounded-xl bg-surface2 p-3"><p className="mb-1 text-sm font-semibold">{note.legacy ? 'Referensi catatan lama' : 'Untuk pertemuan berikutnya'}</p>{plan.mainNote && <p className="whitespace-pre-wrap">{plan.mainNote}</p>}{plan.reminder && <p className="mt-2 whitespace-pre-wrap text-sm text-text2">Informasi selain materi: {plan.reminder}</p>}</div>}
    <button className="primary-button w-full" disabled={date > dateKey()} onClick={onRecord}>Catat hasil</button>
  </section>;
}

function RecordSession({ item, date, onClose, onSaved }: { item: TodayScheduleItem; date: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const draftKey = `edutrack_record_v1:${date}:${item.id}`;
  const [draft, setDraft] = useState(() => {
    const plan = splitSessionNote(date === dateKey() ? getNextMeetingNote(item.classId, item.subjectId).text : '');
    const fallback = { outcome: 'taught', materialId: getTeachingPosition(item.classId, item.subjectId).material?.id || '', completed: false, note: '', nextNote: plan.mainNote, supportingNote: plan.reminder, page: '' };
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (!saved || typeof saved.note !== 'string' || typeof saved.nextNote !== 'string' || typeof saved.page !== 'string' || typeof saved.materialId !== 'string' || typeof saved.completed !== 'boolean' || !['taught', 'skipped'].includes(saved.outcome)) return fallback;
      const savedPlan = splitSessionNote(saved.nextNote);
      return { ...fallback, ...saved, nextNote: savedPlan.mainNote, supportingNote: typeof saved.supportingNote === 'string' ? saved.supportingNote : savedPlan.reminder };
    } catch { return fallback; }
  });
  const [error, setError] = useState('');
  const saving = useRef(false);
  const [draftFailed, setDraftFailed] = useState(false);
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify(draft)); setDraftFailed(false); } catch { setDraftFailed(true); } }, [draft, draftKey]);
  const update = (field: keyof typeof draft, value: string | boolean) => setDraft(previous => ({ ...previous, [field]: value }));
  const save = (event: React.FormEvent) => {
    event.preventDefault(); if (saving.current) return; saving.current = true;
    try {
      const plan = composeSessionNote(draft.nextNote, draft.supportingNote);
      // Preserve a pre-stabilization draft's event note instead of silently replacing it.
      const ok = recordTeachingSession(item.id, date, draft.materialId || null, draft.completed, draft.note.trim() || plan, draft.outcome === 'taught' ? draft.page : undefined, plan, draft.outcome === 'skipped');
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
      {draft.outcome === 'taught' && <><label className="block">Materi<select className="workspace-input mt-1" value={draft.materialId} onChange={e => update('materialId', e.target.value)}><option value="">Tanpa materi terpilih</option>{getMaterials(item.subjectId, item.classId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={draft.completed} onChange={e => update('completed', e.target.checked)} />Bab ini selesai</label>
      </>}
      <label className="block">Materi selanjutnya <span className="text-sm text-text2">(opsional)</span><textarea className="workspace-input mt-1" rows={2} value={draft.nextNote} onChange={e => update('nextNote', e.target.value)} /></label>
      {draft.outcome === 'taught' && <label className="block">Pertemuan selanjutnya hal. <span className="text-sm text-text2">(opsional)</span><input className="workspace-input mt-1" value={draft.page} onChange={e => update('page', e.target.value)} />{draft.page && <span className="mt-1 block text-sm text-text2">Mulai hal. {getNextStartPage(draft.page).nextPage}</span>}</label>}
      <label className="block">Informasi selain materi <span className="text-sm text-text2">(opsional)</span><textarea className="workspace-input mt-1" rows={2} value={draft.supportingNote} onChange={e => update('supportingNote', e.target.value)} /></label>
      {draft.note && <p className="whitespace-pre-wrap text-sm text-text2">Catatan draft lama tetap disimpan: {draft.note}</p>}
      <p className="text-sm text-text2">{draftFailed ? 'Draft belum bisa disimpan di perangkat. Tetap buka formulir ini sampai berhasil menyimpan.' : 'Isian disimpan sebagai draft jika formulir ditutup.'}</p>
      {error && <p role="alert" className="text-red">{error}</p>}
      <div className="flex gap-3"><button type="button" className="quiet-button" onClick={onClose}>Tutup</button><button className="primary-button flex-1" type="submit">Simpan</button></div>
    </form>
  </DialogContent></Dialog>;
}
