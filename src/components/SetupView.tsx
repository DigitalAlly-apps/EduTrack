import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getData, updateData, genId, DAYS_SHORT, DAYS_ID, fmt, checkOverlap, saveData,
  exportJSON, exportCSV, importJSON, loadDemo, updateClass, updateSubject, bulkUpdateExamDateByLevel, updateMaterial, updateSchedule, reorderMaterials, bulkAddMaterials, estimateStorageSize, pruneOldSessions,
  addHoliday, removeHoliday, getHolidays, getHolidayImpactSummary, getMaterials,
} from '@/lib/data';
import { SetupTab } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface SetupViewProps {
  onRefresh: () => void;
}

export default function SetupView({ onRefresh }: SetupViewProps) {
  const [tab, setTab] = useState<SetupTab>('classes');
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onRefresh(); };
  const data = getData();

  const tabs: { id: SetupTab; label: string; icon: string; group: string }[] = [
    { id: 'classes', label: 'Kelas', icon: '🏫', group: 'data' },
    { id: 'subjects', label: 'Mapel', icon: '📚', group: 'data' },
    { id: 'materials', label: 'Materi', icon: '📖', group: 'data' },
    { id: 'schedules', label: 'Jadwal', icon: '🗓', group: 'data' },
    { id: 'holidays', label: 'Libur', icon: '🏖', group: 'other' },
    { id: 'leave', label: 'Izin', icon: '🏥', group: 'other' },
    { id: 'data', label: 'Backup', icon: '💾', group: 'other' },
  ];

  return (
    <div className="pt-2">
      {/* Profile */}
      <div className="bg-surface border border-border rounded-[20px] p-4 mb-[10px]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-dim border border-primary-border grid place-items-center text-xl flex-shrink-0">👤</div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold">{data.teacherName || 'Belum diisi'}</div>
            <div className="text-[11px] text-text2 mt-[2px]">Guru / Pengajar</div>
          </div>
          <EditTeacherButton onRefresh={refresh} />
        </div>
      </div>

      {/* Tabs — grouped */}
      <div className="mb-[14px] space-y-2">
        <div className="text-[9px] font-bold uppercase tracking-widest text-text3 px-1">Data Kelas</div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {tabs.filter(t => t.group === 'data').map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 min-w-[64px] py-2.5 px-2 rounded-2xl text-[11px] font-bold border transition-all whitespace-nowrap flex flex-col items-center gap-1 ${
                  active ? 'bg-primary-dim border-primary-border text-primary shadow-sm' :
                  'bg-surface border-border text-text2 hover:border-border2 hover:text-foreground'
                }`}
              >
                <span className="text-base">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="text-[9px] font-bold uppercase tracking-widest text-text3 px-1 mt-1">Lainnya</div>
        <div className="flex gap-1.5">
          {tabs.filter(t => t.group === 'other').map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2 px-3 rounded-2xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  active ? 'bg-primary-dim border-primary-border text-primary shadow-sm' :
                  'bg-surface border-border text-text2 hover:border-border2 hover:text-foreground'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'classes' && <ClassesTab onRefresh={refresh} />}
      {tab === 'subjects' && <SubjectsTab onRefresh={refresh} />}
      {tab === 'materials' && <MaterialsTab onRefresh={refresh} />}
      {tab === 'schedules' && <SchedulesTab onRefresh={refresh} />}
      {tab === 'holidays' && <LiburTab onRefresh={refresh} />}
      {tab === 'data' && <DataTab onRefresh={refresh} />}
      {tab === 'leave' && <LeaveTab onRefresh={refresh} />}
    </div>
  );
}

function EditTeacherButton({ onRefresh }: { onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const { toast } = useToast();

  const startEdit = () => { setName(getData().teacherName || ''); setEditing(true); };
  const save = () => {
    if (!name.trim()) { toast({ title: 'Masukkan nama Anda' }); return; }
    updateData(d => d.teacherName = name.trim());
    setEditing(false);
    toast({ title: 'Profil disimpan ✓' });
    onRefresh();
  };

  if (editing) {
    return (
      <div className="flex gap-1">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
          className="w-28 bg-surface border border-border2 rounded-lg px-2 py-1 text-xs" autoFocus placeholder="Nama..." />
        <button onClick={save} className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold">✓</button>
      </div>
    );
  }
  return (
    <button onClick={startEdit} className="px-[13px] py-[7px] rounded-lg bg-surface2 border border-border2 text-xs text-text2 transition-all hover:text-foreground hover:border-border3">
      ✏️ Edit
    </button>
  );
}

function DeleteConfirmSheet({ open, onOpenChange, onConfirm, title, desc }: any) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[600] bg-[rgba(0,0,0,0.7)] flex flex-col justify-end animate-in fade-in transition-all" onClick={() => onOpenChange(false)}>
      <div className="bg-surface2 rounded-t-[24px] p-5 pb-safe pb-10 w-full max-w-[430px] mx-auto animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-border2 rounded-full mx-auto mb-5" />
        <div className="text-[19px] font-medium tracking-tight mb-2">{title}</div>
        <div className="text-sm text-text2 mb-6 leading-relaxed bg-[hsl(0_91%_71%/0.05)] border border-[hsl(0_91%_71%/0.1)] p-3 rounded-lg text-red/90">{desc}</div>
        <div className="flex gap-3">
          <button onClick={() => onOpenChange(false)} className="flex-1 py-[14px] bg-surface border border-border2 rounded-xl text-sm font-medium transition-all hover:bg-surface2">Batal</button>
          <button onClick={() => { onConfirm(); onOpenChange(false); }} className="flex-1 py-[14px] bg-[hsl(0_91%_71%/0.12)] border border-[hsl(0_91%_71%/0.25)] text-[#FCA5A5] rounded-xl text-sm font-bold transition-all active:scale-[0.98]">Ya, Hapus</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EditableItem({ item, onSave, onDelete, extraEditField }: any) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.name);
  const [extraVal, setExtraVal] = useState(item.extraVal || '');
  const [delSheet, setDelSheet] = useState(false);

  if (editing) {
    return (
      <div className="bg-surface2 border border-primary-border rounded-lg p-3 mb-[6px] animate-in fade-in slide-in-from-top-1">
        <label className="block text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Edit Item</label>
        <input value={val} onChange={e => setVal(e.target.value)} className="form-input-style mb-2 h-10" autoFocus />
        {extraEditField && extraEditField(extraVal, setExtraVal)}
        <div className="flex gap-2">
          <button onClick={() => { onSave(item.id, val, extraVal); setEditing(false); }} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-[13px] font-bold">Simpan</button>
          <button onClick={() => setEditing(false)} className="flex-1 py-2 bg-surface text-text2 border border-border rounded-md text-[13px] font-medium">Batal</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-lg p-[14px] flex items-center justify-between mb-[6px] transition-colors relative group">
        <div className="flex-1 min-w-0 pr-3">
          <div className="text-sm font-medium leading-snug">{item.name}</div>
          {item.meta && <div className="text-[11px] text-text2 mt-[4px] font-medium">{item.meta}</div>}
        </div>
        <div className="flex gap-[6px] items-center flex-shrink-0">
          <button onClick={() => setEditing(true)} className="w-[34px] h-[34px] rounded-[9px] bg-surface2 border border-border2 text-text2 text-[13px] grid place-items-center transition-all hover:border-primary-border hover:text-primary">✏️</button>
          <button onClick={() => setDelSheet(true)} className="w-[34px] h-[34px] rounded-[9px] bg-[hsl(0_91%_71%/0.06)] border border-[hsl(0_91%_71%/0.12)] text-[#FCA5A5] text-xs grid place-items-center transition-all hover:bg-[hsl(0_91%_71%/0.15)]">✕</button>
        </div>
      </div>
      <DeleteConfirmSheet open={delSheet} onOpenChange={setDelSheet} onConfirm={() => onDelete(item.id)} title={`Hapus "${item.name}"?`} desc={item.deleteWarning || 'Tindakan ini tidak bisa dibatalkan.'} />
    </>
  );
}

// Draggable Material Item
function SortableMaterialItem({ id, item, onSave, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1, opacity: isDragging ? 0.8 : 1 };
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.name);
  const [sessVal, setSessVal] = useState<number>(item.sessions ?? 1);
  const [delSheet, setDelSheet] = useState(false);

  if (editing) {
    return (
      <div className="bg-surface2 border border-primary-border rounded-lg p-3 mb-[6px]">
        <input value={val} onChange={e => setVal(e.target.value)} className="form-input-style mb-2 h-10" autoFocus />
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[10px] font-bold text-text2 uppercase tracking-wide whitespace-nowrap">Pertemuan:</label>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setSessVal(n)}
                className={`w-7 h-7 rounded-md text-xs font-bold border transition-all ${
                  sessVal === n ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border text-text2 hover:border-primary'
                }`}>{n}×</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { onSave(id, val, sessVal); setEditing(false); }} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-[13px] font-bold">Simpan</button>
          <button onClick={() => setEditing(false)} className="flex-1 py-2 bg-surface text-text2 border border-border rounded-md text-[13px] font-medium">Batal</button>
        </div>
      </div>
    );
  }

  const sessBadge = (item.sessions ?? 1) > 1
    ? <span className="inline-block ml-1 bg-primary-dim text-primary text-[9px] font-bold px-[5px] py-[1px] rounded">{item.sessions}×</span>
    : null;

  return (
    <>
      <div ref={setNodeRef} style={style} className={`bg-surface border ${isDragging ? 'border-primary border-[2px] shadow-lg' : 'border-border'} rounded-lg p-2 pl-3 flex items-center justify-between mb-[6px]`}>
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
          <div {...attributes} {...listeners} className="text-text3 cursor-grab p-1 touch-none">≡</div>
          <div>
            <div className="text-sm font-medium leading-snug">{item.name}{sessBadge}</div>
            <div className="text-[11px] text-text2 mt-[2px]">{item.meta}</div>
          </div>
        </div>
        <div className="flex gap-[4px] items-center flex-shrink-0">
          <button onClick={() => setEditing(true)} className="w-[32px] h-[32px] rounded-[9px] bg-surface2 text-text2 text-[12px] grid place-items-center">✏️</button>
          <button onClick={() => setDelSheet(true)} className="w-[32px] h-[32px] rounded-[9px] bg-[hsl(0_91%_71%/0.06)] text-[#FCA5A5] text-[11px] grid place-items-center">✕</button>
        </div>
      </div>
      <DeleteConfirmSheet open={delSheet} onOpenChange={setDelSheet} onConfirm={() => onDelete(id)} title={`Hapus "${item.name}"?`} desc="Data progres kelas untuk materi ini akan terpengaruh jika sudah dilewati." />
    </>
  );
}


function ClassesTab({ onRefresh }: { onRefresh: () => void }) {
  const [name, setName] = useState('');
  const { toast } = useToast();
  const data = getData();

  const add = () => {
    if (!name.trim()) return toast({ title: 'Masukkan nama kelas' });
    updateData(d => d.classes.push({ id: genId(), name: name.trim(), color: 'blue' }));
    setName(''); toast({ title: 'Kelas ditambahkan' }); onRefresh();
  };
  const saveItem = (id: string, newName: string) => {
    if(!newName.trim()) return;
    updateClass(id, newName); toast({ title: 'Kelas diperbarui' }); onRefresh();
  };
  const del = (id: string) => {
    const strId = String(id);
    updateData(d => {
      d.classes = d.classes.filter(c => String(c.id) !== strId);
      d.schedules = d.schedules.filter(s => String(s.classId) !== strId);
      d.progress = d.progress.filter(p => String(p.classId) !== strId);
      d.sessions = d.sessions.filter(s => String(s.classId) !== strId);
    });
    toast({ title: 'Kelas dihapus' }); onRefresh();
  };

  return (
    <div>
      <div className="bg-surface2/60 border border-border rounded-xl p-4 mb-6 shadow-sm">
        <FormField label="Tambah Kelas Baru" className="mb-0">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            className="form-input-style mb-3" placeholder="cth: 10A, XI IPA 2..." />
          <button onClick={add} className="btn-primary-style font-medium text-[13px] bg-primary text-primary-foreground min-h-[44px]">＋ Tambah Kelas</button>
        </FormField>
      </div>
      <div className="mt-6 mb-2 text-[11px] font-bold tracking-[0.7px] uppercase text-text3">Daftar Kelas</div>
      {data.classes.map(c => (
        <EditableItem key={c.id} item={{ id: c.id, name: c.name, deleteWarning: 'Menghapus kelas akan menghapus semua jadwal dan progres terkait.' }} onSave={saveItem} onDelete={del} />
      ))}
      {!data.classes.length && <div className="text-text3 text-[13px] text-center py-6 border border-dashed rounded-lg mt-2">Belum ada kelas</div>}
    </div>
  );
}


function SubjectsTab({ onRefresh }: { onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [level, setLevel] = useState('');
  const { toast } = useToast();
  const data = getData();

  const [bulkLevel, setBulkLevel] = useState('SD/MI');
  const [bulkDate, setBulkDate] = useState('');

  const add = () => {
    if (!name.trim()) return toast({ title: 'Masukkan nama mapel' });
    updateData(d => d.subjects.push({ id: genId(), name: name.trim(), level, examDate: examDate || null }));
    setName(''); setLevel(''); setExamDate(''); toast({ title: 'Mapel ditambahkan' }); onRefresh();
  };
  const saveItem = (id: string, newName: string, extras: any) => {
    if(!newName.trim()) return;
    updateSubject(id, newName, extras.level, extras.examDate); toast({ title: 'Mapel diperbarui' }); onRefresh();
  };
  const del = (id: string) => {
    const strId = String(id);
    updateData(d => {
      d.subjects = d.subjects.filter(s => String(s.id) !== strId);
      d.materials = d.materials.filter(m => String(m.subjectId) !== strId);
      d.schedules = d.schedules.filter(s => String(s.subjectId) !== strId);
      d.progress = d.progress.filter(p => String(p.subjectId) !== strId);
      d.sessions = d.sessions.filter(s => String(s.subjectId) !== strId);
    });
    toast({ title: 'Mapel dihapus' }); onRefresh();
  };

  const applyBulkExamDate = () => {
    if (!bulkLevel) return toast({ title: 'Pilih jenjang terlebih dahulu' });
    if (!bulkDate) return toast({ title: 'Masukkan tanggal ujian' });
    bulkUpdateExamDateByLevel(bulkLevel, bulkDate);
    setBulkDate(''); toast({ title: `Tanggal ujian untuk ${bulkLevel} disimpan` }); onRefresh();
  };

  return (
    <div>
      <div className="bg-surface2/60 p-[14px] rounded-xl border border-border mb-4 shadow-sm">
        <FormField label="Tambah Mata Pelajaran" className="mb-0">
          <input value={name} onChange={e => setName(e.target.value)} className="form-input-style mb-3" placeholder="Nama Mapel..." />
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-[10px] text-text2 mb-1 pl-1">Jenjang</label>
              <select value={level} onChange={e => setLevel(e.target.value)} className="form-select-style text-xs">
                <option value="">Umum / Tidak Spesifik</option>
                <option value="SD/MI">SD / MI</option>
                <option value="SMP/MTs">SMP / MTs</option>
                <option value="SMA/MA">SMA / MA</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-text2 mb-1 pl-1">Tanggal Ujian (Opsional)</label>
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="form-input-style text-xs h-[38px]" />
            </div>
          </div>
          <button onClick={add} className="btn-primary-style font-medium text-[13px] bg-primary text-primary-foreground min-h-[44px]">＋ Tambah Mapel</button>
        </FormField>
      </div>

      <div className="bg-surface border border-border rounded-xl p-3 mb-5">
        <label className="block text-[11px] font-bold tracking-[0.7px] uppercase text-primary mb-2">Set Ujian per Jenjang</label>
        <div className="flex gap-2">
           <select value={bulkLevel} onChange={e => setBulkLevel(e.target.value)} className="form-select-style flex-1 text-xs">
             <option value="SD/MI">SD / MI</option>
             <option value="SMP/MTs">SMP / MTs</option>
             <option value="SMA/MA">SMA / MA</option>
           </select>
           <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="form-input-style flex-1 text-xs h-[38px]" />
        </div>
        <button onClick={applyBulkExamDate} className="w-full mt-2 py-2 rounded-lg bg-primary-dim text-primary border border-primary-border text-[12px] font-bold">Terapkan ke Semua</button>
      </div>

      <div className="mt-2 mb-2 text-[11px] font-bold tracking-[0.7px] uppercase text-text3">Daftar Mapel</div>
      {data.subjects.map(s => {
        const jenjangLabel = s.level ? `[${s.level}] ` : '';
        const ujianLabel = s.examDate ? `Ujian: ${s.examDate}` : 'Tidak ada ujian';
        return (
          <EditableItem key={s.id} item={{ id: s.id, name: s.name, meta: `${jenjangLabel}${ujianLabel}`, extraVal: { level: s.level || '', examDate: s.examDate || '' }, deleteWarning: 'Menghapus mapel akan menghapus materi dan jadwal terkait.' }} onSave={saveItem} onDelete={del} extraEditField={(v:any, setV:any) => (
            <div className="flex gap-2 mb-2">
              <select value={v.level} onChange={e=>setV({...v, level: e.target.value})} className="form-select-style flex-1 text-xs">
                <option value="">Umum</option>
                <option value="SD/MI">SD / MI</option>
                <option value="SMP/MTs">SMP / MTs</option>
                <option value="SMA/MA">SMA / MA</option>
              </select>
              <input type="date" value={v.examDate||''} onChange={e=>setV({...v, examDate: e.target.value})} className="form-input-style flex-1 text-xs h-[38px]" />
            </div>
          )} />
        );
      })}
      {!data.subjects.length && <div className="text-text3 text-[13px] text-center py-6 border border-dashed roundefunction MaterialsTab({ onRefresh }: { onRefresh: () => void }) {
  const [subId, setSubId] = useState('');
  const [name, setName] = useState('');
  const [sessions, setSessions] = useState(1);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSessions, setBulkSessions] = useState(1);
  const { toast } = useToast();
  const data = getData();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const add = () => {
    if (!subId) return toast({ title: 'Pilih mapel dulu' });
    if (bulkMode) {
      if(!bulkText.trim()) return toast({ title: 'Masukkan materi' });
      bulkAddMaterials(subId, bulkText.split('\n').filter(x => x.trim()), bulkSessions);
      setBulkText(''); setBulkMode(false); toast({ title: 'Materi ditambahkan' }); onRefresh();
    } else {
      if(!name.trim()) return toast({ title: 'Isi nama materi' });
      bulkAddMaterials(subId, [name], sessions);
      setName(''); toast({ title: 'Materi ditambahkan' }); onRefresh();
    }
  };

  const saveItem = (id: string, newName: string, newSessions?: number) => {
    if(newName.trim()) updateMaterial(id, newName, newSessions); toast({ title: 'Tersimpan' }); onRefresh();
  };
  const del = (id: string) => { const targetId = String(id); updateData(d => d.materials = d.materials.filter(m => String(m.id) !== targetId)); toast({ title: 'Dihapus' }); onRefresh(); };

  const mats = subId ? data.materials.filter(m => m.subjectId === subId).sort((a, b) => a.order - b.order) : [];
  
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = mats.findIndex(x => x.id === active.id);
      const newIndex = mats.findIndex(x => x.id === over.id);
      const reordered = arrayMove(mats, oldIndex, newIndex);
      reorderMaterials(subId, reordered.map(x => x.id));
      onRefresh();
    }
  };

  return (
    <div>
      <div className="bg-surface2/60 border border-border rounded-xl p-4 mb-4 shadow-sm">
        <FormField label="Pilih Mata Pelajaran" className="mb-0">
          <select value={subId} onChange={e => {setSubId(e.target.value); setName(''); setBulkText(''); }} className="form-select-style border-primary">
            <option value="">Pilih mata pelajaran...</option>
            {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
      </div>

      {subId && (
        <div className="bg-surface2/60 p-[14px] rounded-xl border border-border mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-foreground">Tambah Materi</span>
            <button onClick={() => setBulkMode(!bulkMode)} className="text-[11px] font-semibold text-primary px-2 py-1 bg-primary-dim rounded-md">{bulkMode ? 'Satu-satu' : 'Tambah Banyak'}</button>
          </div>
          {bulkMode ? (
            <>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"Bab 1 - Aljabar\nBab 2 - Geometri\n(Tiap baris jadi 1 materi)"} className="form-input-style min-h-[120px] mb-3 text-[13px] leading-relaxed resize-none font-mono" />
              <div className="flex items-center gap-2 mb-3">
                <label className="text-[10px] font-bold text-text2 uppercase tracking-wide whitespace-nowrap">Pertemuan per bab:</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setBulkSessions(n)}
                      className={`w-7 h-7 rounded-md text-xs font-bold border transition-all ${
                        bulkSessions === n ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border text-text2 hover:border-primary'
                      }`}>{n}×</button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} className="form-input-style mb-2" placeholder="cth: Bab 1 — Persamaan Linear" />
              <div className="flex items-center gap-2 mb-3">
                <label className="text-[10px] font-bold text-text2 uppercase tracking-wide whitespace-nowrap">Pertemuan:</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setSessions(n)}
                      className={`w-7 h-7 rounded-md text-xs font-bold border transition-all ${
                        sessions === n ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border text-text2 hover:border-primary'
                      }`}>{n}×</button>
                  ))}
                </div>
              </div>
            </>
          )}
          <button onClick={add} className="btn-primary-style bg-primary text-primary-foreground min-h-[44px]">＋ {bulkMode ? 'Tambah Semua' : 'Tambah'}</button>
        </div>
      )}

      {subId && (
        <>
          <div className="mt-5 mb-2 flex justify-between items-center">
            <span className="text-[11px] font-bold tracking-[0.7px] uppercase text-text3">Daftar Materi ({mats.length})</span>
            {mats.length > 1 && <span className="text-[10px] text-text2">Tahan &amp; geser untuk urutkan</span>}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={mats.map(m=>m.id)} strategy={verticalListSortingStrategy}>
              {mats.map((m, i) => <SortableMaterialItem key={m.id} id={m.id} item={{ ...m, meta: `Urutan ke-${i+1}` }} onSave={saveItem} onDelete={del} />)}
            </SortableContext>
          </DndContext>
          {!mats.length && <div className="text-text3 text-[13px] text-center py-6 border border-dashed rounded-lg mt-2">Belum ada materi</div>}
        </>
      )}
      {!subId && <div className="text-text3 text-[13px] text-center p-4 bg-surface2 rounded-lg mt-2 border border-border2">Pilih mapel di atas untuk melihat daftar materi</div>}
    </div>
  );
}


function SchedulesTab({ onRefresh }: { onRefresh: () => void }) {
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [duration, setDuration] = useState('45');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const { toast } = useToast();
  const data = getData();

  const toggleDay = (d: number, stateObj: number[], setter: any) => { setter(stateObj.includes(d) ? stateObj.filter(x => x !== d) : [...stateObj, d]); };

  const add = () => {
    if (!classId || !subjectId || !startTime || !selectedDays.length) return toast({ title: 'Lengkapi semua field' });
    if (checkOverlap(classId, selectedDays, startTime, parseInt(duration) || 45)) return toast({ title: 'Waktu bentrok' });
    updateData(d => {
      d.schedules.push({ id: genId(), classId, subjectId, days: [...selectedDays], startTime, duration: parseInt(duration) || 45 });
      if (!d.progress.find(p => p.classId === classId && p.subjectId === subjectId)) d.progress.push({ id: genId(), classId, subjectId, materialsDone: 0, lastSession: null });
    });
    setSelectedDays([]); toast({ title: 'Jadwal ditambahkan' }); onRefresh();
  };

  const saveItem = (id: string, sId: string, extras: any) => {
    updateSchedule(id, extras.days, extras.st, extras.dr); toast({ title: 'Jadwal diperbarui' }); onRefresh();
  };

  const del = (id: string) => {
    const targetId = String(id);
    updateData(d => {
      d.schedules = d.schedules.filter(s => String(s.id) !== targetId);
    });
    toast({ title: 'Jadwal dihapus' });
    onRefresh();
  };

  const dayOrder = [0, 1, 2, 3, 4, 5, 6];
  const schedulesByDay = dayOrder.map(day => ({
    day,
    schedules: data.schedules.filter(s => s.days.includes(day))
  })).filter(group => group.schedules.length > 0);

  return (
    <div>
      <div className="bg-surface2/60 p-[14px] rounded-xl border border-border mb-6 shadow-sm">
        <FormField label="Kelas & Mapel">
          <div className="flex gap-2 mb-3">
            <select value={classId} onChange={e => setClassId(e.target.value)} className="form-select-style flex-1 px-3 py-2 text-[13px]"><option value="">Pilih kelas...</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="form-select-style flex-1 px-3 py-2 text-[13px]"><option value="">Pilih mapel...</option>{data.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
        </FormField>
        <FormField label="Hari">
          <div className="flex gap-1 flex-wrap mb-3">
            {DAYS_SHORT.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i, selectedDays, setSelectedDays)}
                className={`px-[10px] py-[6px] rounded-md text-xs font-medium border transition-all ${selectedDays.includes(i) ? 'bg-primary border-primary text-primary-foreground shadow-sm' : 'bg-surface border-border text-text2'}`}>
                {d}
              </button>
            ))}
          </div>
        </FormField>
        <div className="flex gap-2 mb-3">
          <FormField label="Jam Mulai" className="flex-1 mb-0"><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="form-input-style py-2 border-border focus:border-primary" /></FormField>
          <FormField label="Durasi (mnt)" className="flex-1 mb-0"><input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="form-input-style py-2 border-border focus:border-primary" min={15} max={180} /></FormField>
        </div>
        <button onClick={add} className="btn-primary-style font-medium text-[13px] min-h-[44px]">＋ Tambah Jadwal</button>
      </div>

      <div className="mb-4">
        <div className="mb-3 text-[11px] font-bold tracking-[0.7px] uppercase text-text3 flex items-center justify-between">
          <span>Daftar Jadwal Mingguan</span>
          <span className="text-[10px] font-medium lowercase opacity-60">({data.schedules.length} total)</span>
        </div>
        
        {schedulesByDay.length === 0 && (
          <div className="text-text3 text-[13px] text-center py-6 border border-dashed rounded-lg mt-2">Belum ada jadwal</div>
        )}

        <div className="space-y-6">
          {schedulesByDay.map(group => (
            <div key={group.day} className="animate-slide-up">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[12px] font-bold text-foreground capitalize">{DAYS_ID[group.day]}</span>
                <div className="flex-1 h-[1px] bg-border/40 ml-1" />
              </div>
              <div className="space-y-2">
                {group.schedules
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map(s => {
                  const cls = data.classes.find(c => c.id === s.classId) || { name: '?' };
                  const sub = data.subjects.find(x => x.id === s.subjectId) || { name: '?' };
                  return (
                    <ScheduleEditableItem 
                      key={s.id} 
                      item={{ 
                        id: s.id, 
                        name: `${cls.name} — ${sub.name}`, 
                        meta: `${fmt(s.startTime)} · ${s.duration} mnt`, 
                        st: s.startTime, 
                        dr: s.duration, 
                        days: s.days 
                      }} 
                      onSave={saveItem} 
                      onDelete={del} 
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Special wrapper for Schedule to edit days, start time, duration
function ScheduleEditableItem({ item, onSave, onDelete }: any) {
  const [editing, setEditing] = useState(false);
  const [st, setSt] = useState(item.st);
  const [dr, setDr] = useState(item.dr);
  const [days, setDays] = useState<number[]>(item.days);
  const [delSheet, setDelSheet] = useState(false);

  const toggleDay = (d: number) => setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d]);

  if (editing) {
    return (
      <div className="bg-surface2 border border-primary-border rounded-lg p-3 mb-[6px]">
        <div className="text-sm font-bold mb-3">{item.name}</div>
        <div className="flex gap-1 flex-wrap mb-3">{DAYS_SHORT.map((d, i) => <button key={i} onClick={() => toggleDay(i)} className={`px-[10px] py-[6px] rounded-md text-[11px] font-medium border ${days.includes(i) ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border2 text-text2'}`}>{d}</button>)}</div>
        <div className="flex gap-2 mb-3">
          <input type="time" value={st} onChange={e => setSt(e.target.value)} className="form-input-style flex-1 h-9 px-2 text-xs" />
          <input type="number" value={dr} onChange={e => setDr(parseInt(e.target.value))} className="form-input-style flex-1 h-9 px-2 text-xs" placeholder="Durasi mnt" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { onSave(item.id, '', { st, dr, days }); setEditing(false); }} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-[13px] font-bold">Simpan</button>
          <button onClick={() => setEditing(false)} className="flex-1 py-2 bg-surface text-text2 border border-border rounded-md text-[13px] font-medium">Batal</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-lg p-[14px] flex items-center justify-between mb-[6px]">
        <div className="flex-1 min-w-0 pr-3">
          <div className="text-sm font-medium leading-snug">{item.name}</div>
          <div className="text-[11px] text-text2 mt-[4px] font-medium">{item.meta}</div>
        </div>
        <div className="flex gap-[4px] items-center flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="w-[32px] h-[32px] rounded-[9px] bg-surface2 text-text2 text-[12px] grid place-items-center">✏️</button>
          <button onClick={(e) => { e.stopPropagation(); setDelSheet(true); }} className="w-[32px] h-[32px] rounded-[9px] bg-[hsl(0_91%_71%/0.06)] text-[#FCA5A5] text-[11px] grid place-items-center">✕</button>
        </div>
      </div>
      <DeleteConfirmSheet open={delSheet} onOpenChange={setDelSheet} onConfirm={() => onDelete(item.id)} title="Hapus Jadwal?" desc={`Data historis sesi mengajar tidak dipengaruhi, tapi jadwal ${item.name} tidak akan muncul lagi.`} />
    </>
  );
}


