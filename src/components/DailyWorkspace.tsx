import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateFromKey, dateKey, getData, getMaterials, getNextMeetingNote, getTeachingPosition, getTodaySchedules, recordTeachingSession, now } from '@/lib/data';
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
        </section>
        {!!(exams.length + proctors.length) && <section className="work-panel space-y-3"><h2 className="text-lg font-semibold">Ujian & pengawasan</h2>
          {exams.map(exam => <button key={exam.id} className="flex w-full items-center justify-between gap-3 border-t border-border py-3 text-left" onClick={() => navigateTo({ view: 'exam', section: 'agenda' })}><span><span className="block text-sm text-text2">Ujian · {exam.startTime}–{exam.endTime}</span>{data.subjects.find(s => s.id === exam.subjectId)?.name} · {data.classes.find(c => c.id === exam.classId)?.name}</span><ArrowRight size={18} /></button>)}
          {proctors.map(exam => <p key={exam.id} className="border-t border-border pt-3"><span className="block text-sm text-text2">Pengawasan · {exam.startTime}–{exam.endTime}</span>{exam.subjectName}</p>)}
        </section>}
        {!!completed.length && <section><button className="quiet-button w-full justify-between" aria-expanded={showCompleted} onClick={() => setShowCompleted(v => !v)}>Sesi tercatat ({completed.length}) <Check size={18} /></button>
          {showCompleted && completed.map(item => <div key={item.id} className="mt-3 rounded-xl border border-border p-4"><p className="font-semibold">{item.className} · {item.subjectName}</p><p className="text-sm text-text2">{item.skipped ? 'Tidak terlaksana' : 'Sudah mengajar'}</p>{item.note && <p className="mt-2 whitespace-pre-wrap text-sm">{item.note}</p>}<button className="quiet-button mt-2" onClick={() => navigateTo({ view: 'progress', classId: item.classId, subjectId: item.subjectId, section: 'history', date })}>Lihat / koreksi riwayat</button></div>)}
        </section>}
      </div>
      <aside className="min-w-0"><AssistantPanel key={`${refreshKey}-${clock}`} onNavigate={target => navigateTo(target)} /></aside>
    </div>
    {selected && <RecordSession key={`${date}-${selected.id}`} item={selected} date={date} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); onRefresh(); }} />}
    {reschedule && <Suspense fallback={<p>Memuat penyesuaian jadwal…</p>}><SmartRescheduler open onOpenChange={setReschedule} dateStr={date} onSuccess={onRefresh} /></Suspense>}
  </div>;
}

function FocusSession({ item, date, onRecord }: { item: TodayScheduleItem; date: string; onRecord: () => void }) {
  const position = getTeachingPosition(item.classId, item.subjectId);
  const note = getNextMeetingNote(item.classId, item.subjectId);
  const last = getData().sessions.filter(s => s.classId === item.classId && s.subjectId === item.subjectId && s.materialId !== 'SKIPPED')
    .sort((a, b) => b.date.localeCompare(a.date) || b.completedAt.localeCompare(a.completedAt))[0];
  return <section className="work-panel space-y-3 border-primary/30" aria-labelledby="focus-class">
    <div className="flex flex-wrap justify-between gap-2 text-sm text-text2"><span>{item.active ? 'Sekarang' : 'Berikutnya / belum dicatat'}</span><span className="tabular-nums">{item.startTime}–{item.endTime}</span></div>
    <h2 id="focus-class" className="text-xl font-semibold">{item.className} · {item.subjectName}</h2>
    <div><p className="flex items-start gap-2"><BookOpen size={18} className="mt-1 shrink-0 text-primary" aria-hidden="true" />{position.material?.name || 'Materi belum diatur / sudah selesai'}</p><p className="mt-1 text-sm text-text2">{position.material && `Pertemuan ${position.sessionIndex} dari ${position.totalSessionsInMaterial}`}{last?.lastPageReached && ` · Halaman terakhir ${last.lastPageReached}`}</p></div>
    {note.text && <div className="rounded-xl bg-surface2 p-3"><p className="mb-1 text-sm font-semibold">{note.legacy ? 'Referensi catatan lama' : 'Untuk pertemuan berikutnya'}</p><p className="whitespace-pre-wrap">{note.text}</p></div>}
    <button className="primary-button w-full" disabled={date > dateKey()} onClick={onRecord}>Catat hasil</button>
  </section>;
}

function RecordSession({ item, date, onClose, onSaved }: { item: TodayScheduleItem; date: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const draftKey = `edutrack_record_v1:${date}:${item.id}`;
  const [draft, setDraft] = useState(() => {
    const fallback = { outcome: 'taught', materialId: getTeachingPosition(item.classId, item.subjectId).material?.id || '', completed: false, note: '', nextNote: getNextMeetingNote(item.classId, item.subjectId).text, page: '' };
    try { const saved = JSON.parse(localStorage.getItem(draftKey) || 'null'); return saved && typeof saved.note === 'string' && typeof saved.nextNote === 'string' && typeof saved.page === 'string' && typeof saved.materialId === 'string' && typeof saved.completed === 'boolean' && ['taught', 'skipped'].includes(saved.outcome) ? { ...fallback, ...saved } : fallback; } catch { return fallback; }
  });
  const [error, setError] = useState('');
  const saving = useRef(false);
  const [draftFailed, setDraftFailed] = useState(false);
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify(draft)); setDraftFailed(false); } catch { setDraftFailed(true); } }, [draft, draftKey]);
  const update = (field: keyof typeof draft, value: string | boolean) => setDraft(previous => ({ ...previous, [field]: value }));
  const save = (event: React.FormEvent) => {
    event.preventDefault(); if (saving.current) return; saving.current = true;
    try {
      const ok = recordTeachingSession(item.id, date, draft.materialId || null, draft.completed, draft.note.trim(), draft.outcome === 'taught' ? draft.page : undefined, draft.nextNote, draft.outcome === 'skipped');
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
      <label className="block">Halaman terakhir <span className="text-sm text-text2">(opsional)</span><input className="workspace-input mt-1" value={draft.page} onChange={e => update('page', e.target.value)} /></label></>}
      <label className="block">Yang terjadi hari ini <span className="text-sm text-text2">(opsional)</span><textarea className="workspace-input mt-1" rows={2} value={draft.note} onChange={e => update('note', e.target.value)} /></label>
      <label className="block">Untuk pertemuan berikutnya <span className="text-sm text-text2">(opsional)</span><textarea className="workspace-input mt-1" rows={2} value={draft.nextNote} onChange={e => update('nextNote', e.target.value)} /></label>
      <p className="text-sm text-text2">{draftFailed ? 'Draft belum bisa disimpan di perangkat. Tetap buka formulir ini sampai berhasil menyimpan.' : 'Isian disimpan sebagai draft jika formulir ditutup.'}</p>
      {error && <p role="alert" className="text-red">{error}</p>}
      <div className="flex gap-3"><button type="button" className="quiet-button" onClick={onClose}>Tutup</button><button className="primary-button flex-1" type="submit">Simpan</button></div>
    </form>
  </DialogContent></Dialog>;
}
