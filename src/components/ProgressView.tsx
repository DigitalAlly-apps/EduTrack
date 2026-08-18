import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, History, LayoutDashboard, Pencil, X } from 'lucide-react';
import {
  dateFromKey,
  dateKey,
  getData,
  getMaterials,
  getSessionHistory,
  getSubjectStatus,
  getTeachingPosition,
  getTotalSessionsNeeded,
  markMaterialCompleted,
  splitSessionNote,
  undoLastSession,
  updateMaterial,
  updateMaterialEstimate,
} from '@/lib/data';
import {
  getReliableMonthCalendar,
  getTrackerMessage,
  normalizeProgressConsistency,
  type CalendarDayStatus,
} from '@/lib/progressConsistency';
import { useToast } from '@/hooks/use-toast';
import type { Material } from '@/lib/types';

type Tab = 'progress' | 'kalender' | 'history';
type EducationLevel = 'sd' | 'mts' | 'other';

function notifyDataChanged() {
  normalizeProgressConsistency();
  window.dispatchEvent(new Event('edutrack-data-changed'));
}
function getEducationLevel(level?: string): EducationLevel {
  const normalized = (level ?? '').trim().toLowerCase();
  if (/\b(sd|mi)\b/.test(normalized)) return 'sd';
  if (/\b(mts|smp)\b/.test(normalized)) return 'mts';
  const grade = Number(normalized.match(/\d+/)?.[0]);
  if (Number.isFinite(grade) && grade >= 1 && grade <= 6) return 'sd';
  if (Number.isFinite(grade) && grade >= 7 && grade <= 9) return 'mts';
  return 'other';
}

export default function ProgressView() {
  const [tab, setTab] = useState<Tab>('progress');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    normalizeProgressConsistency();
    const refresh = () => setRevision(v => v + 1);
    window.addEventListener('edutrack-data-changed', refresh);
    return () => window.removeEventListener('edutrack-data-changed', refresh);
  }, []);
  const tabs = [{ id: 'progress' as const, label: 'Progres', icon: LayoutDashboard }, { id: 'kalender' as const, label: 'Kalender', icon: CalendarDays }, { id: 'history' as const, label: 'Riwayat', icon: History }];
  return <div className="pt-1">
    <div className="mb-[18px] flex gap-1 rounded-2xl border border-border/60 bg-surface/50 p-1 shadow-sm backdrop-blur-md">{tabs.map(item => { const Icon = item.icon; const active = tab === item.id; return <button key={item.id} onClick={() => setTab(item.id)} className={`flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-text3 hover:bg-surface2/50 hover:text-foreground'}`}><Icon className="h-3.5 w-3.5" /> {item.label}</button>; })}</div>
    {tab === 'progress' && <ProgressTab revision={revision} />}{tab === 'kalender' && <CalendarTab revision={revision} />}{tab === 'history' && <HistoryTab revision={revision} />}
  </div>;
}