function LiburTab({ onRefresh }: { onRefresh: () => void }) {
  const [date, setDate] = useState('');
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onRefresh(); };
  const { toast } = useToast();
  const holidays = getHolidays();
  const impacts = getHolidayImpactSummary();
  const [level, setLevel] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleAdd = () => {
    if (!date) return toast({ title: 'Pilih tanggal libur' });
    updateData(d => {
      if (!d.holidays) d.holidays = [];
      const index = d.holidays.findIndex(h => typeof h === 'string' ? h === date : h.date === date);
      if (index !== -1) {
        d.holidays.splice(index, 1); // remove existing
      }
      d.holidays.push(level ? { date, level } : date);
      d.holidays.sort((a, b) => {
        const da = typeof a === 'string' ? a : a.date;
        const db = typeof b === 'string' ? b : b.date;
        return da.localeCompare(db);
      });
    });
    setDate('');
    setLevel('');
    toast({ title: 'Hari libur ditambahkan ✓' });
    refresh();
  };

  const handleRemove = (d: any) => {
    const dStr = typeof d === 'string' ? d : d.date;
    updateData(data => { if (data.holidays) data.holidays = data.holidays.filter(h => (typeof h === 'string' ? h : h.date) !== dStr); });
    toast({ title: 'Libur dihapus' });
    refresh();
  };

  const formatDate = (d: string) => {
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div>
      <div className="bg-surface2/60 p-[14px] rounded-xl border border-border mb-6 shadow-sm">
        <div className="text-[12px] font-bold text-foreground mb-3">Tambah Hari Libur / Skip Dadakan</div>
        <div className="flex gap-2 mb-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input-style flex-1 h-10 border-border focus:border-primary" min={todayStr} />
          <select value={level} onChange={e => setLevel(e.target.value)} className="form-select-style flex-1 h-10 border-border">
            <option value="">Semua Jenjang</option>
            <option value="SD/MI">SD / MI</option>
            <option value="SMP/MTs">SMP / MTs</option>
            <option value="SMA/MA">SMA / MA</option>
          </select>
        </div>
        <button onClick={handleAdd} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold shadow-sm">+ Tambah Libur</button>
        <p className="text-[11px] text-text3 mt-2 leading-relaxed">Input tanggal di mana kelas tidak berlangsung: libur mendadak, acara sekolah, dll. Asisten akan mengecualikan tanggal ini dari perhitungan sesi.</p>
      </div>

      {impacts.length > 0 && (
        <div className="bg-[hsl(var(--warn-dim,35_90%_60%/0.08))] border border-[hsl(35_90%_60%/0.25)] rounded-xl p-3 mb-4">
          <div className="text-[11px] font-bold text-[hsl(35_90%_55%)] mb-2 uppercase tracking-wide">⚠ Dampak Hari Libur pada Jadwal</div>
          {impacts.map((imp, i) => (
            <div key={i} className="text-[12px] text-text2">
              <span className="font-semibold text-foreground">{imp.className} — {imp.subjectName}</span>: {imp.impactCount} sesi terpotong
            </div>
          ))}
        </div>
      )}

      <div className="mb-2 text-[11px] font-bold tracking-[0.7px] uppercase text-text3">Daftar Libur ({holidays.length})</div>
      {holidays.length === 0 && (
        <div className="text-text3 text-[13px] text-center py-6 border border-dashed rounded-lg">Belum ada hari libur yang diinput</div>
      )}
      {holidays.map((h, i) => {
        const dStr = typeof h === 'string' ? h : h.date;
        const levelStr = typeof h === 'string' || !h.level ? 'Semua Jenjang' : h.level;
        const isToday = dStr === todayStr;
        const isPast = dStr < todayStr;
        return (
          <div key={i} className={`bg-surface border rounded-lg p-[12px] flex items-center justify-between mb-[6px] ${
            isToday ? 'border-primary-border bg-primary-dim' : isPast ? 'border-border opacity-60' : 'border-border'
          }`}>
            <div>
              <div className="text-sm font-medium">{formatDate(dStr)}</div>
              <div className="flex gap-1 mt-[3px] items-center">
                <span className="text-[10px] bg-surface2 text-text2 rounded px-[5px] py-[1px] border">{levelStr}</span>
                {isToday && <span className="text-[10px] bg-primary text-white rounded px-[5px] py-[1px] font-bold">Hari ini</span>}
                {isPast && <span className="text-[10px] text-text3">(Sudah lewat)</span>}
              </div>
            </div>
            <button onClick={() => handleRemove(h)} className="w-[30px] h-[30px] rounded-lg bg-[hsl(0_91%_71%/0.06)] text-[#FCA5A5] text-xs grid place-items-center flex-shrink-0">✕</button>
          </div>
        );
      })}
    </div>
  );
}

