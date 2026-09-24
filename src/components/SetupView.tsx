import { useState, useRef, useMemo, useEffect, type ElementType } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getData, updateData, genId, DAYS_SHORT, DAYS_ID, fmt, checkOverlap, saveData, dateKey, dateFromKey,
  exportJSON, exportCSV, importJSON, loadDemo, updateClass, updateSubject, bulkUpdateExamDateByLevel, updateMaterial, updateSchedule, reorderMaterials, bulkAddMaterials, bulkSetExamPeriodByOrderRange, estimateStorageSize, pruneOldSessions,
  addHoliday, removeHoliday, getHolidays, getHolidayImpactSummary, getMaterials, setAcademicYear, applyTeacherLeave, parseMaterialDraftLines, getTeachingPosition,
  getSemesters, addSemester, updateSemester, deleteSemester, getCurrentExamPhase, getSubjectSemester, linkSubjectToSemester,
} from '@/lib/data';
import {
  suggestExamPeriodDistribution,
  applyExamPeriodDistribution,
  getSyllabusOverview,
  type DistributionSuggestion,
  type SyllabusOverview,
} from '@/lib/syllabusEngine';
import { addExamSchedule, deleteExamSchedule, fmtDate } from '@/lib/examData';
import { SetupTab } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { requestNotifPermission } from '@/lib/notifications';
import { AlertTriangle, Award, Bell, BookMarked, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Database, Download, FileText, FlaskConical, GraduationCap, HardDrive, HeartPulse, HelpCircle, Info, Layers, Link2, Palmtree, Pencil, RotateCcw, Save, ShieldAlert, SkipForward, SlidersHorizontal, Sparkles, Stethoscope, Trash2, Upload, UserRound, X } from 'lucide-react';

interface SetupViewProps {
  onRefresh: () => void;
  onOpenExamSettings: () => void;
  onOpenInfo: () => void;
}