function ProgressTab({ revision }: { revision: number }) {
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel>(() => (localStorage.getItem('edutrack-progress-level') as EducationLevel) || 'sd');
  const [selectedClassId, setSelectedClassId] = useState('');
  const data = useMemo(() => getData(), [revision]);
  const levels = (['sd', 'mts', 'other'] as EducationLevel[]).filter(level => data.classes.some(cls => getEducationLevel(cls.level) === level));
  const classes = data.classes.filter(cls => getEducationLevel(cls.level) === selectedLevel).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  useEffect(() => { if (levels.length && !levels.includes(selectedLevel)) setSelectedLevel(levels[0]); }, [levels.join('|'), selectedLevel]);
  useEffect(() => { if (!classes.length) { setSelectedClassId(''); return; } const stored = localStorage.getItem(`edutrack-progress-class-${selectedLevel}`); if (!classes.some(c => c.id === selectedClassId)) setSelectedClassId(classes.some(c => c.id === stored) ? stored! : classes[0].id); }, [selectedLevel, classes.map(c => c.id).join('|'), selectedClassId]);
  const selectLevel = (level: EducationLevel) => { localStorage.setItem('edutrack-progress-level', level); setSelectedLevel(level); };
  const selectClass = (id: string) => { localStorage.setItem(`edutrack-progress-class-${selectedLevel}`, id); setSelectedClassId(id); };
  const selectedClass = data.classes.find(c => c.id === selectedClassId);
  const subjects = selectedClass ? data.subjects.filter(s => data.schedules.some(sc => sc.classId === selectedClassId && sc.subjectId === s.id)).map(subject => ({ subject, status: getSubjectStatus(subject, selectedClass, data) })).sort((a, b) => { const score = (s: ReturnType<typeof getSubjectStatus>) => s.status === 'behind' ? 2 : s.status === 'tight' ? 1 : 0; return score(b.status) - score(a.status) || a.subject.name.localeCompare(b.subject.name, 'id'); }) : [];
  if (!data.classes.length) return <EmptyState title="Belum ada data progres" text="Tambahkan kelas, mata pelajaran, dan jadwal terlebih dahulu." />;
  return <div className="space-y-4">
    <section className="app-card p-3 sm:p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-widest text-text3">Pilih jenjang</p><div className="grid grid-cols-3 gap-1 rounded-xl bg-surface2/70 p-1">{([['sd','SD'],['mts','MTs'],['other','Lainnya']] as const).map(([level,label]) => <button key={level} disabled={!levels.includes(level)} onClick={() => selectLevel(level)} className={`rounded-lg px-2 py-2 text-xs font-black ${selectedLevel === level ? 'bg-primary text-primary-foreground shadow-sm' : 'text-text3 disabled:opacity-35'}`}>{label}</button>)}</div><label className="mt-3 block text-[10px] font-black uppercase tracking-widest text-text3">Kelas</label><select value={selectedClassId} onChange={e => selectClass(e.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm font-bold outline-none focus:border-primary">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></section>
    <section><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-text3">Progres mengajar</p><h2 className="mt-1 font-display text-xl font-bold">{selectedClass?.name ?? 'Pilih kelas'}</h2></div><span className="rounded-full bg-surface2 px-2.5 py-1 text-[10px] font-bold text-text2">{subjects.length} mapel</span></div><div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{subjects.map(({subject,status}) => <SubjectCard key={`${selectedClassId}-${subject.id}-${revision}`} classId={selectedClassId} subjectId={subject.id} subjectName={subject.name} status={status} revision={revision} />)}</div></section>
  </div>;
}

function SubjectCard({ classId, subjectId, subjectName, status, revision }: { classId: string; subjectId: string; subjectName: string; status: ReturnType<typeof getSubjectStatus>; revision: number }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false); const [analysisOpen, setAnalysisOpen] = useState(false); const [editingSessionsId, setEditingSessionsId] = useState<string | null>(null); const [sessionDraft, setSessionDraft] = useState(''); const [editingNote, setEditingNote] = useState(false); const [noteDraft, setNoteDraft] = useState(''); const [confirmMaterial, setConfirmMaterial] = useState<Material | null>(null);
  const data = useMemo(() => getData(), [revision]); const materials = getMaterials(subjectId, classId); const progress = data.progress.find(p => p.classId === classId && p.subjectId === subjectId); const sessionsTotal = getTotalSessionsNeeded(materials); const position = getTeachingPosition(classId, subjectId, data); const sessionsDone = position.totalSessionsDone; const activeMaterial = position.material; const progressPct = sessionsTotal ? Math.min(100, Math.round(Math.min(sessionsDone, sessionsTotal) / sessionsTotal * 100)) : 0; const available = status.sessLeft ?? 0; const needed = status.sessionsNeeded ?? status.remaining; const deficit = Math.max(0, needed - available); const tone = status.status === 'behind' ? 'red' : status.status === 'tight' ? 'amber' : 'green'; const trackerMessage = getTrackerMessage(status);
  useEffect(() => { if (!editingNote) setNoteDraft(activeMaterial?.note ?? ''); }, [activeMaterial?.id, activeMaterial?.note, editingNote]);
  const saveSessions = (m: Material) => { const parsed = Number(sessionDraft); if (!Number.isInteger(parsed) || parsed < 1) { toast({ title: 'Jumlah pertemuan minimal 1', variant: 'destructive' }); return; } updateMaterialEstimate(m.id, parsed); setEditingSessionsId(null); notifyDataChanged(); toast({ title: `Rencana ${m.name}: ${parsed} pertemuan` }); };
  const saveNextNote = () => { if (!activeMaterial) return; updateMaterial(activeMaterial.id, activeMaterial.name, activeMaterial.sessions ?? 1, { pageStart: activeMaterial.pageStart, pageEnd: activeMaterial.pageEnd, note: noteDraft }, activeMaterial.examPeriod); setEditingNote(false); notifyDataChanged(); toast({ title: 'Catatan pertemuan berikutnya tersimpan' }); };
  const finishMaterial = () => { if (!confirmMaterial) return; const name = confirmMaterial.name; markMaterialCompleted(classId, subjectId, confirmMaterial.id); setConfirmMaterial(null); notifyDataChanged(); toast({ title: `Bab “${name}” selesai` }); };
  const undo = () => { const ok = undoLastSession(classId, subjectId); if (ok) { notifyDataChanged(); toast({ title: 'Progres mundur 1 sesi' }); } else toast({ title: 'Tidak ada sesi untuk dikoreksi', variant: 'destructive' }); };
  return <>
    <article className={`overflow-hidden rounded-2xl border bg-surface/80 shadow-sm ${tone === 'red' ? 'border-red/30' : tone === 'amber' ? 'border-amber/30' : 'border-border/60'}`}>
      <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-[15px] font-black">{subjectName}</h3><p className="mt-0.5 text-[11px] font-semibold text-text3">{sessionsDone}/{sessionsTotal} pertemuan selesai · {progressPct}%</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${tone === 'red' ? 'border-red/20 bg-red/10 text-red' : tone === 'amber' ? 'border-amber/20 bg-amber/10 text-amber' : 'border-green/20 bg-green/10 text-green'}`}>{deficit ? `Kurang ${deficit} sesi` : needed === available && needed > 0 ? 'Pas' : tone === 'amber' ? 'Jadwal mepet' : 'Sesi cukup'}</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2"><div className={`h-full rounded-full ${tone === 'red' ? 'bg-red' : tone === 'amber' ? 'bg-amber' : 'bg-green'}`} style={{width:`${progressPct}%`}} /></div>
      <div className="mt-3 rounded-xl border border-border/60 bg-surface2/45 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-text3">Bab sekarang</p>{position.isComplete ? <p className="mt-1 text-sm font-black text-green">✓ Semua bab selesai</p> : activeMaterial ? <><p className="mt-1 text-[14px] font-black leading-snug">{activeMaterial.name}</p><p className="mt-0.5 text-[11px] font-semibold text-text2">Pertemuan {position.sessionIndex} dari {position.totalSessionsInMaterial}</p>{(activeMaterial.pageStart || activeMaterial.pageEnd) && <p className="mt-0.5 text-[10px] text-text3">Hal. {activeMaterial.pageStart}{activeMaterial.pageEnd ? `–${activeMaterial.pageEnd}` : ''}</p>}</> : <p className="mt-1 text-sm text-text3">Materi belum diatur.</p>}</div>
      {activeMaterial && !position.isComplete && <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-primary">Pertemuan berikutnya</p><p className="mt-0.5 text-[11px] text-text3">Catatan mengajar.</p></div>{!editingNote && <button onClick={() => {setNoteDraft(activeMaterial.note ?? '');setEditingNote(true);}} className="flex items-center gap-1 rounded-lg border border-primary/20 px-2 py-1 text-[10px] font-bold text-primary"><Pencil className="h-3 w-3"/> Edit</button>}</div>{editingNote ? <div className="mt-2"><textarea autoFocus value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder="Contoh: rangkum isi bab, tulis poin penting di papan..." className="min-h-[72px] w-full resize-none rounded-xl border border-primary/25 bg-surface p-2.5 text-xs outline-none focus:border-primary"/><div className="mt-2 flex justify-end gap-2"><button onClick={()=>setEditingNote(false)} className="px-2.5 py-1.5 text-[10px] font-bold text-text3">Batal</button><button onClick={saveNextNote} className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-black text-primary-foreground">Simpan</button></div></div> : <p className={`mt-2 whitespace-pre-wrap text-xs leading-relaxed ${activeMaterial.note ? 'font-semibold' : 'italic text-text3'}`}>{activeMaterial.note || 'Belum ada catatan.'}</p>}</div>}
      <button onClick={()=>setAnalysisOpen(v=>!v)} className="mt-3 flex w-full items-center justify-between border-t border-border/50 pt-3 text-left"><span><span className="block text-[10px] font-black uppercase tracking-wider text-text3">Tracker sesi</span><span className="mt-0.5 block text-[11px] font-semibold text-text2">Butuh {needed} · tersedia {available}{deficit ? ` · kurang ${deficit}` : ''}</span></span><ChevronDown className={`h-4 w-4 text-text3 transition ${analysisOpen?'rotate-180':''}`}/></button>
      {analysisOpen && <div className="mt-2 rounded-xl bg-surface2/60 p-3 text-[11px]"><div className="grid grid-cols-3 gap-2 text-center"><div><b className="block text-sm">{needed}</b><span className="text-text3">dibutuhkan</span></div><div><b className="block text-sm">{available}</b><span className="text-text3">tersedia</span></div><div><b className={`block text-sm ${deficit?'text-red':'text-green'}`}>{deficit ? `-${deficit}` : needed === available && needed > 0 ? 'Pas' : 'Aman'}</b><span className="text-text3">kondisi</span></div></div><p className={`mt-3 border-t border-border/50 pt-2 leading-relaxed ${deficit ? 'font-semibold text-amber' : 'text-text2'}`}>{trackerMessage}</p></div>}
      <button onClick={()=>setExpanded(v=>!v)} className="mt-3 flex w-full items-center justify-between rounded-xl border border-border/60 bg-surface px-3 py-2 text-left text-[11px] font-black text-text2"><span>Rencana bab & edit</span><ChevronDown className={`h-4 w-4 transition ${expanded?'rotate-180':''}`}/></button></div>
      {expanded && <div className="border-t border-border/50 bg-surface2/20 p-4"><div className="space-y-2">{(()=>{let consumed=0;const explicitCompleted=new Set(position.completedMaterialIds ?? []);return materials.map(m=>{const count=m.sessions??1;const finished=explicitCompleted.has(m.id)||sessionsDone>=consumed+count;const current=position.material?.id===m.id&&!position.isComplete;consumed+=count;const editing=editingSessionsId===m.id;return <div key={m.id} className={`rounded-xl border p-3 ${current?'border-primary/25 bg-primary/5':'border-border/50 bg-surface'}`}><div className="flex items-start gap-2"><span className={`mt-0.5 text-xs font-black ${finished?'text-green':current?'text-primary':'text-text3'}`}>{finished?'✓':current?'▶':'○'}</span><div className="min-w-0 flex-1"><p className={`text-xs font-bold ${finished?'text-text3 line-through':''}`}>{m.name}</p><div className="mt-2 flex flex-wrap items-center gap-2">{editing?<div className="flex items-center gap-1.5"><input type="number" min="1" inputMode="numeric" value={sessionDraft} onChange={e=>setSessionDraft(e.target.value)} className="h-8 w-16 rounded-lg border border-primary/30 bg-surface px-2 text-center text-xs font-bold" autoFocus/><button onClick={()=>saveSessions(m)} className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5"/></button><button onClick={()=>setEditingSessionsId(null)} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-text3"><X className="h-3.5 w-3.5"/></button></div>:<button onClick={()=>{setEditingSessionsId(m.id);setSessionDraft(String(count));}} className="rounded-lg border border-border bg-surface2 px-2 py-1 text-[10px] font-bold text-text3">{count} pertemuan ✏️</button>}{current&&<button onClick={()=>setConfirmMaterial(m)} className="rounded-lg border border-amber/25 bg-amber/10 px-2 py-1 text-[10px] font-black text-amber">Selesaikan bab sekarang</button>}</div></div></div></div>;});})()}</div>{sessionsDone>0&&<div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3"><span className="text-[10px] text-text3">Salah input progres?</span><button onClick={undo} className="rounded-lg border border-amber/25 bg-amber/10 px-2.5 py-1.5 text-[10px] font-black text-amber">↩ Mundur 1 sesi</button></div>}</div>}
    </article>
    {confirmMaterial && createPortal(<div className="app-overlay z-[1000]" onClick={()=>setConfirmMaterial(null)}><div className="app-bottom-sheet" onClick={e=>e.stopPropagation()}><div className="app-sheet-handle"/><div className="app-sheet-title text-[20px]">Selesaikan bab?</div><p className="mt-2 text-[13px] leading-relaxed text-text2">Tandai <strong>{confirmMaterial.name}</strong> selesai sekarang. Sisa rencana pertemuan bab ini dilewati dan progres berpindah ke bab berikutnya.</p><div className="mt-5 flex gap-3"><button onClick={()=>setConfirmMaterial(null)} className="flex-1 rounded-xl border border-border2 bg-surface py-3 text-sm font-bold">Batal</button><button onClick={finishMaterial} className="flex-1 rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground">Ya, selesaikan</button></div></div></div>,document.body)}
  </>;
}

function HistoryTab({ revision }: { revision: number }) {
  const [month,setMonth]=useState(dateKey().slice(0,7)); const items=useMemo(()=>getSessionHistory(month),[month,revision]); const data=useMemo(()=>getData(),[revision]); const grouped=items.reduce((r,s)=>{(r[s.date]||=[]).push(s);return r;},{} as Record<string,typeof items>); const dates=Object.keys(grouped).sort((a,b)=>b.localeCompare(a));
  return <div><div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-3"><span className="text-[11px] font-black uppercase tracking-wide text-text3">Pilih bulan</span><input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="form-input-style min-h-0 w-auto px-3 py-1.5 text-xs"/></div>{!dates.length?<EmptyState title="Tidak ada riwayat" text="Belum ada sesi tercatat di bulan ini."/>:<div className="space-y-5">{dates.map(date=><section key={date}><h3 className="mb-2 text-[11px] font-black text-primary">{dateFromKey(date).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}</h3><div className="space-y-2">{grouped[date].map(session=>{const cls=data.classes.find(i=>i.id===session.classId)?.name??'?';const subject=data.subjects.find(i=>i.id===session.subjectId)?.name??'?';const material=data.materials.find(i=>i.id===session.materialId);const {mainNote,reminder}=splitSessionNote(session.note);return <div key={session.id} className="rounded-xl border border-border bg-surface p-3"><p className="text-[13px] font-black">{cls} · {subject}</p><p className="mt-0.5 text-[11px] text-text2">{material?.name??(session.materialId==='SKIPPED'?'Dilewati':'Tanpa materi')}</p>{mainNote&&<p className="mt-1 text-[11px] text-text3">Berikutnya: {mainNote}</p>}{reminder&&<p className="mt-1 text-[10px] font-semibold text-amber">📌 {reminder}</p>}</div>;})}</div></section>)}</div>}</div>;
}

function CalendarTab({ revision }: { revision: number }) {
  const [month,setMonth]=useState(dateKey().slice(0,7));
  const days=useMemo(()=>getReliableMonthCalendar(month),[month,revision]);
  const [selectedDate,setSelectedDate]=useState<string>(()=>dateKey());
  useEffect(()=>{if(!selectedDate.startsWith(month)) setSelectedDate(`${month}-01`);},[month,selectedDate]);
  const selected=days.find(day=>day.date===selectedDate) ?? days.find(day=>day.date===dateKey()) ?? days[0];
  const firstDay=new Date(`${month}-01T12:00:00`).getDay(); const offset=firstDay===0?6:firstDay-1;
  const tones:Record<CalendarDayStatus,string>={done:'bg-green/10 text-green border-green/20',partial:'bg-amber/10 text-amber border-amber/20',missed:'bg-red/10 text-red border-red/20',holiday:'bg-surface2 text-text3 border-border',noclass:'text-text3 border-transparent',future:'text-text3/45 border-transparent'};
  const statusLabels:Record<CalendarDayStatus,string>={done:'Selesai',partial:'Sebagian',missed:'Terlewat',holiday:'Libur',noclass:'Tidak ada jadwal',future:'Mendatang'};
  const legend=[['bg-green/20','Selesai'],['bg-amber/20','Sebagian'],['bg-red/20','Terlewat'],['bg-surface2','Libur']] as const;
  return <div>
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-3"><span className="text-[11px] font-black uppercase tracking-wide text-text3">Bulan</span><input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="form-input-style min-h-0 w-auto px-3 py-1.5 text-xs"/></div>
    <div className="overflow-hidden rounded-2xl border border-border bg-surface"><div className="grid grid-cols-7 border-b border-border/50">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(day=><div key={day} className="py-2 text-center text-[10px] font-black text-text3">{day}</div>)}</div><div className="grid grid-cols-7 p-1">{Array.from({length:offset}).map((_,i)=><div key={`empty-${i}`}/>)}{days.map(day=><button type="button" onClick={()=>setSelectedDate(day.date)} key={day.date} aria-label={`${day.date}: ${statusLabels[day.status]}`} className={`m-0.5 grid min-h-10 place-items-center rounded-lg border text-xs font-black transition ${tones[day.status]} ${day.date===dateKey()?'ring-2 ring-primary':''} ${day.date===selectedDate?'outline outline-2 outline-offset-1 outline-primary/50':''}`}>{Number(day.date.slice(8))}</button>)}</div></div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 px-1">{legend.map(([tone,label])=><div key={label} className="flex items-center gap-1.5 text-[10px] font-semibold text-text3"><span className={`h-2.5 w-2.5 rounded-sm border border-border/50 ${tone}`}/>{label}</div>)}</div>
    {selected && <div className="mt-3 rounded-xl border border-border bg-surface p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-text3">{dateFromKey(selected.date).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}</p><p className="mt-1 text-sm font-black">{statusLabels[selected.status]}</p></div><span className="rounded-full bg-surface2 px-2 py-1 text-[10px] font-bold text-text2">{selected.sessionCount}/{selected.schedCount} sesi</span></div>{selected.status==='done'&&<p className="mt-2 text-[11px] text-text2">Semua sesi yang dijadwalkan tercatat selesai.</p>}{selected.status==='partial'&&<p className="mt-2 text-[11px] text-amber">Masih ada {Math.max(0,selected.schedCount-selected.sessionCount)} sesi yang belum tercatat selesai.</p>}{selected.status==='missed'&&<p className="mt-2 text-[11px] text-red">Ada jadwal mengajar, tetapi belum ada sesi mengajar yang tercatat.</p>}{selected.status==='holiday'&&<p className="mt-2 text-[11px] text-text3">Jadwal hari ini ditiadakan karena libur.</p>}{selected.skippedCount>0&&<p className="mt-1 text-[10px] text-text3">{selected.skippedCount} sesi ditandai dilewati dan tidak dihitung sebagai selesai.</p>}</div>}
    <p className="mt-2 px-1 text-[10px] text-text3">Pilih tanggal untuk melihat jumlah sesi. Garis pada tanggal menandai hari ini.</p>
  </div>;
}
function EmptyState({title,text}:{title:string;text:string}){return <div className="px-6 py-12 text-center"><span className="mb-3 block text-4xl opacity-60">📈</span><h2 className="font-display text-xl font-bold">{title}</h2><p className="mx-auto mt-1 max-w-[280px] text-sm text-text2">{text}</p></div>;}