function DataTab({ onRefresh }: { onRefresh: () => void }) {
  const [resetVal, setResetVal] = useState('');
  const [showReset, setShowReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importJSON(file); toast({ title: 'Data berhasil diimpor' }); onRefresh();
    } catch { toast({ variant: 'destructive', title: 'File tidak valid' }); }
  };

  const handleReset = () => {
    if (resetVal !== 'RESET') return;
    saveData({ teacherName: getData().teacherName || '', classes: [], subjects: [], materials: [], schedules: [], progress: [], sessions: [], notes: [], lastBackup: null, reminderDismissed: null });
    setShowReset(false); setResetVal(''); toast({ title: 'Semua data dihapus' }); onRefresh();
  };

  return (
    <div>
      <StorageInfo />
      <div className="bg-surface border border-border rounded-[20px] p-4 mb-[10px]">
        <div className="text-[13px] font-bold tracking-wide mb-[10px] flex items-center gap-[6px]">📤 EXPORT DATA</div>
        <div className="flex gap-[7px] flex-wrap">
          <button onClick={() => { exportJSON(); toast({ title: 'Backup JSON diunduh' }); }} className="data-btn-style bg-primary-dim text-primary border-primary-border">💾 Backup Full (JSON)</button>
          <button onClick={() => { exportCSV(); toast({ title: 'Riwayat CSV diunduh' }); }} className="data-btn-style">📋 Riwayat Sesi (CSV)</button>
        </div>
      </div>
      <div className="bg-surface border border-border rounded-[20px] p-4 mb-[10px]">
        <div className="text-[13px] font-bold tracking-wide mb-[10px] flex items-center gap-[6px]">📥 IMPORT DATA</div>
        <div className="flex gap-[7px] flex-wrap">
          <label className="data-btn-style cursor-pointer bg-surface2">
            📂 Upload JSON
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={() => { loadDemo(); toast({ title: 'Data demo dimuat' }); onRefresh(); }} className="data-btn-style text-text2">🧪 Muat Demo</button>
        </div>
      </div>
      
      <div className="bg-[linear-gradient(135deg,hsl(199_89%_60%/0.08)_0%,hsl(160_68%_52%/0.05)_100%)] border border-teal-border rounded-[20px] p-[18px] mb-[10px]">
        <div className="text-[11px] font-bold tracking-[0.7px] uppercase text-teal mb-[14px]">Push Notifikasi</div>
        <p className="text-[13px] text-text2 leading-[1.7] mb-3">
          Izinkan notifikasi agar EduTrack bisa mengingatkan Anda **5 menit sebelum sesi kelas dimulai**.
        </p>
        <button 
          onClick={async () => {
            const mod = await import('@/lib/notifications');
            const res = await mod.requestNotifPermission();
            alert(res ? 'Notifikasi aktif!' : 'Gagal mengaktifkan notifikasi / izin ditolak.');
          }}
          className="w-full py-[12px] bg-teal text-teal-950 text-sm font-bold rounded-lg shadow-teal transition-all active:scale-[0.98]"
        >
          🔔 Aktifkan Notifikasi Web
        </button>
      </div>

      <div className="bg-[hsl(0_91%_71%/0.04)] border border-[hsl(0_91%_71%/0.12)] rounded-[20px] p-4 mb-[10px]">
        <div className="text-[12px] font-bold mb-[10px] text-[#FCA5A5] uppercase tracking-wide">⚠️ Zona Berbahaya</div>
        {!showReset ? (
          <button onClick={() => setShowReset(true)} className="w-full py-3 rounded-lg bg-[hsl(0_91%_71%/0.07)] text-[#FCA5A5] font-semibold transition-all">🗑️ Reset Semua Data</button>
        ) : (
          <div className="animate-in fade-in slide-in-from-top-1">
            <p className="text-text2 text-xs mb-3">Tindakan ini tidak bisa dibatalkan. Ketik <strong className="text-red">RESET</strong> konfirmasi.</p>
            <input value={resetVal} onChange={e => setResetVal(e.target.value)} placeholder="Ketik RESET" className="form-input-style h-10 mb-2 border-red/40 focus:border-red" />
            <button onClick={handleReset} disabled={resetVal !== 'RESET'} className="w-full py-2.5 rounded-lg bg-red text-red-950 font-bold disabled:opacity-40">Hapus Permanen</button>
            <button onClick={() => { setShowReset(false); setResetVal(''); }} className="w-full py-3 text-text2 text-xs font-semibold mt-1">Batal</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children, className = '' }: any) {
  return <div className={`mb-3 ${className}`}><label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">{label}</label>{children}</div>;
}
// ── Leave Tab ────────────────────────────────────────────────────────────────
function LeaveTab({ onRefresh }: { onRefresh: () => void }) {
  const { toast } = useToast();
  const data = getData();

  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [leaveType, setLeaveType] = useState<'izin' | 'sakit'>('izin');
  const [keterangan, setKeterangan] = useState('');
  const [resolutions, setResolutions] = useState<Record<string, { action: 'deliver' | 'skip'; note: string }>>({});

  const dayOfWeek = date ? new Date(date).getDay() : -1;
  const schedules = useMemo(() => {
    if (dayOfWeek === -1) return [];
    return data.schedules.filter(s => s.days.includes(dayOfWeek)).map(s => {
      const cls = data.classes.find(c => c.id === s.classId);
      const sub = data.subjects.find(x => x.id === s.subjectId);
      const mats = data.materials.filter(m => m.subjectId === s.subjectId).sort((a, b) => a.order - b.order);
      const prog = data.progress.find(p => p.classId === s.classId && p.subjectId === s.subjectId);
      const mat = mats[prog ? prog.materialsDone : 0] || null;
      return { ...s, className: cls?.name, subjectName: sub?.name, nextMat: mat };
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [date, data.schedules, dayOfWeek, data.classes, data.subjects, data.materials, data.progress]);

  useEffect(() => {
    const newRes: Record<string, { action: 'deliver' | 'skip'; note: string }> = {};
    schedules.forEach(s => {
      newRes[s.id] = resolutions[s.id] || { action: 'deliver', note: 'Tugas Mandiri/Catatan' };
    });
    setResolutions(newRes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules]);

  const saveLeave = () => {
    if (!date) { toast({ title: 'Pilih tanggal izin terlebih dahulu' }); return; }
    if (schedules.length === 0) { toast({ title: 'Tidak ada jadwal di tanggal ini' }); return; }
    const resArray = Object.entries(resolutions).map(([scheduleId, res]) => ({
      scheduleId,
      action: res.action,
      note: res.action === 'deliver'
        ? res.note || `Otomatis: Tugas Mandiri (${leaveType === 'sakit' ? 'Sakit' : 'Izin'})`
        : `Otomatis: Kelas Kosong/Diluar Jadwal (${leaveType === 'sakit' ? 'Sakit' : 'Izin'})`,
    }));
    const reasonStr = leaveType === 'sakit' ? 'Sakit' : 'Izin';
    const fullReason = keterangan.trim() ? `${reasonStr}: ${keterangan.trim()}` : reasonStr;
    applyTeacherLeave(date, fullReason, resArray);
    toast({ title: '✓ Izin Disimpan', description: 'Sesi otomatis disetup.' });
    onRefresh();
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="bg-surface border border-border rounded-[20px] p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/30 flex items-center justify-center text-xl flex-shrink-0">🏥</div>
          <div>
            <div className="font-display text-[18px] font-bold tracking-tight leading-tight">Pengajuan Izin</div>
            <div className="text-[11px] text-text2">Atur sesi kelas jika berhalangan hadir.</div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Tanggal</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input-style" />
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Jenis</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLeaveType('izin')}
              className={`py-3 rounded-2xl border text-sm font-bold flex flex-col items-center gap-1 transition-all ${leaveType === 'izin' ? 'bg-primary-dim border-primary-border text-primary shadow-sm' : 'bg-surface border-border2 text-text2 hover:border-border3'}`}
            >
              <span className="text-xl">📋</span>
              <span>Izin</span>
            </button>
            <button
              onClick={() => setLeaveType('sakit')}
              className={`py-3 rounded-2xl border text-sm font-bold flex flex-col items-center gap-1 transition-all ${leaveType === 'sakit' ? 'bg-red/10 border-red/30 text-red shadow-sm' : 'bg-surface border-border2 text-text2 hover:border-border3'}`}
            >
              <span className="text-xl">🤒</span>
              <span>Sakit</span>
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">
            Keterangan <span className="normal-case font-normal text-text3">(opsional)</span>
          </label>
          <input
            type="text"
            placeholder={leaveType === 'sakit' ? 'mis. Demam, periksa ke dokter...' : 'mis. Rapat dinas, urusan keluarga...'}
            value={keterangan}
            onChange={e => setKeterangan(e.target.value)}
            className="form-input-style"
          />
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">
            Penyesuaian Jadwal ({schedules.length} Kelas)
          </label>
          {schedules.length === 0 ? (
            <div className="text-center py-6 bg-surface2 border border-border2 rounded-xl text-text3 text-sm">
              Tidak ada jadwal mengajar pada hari ini.
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map(s => {
                const res = resolutions[s.id] || { action: 'deliver', note: '' };
                const isDeliver = res.action === 'deliver';
                return (
                  <div key={s.id} className="bg-surface2 border border-border2 rounded-xl p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 pr-2">
                        <div className="text-[14px] font-bold">{s.className}</div>
                        <div className="text-[12px] text-text2">{s.subjectName} · {s.startTime}</div>
                        {s.nextMat && <div className="text-[10px] text-text3 mt-0.5 truncate">Materi: {s.nextMat.name}</div>}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0 bg-surface p-1 rounded-lg border border-border/50">
                        <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${isDeliver ? 'bg-green/10 text-green ring-1 ring-green/30' : 'text-text3 hover:bg-surface3'}`}>
                          <input type="radio" checked={isDeliver} onChange={() => setResolutions(p => ({...p, [s.id]: {...p[s.id], action: 'deliver'}}))} className="hidden" />
                          ✓ Titip Tugas
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${!isDeliver ? 'bg-red/10 text-red ring-1 ring-red/30' : 'text-text3 hover:bg-surface3'}`}>
                          <input type="radio" checked={!isDeliver} onChange={() => setResolutions(p => ({...p, [s.id]: {...p[s.id], action: 'skip'}}))} className="hidden" />
                          ⏭ Skip Kelas
                        </label>
                      </div>
                    </div>
                    {isDeliver && (
                      <input
                        type="text"
                        placeholder="Contoh: Kerjakan Modul Hal 45-48"
                        value={res.note}
                        onChange={e => setResolutions(p => ({...p, [s.id]: {...p[s.id], note: e.target.value}}))}
                        className="w-full bg-surface border border-border2 rounded-md px-2.5 py-1.5 text-[11px] focus:border-primary focus:outline-none placeholder:text-text3 mt-1"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button onClick={saveLeave} disabled={schedules.length === 0} className="btn-primary-style disabled:opacity-50 disabled:cursor-not-allowed">
          ✓ Terapkan Izin
        </button>
      </div>
    </div>
  );
}

function StorageInfo() {
  const info = estimateStorageSize();
  const data = getData();
  const color = info.pct > 80 ? 'text-red' : info.pct > 50 ? 'text-amber' : 'text-green';
  const barColor = info.pct > 80 ? 'bg-red' : info.pct > 50 ? 'bg-amber' : 'bg-green';
  const kb = Math.round(info.used / 1024);
  return (
    <div className="bg-surface border border-border rounded-[20px] p-4 mb-[10px]">
      <div className="text-[13px] font-bold tracking-wide mb-3 flex items-center justify-between">
        <span className="flex items-center gap-[6px]">💾 PENYIMPANAN LOKAL</span>
        <span className={"text-[11px] font-bold " + color}>{info.pct}% terpakai</span>
      </div>
      <div className="h-2 bg-surface3 rounded-full overflow-hidden mb-2">
        <div className={"h-full rounded-full transition-all " + barColor} style={{ width: info.pct + '%' }} />
      </div>
      <div className="text-[11px] text-text3 flex justify-between mb-3">
        <span>{kb} KB digunakan</span>
        <span>{Math.round(info.total / 1024)} KB total</span>
      </div>
      <div className="text-[11px] text-text3 flex gap-4 flex-wrap mb-3">
        <span>📋 {data.sessions.length} sesi</span>
        <span>📚 {data.materials.length} materi</span>
        <span>📅 {data.schedules.length} jadwal</span>
        <span>✅ {(data.tasks ?? []).length} tugas</span>
      </div>
      <button
        onClick={() => { pruneOldSessions(); window.location.reload(); }}
        className="data-btn-style text-amber border-amber/30 bg-amber/5 text-xs"
      >
        🧹 Bersihkan data lama (&gt;90 hari)
      </button>
    </div>
  );
}