export default function SetupView({ onRefresh, onOpenExamSettings, onOpenInfo }: SetupViewProps) {
  const data = getData();
  const showGettingStarted = !data.classes.length || !data.subjects.length || !data.schedules.length || !data.materials.length;
  // Default to classes if first time, otherwise show menu
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('section') as SetupTab;
  const tab = ['classes', 'subjects', 'schedules', 'materials', 'semesters', 'holidays', 'leave', 'data'].includes(requestedTab) ? requestedTab : null;
  const [, forceUpdate] = useState(0);
  const setTab = (t: SetupTab | null) => { setParams(previous => { const next = new URLSearchParams(previous); if (t) next.set('section', t); else next.delete('section'); return next; }); };
  // Expose setTab globally so child tabs can navigate (e.g. "→ Buat Semester Sekarang")
  useEffect(() => {
    (document as any).__eduSetTab = setTab;
    return () => { delete (document as any).__eduSetTab; };
  });
  const refresh = () => { forceUpdate(n => n + 1); onRefresh(); };

  const tabs: { id: SetupTab; label: string; desc: string; icon: ElementType; group: string }[] = [
    { id: 'classes', label: 'Daftar Kelas', desc: 'Atur rombongan belajar', icon: GraduationCap, group: 'akademik' },
    { id: 'subjects', label: 'Mata Pelajaran', desc: 'Daftar mapel yang diajar', icon: BookOpen, group: 'akademik' },
    { id: 'semesters', label: 'Semester & Ujian', desc: 'Batas UTS & UAS + hubungkan mapel', icon: Layers, group: 'akademik' },
    { id: 'schedules', label: 'Jadwal Mengajar', desc: 'Atur jadwal mingguan', icon: CalendarDays, group: 'jadwal' },
    { id: 'materials', label: 'Materi & Silabus', desc: 'Atur urutan materi (bab)', icon: SlidersHorizontal, group: 'akademik' },
    { id: 'holidays', label: 'Hari Libur', desc: 'Kalender libur akademik', icon: Palmtree, group: 'jadwal' },
    { id: 'leave', label: 'Izin Mengajar', desc: 'Titip tugas atau cuti', icon: HeartPulse, group: 'jadwal' },
    { id: 'data', label: 'Backup & Data', desc: 'Export, import & hapus data', icon: Database, group: 'aplikasi' },
  ];
  const ActiveTabIcon = tab ? tabs.find(t => t.id === tab)?.icon : null;

  const setupSteps = [
    { id: 'classes' as SetupTab, step: 1, label: 'Kelas', desc: 'Rombel', done: data.classes.length > 0 },
    { id: 'subjects' as SetupTab, step: 2, label: 'Mapel', desc: 'Pelajaran', done: data.subjects.length > 0 },
    { id: 'schedules' as SetupTab, step: 3, label: 'Jadwal', desc: 'Mingguan', done: data.schedules.length > 0 },
    { id: 'materials' as SetupTab, step: 4, label: 'Materi', desc: 'Bab & Ujian', done: data.materials.length > 0 },
    { id: 'semesters' as SetupTab, step: 5, label: 'Semester', desc: 'UTS & UAS', done: getSemesters().length > 0 },
  ];
  const completedCount = setupSteps.filter(s => s.done).length;
  const progressPct = Math.round((completedCount / setupSteps.length) * 100);

  return (
    <div className="setup-workspace pt-2 animate-fade-in">
      {/* ─── VISUAL ACADEMIC SETUP STEPPER ─── */}
      {tab === null && (
        <div className="bg-gradient-to-br from-primary/10 via-surface2/60 to-surface border border-primary/25 rounded-3xl p-4 sm:p-5 mb-4 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary flex-shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-foreground tracking-tight">Alur Perencanaan Akademik</h2>
                <p className="text-[11px] text-text3 font-medium">Progress penyiapan aplikasi ({completedCount}/5 Selesai)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-primary bg-primary-dim px-2.5 py-1 rounded-full border border-primary/20">
                {progressPct}%
              </span>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="w-full h-2 bg-surface2 rounded-full overflow-hidden mb-4 border border-border/40">
            <div
              className="h-full bg-gradient-to-r from-teal-500 via-primary to-emerald-400 transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Step Cards Grid */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {[
              { id: 'classes' as SetupTab, step: 1, label: 'Kelas', desc: 'Rombel', done: data.classes.length > 0 },
              { id: 'subjects' as SetupTab, step: 2, label: 'Mapel', desc: 'Pelajaran', done: data.subjects.length > 0 },
              { id: 'schedules' as SetupTab, step: 3, label: 'Jadwal', desc: 'Mingguan', done: data.schedules.length > 0 },
              { id: 'materials' as SetupTab, step: 4, label: 'Materi', desc: 'Bab & Ujian', done: data.materials.length > 0 },
              { id: 'semesters' as SetupTab, step: 5, label: 'Semester', desc: 'UTS & UAS', done: getSemesters().length > 0 },
            ].map((st, idx) => {
              const isNext = !st.done && (idx === 0 || [
                data.classes.length > 0,
                data.subjects.length > 0,
                data.schedules.length > 0,
                data.materials.length > 0,
                getSemesters().length > 0
              ][idx - 1]);

              return (
                <button
                  key={st.id}
                  onClick={() => setTab(st.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-2xl border text-center transition-all min-h-[64px] group ${
                    st.done
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 dark:text-emerald-300'
                      : isNext
                        ? 'bg-primary/15 border-primary/50 text-primary ring-2 ring-primary/20 animate-pulse-dot'
                        : 'bg-surface2/60 border-border/60 text-text3 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black mb-1 transition-transform group-hover:scale-110 ${
                    st.done
                      ? 'bg-emerald-500 text-white'
                      : isNext
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface3 text-text3'
                  }`}>
                    {st.done ? '✓' : st.step}
                  </div>
                  <span className="text-[11px] font-bold leading-none truncate w-full">{st.label}</span>
                  <span className="text-[9px] text-text3 mt-0.5 leading-none truncate w-full hidden sm:block">{st.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Profile */}
      {tab === null && (
        <div className="app-card p-4 sm:p-5 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center flex-shrink-0 ring-4 ring-primary/5 text-primary">
              <UserRound className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold tracking-tight break-words">
                {data.teacherName || 'Belum diisi'}
              </div>
              <div className="text-xs text-text3 font-medium truncate mb-1">Guru / Pengajar</div>
              <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 flex-wrap">
                <span>{data.classes.length} Kelas</span>
                <span>&middot;</span>
                <span>{data.subjects?.length ?? 0} Mapel</span>
                <span>&middot;</span>
                <span>{data.materials?.length ?? 0} Materi</span>
              </div>
              {data.academicYear ? (
                <div className="text-xs text-text2 mt-1 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-text3" />
                  <span className="truncate">Tahun Ajaran: {data.academicYear}</span>
                </div>
              ) : (
                <div className="text-xs text-amber mt-1 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber" />
                  <span>Belum mengatur tahun ajaran</span>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full border-t border-border pt-3">
              <EditTeacherButton onRefresh={refresh} />
              <EditAcademicYearButton onRefresh={refresh} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {tab === null ? (
        // ─── SETTINGS MENU LIST ───
        <div className="animate-slide-up pb-10">
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0">
            <div>
              <div className="app-section-title mb-2">Akademik</div>
              <div className="app-card overflow-hidden">
                {tabs.filter(t => t.group === 'akademik').map((t, idx, arr) => {
                  const Icon = t.icon;
                  const getTabBadge = (id: SetupTab) => {
                    if (id === 'classes') return `${data.classes.length} Kelas`;
                    if (id === 'subjects') return `${data.subjects.length} Mapel`;
                    if (id === 'materials') return `${data.materials.length} Bab`;
                    if (id === 'semesters') return `${getSemesters().length} Semester`;
                    return null;
                  };
                  const badgeText = getTabBadge(t.id);

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
                          <div className="text-[14px] font-bold text-foreground leading-tight flex items-center gap-2">
                            <span>{t.label}</span>
                            {badgeText && (
                              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                {badgeText}
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-text3 mt-0.5">{t.desc}</div>
                        </div>
                      </div>
                      <span className="text-text3 text-lg opacity-50">›</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="app-section-title mb-2">Jadwal &amp; Kehadiran</div>
              <div className="app-card overflow-hidden">
                {tabs.filter(t => t.group === 'jadwal').map((t, idx, arr) => {
                  const Icon = t.icon;
                  const getScheduleBadge = (id: SetupTab) => {
                    if (id === 'schedules') return `${data.schedules.length} Slot`;
                    if (id === 'holidays') return `${getHolidays().length} Libur`;
                    if (id === 'leave') return `${data.leaves?.length ?? 0} Cuti`;
                    return null;
                  };
                  const badgeText = getScheduleBadge(t.id);

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
                          <div className="text-[14px] font-bold text-foreground leading-tight flex items-center gap-2">
                            <span>{t.label}</span>
                            {badgeText && (
                              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-surface3 text-text2 border border-border2">
                                {badgeText}
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-text3 mt-0.5">{t.desc}</div>
                        </div>
                      </div>
                      <span className="text-text3 text-lg opacity-50">›</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="app-section-title mb-2">Aplikasi &amp; Data</div>
              <div className="app-card overflow-hidden">
                {tabs.filter(t => t.group === 'aplikasi').map((t, idx, arr) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-surface2 active:bg-surface3 ${idx !== arr.length - 1 ? 'border-b border-border/50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-surface2 border border-border2 flex items-center justify-center text-text2 flex-shrink-0 shadow-inner"><Icon className="h-5 w-5" /></div>
                        <div><div className="text-[14px] font-bold text-foreground leading-tight">{t.label}</div><div className="text-[12px] text-text3 mt-0.5">{t.desc}</div></div>
                      </div>
                      <span className="text-text3 text-lg opacity-50">›</span>
                    </button>
                  );
                })}
                <button
                  onClick={onOpenExamSettings}
                  className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-surface2 active:bg-surface3 border-t border-border/50"
                >
                  <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-surface2 border border-border2 flex items-center justify-center text-text2 flex-shrink-0 shadow-inner"><Bell className="h-5 w-5" /></div><div><div className="text-[14px] font-bold text-foreground leading-tight">Pengaturan Ujian</div><div className="text-[12px] text-text3 mt-0.5">Mode ujian dan pengingat</div></div></div>
                  <span className="text-text3 text-lg opacity-50">›</span>
                </button>
                <button
                  onClick={onOpenInfo}
                  className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-surface2 active:bg-surface3 border-t border-border/50"
                >
                  <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-surface2 border border-border2 flex items-center justify-center text-text2 flex-shrink-0 shadow-inner"><HelpCircle className="h-5 w-5" /></div><div><div className="text-[14px] font-bold text-foreground leading-tight">Tentang EduTrack</div><div className="text-[12px] text-text3 mt-0.5">Panduan penggunaan dan informasi aplikasi</div></div></div>
                  <span className="text-text3 text-lg opacity-50">›</span>
                </button>
              </div>
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
          {tab === 'semesters' && <SemestersTab onRefresh={refresh} />}
          {['classes', 'subjects', 'schedules'].includes(tab) && <button className="primary-button mt-6" onClick={() => setTab(tab === 'classes' ? 'subjects' : tab === 'subjects' ? 'schedules' : 'materials')}>Lanjut ke {tab === 'classes' ? 'mata pelajaran' : tab === 'subjects' ? 'jadwal' : 'materi'}</button>}
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
          aria-label="Nama pengajar" className="min-w-0 flex-1 bg-surface border border-border2 rounded-lg px-3 py-2 text-base" autoFocus placeholder="Nama..." />
        <button onClick={save} className="min-h-11 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Simpan</button>
        <button onClick={() => setEditing(false)} className="min-h-11 px-2 text-xs text-text2">Batal</button>
      </div>
    );
  }
  return (
    <button onClick={startEdit} className="min-h-11 px-3 py-2 rounded-xl bg-surface2 border border-border2 text-sm text-text2 transition-all hover:text-foreground hover:border-border3 flex items-center justify-center gap-2">
      <Pencil aria-hidden="true" className="h-3.5 w-3.5" /> Edit nama
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
          aria-label="Tahun ajaran" className="min-w-0 flex-1 bg-surface border border-border2 rounded-lg px-3 py-2 text-base" autoFocus placeholder="Contoh: 2026/2027" />
        <button onClick={save} className="min-h-11 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Simpan</button>
        <button onClick={() => setEditing(false)} className="min-h-11 px-2 text-xs text-text2">Batal</button>
      </div>
    );
  }
  return (
    <button onClick={startEdit} className="min-h-11 px-3 py-2 rounded-xl bg-surface2 border border-border2 text-sm text-text2 transition-all hover:text-foreground hover:border-border3 flex items-center justify-center gap-2">
      <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" /> Tahun ajaran
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
        <label className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">Edit Item</label>
        <input value={val} onChange={e => setVal(e.target.value)} className="form-input-style mb-2 min-h-[44px]" autoFocus />
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
          <div className={`text-xs mt-[4px] font-medium ${item.metaColor || 'text-text2'}`}>{item.meta}</div>
        </div>
        <div className="flex gap-[6px] items-center flex-shrink-0">
          <button onClick={() => setEditing(true)} className="app-icon-button w-11 h-11 hover:text-primary" aria-label="Edit item"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => setDelSheet(true)} className="w-11 h-11 rounded-2xl bg-red/10 border border-red/20 text-red grid place-items-center transition-all hover:bg-red/15 active:scale-95" aria-label="Hapus item"><Trash2 className="h-4 w-4" /></button>
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
  const [examPeriod, setExamPeriod] = useState<'UTS' | 'UAS' | null>(item.examPeriod ?? null);
  const [semesterNum, setSemesterNum] = useState<1 | 2 | null>(item.semesterNum ?? 1);
  const [delSheet, setDelSheet] = useState(false);

  if (editing) {
    return (
      <div className="bg-surface2 border border-primary-border rounded-2xl p-4 mb-2 space-y-3 animate-slide-up">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Edit Bab Materi</span>
          <span className="text-[11px] text-text3 font-mono">ID: #{id}</span>
        </div>
        <input value={val} onChange={e => setVal(e.target.value)} className="form-input-style text-sm font-semibold h-11" autoFocus placeholder="Nama materi..." />
        
        {/* Pertemuan */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-bold text-text2 uppercase tracking-wide whitespace-nowrap">Pertemuan:</label>
          <div className="flex items-center gap-1 flex-wrap">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setSessVal(n)}
                className={`w-8 h-8 rounded-xl text-xs font-bold border transition-all ${
                  sessVal === n ? 'bg-primary border-primary text-primary-foreground shadow-xs' : 'bg-surface border-border text-text2 hover:border-primary'
                }`}>{n}×</button>
            ))}
            <div className="flex items-center gap-1 bg-surface border border-border2 rounded-xl px-2 h-8 ml-0.5">
              <span className="text-xs text-text3 font-bold">Lainnya:</span>
              <input
                type="number"
                min="1"
                value={sessVal || ''}
                onChange={e => setSessVal(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-10 h-6 bg-transparent text-xs font-bold text-center focus:outline-none text-foreground"
              />
            </div>
          </div>
        </div>

        {/* 4-Quadrant Selector in Edit Mode */}
        <div>
          <label className="text-xs font-bold text-text2 uppercase tracking-wide block mb-1.5">Target Semester & Ujian:</label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => { setSemesterNum(1); setExamPeriod('UTS'); }}
              className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                semesterNum === 1 && examPeriod === 'UTS'
                  ? 'badge-smt1-uts border-blue-500 ring-2 ring-blue-500/30'
                  : 'bg-surface border-border/80 text-text3 hover:text-foreground'
              }`}
            >
              Smt 1 UTS
            </button>
            <button
              type="button"
              onClick={() => { setSemesterNum(1); setExamPeriod('UAS'); }}
              className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                semesterNum === 1 && examPeriod === 'UAS'
                  ? 'badge-smt1-uas border-violet-500 ring-2 ring-violet-500/30'
                  : 'bg-surface border-border/80 text-text3 hover:text-foreground'
              }`}
            >
              Smt 1 UAS
            </button>
            <button
              type="button"
              onClick={() => { setSemesterNum(2); setExamPeriod('UTS'); }}
              className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                semesterNum === 2 && examPeriod === 'UTS'
                  ? 'badge-smt2-uts border-indigo-500 ring-2 ring-indigo-500/30'
                  : 'bg-surface border-border/80 text-text3 hover:text-foreground'
              }`}
            >
              Smt 2 UTS
            </button>
            <button
              type="button"
              onClick={() => { setSemesterNum(2); setExamPeriod('UAS'); }}
              className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                semesterNum === 2 && examPeriod === 'UAS'
                  ? 'badge-smt2-uas border-fuchsia-500 ring-2 ring-fuchsia-500/30'
                  : 'bg-surface border-border/80 text-text3 hover:text-foreground'
              }`}
            >
              Smt 2 UAS
            </button>
          </div>
          <button
            type="button"
            onClick={() => setExamPeriod(null)}
            className={`w-full mt-1 py-1 rounded-xl text-[11px] font-bold border transition-all ${
              examPeriod === null
                ? 'bg-surface3 border-border3 text-foreground'
                : 'bg-transparent border-transparent text-text3 hover:text-foreground'
            }`}
          >
            Tanpa Tag Ujian (Bebas)
          </button>
        </div>

        <div className="flex gap-2">
          <input value={pageStart} onChange={e => setPageStart(e.target.value)} className="form-input-style min-h-[44px] flex-1 text-xs" placeholder="Hal. mulai" />
          <input value={pageEnd} onChange={e => setPageEnd(e.target.value)} className="form-input-style min-h-[44px] flex-1 text-xs" placeholder="Hal. akhir" />
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} className="form-input-style min-h-[60px] resize-none text-xs" placeholder="Catatan opsional..." />

        <div className="flex gap-2 pt-1">
          <button onClick={() => { onSave(id, val, sessVal, { pageStart, pageEnd, note }, examPeriod, semesterNum); setEditing(false); }} className="flex-1 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-sm">Simpan</button>
          <button onClick={() => setEditing(false)} className="flex-1 min-h-[44px] bg-surface text-text2 border border-border rounded-xl text-xs font-medium">Batal</button>
        </div>
      </div>
    );
  }

  const matSmt = item.semesterNum ?? 1;
  const matExam = item.examPeriod;

  // Quad class for left border
  const borderClass = matExam === 'UTS'
    ? matSmt === 1 ? 'mat-smt1-uts' : 'mat-smt2-uts'
    : matExam === 'UAS'
      ? matSmt === 1 ? 'mat-smt1-uas' : 'mat-smt2-uas'
      : 'mat-untagged';

  // Quadrant Badge
  const quadrantBadge = matExam === 'UTS'
    ? matSmt === 1
      ? <span className="badge-smt1-uts border px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">Smt 1 UTS</span>
      : <span className="badge-smt2-uts border px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">Smt 2 UTS</span>
    : matExam === 'UAS'
      ? matSmt === 1
        ? <span className="badge-smt1-uas border px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">Smt 1 UAS</span>
        : <span className="badge-smt2-uas border px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">Smt 2 UAS</span>
      : <span className="bg-surface2 text-text3 border border-border px-2 py-0.5 rounded-md text-[10px] font-bold">Smt {matSmt}</span>;

  const sessBadge = (item.sessions ?? 1) > 1
    ? <span className="bg-primary/15 text-primary border border-primary/25 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md">{item.sessions}×</span>
    : null;

  const statusBadge = item.progressStatus ? (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
      item.progressStatus.type === 'finished'
        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
        : item.progressStatus.type === 'current'
          ? 'bg-teal-500/20 border-teal-500/40 text-teal-300 ring-2 ring-teal-500/20'
          : 'bg-surface2 border-border text-text3'
    }`}>
      {item.progressStatus.label}
    </span>
  ) : null;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-surface border ${
          isDragging ? 'border-primary border-2 shadow-xl' : 'border-border/80'
        } ${borderClass} rounded-2xl p-3.5 flex items-center justify-between mb-2 transition-shadow hover:border-border3 group`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
          {/* Drag Handle min touch target 44x44px */}
          <div
            {...attributes}
            {...listeners}
            className="w-11 h-11 rounded-xl bg-surface2/60 border border-border/40 text-text3 hover:text-foreground flex items-center justify-center cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
            title="Tahan & geser untuk mengubah urutan"
          >
            <span className="text-base leading-none">⋮⋮</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-sm font-bold text-foreground leading-snug">{item.name}</span>
              {sessBadge}
              {quadrantBadge}
              {statusBadge}
            </div>
            <div className="text-xs text-text3 leading-snug truncate">{item.meta}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="w-11 h-11 rounded-xl bg-surface2 border border-border/60 text-text2 hover:text-foreground hover:border-border3 grid place-items-center transition-all active:scale-95"
            aria-label="Edit materi"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDelSheet(true)}
            className="w-11 h-11 rounded-xl bg-red/10 border border-red/20 text-red hover:bg-red/20 grid place-items-center transition-all active:scale-95"
            aria-label="Hapus materi"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <DeleteConfirmSheet
        open={delSheet}
        onOpenChange={setDelSheet}
        onConfirm={() => onDelete(id)}
        title={`Hapus "${item.name}"?`}
        desc="Data progres kelas untuk materi ini akan terpengaruh jika sudah dilewati."
      />
    </>
  );
}


function ClassesTab({ onRefresh }: { onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [bulkLevel, setBulkLevel] = useState('SD/MI');
  const { toast } = useToast();
  const data = getData();

  const add = () => {
    if (!name.trim()) return toast({ title: 'Masukkan nama kelas' });
    updateData(d => d.classes.push({ id: genId(), name: name.trim(), color: 'blue', level: level.trim() || undefined }));
    setName(''); setLevel(''); toast({ title: 'Kelas ditambahkan' }); onRefresh();
  };
  const addBulk = () => {
    const names = [...new Set(bulkNames.split('\n').map(v => v.trim()).filter(Boolean))];
    if (!names.length) return toast({ title: 'Isi minimal satu kelas' });
    const existing = new Set(data.classes.filter(c => (c.level || '') === bulkLevel).map(c => c.name.toLowerCase()));
    const added = names.filter(item => !existing.has(item.toLowerCase()));
    updateData(d => added.forEach(item => d.classes.push({ id: genId(), name: item, color: 'blue', level: bulkLevel })));
    setBulkNames(''); toast({ title: `${added.length} kelas ditambahkan${names.length - added.length ? ` · ${names.length - added.length} duplikat dilewati` : ''}` }); onRefresh();
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
        <FormField label="Tambah Banyak Kelas">
          <select value={bulkLevel} onChange={e => setBulkLevel(e.target.value)} className="form-select-style mb-2"><option value="SD/MI">SD / MI</option><option value="SMP/MTs">SMP / MTs</option><option value="SMA/MA">SMA / MA</option></select>
          <textarea value={bulkNames} onChange={e => setBulkNames(e.target.value)} className="form-input-style min-h-[104px] mb-2 resize-none" placeholder={'Satu kelas per baris\nContoh:\n4A\n4B\n5A'} />
          <button onClick={addBulk} className="btn-primary-style font-medium text-[13px] bg-primary text-primary-foreground min-h-[44px] w-full">＋ Tambah Semua Kelas</button>
        </FormField>
        <details className="mt-4"><summary className="cursor-pointer text-xs font-bold text-text2">Tambah satu kelas</summary>
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            className="form-input-style my-2" placeholder="cth: 4A, 10B, XI IPA 2..." />
          <input value={level} onChange={e => setLevel(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            className="form-input-style mb-3" placeholder="Level/jenjang opsional, cth: 10, SD/MI, SMP/MTs" />
          <button onClick={add} className="btn-primary-style font-medium text-[13px] bg-primary text-primary-foreground min-h-[44px]">＋ Tambah Kelas</button>
        </details>
      </div>
      <div className="app-section-title mt-6 mb-2">Daftar Kelas</div>
      {data.classes.map(c => (
        <EditableItem key={c.id} item={{ id: c.id, name: c.name, meta: c.level ? `Level: ${c.level}` : 'Level belum diisi', extraVal: { level: c.level || '' }, deleteWarning: 'Menghapus kelas akan menghapus semua jadwal dan progres terkait.' }} onSave={saveItem} onDelete={del} extraEditField={(v:any, setV:any) => (
          <input value={v.level || ''} onChange={e => setV({ ...v, level: e.target.value })} className="form-input-style mb-2 min-h-[44px]" placeholder="Level/jenjang opsional" />
        )} />
      ))}
      {!data.classes.length && <div className="text-text3 font-medium text-[13px] text-center py-8 border-2 border-dashed border-border2 bg-surface2/30 rounded-3xl mt-2">Belum ada kelas</div>}
    </div>
  );
}


function SubjectsTab({ onRefresh }: { onRefresh: () => void }) {
  const [name, setName] = useState('');
  
  const [level, setLevel] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const { toast } = useToast();
  const data = getData();
  const semesters = getSemesters();

  const [bulkLevel, setBulkLevel] = useState('SD/MI');
  const add = () => {
    if (!name.trim()) return toast({ title: 'Masukkan nama mapel' });
    updateData(d => d.subjects.push({ id: genId(), name: name.trim(), level, examDate: null, semesterId: semesterId || null }));
    setName(''); setLevel(''); setSemesterId(''); toast({ title: 'Mapel ditambahkan' }); onRefresh();
  };
  const saveItem = (id: string, newName: string, extras: any) => {
    if(!newName.trim()) return;
    updateSubject(id, newName, extras.level, extras.examDate, extras.semesterId); toast({ title: 'Mapel diperbarui' }); onRefresh();
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

  const [bulkNames, setBulkNames] = useState('');
  const [bulkAddLevel, setBulkAddLevel] = useState('SD/MI');
  const addBulkSubjects = () => {
    const names = [...new Set(bulkNames.split('\n').map(v => v.trim()).filter(Boolean))];
    if (!names.length) return toast({ title: 'Isi minimal satu mapel' });
    const existing = new Set(data.subjects.filter(s => (s.level || '') === bulkAddLevel).map(s => s.name.toLowerCase()));
    const added = names.filter(item => !existing.has(item.toLowerCase()));
    updateData(d => added.forEach(item => d.subjects.push({ id: genId(), name: item, level: bulkAddLevel, examDate: null, semesterId: null })));
    setBulkNames(''); toast({ title: `${added.length} mapel ditambahkan${names.length - added.length ? ` · ${names.length - added.length} duplikat dilewati` : ''}` }); onRefresh();
  };

  return (
    <div>
      {/* Banner: belum ada semester */}
      {semesters.length === 0 && (
        <div className="app-card-soft p-3 mb-4 border border-amber/30 bg-amber/5">
          <p className="text-[12px] text-amber flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <span>Belum ada semester. Buat semester dulu agar mapel bisa dihubungkan ke UTS/UAS.<br />
              <button onClick={() => { (document as any).__eduSetTab?.('semesters'); }} className="mt-1 inline-block font-bold underline underline-offset-2">→ Buat Semester Sekarang</button>
            </span>
          </p>
        </div>
      )}

      <div className="app-card-soft p-4 mb-4">
        <FormField label="Tambah Banyak Mata Pelajaran" className="mb-0">
          <select value={bulkAddLevel} onChange={e => setBulkAddLevel(e.target.value)} className="form-select-style mb-2"><option value="SD/MI">SD / MI</option><option value="SMP/MTs">SMP / MTs</option><option value="SMA/MA">SMA / MA</option></select>
          <textarea value={bulkNames} onChange={e => setBulkNames(e.target.value)} className="form-input-style min-h-[104px] mb-2 resize-none" placeholder={'Satu mapel per baris\nContoh:\nFiqih\nBahasa Arab\nMatematika'} />
          <button onClick={addBulkSubjects} className="btn-primary-style font-medium text-[13px] bg-primary text-primary-foreground min-h-[44px] w-full mb-3">＋ Tambah Semua Mapel</button>
          <details><summary className="cursor-pointer text-xs font-bold text-text2">Tambah satu mapel + pengaturan lanjutan</summary><div className="mt-3">
          <input value={name} onChange={e => setName(e.target.value)} className="form-input-style mb-3" placeholder="Nama Mapel..." />
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-xs text-text2 mb-1 pl-1">Jenjang</label>
              <select value={level} onChange={e => setLevel(e.target.value)} className="form-select-style text-xs">
                <option value="">Umum / Tidak Spesifik</option>
                <option value="SD/MI">SD / MI</option>
                <option value="SMP/MTs">SMP / MTs</option>
                <option value="SMA/MA">SMA / MA</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-text2 mb-1 pl-1">Hubungkan ke Semester</label>
              <select value={semesterId} onChange={e => setSemesterId(e.target.value)} className="form-select-style text-xs">
                <option value="">Pilih semester...</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={add} className="btn-primary-style font-medium text-[13px] bg-primary text-primary-foreground min-h-[44px]">＋ Tambah Mapel</button>
          </div></details>
        </FormField>
      </div>

      <div className="app-section-title mt-2 mb-2">Daftar Mapel ({data.subjects.length})</div>
      {data.subjects.map(s => {
        const jenjangLabel = s.level ? `[${s.level}] ` : '';
        const sem = semesters.find(x => x.id === s.semesterId);
        const phase = sem ? getCurrentExamPhase(sem) : null;
        const semLabel = sem ? `📅 ${sem.name}${phase ? ` · ${phase} aktif` : ''}` : '⚠️ Belum ada semester';
        const semColor = sem ? '' : 'text-amber';
        return (
          <EditableItem key={s.id} item={{ id: s.id, name: s.name, meta: `${jenjangLabel}${semLabel}`, metaColor: semColor, extraVal: { level: s.level || '', semesterId: s.semesterId || '' }, deleteWarning: 'Menghapus mapel akan menghapus materi dan jadwal terkait.' }} onSave={saveItem} onDelete={del} extraEditField={(v:any, setV:any) => (
            <div className="space-y-2 mb-2">
              <div className="flex gap-2">
                <select value={v.level} onChange={e=>setV({...v, level: e.target.value})} className="form-select-style flex-1 text-xs">
                  <option value="">Umum</option>
                  <option value="SD/MI">SD / MI</option>
                  <option value="SMP/MTs">SMP / MTs</option>
                  <option value="SMA/MA">SMA / MA</option>
                </select>
                <select value={v.semesterId||''} onChange={e=>setV({...v, semesterId: e.target.value})} className="form-select-style flex-1 text-xs">
                  <option value="">Tanpa Semester</option>
                  {semesters.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
            </div>
          )} />
        );
      })}
      {!data.subjects.length && <div className="text-text3 font-medium text-[13px] text-center py-8 border-2 border-dashed border-border2 bg-surface2/30 rounded-3xl mt-2">Belum ada mapel</div>}
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
        <div className="grid grid-cols-7 gap-1.5 mb-3">{DAYS_SHORT.map((d, i) => <button key={i} onClick={() => toggleDay(i)} className={`min-h-[34px] rounded-xl text-xs font-bold border ${days.includes(i) ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border2 text-text2'}`}>{d}</button>)}</div>
        <div className="flex gap-2 mb-3">
          <input type="time" value={st} onChange={e => setSt(e.target.value)} className="form-input-style flex-1 min-h-[44px] px-2 text-xs" />
          <input type="number" value={dr} onChange={e => setDr(parseInt(e.target.value))} className="form-input-style flex-1 min-h-[44px] px-2 text-xs" placeholder="Durasi mnt" />
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
          <div className="text-xs text-text2 mt-[4px] font-medium">{item.meta}</div>
        </div>
        <div className="flex gap-[4px] items-center flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="app-icon-button w-11 h-11" aria-label="Edit jadwal"><Pencil className="h-4 w-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); setDelSheet(true); }} className="w-11 h-11 rounded-2xl bg-red/10 border border-red/20 text-red grid place-items-center transition-all hover:bg-red/15 active:scale-95" aria-label="Hapus jadwal"><Trash2 className="h-4 w-4" /></button>
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
          <div className="w-10 min-h-[44px] rounded-2xl bg-amber/10 border border-amber/20 text-amber grid place-items-center"><Palmtree className="h-5 w-5" /></div>
          <div>
            <div className="font-display text-xl font-bold tracking-tight">Tambah Hari Libur</div>
            <div className="text-[12px] text-text2">Tanggal ini dikecualikan dari hitungan sesi.</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input-style flex-1 min-h-[44px] border-border focus:border-primary" min={todayStr} />
          <select value={level} onChange={e => setLevel(e.target.value)} className="form-select-style flex-1 min-h-[44px] border-border">
            <option value="">Semua Jenjang</option>
            <option value="SD/MI">SD / MI</option>
            <option value="SMP/MTs">SMP / MTs</option>
            <option value="SMA/MA">SMA / MA</option>
          </select>
        </div>
        <button onClick={handleAdd} className="btn-primary-style min-h-[44px] flex items-center justify-center gap-2"><Palmtree className="h-4 w-4" /> Tambah Libur</button>
        <p className="text-xs text-text3 mt-2 leading-relaxed">Input tanggal di mana kelas tidak berlangsung: libur mendadak, acara sekolah, dll. Asisten akan mengecualikan tanggal ini dari perhitungan sesi.</p>
      </div>

      {impacts.length > 0 && (
        <div className="bg-amber/10 border border-amber/25 rounded-2xl p-4 mb-4">
          <div className="text-xs font-black text-amber mb-2 uppercase tracking-wide flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Dampak Hari Libur pada Jadwal</div>
          {impacts.map((imp, i) => (
            <div key={i} className="text-[12px] text-text2">
              <span className="font-semibold text-foreground">{imp.className} — {imp.subjectName}</span>: {imp.impactCount} sesi terpotong
            </div>
          ))}
        </div>
      )}

      <div className="app-section-title mb-2">Daftar Libur ({holidays.length})</div>
      {holidays.length === 0 && (
        <div className="text-text3 font-medium text-[13px] text-center py-8 border-2 border-dashed border-border2 bg-surface2/30 rounded-3xl">Belum ada hari libur yang diinput</div>
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
                <span className="text-xs bg-surface2 text-text2 rounded px-[5px] py-[1px] border">{levelStr}</span>
                {isToday && <span className="text-xs bg-primary text-white rounded px-[5px] py-[1px] font-bold">Hari ini</span>}
                {isPast && <span className="text-xs text-text3">(Sudah lewat)</span>}
              </div>
            </div>
            <button onClick={() => handleRemove(h)} className="w-11 h-11 rounded-2xl bg-red/10 border border-red/20 text-red grid place-items-center flex-shrink-0"><Trash2 className="h-4 w-4" /></button>
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
        <div className="text-xs font-bold tracking-[0.7px] uppercase text-teal mb-[14px] flex items-center gap-2"><Bell className="h-4 w-4" /> Push Notifikasi</div>
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
            <input value={resetVal} onChange={e => setResetVal(e.target.value)} placeholder="Ketik RESET" className="form-input-style min-h-[44px] mb-2 border-red/40 focus:border-red" />
            <button onClick={handleReset} disabled={resetVal !== 'RESET'} className="w-full py-2.5 rounded-2xl bg-red text-white font-bold disabled:opacity-40">Hapus Permanen</button>
            <button onClick={() => { setShowReset(false); setResetVal(''); }} className="w-full py-3 text-text2 text-xs font-semibold mt-1">Batal</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children, className = '' }: any) {
  return <div className={`mb-3 ${className}`}><label className="block text-xs font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">{label}</label>{children}</div>;
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
          <div className="w-10 min-h-[44px] rounded-2xl bg-amber/10 border border-amber/30 flex items-center justify-center text-amber flex-shrink-0"><HeartPulse className="h-5 w-5" /></div>
          <div>
            <div className="font-display text-[18px] font-bold tracking-tight leading-tight">Pengajuan Izin</div>
            <div className="text-xs text-text2">Atur sesi kelas jika berhalangan hadir.</div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Tanggal</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input-style" />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Jenis</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
          <label className="block text-xs font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">
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
          <label className="block text-xs font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">
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
                        {s.nextMat && <div className="text-xs text-text3 mt-0.5 truncate">Materi: {s.nextMat.name}</div>}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0 bg-surface p-1 rounded-2xl border border-border/50">
                        <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${isDeliver ? 'bg-green/10 text-green ring-1 ring-green/30' : 'text-text3 hover:bg-surface3'}`}>
                          <input type="radio" checked={isDeliver} onChange={() => setResolutions(p => ({...p, [s.id]: {...p[s.id], action: 'deliver'}}))} className="hidden" />
                          <CheckCircle2 className="h-3.5 w-3.5" /> Titip Tugas
                        </label>
                        <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${!isDeliver ? 'bg-red/10 text-red ring-1 ring-red/30' : 'text-text3 hover:bg-surface3'}`}>
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
          <span className={"text-xs font-bold " + color}>{safeInfo.pct}% terpakai</span>
        </div>
        <div className="h-2 bg-surface3 rounded-full overflow-hidden mb-2">
          <div className={"h-full rounded-full transition-all " + barColor} style={{ width: safeInfo.pct + '%' }} />
      </div>
      <div className="text-xs text-text3 flex justify-between mb-3">
        <span>{kb} KB digunakan</span>
        <span>{Math.round(info.total / 1024)} KB total</span>
      </div>
      <div className="text-xs text-text3 flex gap-2 flex-wrap mb-3">
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

