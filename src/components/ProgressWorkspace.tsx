import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getData, getSubjectStatus, getTeachingPosition } from '@/lib/data';
import { CalendarTab, HistoryTab, SubjectCard } from './ProgressView';
import WeeklyReviewCard from './WeeklyReviewCard';
import { navigateTo } from '@/lib/navigation';

function savedFilter(key: string) { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } }

export default function ProgressWorkspace({ refreshKey = 0 }: { refreshKey?: number }) {
  const [params, setParams] = useSearchParams();
  const [localRevision, setRevision] = useState(0);
  const revision = localRevision + refreshKey;
  const [repairDate, setRepairDate] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState(() => savedFilter('progress-class-filter'));
  const [subjectFilter, setSubjectFilter] = useState(() => savedFilter('progress-subject-filter'));
  const [attention, setAttention] = useState(() => savedFilter('progress-attention') === 'true');
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('edutrack-data-changed', refresh);
    return () => window.removeEventListener('edutrack-data-changed', refresh);
  }, []);
  const data = getData();
  const pairs = data.classes.flatMap(cls => data.subjects.filter(subject => data.schedules.some(s => s.classId === cls.id && s.subjectId === subject.id)).map(subject => ({ cls, subject, status: getSubjectStatus(subject, cls, data), position: getTeachingPosition(cls.id, subject.id, data) })))
    .sort((a, b) => a.cls.name.localeCompare(b.cls.name, 'id', { numeric: true }) || a.subject.name.localeCompare(b.subject.name, 'id'));
  const visible = pairs.filter(p => (!classFilter || p.cls.id === classFilter) && (!subjectFilter || p.subject.id === subjectFilter) && (!attention || p.status.status !== 'on-track'));
  const selected = pairs.find(p => p.cls.id === params.get('classId') && p.subject.id === params.get('subjectId'));
  const section = params.get('section') || 'summary';
  const setSection = (value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set('section', value); return next; });
  const filter = (key: string, value: string) => { try { sessionStorage.setItem(key, value); } catch { /* In-memory filter remains usable. */ } };
  return <div className="progress-workspace space-y-5">
    <div className="progress-section-nav flex flex-wrap gap-2"><button className="quiet-button" aria-pressed={section !== 'calendar' && section !== 'history'} onClick={() => setSection('summary')}>Progres kelas</button><button className="quiet-button" aria-pressed={section === 'calendar'} onClick={() => setSection('calendar')}>Kalender</button><button className="quiet-button" aria-pressed={section === 'history' && !selected} onClick={() => {
      setRepairDate(null);
      setParams(previous => { const next = new URLSearchParams(previous); next.set('section', 'history'); for (const key of ['classId', 'subjectId', 'date']) next.delete(key); return next; });
    }}>Riwayat</button></div>
    {section === 'calendar' ? <><CalendarTab revision={revision} classId={classFilter} onRepair={date => { setRepairDate(date); setSection('history'); }} /><WeeklyReviewCard key={revision} /></> : <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <section className={`progress-list-panel ${selected ? 'hidden lg:block' : ''}`} aria-label="Daftar kelas dan mata pelajaran">
        <div className="space-y-3 mb-4">
          <label className="block text-sm">Kelas<select className="workspace-input mt-1" value={classFilter} onChange={e => { setClassFilter(e.target.value); filter('progress-class-filter', e.target.value); }}><option value="">Semua kelas</option>{data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="block text-sm">Mata pelajaran<select className="workspace-input mt-1" value={subjectFilter} onChange={e => { setSubjectFilter(e.target.value); filter('progress-subject-filter', e.target.value); }}><option value="">Semua mapel</option>{data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={attention} onChange={e => { setAttention(e.target.checked); filter('progress-attention', String(e.target.checked)); }} />Perlu perhatian</label>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
          {visible.map(({ cls, subject, position, status }) => <button key={`${cls.id}:${subject.id}`} className={`progress-list-item w-full p-4 text-left ${selected?.cls.id === cls.id && selected?.subject.id === subject.id ? 'is-selected' : ''}`} onClick={() => navigateTo({ view: 'progress', classId: cls.id, subjectId: subject.id, section: 'summary' })}>
            <p className="font-semibold">{cls.name} · {subject.name}</p><p className="mt-1 text-sm text-text2">{position.material?.name || (position.isComplete ? 'Materi selesai' : 'Materi belum diatur')}</p><p className="mt-1 text-sm text-text2">{position.totalSessionsDone}/{position.totalSessionsAll} sesi{position.material ? ` · Pertemuan ${position.sessionIndex}/${position.totalSessionsInMaterial}` : ''}</p><p className="mt-2 text-sm text-primary">{status.daysLeft === undefined ? 'Belum bisa diperkirakan' : status.label}</p>{status.nextSched && <p className="mt-1 text-sm text-text2">Berikutnya: {status.nextSched.dayName}, {status.nextSched.time}</p>}
          </button>)}
          {!visible.length && <p className="p-4 text-text2">Belum ada kelas–mapel yang sesuai filter.</p>}
        </div>
      </section>
      <section className="progress-detail-panel min-w-0 space-y-4" aria-label="Detail progres">
        {selected && <><button className="quiet-button lg:hidden" onClick={() => { setParams(previous => { const next = new URLSearchParams(previous); next.delete('classId'); next.delete('subjectId'); return next; }); }}>Kembali ke daftar</button><h2 className="text-xl font-semibold">{selected.cls.name} · {selected.subject.name}</h2><div className="flex flex-wrap gap-2">{[['summary', 'Ringkasan'], ['materials', 'Materi'], ['history', 'Riwayat']].map(([id, label]) => <button key={id} className="quiet-button" aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>)}</div></>}
        {section === 'history' ? <HistoryTab revision={revision} repairDate={repairDate} initialDate={params.get('date') || undefined} classId={selected?.cls.id} subjectId={selected?.subject.id} /> : selected ? <SubjectCard key={`${selected.cls.id}:${selected.subject.id}:${section}`} classId={selected.cls.id} subjectId={selected.subject.id} subjectName={selected.subject.name} status={selected.status} revision={revision} viewMode="detailed" initialExpanded={section === 'materials'} /> : <><div className="work-panel"><h2 className="text-lg font-semibold">Pilih kelas dan mapel</h2><p className="mt-2 text-text2">Lihat posisi materi, edit catatan berikutnya, atau koreksi riwayat dari satu tempat.</p></div><WeeklyReviewCard key={revision} /></>}
      </section>
    </div>}
  </div>;
}
