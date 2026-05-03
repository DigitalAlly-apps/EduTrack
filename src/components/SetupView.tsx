import { useState, useRef, useMemo, useEffect, type ElementType } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getData, updateData, genId, DAYS_SHORT, DAYS_ID, fmt, checkOverlap, saveData, dateKey, dateFromKey,
  exportJSON, exportCSV, importJSON, loadDemo, updateClass, updateSubject, bulkUpdateExamDateByLevel, updateMaterial, updateSchedule, reorderMaterials, bulkAddMaterials, estimateStorageSize, pruneOldSessions,
  addHoliday, removeHoliday, getHolidays, getHolidayImpactSummary, getMaterials, setAcademicYear, applyTeacherLeave, parseMaterialDraftLines,
} from '@/lib/data';
import { SetupTab } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { requestNotifPermission } from '@/lib/notifications';
import { Bell, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Database, Download, FlaskConical, GraduationCap, HardDrive, HeartPulse, Palmtree, Pencil, RotateCcw, Save, ShieldAlert, SkipForward, SlidersHorizontal, Stethoscope, Trash2, Upload, UserRound, X } from 'lucide-react';

interface SetupViewProps {
  onRefresh: () => void;
}

export default function SetupView({ onRefresh }: SetupViewProps) {
  const data = getData();
  const showGettingStarted = data.classes.length === 0 || data.subjects.length === 0;
  // Default to classes if first time, otherwise show menu
  const [tab, setTab] = useState<SetupTab | null>(showGettingStarted ? 'classes' : null);
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onRefresh(); };

  const tabs: { id: SetupTab; label: string; desc: string; icon: ElementType; group: string }[] = [
    { id: 'classes', label: 'Daftar Kelas', desc: 'Atur rombongan belajar', icon: GraduationCap, group: 'akademik' },
    { id: 'subjects', label: 'Mata Pelajaran', desc: 'Daftar mapel yang diajar', icon: BookOpen, group: 'akademik' },
    { id: 'schedules', label: 'Jadwal Mengajar', desc: 'Atur jadwal mingguan', icon: CalendarDays, group: 'akademik' },
    { id: 'materials', label: 'Materi & Silabus', desc: 'Atur urutan materi (bab)', icon: SlidersHorizontal, group: 'akademik' },
    { id: 'holidays', label: 'Hari Libur', desc: 'Kalender libur akademik', icon: Palmtree, group: 'sistem' },
    { id: 'leave', label: 'Izin Mengajar', desc: 'Titip tugas atau cuti', icon: HeartPulse, group: 'sistem' },
    { id: 'data', label: 'Backup & Data', desc: 'Export, import & hapus data', icon: Database, group: 'sistem' },
  ];
  const ActiveTabIcon = tab ? tabs.find(t => t.id === tab)?.icon : null;

  return (
    <div className="pt-2 animate-fade-in">
      {/* Getting Started Guide — when no classes or subjects yet */}
      {showGettingStarted && (
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/30 rounded-3xl p-5 mb-4 shadow-sm animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-xl flex-shrink-0">
              👋
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-foreground mb-1">Selamat Datang di EduTrack!</div>
              <div className="text-[13px] text-text2 leading-relaxed">
                Mari kita atur data dasar dulu sebelum mulai mengajar. Ikuti langkah-langkah berikut:
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary flex-shrink-0 mt-0.5">1</span>
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">Tambahkan Kelas</div>
                    <div className="text-[12px] text-text2">Misal: 10A, 10B, 11 IPA (tab <strong>Kelas</strong>)</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary flex-shrink-0 mt-0.5">2</span>
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">Tambahkan Mapel</div>
                    <div className="text-[12px] text-text2">Misal: Matematika, Fisika (tab <strong>Mapel</strong>)</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary flex-shrink-0 mt-0.5">3</span>
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">Atur Jadwal & Materi</div>
                    <div className="text-[12px] text-text2">Setelah data dasar selesai, buka tab <strong>Jadwal</strong> dan <strong>Materi</strong></div>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-primary/20">
                <button
                  onClick={() => setTab('classes')}
                  className="text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-lg border border-primary/20 transition-colors"
                >
                  Mulai Mengatur Sekarang →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Profile */}
      <div className="app-card p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center flex-shrink-0 ring-4 ring-primary/5 text-primary">
            <UserRound className="h-6 w-6" />
          </div>
           <div className="flex-1 min-w-0">
             <div className="text-base font-black tracking-tight truncate">
               {data.teacherName || 'Belum diisi'}
             </div>
             <div className="text-[11px] text-text3 font-medium truncate mb-1">Guru / Pengajar</div>
             <div className="text-[9px] font-bold uppercase tracking-wider text-primary">
               &#x2736; {data.classes.length} Kelas &middot; {data.subjects?.length ?? 0} Mapel
             </div>
             {data.academicYear ? (
               <div className="text-[11px] text-text2 mt-1 flex items-center gap-1.5">
                 <span className="opacity-60">📅</span>
                 <span className="truncate">Tahun Ajaran: {data.academicYear}</span>
               </div>
             ) : (
               <div className="text-[11px] text-amber mt-1 flex items-center gap-1.5">
                 <span>⚠️</span>
                 <span>Belum mengatur tahun ajaran</span>
               </div>
             )}
           </div>
           <div className="flex flex-col gap-2">
             <EditTeacherButton onRefresh={refresh} />
             <EditAcademicYearButton onRefresh={refresh} />
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      {tab === null ? (
        // ─── SETTINGS MENU LIST ───
        <div className="space-y-4 animate-slide-up pb-10">
          <div>
            <div className="app-section-title mb-2">Akademik & Jadwal</div>
            <div className="app-card overflow-hidden">
              {tabs.filter(t => t.group === 'akademik').map((t, idx, arr) => {
                const Icon = t.icon;
                return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-surface2 active:bg-surface3 ${
                    idx !== arr.length - 1 ? 'border-b border-border/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary flex-shrink-0 shadow-inner">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-foreground leading-tight">{t.label}</div>
                      <div className="text-[12px] text-text3 mt-0.5">{t.desc}</div>
                    </div>
                  </div>
                  <span className="text-text3 text-lg opacity-50">›</span>
                </button>
              );})}
            </div>
          </div>
          
          <div>
            <div className="app-section-title mb-2">Sistem & Lainnya</div>
            <div className="app-card overflow-hidden">
              {tabs.filter(t => t.group === 'sistem').map((t, idx, arr) => {
                const Icon = t.icon;
                return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-surface2 active:bg-surface3 ${
                    idx !== arr.length - 1 ? 'border-b border-border/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-surface2 border border-border2 flex items-center justify-center text-text2 flex-shrink-0 shadow-inner">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-foreground leading-tight">{t.label}</div>
                      <div className="text-[12px] text-text3 mt-0.5">{t.desc}</div>
                    </div>
                  </div>
                  <span className="text-text3 text-lg opacity-50">›</span>
                </button>
              );})}
            </div>
          </div>
        </div>
      ) : (
        // ─── ACTIVE TAB COMPONENT ───
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-4 px-1">
            <button
              onClick={() => setTab(null)}
              className="text-[13px] font-bold text-primary flex items-center gap-1.5 hover:underline decoration-primary/50 underline-offset-4 bg-primary/5 px-3 py-1.5 rounded-xl transition-all active:scale-95"
            >
              <span className="text-lg leading-none mt-[-2px]">‹</span> Kembali
            </button>
            <div className="text-[13px] font-bold text-text2 flex items-center gap-1.5">
              {ActiveTabIcon && <ActiveTabIcon className="h-4 w-4" />}
              {tabs.find(t => t.id === tab)?.label}
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
      )}
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
    <button onClick={startEdit} className="px-3 py-2 rounded-xl bg-surface2 border border-border2 text-xs text-text2 transition-all hover:text-foreground hover:border-border3 flex items-center gap-1.5">
      <Pencil className="h-3.5 w-3.5" /> Edit
    </button>
  );
}

