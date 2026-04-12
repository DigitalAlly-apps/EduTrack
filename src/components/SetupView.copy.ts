import { useState, useRef } from 'react';
import {
  getData, updateData, genId, DAYS_SHORT, fmt, checkOverlap, saveData,
  exportJSON, exportCSV, importJSON, loadDemo,
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
  const { toast } = useToast();
  const data = getData();
  const comp = {
    classes: data.classes.length > 0,
    subjects: data.subjects.length > 0,
    materials: data.materials.length > 0,
    schedules: data.schedules.length > 0,
  };

  const tabs: { id: SetupTab; label: string; step: number | null }[] = [
    { id: 'classes', label: 'Kelas', step: 1 },
    { id: 'subjects', label: 'Mapel', step: 2 },
    { id: 'materials', label: 'Materi', step: 3 },
    { id: 'schedules', label: 'Jadwal', step: 4 },
    { id: 'data', label: 'Data', step: null },
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

      {!Object.values(comp).every(Boolean) && (
        <div className="bg-surface border border-border2 rounded-lg p-3 text-xs text-text2 flex items-start gap-2 mb-3 leading-relaxed">
          <span className="text-sm flex-shrink-0">ℹ️</span>
          <span>Ikuti urutan: Kelas → Mapel → Materi → Jadwal.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-[14px] overflow-x-auto pb-[2px] scrollbar-none">
        {tabs.map(t => {
          const done = t.step ? (comp as any)[t.id] : true;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-[13px] py-[7px] rounded-full text-xs font-medium border transition-all whitespace-nowrap inline-flex items-center gap-[5px] ${
                active ? 'bg-primary-dim border-primary-border text-primary' :
                t.step && done ? 'bg-surface border-green text-green' :
                'bg-surface border-border text-text2 hover:border-border2 hover:text-foreground'
              }`}
            >
              {t.step && (
                <span className={`w-4 h-4 rounded-full inline-flex items-center justify-center text-[9px] font-bold ${
                  active ? 'bg-[hsl(37_78%_56%/0.2)]' :
                  done ? 'bg-[hsl(160_68%_52%/0.15)]' : 'bg-[hsl(var(--border2))]'
                }`}>
                  {done && !active ? '✓' : t.step}
                </span>
              )}
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'classes' && <ClassesTab onRefresh={refresh} />}
      {tab === 'subjects' && <SubjectsTab onRefresh={refresh} />}
      {tab === 'materials' && <MaterialsTab onRefresh={refresh} />}
      {tab === 'schedules' && <SchedulesTab onRefresh={refresh} />}
      {tab === 'data' && <DataTab onRefresh={refresh} />}
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

function ClassesTab({ onRefresh }: { onRefresh: () => void }) {
  const [name, setName] = useState('');
  const { toast } = useToast();
  const data = getData();

  const add = () => {
    if (!name.trim()) { toast({ title: 'Masukkan nama kelas' }); return; }
    updateData(d => d.classes.push({ id: genId(), name: name.trim(), color: 'blue' }));
    setName('');
    toast({ title: 'Kelas ditambahkan' });
    onRefresh();
  };

  const del = (id: string) => {
    updateData(d => {
      d.classes = d.classes.filter(c => c.id !== id);
      d.schedules = d.schedules.filter(s => s.classId !== id);
      d.progress = d.progress.filter(p => p.classId !== id);
      d.sessions = d.sessions.filter(s => s.classId !== id);
    });
    toast({ title: 'Kelas dihapus' });
    onRefresh();
  };

  return (
    <div>
      <FormField label="Nama Kelas">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          className="form-input-style" placeholder="cth: 10A, XI IPA 2..." />
      </FormField>
      <button onClick={add} className="btn-primary-style">Tambah Kelas</button>
      <ItemList items={data.classes.map(c => ({ id: c.id, name: c.name }))} onDelete={del} emptyText="Belum ada kelas" />
    </div>
  );
}

function SubjectsTab({ onRefresh }: { onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const { toast } = useToast();
  const data = getData();

  const add = () => {
    if (!name.trim()) { toast({ title: 'Masukkan nama mata pelajaran' }); return; }
    updateData(d => d.subjects.push({ id: genId(), name: name.trim(), examDate: examDate || null }));
    setName(''); setExamDate('');
    toast({ title: 'Mapel ditambahkan' });
    onRefresh();
  };

  const del = (id: string) => {
    updateData(d => {
      d.subjects = d.subjects.filter(s => s.id !== id);
      d.materials = d.materials.filter(m => m.subjectId !== id);
      d.schedules = d.schedules.filter(s => s.subjectId !== id);
    });
    toast({ title: 'Mapel dihapus' });
    onRefresh();
  };

  return (
    <div>
      <FormField label="Mata Pelajaran">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          className="form-input-style" placeholder="cth: Matematika, Fisika..." />
      </FormField>
      <FormField label="Tanggal Ujian (opsional)">
        <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="form-input-style" />
      </FormField>
      <button onClick={add} className="btn-primary-style">Tambah Mata Pelajaran</button>
      <ItemList items={data.subjects.map(s => ({ id: s.id, name: s.name, meta: s.examDate ? `Ujian: ${s.examDate}` : undefined }))} onDelete={del} emptyText="Belum ada mata pelajaran" />
    </div>
  );
}

function MaterialsTab({ onRefresh }: { onRefresh: () => void }) {
  const [subId, setSubId] = useState('');
  const [name, setName] = useState('');
  const { toast } = useToast();
  const data = getData();

  const add = () => {
    if (!subId || !name.trim()) { toast({ title: 'Pilih mapel dan isi nama materi' }); return; }
    const maxOrder = Math.max(0, ...data.materials.filter(m => m.subjectId === subId).map(m => m.order));
    updateData(d => d.materials.push({ id: genId(), subjectId: subId, name: name.trim(), order: maxOrder + 1 }));
    setName('');
    toast({ title: 'Materi ditambahkan' });
    onRefresh();
  };

  const del = (id: string) => {
    updateData(d => d.materials = d.materials.filter(m => m.id !== id));
    toast({ title: 'Materi dihapus' });
    onRefresh();
  };

  const mats = subId
    ? data.materials.filter(m => m.subjectId === subId).sort((a, b) => a.order - b.order)
    : data.materials.slice(0, 20);

  return (
    <div>
      <FormField label="Mata Pelajaran">
        <select value={subId} onChange={e => setSubId(e.target.value)} className="form-select-style">
          <option value="">Pilih mata pelajaran...</option>
          {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </FormField>
      <FormField label="Nama Materi / Bab">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          className="form-input-style" placeholder="cth: Bab 1 — Persamaan Linear" />
      </FormField>
      <button onClick={add} className="btn-primary-style">Tambah Materi</button>
      <ItemList
        items={mats.map(m => {
          const sub = data.subjects.find(s => s.id === m.subjectId);
          return { id: m.id, name: m.name, meta: `${!subId ? `${sub?.name || '?'} · ` : ''}Urutan ${m.order}` };
        })}
        onDelete={del}
        emptyText={subId ? 'Belum ada materi' : 'Pilih mapel untuk melihat materi'}
      />
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

  const toggleDay = (d: number) => {
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const add = () => {
    if (!classId || !subjectId || !startTime || !selectedDays.length) {
      toast({ title: 'Lengkapi semua field dan pilih hari' }); return;
    }
    if (checkOverlap(classId, selectedDays, startTime, parseInt(duration) || 45)) {
      toast({ title: 'Waktu bentrok dengan jadwal kelas yang sama' }); return;
    }
    updateData(d => {
      d.schedules.push({ id: genId(), classId, subjectId, days: [...selectedDays], startTime, duration: parseInt(duration) || 45 });
      if (!d.progress.find(p => p.classId === classId && p.subjectId === subjectId))
        d.progress.push({ id: genId(), classId, subjectId, materialsDone: 0, lastSession: null });
    });
    setSelectedDays([]);
    toast({ title: 'Jadwal ditambahkan' });
    onRefresh();
  };

  const del = (id: string) => {
    updateData(d => d.schedules = d.schedules.filter(s => s.id !== id));
    toast({ title: 'Jadwal dihapus' });
    onRefresh();
  };

  return (
    <div>
      <FormField label="Kelas">
        <select value={classId} onChange={e => setClassId(e.target.value)} className="form-select-style">
          <option value="">Pilih kelas...</option>
          {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FormField>
      <FormField label="Mata Pelajaran">
        <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="form-select-style">
          <option value="">Pilih mapel...</option>
          {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </FormField>
      <FormField label="Hari">
        <div className="flex gap-1 flex-wrap">
          {DAYS_SHORT.map((d, i) => (
            <button key={i} onClick={() => toggleDay(i)}
              className={`px-[11px] py-[7px] rounded-full text-xs font-medium border transition-all min-h-[36px] ${
                selectedDays.includes(i) ? 'bg-teal-dim border-teal text-teal' : 'bg-surface border-border text-text2'
              }`}>
              {d}
            </button>
          ))}
        </div>
      </FormField>
      <div className="flex gap-2">
        <FormField label="Jam Mulai" className="flex-1">
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="form-input-style" />
        </FormField>
        <FormField label="Durasi (mnt)" className="flex-1">
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="form-input-style" min={15} max={180} />
        </FormField>
      </div>
      <button onClick={add} className="btn-primary-style">Tambah Jadwal</button>
      <ItemList
        items={data.schedules.map(s => {
          const cls = data.classes.find(c => c.id === s.classId) || { name: '?' };
          const sub = data.subjects.find(x => x.id === s.subjectId) || { name: '?' };
          const daysStr = s.days.map(d => DAYS_SHORT[d]).join(', ');
          return { id: s.id, name: `${cls.name} — ${sub.name}`, meta: `${daysStr} · ${fmt(s.startTime)} · ${s.duration || 45} mnt` };
        })}
        onDelete={del}
        emptyText="Belum ada jadwal"
      />
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
      await importJSON(file);
      toast({ title: 'Data berhasil diimpor' });
      onRefresh();
    } catch { toast({ title: 'File tidak valid' }); }
  };

  const handleReset = () => {
    if (resetVal !== 'RESET') return;
    const name = getData().teacherName || '';
    const fresh = { teacherName: name, classes: [], subjects: [], materials: [], schedules: [], progress: [], sessions: [], notes: [] } as any;
    saveData(fresh);
    setShowReset(false);
    setResetVal('');
    toast({ title: 'Semua data dihapus' });
    onRefresh();
  };

  const handleLoadDemo = () => {
    loadDemo();
    toast({ title: 'Data demo dimuat' });
    onRefresh();
  };

  return (
    <div>
      <div className="bg-surface border border-border rounded-[20px] p-4 mb-[10px]">
        <div className="text-[13px] font-semibold mb-[10px] flex items-center gap-[6px]">📤 Export Data</div>
        <div className="flex gap-[7px] flex-wrap">
          <button onClick={() => { exportJSON(); toast({ title: 'Backup JSON diunduh' }); }} className="data-btn-style">💾 JSON</button>
          <button onClick={() => { exportCSV(); toast({ title: 'CSV diunduh' }); }} className="data-btn-style">📋 CSV</button>
        </div>
      </div>
      <div className="bg-surface border border-border rounded-[20px] p-4 mb-[10px]">
        <div className="text-[13px] font-semibold mb-[10px] flex items-center gap-[6px]">📥 Import Data</div>
        <div className="flex gap-[7px] flex-wrap">
          <label className="data-btn-style cursor-pointer">
            📂 Upload JSON
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleLoadDemo} className="data-btn-style">🧪 Demo</button>
        </div>
      </div>
      <div className="bg-surface border border-[hsl(0_91%_71%/0.16)] rounded-[20px] p-4 mb-[10px]">
        <div className="text-[13px] font-semibold mb-[10px] flex items-center gap-[6px] text-[#FCA5A5]">⚠️ Zona Berbahaya</div>
        {!showReset ? (
          <button onClick={() => setShowReset(true)} className="w-full py-3 rounded-lg bg-[hsl(0_91%_71%/0.07)] border border-[hsl(0_91%_71%/0.16)] text-[#FCA5A5] text-sm font-medium transition-all hover:bg-[hsl(0_91%_71%/0.13)] min-h-[44px]">
            🗑️ Reset Semua Data
          </button>
        ) : (
          <div>
            <p className="text-text2 text-[13px] mb-4 leading-relaxed">
              Tindakan ini tidak bisa dibatalkan. Ketik <strong className="text-red">RESET</strong> untuk konfirmasi.
            </p>
            <input value={resetVal} onChange={e => setResetVal(e.target.value)} placeholder="Ketik RESET di sini..."
              className="form-input-style mb-3" />
            <button onClick={handleReset} disabled={resetVal !== 'RESET'}
              className={`w-full py-3 rounded-lg bg-[hsl(0_91%_71%/0.07)] border border-[hsl(0_91%_71%/0.16)] text-[#FCA5A5] text-sm font-medium transition-all min-h-[44px] ${resetVal !== 'RESET' ? 'opacity-40 cursor-not-allowed' : ''}`}>
              Hapus Semua Data
            </button>
            <button onClick={() => { setShowReset(false); setResetVal(''); }} className="w-full py-[13px] text-text2 text-[13px] mt-2">Batal</button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoView() {
  return null; // placeholder
}

// Shared sub-components
function FormField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-3 ${className}`}>
      <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">{label}</label>
      {children}
    </div>
  );
}

function ItemList({ items, onDelete, emptyText }: { items: { id: string; name: string; meta?: string }[]; onDelete: (id: string) => void; emptyText: string }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="mt-[14px]">
      {items.map(item => (
        <div key={item.id} className={`bg-surface border rounded-lg p-3 flex items-center justify-between mb-[5px] transition-colors ${
          confirmId === item.id ? 'border-[hsl(0_91%_71%/0.3)] bg-[hsl(0_91%_71%/0.03)]' : 'border-border'
        }`}>
          <div>
            <div className="text-sm font-medium">{item.name}</div>
            {item.meta && <div className="text-[11px] text-text2 mt-[2px]">{item.meta}</div>}
          </div>
          <div className="flex gap-[5px] items-center flex-shrink-0">
            {confirmId === item.id ? (
              <>
                <button onClick={() => setConfirmId(null)} className="px-[10px] py-[5px] rounded-[7px] bg-surface2 border border-border2 text-text2 text-[11px] font-medium">Batal</button>
                <button onClick={() => { onDelete(item.id); setConfirmId(null); }} className="px-[10px] py-[5px] rounded-[7px] bg-[hsl(0_91%_71%/0.13)] border border-[hsl(0_91%_71%/0.22)] text-[#FCA5A5] text-[11px] font-bold">Hapus</button>
              </>
            ) : (
              <button onClick={() => setConfirmId(item.id)} className="w-8 h-8 rounded-lg bg-[hsl(0_91%_71%/0.06)] border border-[hsl(0_91%_71%/0.1)] text-[#FCA5A5] text-xs grid place-items-center transition-all hover:bg-[hsl(0_91%_71%/0.13)]">✕</button>
            )}
          </div>
        </div>
      ))}
      {!items.length && <div className="text-text3 text-[13px] text-center py-6">{emptyText}</div>}
    </div>
  );
}