function SemestersTab({ onRefresh }: { onRefresh: () => void }) {
  const [examType, setExamType] = useState<'UTS' | 'UAS'>('UTS');
  const [level, setLevel] = useState<'SD/MI' | 'SMP/MTs' | 'SMA/MA' | string>('SMP/MTs');
  const levelSimple = level.split('/')[0];
  
  const [eClassId, setEClassId] = useState('');
  const [eSubjectId, setESubjectId] = useState('');
  const [eCustomSubjectName, setECustomSubjectName] = useState('');
  const [eCustomClassName, setECustomClassName] = useState('');
  const [eDate, setEDate] = useState('');
  const [eStartTime, setEStartTime] = useState('');
  const [eEndTime, setEEndTime] = useState('');
  const [eSupervisor, setESupervisor] = useState('');
  
  const { toast } = useToast();
  const data = getData();
  const semesters = getSemesters();

  // Autocomplete data for supervisors
  const usedSupervisors = useMemo(() => {
    const names = new Set<string>();
    (data.examSchedules || []).forEach(e => {
      if (e.supervisorId && e.supervisorId !== data.teacherName) names.add(e.supervisorId);
    });
    return Array.from(names);
  }, [data.examSchedules, data.teacherName]);

  // Preset time templates
  const applyPreset = (presetId: number) => {
    if (levelSimple === 'SD') {
      if (presetId === 1) { setEStartTime('07:30'); setEEndTime('09:00'); }
      if (presetId === 2) { setEStartTime('09:30'); setEEndTime('11:00'); }
    } else if (levelSimple === 'SMP') {
      if (presetId === 1) { setEStartTime('07:30'); setEEndTime('09:30'); }
      if (presetId === 2) { setEStartTime('10:00'); setEEndTime('12:00'); }
    } else { // SMA
      if (presetId === 1) { setEStartTime('07:30'); setEEndTime('09:30'); }
      if (presetId === 2) { setEStartTime('10:00'); setEEndTime('12:00'); }
      if (presetId === 3) { setEStartTime('13:00'); setEEndTime('15:00'); }
    }
  };

  const handleAddExam = () => {
    if (!eClassId || !eSubjectId || !eDate || !eStartTime || !eEndTime || (eClassId === 'custom_class' && !eCustomClassName) || (eSubjectId === 'custom_subject' && !eCustomSubjectName)) {
      return toast({ title: 'Lengkapi form ujian (Kelas, Mapel, Waktu)' });
    }
    const subject = data.subjects.find(s => s.id === eSubjectId);
    const finalSubjectName = eSubjectId === 'custom_subject' ? eCustomSubjectName : subject?.name;
    const finalSubjectId = eSubjectId === 'custom_subject' ? 'custom_' + Date.now() : eSubjectId;
    const finalClassId = eClassId === 'custom_class' ? 'custom_' + Date.now() : eClassId;
    
    // Check duplication (same class, subject, examType, date, level)
    const duplicate = (data.examSchedules || []).find(e => 
      e.classId === finalClassId && e.subjectId === finalSubjectId && 
      e.examType === examType && 
      e.date === eDate &&
      e.level === level
    );
    if (duplicate) {
      return toast({ title: 'Ujian ini sudah ada di jadwal!' });
    }

    addExamSchedule({
      classId: finalClassId,
      subjectId: finalSubjectId,
      subjectName: finalSubjectName,
      customClassName: eClassId === 'custom_class' ? eCustomClassName : undefined,
      date: eDate,
      startTime: eStartTime,
      endTime: eEndTime,
      examType: examType,
      level: level,
      supervisorId: eSupervisor || data.teacherName || 'Pengawas'
    });
    
    setEClassId(''); setESubjectId(''); setECustomSubjectName(''); setECustomClassName(''); 
    // keep eDate, eStartTime, eEndTime the same to make inputting multiple exams on same day easier
    setEStartTime(''); setEEndTime(''); // clear time for next exam
    toast({ title: 'Jadwal ujian ditambahkan' });
    onRefresh();
  };

  const exams = (data.examSchedules || []).filter(e => e.examType === examType && (e.level === level || (!e.level && level === 'SMP/MTs')));

  // Group exams by date
  const groupedExams = useMemo(() => {
    const groups: Record<string, typeof exams> = {};
    exams.forEach(e => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    // sort dates
    const sortedDates = Object.keys(groups).sort();
    // sort exams within each date by start time
    sortedDates.forEach(d => groups[d].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return { groups, sortedDates };
  }, [exams]);

  return (
    <div className="space-y-4">
      {semesters.length === 0 && (
        <div className="app-card-soft p-3 mb-2 border border-amber/30 bg-amber/5">
          <p className="text-[12px] text-amber flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <span>Anda belum membuat semester. Silakan klik tab Semester &amp; Ujian kembali setelah pengaturan ini.</span>
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => setExamType('UTS')} className={`flex-1 py-2.5 min-h-[44px] rounded-xl font-bold text-sm transition-all ${examType === 'UTS' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-surface2 text-text2'}`}>UTS</button>
        <button onClick={() => setExamType('UAS')} className={`flex-1 py-2.5 min-h-[44px] rounded-xl font-bold text-sm transition-all ${examType === 'UAS' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-surface2 text-text2'}`}>UAS</button>
      </div>
      
      <div className="flex gap-2">
        {['SD/MI', 'SMP/MTs', 'SMA/MA'].map(l => (
          <button key={l} onClick={() => setLevel(l)} className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-bold flex-1 transition-all ${level === l ? 'bg-primary text-primary-foreground shadow-md' : 'bg-surface3 text-text3'}`}>
            {l.split('/')[0]}
          </button>
        ))}
      </div>

      <div className="app-card-soft p-4 space-y-4 border border-border/50">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-primary border-b border-border/50 pb-2">
          <CalendarDays className="h-4 w-4" />
          <span>Tambah Jadwal {examType} {levelSimple}</span>
        </div>
        
        {/* Step 1: Kelas & Mapel */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={eClassId} onChange={e => setEClassId(e.target.value)} className="form-input-style text-xs">
              <option value="">1. Pilih Kelas...</option>
              {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="custom_class">+ Kelas Lainnya (Pengawas)</option>
            </select>
            <select value={eSubjectId} onChange={e => setESubjectId(e.target.value)} className="form-input-style text-xs">
              <option value="">2. Pilih Mapel...</option>
              {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="custom_subject">+ Mapel Lainnya (Pengawas)</option>
            </select>
          </div>
          {eClassId === 'custom_class' && <input value={eCustomClassName} onChange={e => setECustomClassName(e.target.value)} placeholder="Tulis Nama Kelas Lainnya" className="form-input-style text-xs w-full border-primary/40 bg-primary/5" autoFocus />}
          {eSubjectId === 'custom_subject' && <input value={eCustomSubjectName} onChange={e => setECustomSubjectName(e.target.value)} placeholder="Tulis Nama Mapel Lainnya" className="form-input-style text-xs w-full border-primary/40 bg-primary/5" autoFocus />}
        </div>

        {/* Step 2: Waktu (Preset per jenjang) */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold text-text2 block">3. Waktu Pelaksanaan</label>
          <input type="date" value={eDate} onChange={e => setEDate(e.target.value)} className="form-input-style text-xs w-full" />
          
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            <button onClick={() => applyPreset(1)} className="snap-start flex-1 whitespace-nowrap px-3 py-2 bg-surface2 hover:bg-surface3 border border-border2 rounded-lg text-[11px] font-medium text-text2 transition-colors">
              Sesi 1 ({levelSimple === 'SD' ? '07:30-09:00' : '07:30-09:30'})
            </button>
            <button onClick={() => applyPreset(2)} className="snap-start flex-1 whitespace-nowrap px-3 py-2 bg-surface2 hover:bg-surface3 border border-border2 rounded-lg text-[11px] font-medium text-text2 transition-colors">
              Sesi 2 ({levelSimple === 'SD' ? '09:30-11:00' : '10:00-12:00'})
            </button>
            {levelSimple === 'SMA' && (
              <button onClick={() => applyPreset(3)} className="snap-start flex-1 whitespace-nowrap px-3 py-2 bg-surface2 hover:bg-surface3 border border-border2 rounded-lg text-[11px] font-medium text-text2 transition-colors">
                Sesi 3 (13:00-15:00)
              </button>
            )}
          </div>
          
          <div className="flex gap-2 items-center">
            <input type="time" value={eStartTime} onChange={e => setEStartTime(e.target.value)} className="form-input-style text-xs flex-1" />
            <span className="text-text3 text-xs font-bold">—</span>
            <input type="time" value={eEndTime} onChange={e => setEEndTime(e.target.value)} className="form-input-style text-xs flex-1" />
          </div>
        </div>

        {/* Step 3: Pengawas (opsional) */}
        <div className="pt-2">
          <label className="text-xs font-semibold text-text2 block mb-1">4. Nama Pengawas (Opsional)</label>
          <input 
            list="supervisors-list"
            value={eSupervisor} 
            onChange={e => setESupervisor(e.target.value)} 
            placeholder={`Kosong = ${data.teacherName || 'Saya'} (Anda yang mengawas)`} 
            className="form-input-style text-xs w-full" 
          />
          <datalist id="supervisors-list">
            {usedSupervisors.map(sup => <option key={sup} value={sup} />)}
          </datalist>
        </div>

        <button onClick={handleAddExam} className="btn-primary-style w-full min-h-[44px] text-xs font-bold mt-2 flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Simpan Jadwal Ujian
        </button>
      </div>

      <div className="space-y-4 mt-6">
        <div className="text-sm font-bold text-foreground border-b border-border/50 pb-2 flex justify-between items-center">
          <span>Jadwal Tersimpan ({levelSimple})</span>
          <span className="text-xs bg-surface2 px-2 py-1 rounded-md text-text2">{exams.length} Ujian</span>
        </div>
        
        {exams.length === 0 ? (
          <div className="text-xs text-text3 text-center py-8 bg-surface2/30 border border-dashed border-border2 rounded-2xl">
            Belum ada jadwal ujian {examType} {levelSimple}.
          </div>
        ) : (
          groupedExams.sortedDates.map(dateStr => (
            <div key={dateStr} className="space-y-2 relative">
              <div className="sticky top-0 z-10 py-1.5 flex items-center gap-2 bg-background/90 backdrop-blur-sm">
                <div className="w-1.5 h-4 bg-primary/40 rounded-full"></div>
                <div className="text-xs font-bold text-text2 uppercase tracking-wide">{fmtDate(dateStr)}</div>
              </div>
              <div className="pl-3.5 space-y-2 border-l-2 border-border/40">
                {groupedExams.groups[dateStr].map(e => {
                  const cls = data.classes.find(c => c.id === e.classId);
                  const isCustomMapel = !data.subjects.some(s => s.id === e.subjectId);
                  
                  return (
                    <div key={e.id} className="border border-border2 rounded-xl p-3 bg-surface1 hover:border-primary/30 transition-colors group relative">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                          {e.customClassName || cls?.name || '?'}
                        </div>
                        <button onClick={() => { deleteExamSchedule(e.id); onRefresh(); }} className="min-w-[32px] min-h-[32px] flex items-center justify-center -mr-2 -mt-2 text-text3 hover:text-red hover:bg-red/10 rounded-lg transition-colors opacity-60 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      
                      <div className="text-text2 text-[12px] font-medium flex flex-wrap items-center gap-1">
                        <span>{e.subjectName || data.subjects.find(s => s.id === e.subjectId)?.name || e.subjectId}</span>
                        {isCustomMapel && <span className="px-1.5 py-0.5 rounded-md bg-amber/10 text-amber text-[9px] font-bold uppercase tracking-wider">Pengawasan</span>}
                      </div>
                      
                      <div className="flex justify-between items-end mt-3">
                        <div className="text-text3 text-[11px] font-mono font-medium bg-surface2/50 px-2 py-1 rounded-md border border-border/30 inline-block">
                          {e.startTime} - {e.endTime}
                        </div>
                        {e.supervisorId && e.supervisorId !== (data.teacherName || 'Pengawas') && (
                          <div className="text-primary text-[10px] font-bold px-2 py-1 rounded-md bg-primary/5 flex items-center gap-1 truncate max-w-[120px]">
                            <UserRound className="h-3 w-3" /> {e.supervisorId}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