function EditAcademicYearButton({ onRefresh }: { onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [year, setYear] = useState('');
  const { toast } = useToast();

  const startEdit = () => { setYear(getData().academicYear || ''); setEditing(true); };
  const save = () => {
    if (!year.trim()) { toast({ title: 'Masukkan tahun ajaran' }); return; }
    setAcademicYear(year.trim());
    setEditing(false);
    toast({ title: 'Tahun ajaran disimpan ✓' });
    onRefresh();
  };

  if (editing) {
    return (
      <div className="flex gap-1">
        <input value={year} onChange={e => setYear(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
          className="w-32 bg-surface border border-border2 rounded-lg px-2 py-1 text-xs" autoFocus placeholder="Contoh: 2024/2025" />
        <button onClick={save} className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold">✓</button>
      </div>
    );
  }
  return (
    <button onClick={startEdit} className="px-3 py-2 rounded-xl bg-surface2 border border-border2 text-xs text-text2 transition-all hover:text-foreground hover:border-border3 flex items-center gap-1.5">
      <CalendarDays className="h-3.5 w-3.5" /> Atur
    </button>
  );
}

function DeleteConfirmSheet({ open, onOpenChange, onConfirm, title, desc }: any) {
  if (!open) return null;
  return createPortal(
    <div className="app-overlay z-[600] animate-in fade-in transition-all" onClick={() => onOpenChange(false)}>
      <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
        <div className="app-sheet-handle" />
        <div className="app-sheet-title mb-2">{title}</div>
        <div className="text-sm text-text2 mb-6 leading-relaxed bg-red/10 border border-red/20 p-4 rounded-2xl text-red/90">{desc}</div>
        <div className="flex gap-3">
          <button onClick={() => onOpenChange(false)} className="flex-1 py-[14px] bg-surface border border-border2 rounded-xl text-sm font-medium transition-all hover:bg-surface2">Batal</button>
          <button onClick={() => { onConfirm(); onOpenChange(false); }} className="flex-1 py-[14px] bg-red/10 border border-red/25 text-red rounded-xl text-sm font-bold transition-all active:scale-[0.98]">Ya, Hapus</button>
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
      <div className="app-list-item flex items-center justify-between mb-2 relative group">
        <div className="flex-1 min-w-0 pr-3">
          <div className="text-sm font-medium leading-snug">{item.name}</div>
          {item.meta && <div className="text-[11px] text-text2 mt-[4px] font-medium">{item.meta}</div>}
        </div>
        <div className="flex gap-[6px] items-center flex-shrink-0">
          <button onClick={() => setEditing(true)} className="app-icon-button w-9 h-9 hover:text-primary" aria-label="Edit item"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => setDelSheet(true)} className="w-9 h-9 rounded-2xl bg-red/10 border border-red/20 text-red grid place-items-center transition-all hover:bg-red/15 active:scale-95" aria-label="Hapus item"><Trash2 className="h-4 w-4" /></button>
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
  const [pageStart, setPageStart] = useState(item.pageStart || '');
  const [pageEnd, setPageEnd] = useState(item.pageEnd || '');
  const [note, setNote] = useState(item.note || '');
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
        <div className="flex gap-2 mb-2">
          <input value={pageStart} onChange={e => setPageStart(e.target.value)} className="form-input-style h-10 flex-1" placeholder="Hal. mulai" />
          <input value={pageEnd} onChange={e => setPageEnd(e.target.value)} className="form-input-style h-10 flex-1" placeholder="Hal. akhir" />
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} className="form-input-style min-h-[70px] mb-2 resize-none text-[13px]" placeholder="Catatan opsional, cth: banyak latihan soal" />
        <div className="flex gap-2">
          <button onClick={() => { onSave(id, val, sessVal, { pageStart, pageEnd, note }); setEditing(false); }} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-[13px] font-bold">Simpan</button>
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
      <div ref={setNodeRef} style={style} className={`bg-surface border ${isDragging ? 'border-primary border-[2px] shadow-lg' : 'border-border'} rounded-2xl p-3 flex items-center justify-between mb-2`}>
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
          <div {...attributes} {...listeners} className="text-text3 cursor-grab p-1 touch-none">≡</div>
          <div>
            <div className="text-sm font-medium leading-snug">{item.name}{sessBadge}</div>
            <div className="text-[11px] text-text2 mt-[2px] leading-snug">{item.meta}</div>
          </div>
        </div>
        <div className="flex gap-[4px] items-center flex-shrink-0">
          <button onClick={() => setEditing(true)} className="app-icon-button w-9 h-9" aria-label="Edit materi"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => setDelSheet(true)} className="w-9 h-9 rounded-2xl bg-red/10 text-red border border-red/20 grid place-items-center transition-all hover:bg-red/15 active:scale-95" aria-label="Hapus materi"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <DeleteConfirmSheet open={delSheet} onOpenChange={setDelSheet} onConfirm={() => onDelete(id)} title={`Hapus "${item.name}"?`} desc="Data progres kelas untuk materi ini akan terpengaruh jika sudah dilewati." />
    </>
  );
}


function ClassesTab({ onRefresh }: { onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const { toast } = useToast();
  const data = getData();

  const add = () => {
    if (!name.trim()) return toast({ title: 'Masukkan nama kelas' });
    updateData(d => d.classes.push({ id: genId(), name: name.trim(), color: 'blue', level: level.trim() || undefined }));
    setName(''); setLevel(''); toast({ title: 'Kelas ditambahkan' }); onRefresh();
  };
  const saveItem = (id: string, newName: string, extras?: { level?: string }) => {
    if(!newName.trim()) return;
    updateData(d => { const c = d.classes.find(x => x.id === id); if (c) { c.name = newName.trim(); c.level = extras?.level?.trim() || undefined; } });
    toast({ title: 'Kelas diperbarui' }); onRefresh();
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
      <div className="app-card-soft p-4 mb-6">
        <FormField label="Tambah Kelas Baru">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            className="form-input-style mb-3" placeholder="cth: 4A, 10B, XI IPA 2..." />
          <input value={level} onChange={e => setLevel(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            className="form-input-style mb-3" placeholder="Level/jenjang opsional, cth: 10, SD/MI, SMP/MTs" />
          <button onClick={add} className="btn-primary-style font-medium text-[13px] bg-primary text-primary-foreground min-h-[44px]">＋ Tambah Kelas</button>
        </FormField>
      </div>
      <div className="app-section-title mt-6 mb-2">Daftar Kelas</div>
      {data.classes.map(c => (
        <EditableItem key={c.id} item={{ id: c.id, name: c.name, meta: c.level ? `Level: ${c.level}` : 'Level belum diisi', extraVal: { level: c.level || '' }, deleteWarning: 'Menghapus kelas akan menghapus semua jadwal dan progres terkait.' }} onSave={saveItem} onDelete={del} extraEditField={(v:any, setV:any) => (
          <input value={v.level || ''} onChange={e => setV({ ...v, level: e.target.value })} className="form-input-style mb-2 h-10" placeholder="Level/jenjang opsional" />
        )} />
      ))}
      {!data.classes.length && <div className="text-text3 text-[13px] text-center py-6 border border-dashed border-border2 rounded-2xl mt-2">Belum ada kelas</div>}
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
      <div className="app-card-soft p-4 mb-4">
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

      <div className="app-card-soft p-4 mb-5">
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

      <div className="app-section-title mt-2 mb-2">Daftar Mapel</div>
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
      {!data.subjects.length && <div className="text-text3 text-[13px] text-center py-6 border border-dashed border-border2 rounded-2xl mt-2">Belum ada mapel</div>}
    </div>
  );
}


function MaterialsTab({ onRefresh }: { onRefresh: () => void }) {
  const [subId, setSubId] = useState('');
  const [classId, setClassId] = useState('');
  const [name, setName] = useState('');
  const [sessions, setSessions] = useState(1);
  const [pageStart, setPageStart] = useState('');
  const [pageEnd, setPageEnd] = useState('');
  const [note, setNote] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSessions, setBulkSessions] = useState(1);
  const { toast } = useToast();
  const data = getData();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // Kelas yang punya jadwal mapel ini — fallback ke semua kelas jika belum ada jadwal
  const classesWithSchedule = subId
    ? data.classes.filter(c => data.schedules.some(s => s.classId === c.id && s.subjectId === subId))
    : [];
  const classesForSubject = subId
    ? (classesWithSchedule.length > 0 ? classesWithSchedule : data.classes)
    : [];
  const hasNoSchedule = subId && classesWithSchedule.length === 0 && data.classes.length > 0;

  const add = () => {
    if (!subId) return toast({ title: 'Pilih mapel dulu' });
    if (!classId) return toast({ title: 'Pilih kelas dulu' });
    if (bulkMode) {
      if(!bulkText.trim()) return toast({ title: 'Masukkan materi' });
      bulkAddMaterials(subId, parseMaterialDraftLines(bulkText, bulkSessions), bulkSessions, undefined, classId);
      setBulkText(''); setBulkMode(false); toast({ title: 'Materi ditambahkan' }); onRefresh();
    } else {
      if(!name.trim()) return toast({ title: 'Isi nama materi' });
      bulkAddMaterials(subId, [{ name, sessions, pageStart, pageEnd, note }], sessions, undefined, classId);
      setName(''); setPageStart(''); setPageEnd(''); setNote(''); toast({ title: 'Materi ditambahkan' }); onRefresh();
    }
  };

  const saveItem = (id: string, newName: string, newSessions?: number, details?: { pageStart?: string; pageEnd?: string; note?: string }) => {
    if(newName.trim()) updateMaterial(id, newName, newSessions, details); toast({ title: 'Tersimpan' }); onRefresh();
  };
  const del = (id: string) => { const targetId = String(id); updateData(d => d.materials = d.materials.filter(m => String(m.id) !== targetId)); toast({ title: 'Dihapus' }); onRefresh(); };

  // Ambil materi untuk kelas ini
  const mats = (() => {
    if (!subId || !classId) return [];
    return getMaterials(subId, classId);
  })();
  
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = mats.findIndex(x => x.id === active.id);
      const newIndex = mats.findIndex(x => x.id === over.id);
      const reordered = arrayMove(mats, oldIndex, newIndex);
      updateData(d => {
        reordered.forEach((matItem, idx) => {
          const m = d.materials.find(x => x.id === matItem.id);
          if (m) m.order = idx + 1;
        });
      });
      onRefresh();
    }
  };

  return (
    <div>
      <div className="app-card-soft p-4 mb-4 space-y-3">
        <FormField label="Pilih Mata Pelajaran" className="mb-0">
          <select value={subId} onChange={e => { setSubId(e.target.value); setClassId(''); setName(''); setPageStart(''); setPageEnd(''); setNote(''); setBulkText(''); }} className="form-select-style border-primary">
            <option value="">Pilih mata pelajaran...</option>
            {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>

        {hasNoSchedule && (
          <p className="text-[11px] text-amber bg-amber/10 border border-amber/20 rounded-lg px-3 py-2">
            ℹ️ Belum ada jadwal untuk mapel ini. Materi akan tersimpan tapi baru aktif setelah jadwal ditambahkan.
          </p>
        )}

        {subId && classesForSubject.length > 0 && (
          <FormField label="Pilih Kelas" className="mb-0">
            <select value={classId} onChange={e => { setClassId(e.target.value); setName(''); setPageStart(''); setPageEnd(''); setNote(''); setBulkText(''); }} className="form-select-style border-primary">
              <option value="">Pilih kelas...</option>
              {classesForSubject.map(c => <option key={c.id} value={c.id}>{c.name} {classesWithSchedule.find(x => x.id === c.id) ? '' : '(belum ada jadwal)'}</option>)}
            </select>
          </FormField>
        )}
        {subId && classesForSubject.length === 0 && (
          <p className="text-[11px] text-text3 bg-surface2 border border-border2 rounded-lg px-3 py-2">
            Tambahkan kelas di tab Kelas terlebih dahulu.
          </p>
        )}
      </div>

      {subId && classId && (
        <div className="app-card-soft p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-foreground">Tambah Materi ({classesForSubject.find(c => c.id === classId)?.name})</span>
            <button onClick={() => setBulkMode(!bulkMode)} className="text-[11px] font-semibold text-primary px-2 py-1 bg-primary-dim rounded-md">{bulkMode ? 'Satu-satu' : 'Tambah Banyak'}</button>
          </div>
          {bulkMode ? (
            <>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"Bab 1 - Aljabar | 2x | hal 1-12 | banyak latihan soal\nBab 2 - Geometri | 3x | hal 13-28 | ulang konsep dasar\n\nFormat lama tetap bisa: satu baris = satu materi"} className="form-input-style min-h-[150px] mb-3 text-[13px] leading-relaxed resize-none font-mono" />
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
              <div className="flex gap-2 mb-2">
                <input value={pageStart} onChange={e => setPageStart(e.target.value)} className="form-input-style flex-1" placeholder="Hal. mulai" />
                <input value={pageEnd} onChange={e => setPageEnd(e.target.value)} className="form-input-style flex-1" placeholder="Hal. akhir" />
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} className="form-input-style min-h-[72px] mb-3 resize-none text-[13px]" placeholder="Catatan opsional, cth: banyak latihan soal, ulang konsep dasar" />
            </>
          )}
          <button onClick={add} className="btn-primary-style bg-primary text-primary-foreground min-h-[44px]">＋ {bulkMode ? 'Tambah Semua' : 'Tambah'}</button>
        </div>
      )}

      {subId && classId && (
        <>
          <div className="mt-5 mb-2 flex justify-between items-center">
            <span className="app-section-title px-0">Daftar Materi ({mats.length})</span>
            {mats.length > 1 && <span className="text-[10px] text-text2">Tahan &amp; geser untuk urutkan</span>}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={mats.map(m=>m.id)} strategy={verticalListSortingStrategy}>
              {mats.map((m, i) => {
                const pageLabel = m.pageStart && m.pageEnd ? `Hal. ${m.pageStart}-${m.pageEnd}` : m.pageStart ? `Hal. ${m.pageStart}` : '';
                const meta = [pageLabel, m.note].filter(Boolean).join(' • ') || `Urutan ke-${i+1}`;
                return <SortableMaterialItem key={m.id} id={m.id} item={{ ...m, meta }} onSave={saveItem} onDelete={del} />;
              })}
            </SortableContext>
          </DndContext>
          {!mats.length && <div className="text-text3 text-[13px] text-center py-6 border border-dashed border-border2 rounded-2xl mt-2">Belum ada materi</div>}
        </>
      )}
      {!subId && <div className="text-text3 text-[13px] text-center p-4 bg-surface2 rounded-2xl mt-2 border border-border2">Pilih mapel untuk melihat materi</div>}
      {subId && !classId && classesForSubject.length > 0 && <div className="text-text3 text-[13px] text-center p-4 bg-surface2 rounded-2xl mt-2 border border-border2">Pilih kelas di atas</div>}
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
      <div className="app-card-soft p-5 mb-6 space-y-4">
        <div>
          <div className="font-display text-xl font-bold tracking-tight">Tambah Jadwal Mingguan</div>
          <div className="text-[12px] text-text2 mt-1">Pilih kelas, mapel, hari aktif, dan durasi mengajar.</div>
        </div>
        <FormField label="Kelas & Mapel">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <select value={classId} onChange={e => setClassId(e.target.value)} className="form-select-style flex-1 px-3 py-2 text-[13px]"><option value="">Pilih kelas...</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="form-select-style flex-1 px-3 py-2 text-[13px]"><option value="">Pilih mapel...</option>{data.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
        </FormField>
        <FormField label="Hari">
          <div className="grid grid-cols-7 gap-1.5 mb-3">
            {DAYS_SHORT.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i, selectedDays, setSelectedDays)}
                className={`min-h-[38px] rounded-xl text-xs font-bold border transition-all ${selectedDays.includes(i) ? 'bg-primary border-primary text-primary-foreground shadow-sm' : 'bg-surface border-border text-text2 hover:border-border3'}`}>
                {d}
              </button>
            ))}
          </div>
        </FormField>
        <div className="flex gap-2 mb-3">
          <FormField label="Jam Mulai" className="flex-1 mb-0"><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="form-input-style py-2 border-border focus:border-primary" /></FormField>
          <FormField label="Durasi (mnt)" className="flex-1 mb-0"><input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="form-input-style py-2 border-border focus:border-primary" min={15} max={180} /></FormField>
        </div>
        <button onClick={add} className="btn-primary-style font-medium text-[13px] min-h-[44px] flex items-center justify-center gap-2"><CalendarDays className="h-4 w-4" /> Tambah Jadwal</button>
      </div>

      <div className="mb-4">
        <div className="app-section-title mb-3 flex items-center justify-between">
          <span>Daftar Jadwal Mingguan</span>
          <span className="text-[10px] font-medium lowercase opacity-60">({data.schedules.length} total)</span>
        </div>
        
        {schedulesByDay.length === 0 && (
          <div className="text-text3 text-[13px] text-center py-6 border border-dashed border-border2 rounded-2xl mt-2">Belum ada jadwal</div>
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
      <div className="bg-surface2 border border-primary-border rounded-2xl p-4 mb-2">
        <div className="text-sm font-bold mb-3">{item.name}</div>
        <div className="grid grid-cols-7 gap-1.5 mb-3">{DAYS_SHORT.map((d, i) => <button key={i} onClick={() => toggleDay(i)} className={`min-h-[34px] rounded-xl text-[11px] font-bold border ${days.includes(i) ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border2 text-text2'}`}>{d}</button>)}</div>
        <div className="flex gap-2 mb-3">
          <input type="time" value={st} onChange={e => setSt(e.target.value)} className="form-input-style flex-1 h-9 px-2 text-xs" />
          <input type="number" value={dr} onChange={e => setDr(parseInt(e.target.value))} className="form-input-style flex-1 h-9 px-2 text-xs" placeholder="Durasi mnt" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { onSave(item.id, '', { st, dr, days }); setEditing(false); }} className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5"><Save className="h-4 w-4" /> Simpan</button>
          <button onClick={() => setEditing(false)} className="flex-1 py-2 bg-surface text-text2 border border-border rounded-xl text-[13px] font-medium">Batal</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="app-list-item flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0 pr-3">
          <div className="text-sm font-medium leading-snug">{item.name}</div>
          <div className="text-[11px] text-text2 mt-[4px] font-medium">{item.meta}</div>
        </div>
        <div className="flex gap-[4px] items-center flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="app-icon-button w-9 h-9" aria-label="Edit jadwal"><Pencil className="h-4 w-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); setDelSheet(true); }} className="w-9 h-9 rounded-2xl bg-red/10 border border-red/20 text-red grid place-items-center transition-all hover:bg-red/15 active:scale-95" aria-label="Hapus jadwal"><Trash2 className="h-4 w-4" /></button>
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

  const todayStr = dateKey();

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
    return dateFromKey(d).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div>
      <div className="app-card-soft p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber/10 border border-amber/20 text-amber grid place-items-center"><Palmtree className="h-5 w-5" /></div>
          <div>
            <div className="font-display text-xl font-bold tracking-tight">Tambah Hari Libur</div>
            <div className="text-[12px] text-text2">Tanggal ini dikecualikan dari hitungan sesi.</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input-style flex-1 h-10 border-border focus:border-primary" min={todayStr} />
          <select value={level} onChange={e => setLevel(e.target.value)} className="form-select-style flex-1 h-10 border-border">
            <option value="">Semua Jenjang</option>
            <option value="SD/MI">SD / MI</option>
            <option value="SMP/MTs">SMP / MTs</option>
            <option value="SMA/MA">SMA / MA</option>
          </select>
        </div>
        <button onClick={handleAdd} className="btn-primary-style min-h-[44px] flex items-center justify-center gap-2"><Palmtree className="h-4 w-4" /> Tambah Libur</button>
        <p className="text-[11px] text-text3 mt-2 leading-relaxed">Input tanggal di mana kelas tidak berlangsung: libur mendadak, acara sekolah, dll. Asisten akan mengecualikan tanggal ini dari perhitungan sesi.</p>
      </div>

      {impacts.length > 0 && (
        <div className="bg-amber/10 border border-amber/25 rounded-2xl p-4 mb-4">
          <div className="text-[11px] font-black text-amber mb-2 uppercase tracking-wide flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Dampak Hari Libur pada Jadwal</div>
          {impacts.map((imp, i) => (
            <div key={i} className="text-[12px] text-text2">
              <span className="font-semibold text-foreground">{imp.className} — {imp.subjectName}</span>: {imp.impactCount} sesi terpotong
            </div>
          ))}
        </div>
      )}

      <div className="app-section-title mb-2">Daftar Libur ({holidays.length})</div>
      {holidays.length === 0 && (
        <div className="text-text3 text-[13px] text-center py-6 border border-dashed border-border2 rounded-2xl">Belum ada hari libur yang diinput</div>
      )}
      {holidays.map((h, i) => {
        const dStr = typeof h === 'string' ? h : h.date;
        const levelStr = typeof h === 'string' || !h.level ? 'Semua Jenjang' : h.level;
        const isToday = dStr === todayStr;
        const isPast = dStr < todayStr;
        return (
          <div key={i} className={`border rounded-2xl p-4 flex items-center justify-between mb-2 ${
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
            <button onClick={() => handleRemove(h)} className="w-9 h-9 rounded-2xl bg-red/10 border border-red/20 text-red grid place-items-center flex-shrink-0"><Trash2 className="h-4 w-4" /></button>
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
    saveData({ teacherName: getData().teacherName || '', classes: [], subjects: [], materials: [], schedules: [], progress: [], sessions: [], tasks: [], notes: [], lastBackup: null, reminderDismissed: null, holidays: [], scheduleOverrides: [] });
    setShowReset(false); setResetVal(''); toast({ title: 'Semua data dihapus' }); onRefresh();
  };

  return (
    <div>
      <StorageInfo />
      <div className="app-card p-4 mb-3">
        <div className="text-[13px] font-black tracking-wide mb-3 flex items-center gap-2"><Download className="h-4 w-4 text-primary" /> Export Data</div>
        <div className="flex gap-[7px] flex-wrap">
          <button onClick={() => { 
            try {
              exportJSON(); 
              toast({ title: 'Backup JSON diunduh' }); 
            } catch (e) {
              console.error('Backup error:', e);
              toast({ variant: 'destructive', title: 'Backup gagal' });
            }
          }} className="data-btn-style bg-primary-dim text-primary border-primary-border"><Save className="h-4 w-4" /> Backup JSON</button>
          <button onClick={() => { exportCSV(); toast({ title: 'Riwayat CSV diunduh' }); }} className="data-btn-style"><ClipboardList className="h-4 w-4" /> Riwayat CSV</button>
        </div>
      </div>
      <div className="app-card p-4 mb-3">
        <div className="text-[13px] font-black tracking-wide mb-3 flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Import Data</div>
        <div className="flex gap-[7px] flex-wrap">
          <label className="data-btn-style cursor-pointer bg-surface2">
            <Upload className="h-4 w-4" /> Upload JSON
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={() => { loadDemo(); toast({ title: 'Data demo dimuat' }); onRefresh(); }} className="data-btn-style text-text2"><FlaskConical className="h-4 w-4" /> Muat Demo</button>
        </div>
      </div>
      
      <div className="bg-[linear-gradient(135deg,hsl(199_89%_60%/0.08)_0%,hsl(160_68%_52%/0.05)_100%)] border border-teal-border rounded-3xl p-[18px] mb-3">
        <div className="text-[11px] font-bold tracking-[0.7px] uppercase text-teal mb-[14px] flex items-center gap-2"><Bell className="h-4 w-4" /> Push Notifikasi</div>
        <p className="text-[13px] text-text2 leading-[1.7] mb-3">
          Izinkan notifikasi agar EduTrack bisa mengingatkan Anda **5 menit sebelum sesi kelas dimulai**.
        </p>
        <button 
          onClick={async () => {
            const res = await requestNotifPermission();
            alert(res ? 'Notifikasi aktif!' : 'Gagal mengaktifkan notifikasi / izin ditolak.');
          }}
          className="w-full py-[12px] bg-teal text-teal-950 text-sm font-bold rounded-2xl shadow-teal transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Bell className="h-4 w-4" /> Aktifkan Notifikasi Web
        </button>
      </div>

      <div className="bg-red/5 border border-red/20 rounded-3xl p-4 mb-[10px]">
        <div className="text-[12px] font-black mb-[10px] text-red uppercase tracking-wide flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Zona Berbahaya</div>
        {!showReset ? (
          <button onClick={() => setShowReset(true)} className="w-full py-3 rounded-2xl bg-red/10 text-red font-bold transition-all flex items-center justify-center gap-2"><Trash2 className="h-4 w-4" /> Reset Semua Data</button>
        ) : (
          <div className="animate-in fade-in slide-in-from-top-1">
            <p className="text-text2 text-xs mb-3">Tindakan ini tidak bisa dibatalkan. Ketik <strong className="text-red">RESET</strong> konfirmasi.</p>
            <input value={resetVal} onChange={e => setResetVal(e.target.value)} placeholder="Ketik RESET" className="form-input-style h-10 mb-2 border-red/40 focus:border-red" />
            <button onClick={handleReset} disabled={resetVal !== 'RESET'} className="w-full py-2.5 rounded-2xl bg-red text-white font-bold disabled:opacity-40">Hapus Permanen</button>
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
    return dateKey(tomorrow);
  });
  const [leaveType, setLeaveType] = useState<'izin' | 'sakit'>('izin');
  const [keterangan, setKeterangan] = useState('');
  const [resolutions, setResolutions] = useState<Record<string, { action: 'deliver' | 'skip'; note: string }>>({});

  const dayOfWeek = date ? dateFromKey(date).getDay() : -1;
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
      <div className="app-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber/10 border border-amber/30 flex items-center justify-center text-amber flex-shrink-0"><HeartPulse className="h-5 w-5" /></div>
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
              <ClipboardList className="h-5 w-5" />
              <span>Izin</span>
            </button>
            <button
              onClick={() => setLeaveType('sakit')}
              className={`py-3 rounded-2xl border text-sm font-bold flex flex-col items-center gap-1 transition-all ${leaveType === 'sakit' ? 'bg-red/10 border-red/30 text-red shadow-sm' : 'bg-surface border-border2 text-text2 hover:border-border3'}`}
            >
              <Stethoscope className="h-5 w-5" />
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
            <div className="text-center py-6 bg-surface2 border border-border2 rounded-2xl text-text3 text-sm">
              Tidak ada jadwal mengajar pada hari ini.
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map(s => {
                const res = resolutions[s.id] || { action: 'deliver', note: '' };
                const isDeliver = res.action === 'deliver';
                return (
                  <div key={s.id} className="bg-surface2 border border-border2 rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 pr-2">
                        <div className="text-[14px] font-bold">{s.className}</div>
                        <div className="text-[12px] text-text2">{s.subjectName} · {s.startTime}</div>
                        {s.nextMat && <div className="text-[10px] text-text3 mt-0.5 truncate">Materi: {s.nextMat.name}</div>}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0 bg-surface p-1 rounded-2xl border border-border/50">
                        <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${isDeliver ? 'bg-green/10 text-green ring-1 ring-green/30' : 'text-text3 hover:bg-surface3'}`}>
                          <input type="radio" checked={isDeliver} onChange={() => setResolutions(p => ({...p, [s.id]: {...p[s.id], action: 'deliver'}}))} className="hidden" />
                          <CheckCircle2 className="h-3.5 w-3.5" /> Titip Tugas
                        </label>
                        <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${!isDeliver ? 'bg-red/10 text-red ring-1 ring-red/30' : 'text-text3 hover:bg-surface3'}`}>
                          <input type="radio" checked={!isDeliver} onChange={() => setResolutions(p => ({...p, [s.id]: {...p[s.id], action: 'skip'}}))} className="hidden" />
                          <SkipForward className="h-3.5 w-3.5" /> Skip Kelas
                        </label>
                      </div>
                    </div>
                    {isDeliver && (
                      <input
                        type="text"
                        placeholder="Contoh: Kerjakan Modul Hal 45-48"
                        value={res.note}
                        onChange={e => setResolutions(p => ({...p, [s.id]: {...p[s.id], note: e.target.value}}))}
                        className="w-full bg-surface border border-border2 rounded-xl px-3 py-2 text-[12px] focus:border-primary focus:outline-none placeholder:text-text3 mt-1"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button onClick={saveLeave} disabled={schedules.length === 0} className="btn-primary-style disabled:opacity-50 disabled:cursor-not-allowed">
          Terapkan Izin
        </button>
      </div>
    </div>
  );
}

function StorageInfo() {
  const info = estimateStorageSize();
  // Fallback jika info undefined (shouldn't happen, but safety first)
  const safeInfo = info ?? { used: 0, total: 5242880, pct: 0 };
  const data = getData();
  const color = safeInfo.pct > 80 ? 'text-red' : safeInfo.pct > 50 ? 'text-amber' : 'text-green';
  const barColor = safeInfo.pct > 80 ? 'bg-red' : safeInfo.pct > 50 ? 'bg-amber' : 'bg-green';
  const kb = Math.round(safeInfo.used / 1024);
  return (
    <div className="app-card p-4 mb-3">
        <div className="text-[13px] font-bold tracking-wide mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-primary" /> Penyimpanan Lokal</span>
          <span className={"text-[11px] font-bold " + color}>{safeInfo.pct}% terpakai</span>
        </div>
        <div className="h-2 bg-surface3 rounded-full overflow-hidden mb-2">
          <div className={"h-full rounded-full transition-all " + barColor} style={{ width: safeInfo.pct + '%' }} />
      </div>
      <div className="text-[11px] text-text3 flex justify-between mb-3">
        <span>{kb} KB digunakan</span>
        <span>{Math.round(info.total / 1024)} KB total</span>
      </div>
      <div className="text-[11px] text-text3 flex gap-2 flex-wrap mb-3">
        <span className="px-2 py-1 rounded-full bg-surface2 border border-border2">{data.sessions.length} sesi</span>
        <span className="px-2 py-1 rounded-full bg-surface2 border border-border2">{data.materials.length} materi</span>
        <span className="px-2 py-1 rounded-full bg-surface2 border border-border2">{data.schedules.length} jadwal</span>
        <span className="px-2 py-1 rounded-full bg-surface2 border border-border2">{(data.tasks ?? []).length} tugas</span>
      </div>
      <button
        onClick={() => { pruneOldSessions(); window.location.reload(); }}
        className="data-btn-style text-amber border-amber/30 bg-amber/5 text-xs"
      >
        <RotateCcw className="h-4 w-4" /> Bersihkan data lama (&gt;90 hari)
      </button>
    </div>
  );
}
