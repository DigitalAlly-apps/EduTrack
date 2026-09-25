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
import {
  addExamSchedule, deleteExamSchedule, fmtDate,
  getExamDayMode, setExamDayMode,
  getExamReminderSettings, updateExamReminderSetting, type ExamReminderSettingKey,
  resetAllExamData
} from '@/lib/examData';
import { SetupTab } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { requestNotifPermission } from '@/lib/notifications';
import { AlertTriangle, Award, Bell, BookMarked, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Database, Download, FileText, FlaskConical, GraduationCap, HardDrive, HeartPulse, HelpCircle, Info, Layers, Link2, Palmtree, Pencil, RotateCcw, Save, ShieldAlert, SkipForward, SlidersHorizontal, Sparkles, Stethoscope, Trash2, Upload, UserRound, X } from 'lucide-react';

interface SetupViewProps {
  onRefresh: () => void;
  onOpenInfo: () => void;
}

export default function SetupView({ onRefresh, onOpenInfo }: SetupViewProps) {
  const data = getData();
  const showGettingStarted = !data.classes.length || !data.subjects.length || !data.schedules.length || !data.materials.length;
  // Default to classes if first time, otherwise show menu
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('section') as SetupTab;
  const tab = ['classes', 'subjects', 'schedules', 'materials', 'semesters', 'holidays', 'leave', 'data', 'exam_settings'].includes(requestedTab) ? requestedTab : null;
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
                  onClick={() => setTab('exam_settings')}
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
          {tab === 'exam_settings' && <ExamSettingsTab onRefresh={refresh} />}
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
  const [bulkNames, setBulkNames] = useState('');
  const [activeLevel, setActiveLevel] = useState<'SD/MI' | 'SMP/MTs' | 'SMA/MA'>('SMP/MTs');
  const [inputMode, setInputMode] = useState<'one' | 'bulk'>('bulk');
  const { toast } = useToast();
  const data = getData();
  const LEVELS = ['SD/MI', 'SMP/MTs', 'SMA/MA'] as const;

  const add = () => {
    if (!name.trim()) return toast({ title: 'Masukkan nama kelas' });
    updateData(d => d.classes.push({ id: genId(), name: name.trim(), color: 'blue', level: activeLevel }));
    setName(''); toast({ title: 'Kelas ditambahkan' }); onRefresh();
  };
  const addBulk = () => {
    const names = [...new Set(bulkNames.split('\n').map(v => v.trim()).filter(Boolean))];
    if (!names.length) return toast({ title: 'Isi minimal satu kelas' });
    const existing = new Set(data.classes.filter(c => c.level === activeLevel).map(c => c.name.toLowerCase()));
    const added = names.filter(item => !existing.has(item.toLowerCase()));
    updateData(d => added.forEach(item => d.classes.push({ id: genId(), name: item, color: 'blue', level: activeLevel })));
    setBulkNames(''); toast({ title: `${added.length} kelas ditambahkan${names.length - added.length ? ` · ${names.length - added.length} duplikat dilewati` : ''}` }); onRefresh();
  };
  const saveItem = (id: string, newName: string, extras?: { level?: string }) => {
    if (!newName.trim()) return;
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

  const grouped = LEVELS.map(lv => ({
    level: lv,
    short: lv.split('/')[0],
    classes: data.classes.filter(c => c.level === lv),
  }));
  const ungrouped = data.classes.filter(c => !c.level || !LEVELS.includes(c.level as any));

  return (
    <div className="space-y-4">
      <div className="app-card-soft p-4 space-y-4">
        {/* Level Picker */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-text2 mb-2">Jenjang</div>
          <div className="flex gap-2">
            {LEVELS.map(lv => (
              <button key={lv} onClick={() => setActiveLevel(lv)}
                className={`flex-1 py-2.5 min-h-[44px] rounded-xl text-sm font-bold transition-all ${activeLevel === lv ? 'bg-primary text-primary-foreground shadow-md' : 'bg-surface2 text-text2 hover:bg-surface3'}`}>
                {lv.split('/')[0]}
              </button>
            ))}
          </div>
        </div>
        {/* Mode Toggle */}
        <div>
          <div className="flex p-1 bg-surface2 rounded-xl mb-3">
            <button onClick={() => setInputMode('one')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${inputMode === 'one' ? 'bg-background shadow text-foreground' : 'text-text2'}`}>Satu Kelas</button>
            <button onClick={() => setInputMode('bulk')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${inputMode === 'bulk' ? 'bg-background shadow text-foreground' : 'text-text2'}`}>Banyak Sekaligus</button>
          </div>
          {inputMode === 'one' ? (
            <div className="flex gap-2">
              <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
                className="form-input-style flex-1" placeholder={`cth: ${activeLevel === 'SD/MI' ? '4A, 5B' : activeLevel === 'SMP/MTs' ? 'VII A, VIII B' : 'X IPA 1, XI IPS 2'}`} />
              <button onClick={add} className="btn-primary-style px-4 min-h-[44px] whitespace-nowrap">＋ Tambah</button>
            </div>
          ) : (
            <div>
              <textarea value={bulkNames} onChange={e => setBulkNames(e.target.value)}
                className="form-input-style min-h-[120px] mb-2 resize-none w-full"
                placeholder={`Satu kelas per baris untuk ${activeLevel.split('/')[0]}:\n${activeLevel === 'SD/MI' ? '4A\n4B\n5A\n5B' : activeLevel === 'SMP/MTs' ? 'VII A\nVII B\nVIII A' : 'X IPA 1\nX IPS 1\nXI IPA 2'}`} />
              <button onClick={addBulk} className="btn-primary-style w-full min-h-[44px] font-bold">＋ Tambah Semua Kelas {activeLevel.split('/')[0]}</button>
            </div>
          )}
        </div>
      </div>

      {/* Classes List grouped by level */}
      <div className="space-y-5">
        {grouped.map(({ level: lv, short, classes }) => classes.length > 0 && (
          <div key={lv}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">{short}</span>
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-text3 font-medium">{classes.length} kelas</span>
            </div>
            {classes.map(c => (
              <EditableItem key={c.id} item={{ id: c.id, name: c.name, meta: lv, extraVal: { level: c.level || '' }, deleteWarning: 'Menghapus kelas akan menghapus semua jadwal dan progres terkait.' }} onSave={saveItem} onDelete={del}
                extraEditField={(v: any, setV: any) => (
                  <div className="flex gap-2 mb-2">
                    {LEVELS.map(l => (
                      <button key={l} type="button" onClick={() => setV({ ...v, level: l })} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${v.level === l ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border text-text2'}`}>{l.split('/')[0]}</button>
                    ))}
                  </div>
                )} />
            ))}
          </div>
        ))}
        {ungrouped.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-text3 bg-surface2 border border-border px-2 py-0.5 rounded-md">Umum</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            {ungrouped.map(c => (
              <EditableItem key={c.id} item={{ id: c.id, name: c.name, meta: 'Jenjang belum ditentukan', extraVal: { level: c.level || '' }, deleteWarning: 'Menghapus kelas akan menghapus semua jadwal dan progres terkait.' }} onSave={saveItem} onDelete={del}
                extraEditField={(v: any, setV: any) => (
                  <div className="flex gap-2 mb-2">
                    {LEVELS.map(l => (
                      <button key={l} type="button" onClick={() => setV({ ...v, level: l })} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${v.level === l ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border text-text2'}`}>{l.split('/')[0]}</button>
                    ))}
                  </div>
                )} />
            ))}
          </div>
        )}
        {data.classes.length === 0 && (
          <div className="text-text3 font-medium text-[13px] text-center py-10 border-2 border-dashed border-border2 bg-surface2/30 rounded-3xl">
            Belum ada kelas. Pilih jenjang dan tambahkan di atas.
          </div>
        )}
      </div>
    </div>
  );
}


function SubjectsTab({ onRefresh }: { onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [activeLevel, setActiveLevel] = useState<'SD/MI' | 'SMP/MTs' | 'SMA/MA'>('SMP/MTs');
  const [semesterId, setSemesterId] = useState('');
  const [inputMode, setInputMode] = useState<'one' | 'bulk'>('bulk');
  const [bulkNames, setBulkNames] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const { toast } = useToast();
  const data = getData();
  const semesters = getSemesters();
  const LEVELS = ['SD/MI', 'SMP/MTs', 'SMA/MA'] as const;

  const add = () => {
    if (!name.trim()) return toast({ title: 'Masukkan nama mapel' });
    updateData(d => d.subjects.push({ id: genId(), name: name.trim(), level: activeLevel, examDate: null, semesterId: semesterId || null }));
    setName(''); setSemesterId(''); toast({ title: 'Mapel ditambahkan' }); onRefresh();
  };
  const addBulk = () => {
    const names = [...new Set(bulkNames.split('\n').map(v => v.trim()).filter(Boolean))];
    if (!names.length) return toast({ title: 'Isi minimal satu mapel' });
    const existing = new Set(data.subjects.filter(s => s.level === activeLevel).map(s => s.name.toLowerCase()));
    const added = names.filter(item => !existing.has(item.toLowerCase()));
    updateData(d => added.forEach(item => d.subjects.push({ id: genId(), name: item, level: activeLevel, examDate: null, semesterId: null })));
    setBulkNames(''); toast({ title: `${added.length} mapel ditambahkan${names.length - added.length ? ` · ${names.length - added.length} duplikat dilewati` : ''}` }); onRefresh();
  };
  const saveItem = (id: string, newName: string, extras: any) => {
    if (!newName.trim()) return;
    updateSubject(id, newName, extras.level, extras.examDate, extras.semesterId, extras.noMaterial, extras.noCorrection); 
    toast({ title: 'Mapel diperbarui' }); 
    onRefresh();
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

  const filteredSubjects = filterLevel === 'all' ? data.subjects : data.subjects.filter(s => s.level === filterLevel);

  return (
    <div className="space-y-4">
      {semesters.length === 0 && (
        <div className="app-card-soft p-3 border border-amber/30 bg-amber/5">
          <p className="text-[12px] text-amber flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <span>Belum ada semester. Buat semester dulu agar mapel bisa dihubungkan ke UTS/UAS.{' '}
              <button onClick={() => { (document as any).__eduSetTab?.('semesters'); }} className="font-bold underline underline-offset-2">→ Buat Sekarang</button>
            </span>
          </p>
        </div>
      )}

      {/* Add Form */}
      <div className="app-card-soft p-4 space-y-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-text2 mb-2">Jenjang Mapel</div>
          <div className="flex gap-2">
            {LEVELS.map(lv => (
              <button key={lv} onClick={() => setActiveLevel(lv)}
                className={`flex-1 py-2.5 min-h-[44px] rounded-xl text-sm font-bold transition-all ${activeLevel === lv ? 'bg-primary text-primary-foreground shadow-md' : 'bg-surface2 text-text2 hover:bg-surface3'}`}>
                {lv.split('/')[0]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex p-1 bg-surface2 rounded-xl mb-3">
            <button onClick={() => setInputMode('one')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${inputMode === 'one' ? 'bg-background shadow text-foreground' : 'text-text2'}`}>Satu Mapel</button>
            <button onClick={() => setInputMode('bulk')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${inputMode === 'bulk' ? 'bg-background shadow text-foreground' : 'text-text2'}`}>Banyak Sekaligus</button>
          </div>
          {inputMode === 'one' ? (
            <div className="space-y-2">
              <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
                className="form-input-style w-full" placeholder="Nama Mapel..." />
              {semesters.length > 0 && (
                <select value={semesterId} onChange={e => setSemesterId(e.target.value)} className="form-select-style w-full text-xs">
                  <option value="">Hubungkan ke Semester (opsional)</option>
                  {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <button onClick={add} className="btn-primary-style w-full min-h-[44px]">＋ Tambah Mapel {activeLevel.split('/')[0]}</button>
            </div>
          ) : (
            <div>
              <textarea value={bulkNames} onChange={e => setBulkNames(e.target.value)}
                className="form-input-style min-h-[120px] mb-2 resize-none w-full"
                placeholder={'Satu mapel per baris:\nFiqih\nBahasa Arab\nMatematika\nIPA'} />
              <button onClick={addBulk} className="btn-primary-style w-full min-h-[44px] font-bold">＋ Tambah Semua Mapel {activeLevel.split('/')[0]}</button>
            </div>
          )}
        </div>
      </div>

      {/* Filter + List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold">Daftar Mapel <span className="text-text3 font-normal text-xs">({filteredSubjects.length})</span></div>
          <div className="flex gap-1">
            {(['all', ...LEVELS] as const).map(lv => (
              <button key={lv} onClick={() => setFilterLevel(lv)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${filterLevel === lv ? 'bg-primary text-primary-foreground' : 'bg-surface2 text-text2 hover:bg-surface3'}`}>
                {lv === 'all' ? 'Semua' : lv.split('/')[0]}
              </button>
            ))}
          </div>
        </div>
        {filteredSubjects.map(s => {
          const sem = semesters.find(x => x.id === s.semesterId);
          const phase = sem ? getCurrentExamPhase(sem) : null;
          const jenjangLabel = s.level ? `[${s.level.split('/')[0]}] ` : '';
          const semLabel = sem ? `📅 ${sem.name}${phase ? ` · ${phase}` : ''}` : '⚠️ Belum ada semester';
          const semColor = sem ? '' : 'text-amber';
          return (
            <EditableItem key={s.id} item={{ id: s.id, name: s.name, meta: `${jenjangLabel}${semLabel}`, metaColor: semColor, extraVal: { level: s.level || '', semesterId: s.semesterId || '', noMaterial: !!s.noMaterial, noCorrection: !!s.noCorrection }, deleteWarning: 'Menghapus mapel akan menghapus materi dan jadwal terkait.' }} onSave={saveItem} onDelete={del}
              extraEditField={(v: any, setV: any) => (
                <div className="space-y-3 mb-3">
                  <div className="flex gap-2">
                    {LEVELS.map(l => (
                      <button key={l} type="button" onClick={() => setV({ ...v, level: l })} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${v.level === l ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border text-text2'}`}>{l.split('/')[0]}</button>
                    ))}
                  </div>
                  <select value={v.semesterId || ''} onChange={e => setV({ ...v, semesterId: e.target.value })} className="form-select-style w-full text-xs">
                    <option value="">Tanpa Semester</option>
                    {semesters.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <div className="space-y-1 bg-surface2/50 p-2.5 rounded-xl border border-border2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={v.noMaterial} onChange={e => setV({ ...v, noMaterial: e.target.checked })} className="rounded border-border text-primary focus:ring-primary/20" />
                      <span className="text-xs text-text font-medium">Tanpa input materi (lisan/praktik)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={v.noCorrection} onChange={e => setV({ ...v, noCorrection: e.target.checked })} className="rounded border-border text-primary focus:ring-primary/20" />
                      <span className="text-xs text-text font-medium">Keluarkan dari antrean koreksi ujian</span>
                    </label>
                  </div>
                </div>
              )} />
          );
        })}
        {filteredSubjects.length === 0 && (
          <div className="text-text3 font-medium text-[13px] text-center py-10 border-2 border-dashed border-border2 bg-surface2/30 rounded-3xl">
            {filterLevel === 'all' ? 'Belum ada mapel. Tambahkan mapel di atas.' : `Belum ada mapel ${filterLevel.split('/')[0]}.`}
          </div>
        )}
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
function MaterialsTab({ onRefresh }: { onRefresh: () => void }) {
  const [params] = useSearchParams();
  const [subId, setSubId] = useState(() => getData().subjects.find(s => s.id === params.get('subjectId'))?.id || (getData().subjects.length === 1 ? getData().subjects[0].id : ''));
  const [classId, setClassId] = useState(() => getData().classes.find(c => c.id === params.get('classId'))?.id || (getData().classes.length === 1 ? getData().classes[0].id : ''));
  const [name, setName] = useState('');
  const [sessions, setSessions] = useState(1);
  const [pageStart, setPageStart] = useState('');
  const [pageEnd, setPageEnd] = useState('');
  const [note, setNote] = useState('');
  const [singleSemesterNum, setSingleSemesterNum] = useState<1 | 2>(1);
  const [singleExamPeriod, setSingleExamPeriod] = useState<'UTS' | 'UAS' | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSessions, setBulkSessions] = useState(1);
  const [rangeFrom, setRangeFrom] = useState('1');
  const [rangeTo, setRangeTo] = useState('');
  const [rangePeriod, setRangePeriod] = useState<'UTS' | 'UAS' | null>('UTS');
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
      bulkAddMaterials(
        subId,
        [{ name, sessions, pageStart, pageEnd, note, examPeriod: singleExamPeriod, semesterNum: singleSemesterNum }],
        sessions,
        undefined,
        classId,
        singleExamPeriod,
        singleSemesterNum
      );
      setName(''); setPageStart(''); setPageEnd(''); setNote('');
      const examLabel = singleExamPeriod ? ` (${singleExamPeriod})` : '';
      toast({ title: `✓ Materi ditambahkan ke Semester ${singleSemesterNum}${examLabel}` });
      onRefresh();
    }
  };

  const saveItem = (id: string, newName: string, newSessions?: number, details?: { pageStart?: string; pageEnd?: string; note?: string }, examPeriod?: 'UTS' | 'UAS' | null) => {
    if(newName.trim()) updateMaterial(id, newName, newSessions, details, examPeriod !== undefined ? examPeriod : undefined); toast({ title: 'Tersimpan' }); onRefresh();
  };
  const del = (id: string) => { const targetId = String(id); updateData(d => d.materials = d.materials.filter(m => String(m.id) !== targetId)); toast({ title: 'Dihapus' }); onRefresh(); };

  const applyRange = () => {
    if (!subId || !classId) return toast({ title: 'Pilih mapel dan kelas dulu' });
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10) || mats.length;
    if (isNaN(from) || from < 1) return toast({ title: 'Nomor bab tidak valid' });
    const actualTo = Math.min(to, mats.length);
    if (from > actualTo) return toast({ title: `Bab ${from} melebihi jumlah bab (${mats.length})` });
    // Convert 1-based UI index to order values (which may not be contiguous after reorder)
    const targetMats = mats.slice(from - 1, actualTo);
    if (targetMats.length === 0) return toast({ title: 'Tidak ada bab dalam rentang ini' });
    const minOrder = Math.min(...targetMats.map(m => m.order));
    const maxOrder = Math.max(...targetMats.map(m => m.order));
    bulkSetExamPeriodByOrderRange(subId, classId, minOrder, maxOrder, rangePeriod);
    const label = rangePeriod ?? '—';
    toast({ title: `✓ Bab ${from} s/d ${actualTo} → ${label}` });
    onRefresh();
  };

  const [autoDistModalOpen, setAutoDistModalOpen] = useState(false);
  const [autoDistSuggestions, setAutoDistSuggestions] = useState<DistributionSuggestion[]>([]);
  const [semesterFilter, setSemesterFilter] = useState<'all' | '1' | '2'>('all');
  const [rangeSemester, setRangeSemester] = useState<1 | 2 | null>(null);

  // Ambil materi untuk kelas ini
  const mats = (() => {
    if (!subId || !classId) return [];
    return getMaterials(subId, classId);
  })();

  const syllabusOverview = subId && classId ? getSyllabusOverview(subId, classId) : null;

  const handleAutoDistribute = () => {
    if (!subId || !classId) return;
    if (!mats.length) {
      toast({ title: 'Masukkan materi terlebih dahulu' });
      return;
    }
    const suggestions = suggestExamPeriodDistribution(mats);
    setAutoDistSuggestions(suggestions);
    setAutoDistModalOpen(true);
  };

  const handleConfirmAutoDistribute = () => {
    applyExamPeriodDistribution(autoDistSuggestions);
    setAutoDistModalOpen(false);
    toast({ title: `✓ ${autoDistSuggestions.length} materi berhasil dibagi untuk Semester 1 & 2 (UTS/UAS)` });
    onRefresh();
  };

  const applyRangeWithSemester = () => {
    if (!subId || !classId) return toast({ title: 'Pilih mapel dan kelas dulu' });
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10) || mats.length;
    if (isNaN(from) || from < 1) return toast({ title: 'Nomor bab tidak valid' });
    const actualTo = Math.min(to, mats.length);
    if (from > actualTo) return toast({ title: `Bab ${from} melebihi jumlah bab (${mats.length})` });
    const targetMats = mats.slice(from - 1, actualTo);
    if (targetMats.length === 0) return toast({ title: 'Tidak ada bab dalam rentang ini' });
    const minOrder = Math.min(...targetMats.map(m => m.order));
    const maxOrder = Math.max(...targetMats.map(m => m.order));
    bulkSetExamPeriodByOrderRange(subId, classId, minOrder, maxOrder, rangePeriod, rangeSemester);
    const examLabel = rangePeriod ?? '—';
    const semLabel = rangeSemester ? `Smt ${rangeSemester}` : '';
    toast({ title: `✓ Bab ${from} s/d ${actualTo} → ${semLabel} ${examLabel}`.trim() });
    onRefresh();
  };

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

  const selectedSubject = data.subjects.find(s => s.id === subId);
  const selectedSemesters = getSemesters();
  const subjectSemester = selectedSubject?.semesterId
    ? selectedSemesters.find(s => s.id === selectedSubject.semesterId) ?? null
    : null;

  return (
    <div>
      {/* Konteks penjelasan examPeriod */}
      <div className="app-card-soft p-3 mb-4 bg-primary/5 border border-primary/20">
        <p className="text-xs text-text2 leading-relaxed">
          <Info className="h-4 w-4 text-primary inline mr-1" />
          <span className="font-bold text-foreground">Cara kerja Materi & Ujian:</span><br />
          Pilih mapel dan kelas, lalu tambahkan bab-bab materi. Anda dapat memasukkan bab untuk <span className="font-bold text-emerald-400">Semester 1 & 2</span> sekaligus dan menandai bab dengan <span className="font-bold text-blue-400">UTS</span> atau <span className="font-bold text-purple-400">UAS</span>.
        </p>
      </div>

      <div className="app-card-soft p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <FormField label="Mata Pelajaran" className="mb-0">
            <select value={subId} onChange={e => { setSubId(e.target.value); setClassId(''); setName(''); setPageStart(''); setPageEnd(''); setNote(''); setBulkText(''); }} className="form-select-style border-primary text-xs">
              <option value="">Pilih mapel...</option>
              {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="Kelas" className="mb-0">
            <select value={classId} onChange={e => { setClassId(e.target.value); setName(''); setPageStart(''); setPageEnd(''); setNote(''); setBulkText(''); }} disabled={!subId || classesForSubject.length === 0} className="form-select-style border-primary text-xs disabled:opacity-50">
              <option value="">{!subId ? '← Pilih mapel dulu' : classesForSubject.length === 0 ? 'Belum ada kelas' : 'Pilih kelas...'}</option>
              {classesForSubject.map(c => <option key={c.id} value={c.id}>{c.name}{classesWithSchedule.find(x => x.id === c.id) ? '' : ' (perlu jadwal)'}</option>)}
            </select>
          </FormField>
        </div>

        {/* Info panel setelah mapel & kelas dipilih */}
        {subId && classId && (
          <div className="bg-surface2 border border-border2 rounded-xl px-3 py-2.5 text-xs text-text2 space-y-0.5">
            <div className="font-bold text-foreground text-[12px] flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>{selectedSubject?.name} — {classesForSubject.find(c => c.id === classId)?.name}</span>
            </div>
            {subjectSemester ? (
              <div>Semester: <span className="font-medium text-foreground">{subjectSemester.name}</span>
                {subjectSemester.utsDate && <span className="ml-2 text-blue-400">UTS: {subjectSemester.utsDate}</span>}
                {subjectSemester.uasDate && <span className="ml-2 text-purple-400">UAS: {subjectSemester.uasDate}</span>}
              </div>
            ) : (
              <div className="text-amber flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Mapel ini belum dihubungkan ke semester. <button onClick={() => (document as any).__eduSetTab?.('semesters')} className="underline font-semibold">Atur di Semester →</button></span>
              </div>
            )}
            {hasNoSchedule && (
              <div className="text-amber flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Belum ada jadwal untuk mapel ini — materi tersimpan tapi belum aktif. <button onClick={() => (document as any).__eduSetTab?.('schedules')} className="underline font-semibold">Buat Jadwal →</button></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ringkasan Silabus & Auto-Distribusi Cerdas 4-Kuadran */}
      {syllabusOverview && syllabusOverview.totalMaterials > 0 && (
        <div className="app-card p-4 mb-4 bg-gradient-to-r from-primary/10 via-surface2 to-surface border border-primary/20 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Silabus Cerdas Smt 1 & 2</span>
              {syllabusOverview.untaggedMaterials > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber border border-amber-500/30">
                  {syllabusOverview.untaggedMaterials} belum di-tag
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ✓ Terorganisir
                </span>
              )}
            </div>
            <button
              onClick={handleAutoDistribute}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:brightness-105 transition-all flex items-center gap-1"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Bagi Smt 1 & 2</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-surface border border-border/60 rounded-xl p-2.5 space-y-1">
              <div className="text-[11px] font-extrabold text-foreground flex justify-between">
                <span>Semester 1 (Ganjil)</span>
                <span className="text-text3">{syllabusOverview.smt1Materials} Bab</span>
              </div>
              <div className="flex gap-1 text-[10px] font-bold">
                <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded">UTS: {syllabusOverview.smt1UtsMaterials}</span>
                <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded">UAS: {syllabusOverview.smt1UasMaterials}</span>
              </div>
            </div>
            <div className="bg-surface border border-border/60 rounded-xl p-2.5 space-y-1">
              <div className="text-[11px] font-extrabold text-foreground flex justify-between">
                <span>Semester 2 (Genap)</span>
                <span className="text-text3">{syllabusOverview.smt2Materials} Bab</span>
              </div>
              <div className="flex gap-1 text-[10px] font-bold">
                <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded">UTS: {syllabusOverview.smt2UtsMaterials}</span>
                <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded">UAS: {syllabusOverview.smt2UasMaterials}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog untuk Konfirmasi Auto-Distribusi 4 Kuadran */}
      {autoDistModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base text-foreground">Saran Pembagian Semester 1 & 2</h3>
              </div>
              <button onClick={() => setAutoDistModalOpen(false)} className="text-text3 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-text2 leading-relaxed">
              EduTrack membagi bab secara seimbang ke <strong>Semester 1</strong> dan <strong>Semester 2</strong>, serta membaginya ke <strong>UTS</strong> dan <strong>UAS</strong>:
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {autoDistSuggestions.map((s, idx) => (
                <div key={s.materialId} className="flex items-center justify-between p-2.5 rounded-xl bg-surface2 border border-border2 text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="font-mono text-text3 font-bold">#{idx + 1}</span>
                    <span className="font-semibold text-foreground truncate">{s.materialName}</span>
                    <span className="text-[11px] text-text3">({s.sessions}×)</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Smt {s.suggestedSemester}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      s.suggestedPeriod === 'UTS' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    }`}>
                      {s.suggestedPeriod}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <button
                onClick={() => setAutoDistModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text2 hover:bg-surface2 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmAutoDistribute}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:brightness-105 transition-all"
              >
                Terapkan Pembagian
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {subId && classId && (
        <div className="app-card-soft p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-foreground">Tambah Materi ({classesForSubject.find(c => c.id === classId)?.name})</span>
            <button onClick={() => setBulkMode(!bulkMode)} className="text-xs font-semibold text-primary px-2 py-1 bg-primary-dim rounded-md">{bulkMode ? 'Satu-satu' : 'Tambah Banyak'}</button>
          </div>
          {bulkMode ? (
            <>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"Bab 1 - Aljabar | 2x | hal 1-12 | UTS\nBab 2 - Geometri | 3x | hal 13-28 | UTS\nBab 3 - Statistik | 2x | hal 29-40 | UAS\n\nTips: Tambahkan | UTS atau | UAS di akhir baris untuk langsung mengikat materi ke ujian."} className="form-input-style min-h-[150px] mb-3 text-[13px] leading-relaxed resize-none font-mono" />
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <label className="text-xs font-bold text-text2 uppercase tracking-wide whitespace-nowrap">Pertemuan per bab:</label>
                <div className="flex items-center gap-1 flex-wrap">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setBulkSessions(n)}
                      className={`w-7 h-7 rounded-md text-xs font-bold border transition-all ${
                        bulkSessions === n ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border text-text2 hover:border-primary'
                      }`}>{n}×</button>
                  ))}
                  <div className="flex items-center gap-1 bg-surface border border-border2 rounded-md px-1.5 h-7 ml-0.5">
                    <span className="text-xs text-text3 font-bold">Lainnya:</span>
                    <input
                      type="number"
                      min="1"
                      value={bulkSessions || ''}
                      onChange={e => setBulkSessions(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-10 h-6 bg-transparent text-xs font-bold text-center focus:outline-none text-foreground"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} className="form-input-style mb-2" placeholder="cth: Bab 1 — Persamaan Linear" />
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <label className="text-xs font-bold text-text2 uppercase tracking-wide whitespace-nowrap">Pertemuan:</label>
                <div className="flex items-center gap-1 flex-wrap">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setSessions(n)}
                      className={`w-7 h-7 rounded-md text-xs font-bold border transition-all ${
                        sessions === n ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border text-text2 hover:border-primary'
                      }`}>{n}×</button>
                  ))}
                  <div className="flex items-center gap-1 bg-surface border border-border2 rounded-md px-1.5 h-7 ml-0.5">
                    <span className="text-xs text-text3 font-bold">Lainnya:</span>
                    <input
                      type="number"
                      min="1"
                      value={sessions || ''}
                      onChange={e => setSessions(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-10 h-6 bg-transparent text-xs font-bold text-center focus:outline-none text-foreground"
                    />
                  </div>
                </div>
              </div>
              {/* 4-Quadrant Semester & Exam Tagging Chips */}
              <div className="mb-3 space-y-1.5">
                <label className="text-[11px] font-bold text-text2 uppercase tracking-wide block">Target Semester & Ujian:</label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => { setSingleSemesterNum(1); setSingleExamPeriod('UTS'); }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      singleSemesterNum === 1 && singleExamPeriod === 'UTS'
                        ? 'badge-smt1-uts border-blue-500 ring-2 ring-blue-500/30'
                        : 'bg-surface border-border text-text3 hover:border-border3'
                    }`}
                  >
                    <span>Smt 1 UTS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSingleSemesterNum(1); setSingleExamPeriod('UAS'); }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      singleSemesterNum === 1 && singleExamPeriod === 'UAS'
                        ? 'badge-smt1-uas border-violet-500 ring-2 ring-violet-500/30'
                        : 'bg-surface border-border text-text3 hover:border-border3'
                    }`}
                  >
                    <span>Smt 1 UAS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSingleSemesterNum(2); setSingleExamPeriod('UTS'); }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      singleSemesterNum === 2 && singleExamPeriod === 'UTS'
                        ? 'badge-smt2-uts border-indigo-500 ring-2 ring-indigo-500/30'
                        : 'bg-surface border-border text-text3 hover:border-border3'
                    }`}
                  >
                    <span>Smt 2 UTS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSingleSemesterNum(2); setSingleExamPeriod('UAS'); }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      singleSemesterNum === 2 && singleExamPeriod === 'UAS'
                        ? 'badge-smt2-uas border-fuchsia-500 ring-2 ring-fuchsia-500/30'
                        : 'bg-surface border-border text-text3 hover:border-border3'
                    }`}
                  >
                    <span>Smt 2 UAS</span>
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <span className="text-text3">Tag terpilih: <strong className="text-foreground font-semibold">Semester {singleSemesterNum} {singleExamPeriod ? `(${singleExamPeriod})` : '— Tanpa Ujian'}</strong></span>
                  {singleExamPeriod !== null && (
                    <button
                      type="button"
                      onClick={() => setSingleExamPeriod(null)}
                      className="text-text3 hover:text-foreground underline"
                    >
                      Reset tag
                    </button>
                  )}
                </div>
              </div>

              {/* Progressive Disclosure for optional details */}
              <details className="group border border-border/50 rounded-xl p-2.5 bg-surface2/30 mb-3">
                <summary className="text-xs font-bold text-text2 cursor-pointer flex items-center justify-between select-none">
                  <span>＋ Halaman & Catatan <span className="font-normal text-text3">(opsional)</span></span>
                  <span className="text-text3 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="pt-2.5 space-y-2">
                  <div className="flex gap-2">
                    <input value={pageStart} onChange={e => setPageStart(e.target.value)} className="form-input-style flex-1 text-xs" placeholder="Hal. mulai (cth: 1)" />
                    <input value={pageEnd} onChange={e => setPageEnd(e.target.value)} className="form-input-style flex-1 text-xs" placeholder="Hal. akhir (cth: 15)" />
                  </div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} className="form-input-style min-h-[60px] resize-none text-xs" placeholder="Catatan opsional (cth: banyak latihan soal, ulang konsep dasar)" />
                </div>
              </details>
            </>
          )}
          <button onClick={add} className="btn-primary-style bg-primary text-primary-foreground min-h-[44px] w-full font-bold text-sm shadow-sm hover:brightness-105 active:scale-[0.99] transition-all">＋ {bulkMode ? 'Tambah Semua Bab' : 'Tambah Bab Materi'}</button>
        </div>
      )}

      {subId && classId && (
        <>
          <div className="mt-5 mb-2 flex justify-between items-center">
            <span className="app-section-title px-0">Daftar Materi ({mats.length})</span>
            {mats.length > 1 && <span className="text-xs text-text2">Tahan &amp; geser untuk urutkan</span>}
          </div>

          {mats.length > 0 && (
            <div className="app-card-soft p-3 mb-3 border border-border/60 bg-surface2/40 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-primary">Set Rentang Bab ke Semester & Ujian</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-text2">Bab</span>
                <input
                  type="number"
                  min="1"
                  max={mats.length}
                  value={rangeFrom}
                  onChange={e => setRangeFrom(e.target.value)}
                  className="form-input-style w-14 text-center h-8 text-xs p-1"
                />
                <span className="text-xs text-text2">s/d</span>
                <input
                  type="number"
                  min="1"
                  max={mats.length}
                  value={rangeTo}
                  placeholder={String(mats.length)}
                  onChange={e => setRangeTo(e.target.value)}
                  className="form-input-style w-14 text-center h-8 text-xs p-1"
                />
                <div className="flex gap-1 ml-auto flex-wrap">
                  {([1, 2, null] as const).map(s => (
                    <button
                      key={`sem-${s ?? 'none'}`}
                      onClick={() => setRangeSemester(s)}
                      className={`px-2 h-8 rounded-md text-xs font-bold border transition-all ${
                        rangeSemester === s
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-surface border-border text-text3 hover:border-border3'
                      }`}
                    >
                      {s ? `Smt ${s}` : 'Smt —'}
                    </button>
                  ))}
                  {(['UTS', 'UAS', null] as const).map(p => (
                    <button
                      key={`exam-${p ?? 'none'}`}
                      onClick={() => setRangePeriod(p)}
                      className={`px-2 h-8 rounded-md text-xs font-bold border transition-all ${
                        rangePeriod === p
                          ? p === 'UTS'
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                            : p === 'UAS'
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                            : 'bg-surface2 border-border3 text-text2'
                          : 'bg-surface border-border text-text3 hover:border-border3'
                      }`}
                    >
                      {p ?? 'Ujian —'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={applyRangeWithSemester}
                  className="w-full mt-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-all hover:brightness-105 active:scale-95"
                >
                  Terapkan ke Rentang Bab
                </button>
              </div>
            </div>
          )}

          {/* Filter Tab Semester 1 vs Semester 2 */}
          {mats.length > 0 && (
            <div className="flex items-center gap-1 mb-3 bg-surface2 p-1 rounded-xl border border-border/50 text-xs font-bold">
              <button
                onClick={() => setSemesterFilter('all')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${semesterFilter === 'all' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-text3 hover:text-foreground'}`}
              >
                Semua Bab ({mats.length})
              </button>
              <button
                onClick={() => { setSemesterFilter('1'); setSingleSemesterNum(1); }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${semesterFilter === '1' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-text3 hover:text-foreground'}`}
              >
                Semester 1 ({mats.filter(m => (m.semesterNum ?? 1) === 1).length})
              </button>
              <button
                onClick={() => { setSemesterFilter('2'); setSingleSemesterNum(2); }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${semesterFilter === '2' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-text3 hover:text-foreground'}`}
              >
                Semester 2 ({mats.filter(m => m.semesterNum === 2).length})
              </button>
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={mats.map(m=>m.id)} strategy={verticalListSortingStrategy}>
              {(() => {
                const teachingPos = classId && subId ? getTeachingPosition(classId, subId, data) : null;
                const completedIds = new Set(teachingPos?.completedMaterialIds ?? []);
                let runningTotal = 0;

                const displayMats = mats.filter(m => {
                  if (semesterFilter === '1') return (m.semesterNum ?? 1) === 1;
                  if (semesterFilter === '2') return m.semesterNum === 2;
                  return true;
                });

                return displayMats.map((m, i) => {
                  const sessions = m.sessions ?? 1;
                  const isFinished = completedIds.has(m.id) || (teachingPos && teachingPos.totalSessionsDone >= runningTotal + sessions);
                  const isCurrent = teachingPos && teachingPos.material?.id === m.id;
                  const sessionIndex = teachingPos?.sessionIndex || 1;
                  runningTotal += sessions;

                  let progressStatus = null;
                  if (isFinished) {
                    progressStatus = { type: 'finished', label: '✓ Selesai' };
                  } else if (isCurrent) {
                    progressStatus = { type: 'current', label: `▶ Sesi ${sessionIndex}/${sessions}` };
                  }

                  const pageLabel = m.pageStart && m.pageEnd ? `Hal. ${m.pageStart}-${m.pageEnd}` : m.pageStart ? `Hal. ${m.pageStart}` : '';
                  const meta = [pageLabel, m.note].filter(Boolean).join(' • ') || `Urutan ke-${m.order}`;
                  return <SortableMaterialItem key={m.id} id={m.id} item={{ ...m, meta, progressStatus }} onSave={saveItem} onDelete={del} />;
                });
              })()}
            </SortableContext>
          </DndContext>
          {!mats.length && <div className="text-text3 font-medium text-[13px] text-center py-8 border-2 border-dashed border-border2 bg-surface2/30 rounded-3xl mt-2">Belum ada materi</div>}
        </>
      )}
      {!subId && <div className="text-text3 text-[13px] text-center p-4 bg-surface2 rounded-2xl mt-2 border border-border2">Pilih mapel untuk melihat materi</div>}
      {subId && !classId && classesForSubject.length > 0 && <div className="text-text3 text-[13px] text-center p-4 bg-surface2 rounded-2xl mt-2 border border-border2">Pilih kelas di atas</div>}
    </div>
  );
}

function SchedulesTab({ onRefresh }: { onRefresh: () => void }) {
  const [params] = useSearchParams();
  const [classId, setClassId] = useState(() => getData().classes.find(c => c.id === params.get('classId'))?.id || (getData().classes.length === 1 ? getData().classes[0].id : ''));
  const [subjectId, setSubjectId] = useState(() => getData().subjects.find(s => s.id === params.get('subjectId'))?.id || (getData().subjects.length === 1 ? getData().subjects[0].id : ''));
  const [startTime, setStartTime] = useState('07:30');
  const [duration, setDuration] = useState('45');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const { toast } = useToast();
  const data = getData();
  const selectedClass = data.classes.find(c => c.id === classId);
  const compatibleSubjects = data.subjects.filter(s => !selectedClass?.level || !s.level || s.level === selectedClass.level);

  const toggleDay = (d: number) => setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const add = () => {
    if (!classId || !subjectId || !startTime || !selectedDays.length) return toast({ title: 'Lengkapi semua field' });
    if (checkOverlap(classId, selectedDays, startTime, parseInt(duration) || 45)) return toast({ title: 'Waktu bentrok dengan jadwal lain' });
    updateData(d => {
      d.schedules.push({ id: genId(), classId, subjectId, days: [...selectedDays], startTime, duration: parseInt(duration) || 45 });
      if (!d.progress.find(p => p.classId === classId && p.subjectId === subjectId)) d.progress.push({ id: genId(), classId, subjectId, materialsDone: 0, lastSession: null });
    });
    setSelectedDays([]); toast({ title: 'Jadwal ditambahkan' }); onRefresh();
  };

  const saveItem = (id: string, _: string, extras: any) => {
    updateSchedule(id, extras.days, extras.st, extras.dr); toast({ title: 'Jadwal diperbarui' }); onRefresh();
  };
  const del = (id: string) => {
    updateData(d => { d.schedules = d.schedules.filter(s => String(s.id) !== String(id)); });
    toast({ title: 'Jadwal dihapus' }); onRefresh();
  };

  // Mini-grid: which days have schedules
  const dayHasSchedule = DAYS_SHORT.map((_, i) => data.schedules.some(s => s.days.includes(i)));

  // Group by day for display
  const schedulesByDay = [0,1,2,3,4,5,6].map(day => ({
    day, schedules: data.schedules.filter(s => s.days.includes(day))
  })).filter(g => g.schedules.length > 0);

  return (
    <div className="space-y-5">
      {/* Mini-grid visual */}
      {data.schedules.length > 0 && (
        <div className="app-card-soft p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text3 mb-2">Distribusi Hari Mengajar</div>
          <div className="grid grid-cols-7 gap-1">
            {DAYS_SHORT.map((d, i) => (
              <div key={i} className={
                `flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${dayHasSchedule[i] ? 'bg-primary/15 border border-primary/30' : 'bg-surface2/50 border border-transparent'}`
              }>
                <span className={`text-[10px] font-bold ${dayHasSchedule[i] ? 'text-primary' : 'text-text3'}`}>{d}</span>
                <div className={`w-2 h-2 rounded-full ${dayHasSchedule[i] ? 'bg-primary' : 'bg-border'}`} />
                <span className={`text-[9px] font-bold ${dayHasSchedule[i] ? 'text-primary' : 'text-text3 opacity-0'}`}>
                  {data.schedules.filter(s => s.days.includes(i)).length || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Form */}
      <div className="app-card-soft p-4 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <div className="text-sm font-bold">Tambah Jadwal Mingguan</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select value={classId} onChange={e => { setClassId(e.target.value); setSubjectId(''); }} className="form-select-style text-xs">
            <option value="">1. Pilih Kelas...</option>
            {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level.split('/')[0]})` : ''}</option>)}
          </select>
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="form-select-style text-xs" disabled={!classId}>
            <option value="">2. Pilih Mapel...</option>
            {compatibleSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Day Selector */}
        <div>
          <div className="text-xs font-bold text-text2 uppercase tracking-wide mb-2">3. Hari Mengajar</div>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS_SHORT.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                className={`py-3 rounded-xl text-xs font-bold border transition-all ${selectedDays.includes(i) ? 'bg-primary border-primary text-primary-foreground shadow-sm' : 'bg-surface border-border text-text2 hover:border-primary/50'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Time & Duration */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs font-bold text-text2 uppercase tracking-wide mb-1.5">4. Jam Mulai</div>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="form-input-style w-full" />
          </div>
          <div>
            <div className="text-xs font-bold text-text2 uppercase tracking-wide mb-1.5">Durasi (menit)</div>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="form-input-style w-full" min={15} max={180} />
          </div>
        </div>

        {/* Summary */}
        {(classId && subjectId && selectedDays.length > 0) && (
          <div className="rounded-xl bg-surface2/70 border border-border2 px-3 py-2 text-xs text-text2 animate-in fade-in">
            <span className="font-bold text-foreground">{data.classes.find(c => c.id === classId)?.name}</span>
            {' · '}<span className="font-bold text-foreground">{data.subjects.find(s => s.id === subjectId)?.name}</span>
            {' · '}{selectedDays.map(d => DAYS_SHORT[d]).join(', ')}
            {' · '}{startTime} · {duration} mnt
          </div>
        )}

        <button onClick={add} className="btn-primary-style w-full min-h-[44px] font-bold flex items-center justify-center gap-2">
          <CalendarDays className="h-4 w-4" /> Simpan Jadwal
        </button>
      </div>

      {/* Schedule List grouped by day */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold">Jadwal Tersimpan</div>
          <span className="text-xs text-text3">{data.schedules.length} slot</span>
        </div>

        {schedulesByDay.length === 0 && (
          <div className="text-text3 font-medium text-[13px] text-center py-10 border-2 border-dashed border-border2 bg-surface2/30 rounded-3xl">
            Belum ada jadwal. Tambahkan di atas.
          </div>
        )}

        <div className="space-y-5">
          {schedulesByDay.map(({ day, schedules }) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <span className="text-[12px] font-bold text-foreground capitalize">{DAYS_ID[day]}</span>
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[11px] text-text3">{schedules.length} mapel</span>
              </div>
              <div className="space-y-2 pl-3 border-l-2 border-border/40">
                {schedules.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(s => {
                  const cls = data.classes.find(c => c.id === s.classId) || { name: '?' };
                  const sub = data.subjects.find(x => x.id === s.subjectId) || { name: '?' };
                  return (
                    <ScheduleEditableItem key={s.id}
                      item={{ id: s.id, name: `${cls.name} — ${sub.name}`, meta: `${fmt(s.startTime)} · ${s.duration} mnt`, st: s.startTime, dr: s.duration, days: s.days }}
                      onSave={saveItem} onDelete={del} />
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

function ExamSettingsTab({ onRefresh }: { onRefresh: () => void }) {
  const { toast } = useToast();
  const [examMode, setExamMode] = useState(getExamDayMode());
  const [reminderSettings, setReminderSettings] = useState(getExamReminderSettings());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleToggleExamMode = () => {
    if (!examMode && !window.confirm('Aktifkan mode fokus ujian? Halaman Hari Ini akan menampilkan agenda ujian terlebih dahulu, tetapi jadwal KBM tetap bisa dibuka dan dicatat.')) return;
    const next = !examMode;
    setExamDayMode(next);
    setExamMode(next);
    onRefresh();
    toast({ title: next ? '📋 Mode Ujian Aktif' : '📚 Mode KBM Normal' });
  };

  const handleToggleReminder = (key: ExamReminderSettingKey) => {
    setReminderSettings(updateExamReminderSetting(key, !reminderSettings[key]));
    onRefresh();
  };

  const handleResetExamData = () => {
    resetAllExamData();
    setShowResetConfirm(false);
    onRefresh();
    toast({ title: '🗑️ Semua data ujian dihapus' });
  };

  const ReminderToggle = ({ settingKey, title, desc }: { settingKey: ExamReminderSettingKey; title: string; desc: string }) => {
    const active = reminderSettings[settingKey];
    const disabled = settingKey !== 'enabled' && !reminderSettings.enabled;
    return (
      <button
        onClick={() => handleToggleReminder(settingKey)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all ${
          disabled ? 'bg-surface2/20 border-border/40 opacity-50' : active ? 'bg-primary/10 border-primary-border text-foreground' : 'bg-surface2/50 border-border2 text-text2 hover:border-border3'
        }`}
      >
        <div className="min-w-0">
          <div className="text-[12px] font-bold leading-tight">{title}</div>
          <div className="text-xs text-text3 mt-0.5 leading-snug">{desc}</div>
        </div>
        <span className={`w-10 h-6 rounded-full border flex-shrink-0 relative transition-all ${active && !disabled ? 'bg-primary border-primary' : 'bg-surface border-border2'}`}>
          <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all ${active && !disabled ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="space-y-3">
        {/* Hero Toggle */}
        <div className={`relative rounded-3xl overflow-hidden border transition-all duration-500 ${
          examMode ? 'bg-amber/10 border-amber/30 shadow-[0_0_30px_hsl(40_80%_60%/0.08)]' : 'bg-surface/60 border-border2'
        }`}>
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-xs font-black uppercase tracking-widest text-text3 mb-1">Mode Ujian Hari Ini</div>
                <div className={`text-xl font-bold mb-1 ${examMode ? 'text-amber' : 'text-foreground'}`}>
                  {examMode ? '📋 Fokus Ujian Aktif' : '📚 KBM Normal'}
                </div>
                <div className="text-[12px] text-text2 leading-snug">
                  {examMode
                    ? 'Agenda ujian diprioritaskan. Jadwal KBM tetap dapat dibuka dari tab Hari Ini.'
                    : 'Aktifkan saat hari ujian untuk memprioritaskan agenda ujian tanpa menghilangkan akses ke KBM.'}
                </div>
              </div>
              <button
                onClick={handleToggleExamMode}
                aria-label="Toggle mode ujian"
                className={`relative flex-shrink-0 w-14 h-7 rounded-full border-2 transition-all duration-300 ${
                  examMode ? 'bg-amber border-amber/60' : 'bg-surface2 border-border2'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-all duration-300 ${
                  examMode ? 'left-[30px] bg-white' : 'left-0.5 bg-text3'
                }`} />
              </button>
            </div>
            {examMode && (
              <div className="mt-4 bg-amber/10 border border-amber/20 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="text-amber">⚡</span>
                <span className="text-xs text-amber font-medium">Mode ini aktif sampai dinonaktifkan secara manual.</span>
              </div>
            )}
          </div>
        </div>

        {/* Reminders */}
        <div className="bg-surface/60 border border-border2 rounded-3xl p-4 space-y-2">
          <div className="mb-2">
            <div className="text-xs font-black uppercase tracking-widest text-primary">Pengingat</div>
            <div className="text-[12px] text-text3 mt-1 leading-snug">
              Hanya untuk jadwal ujian dan ngawas hari ini serta besok. Butuh izin notifikasi aktif.
            </div>
          </div>
          <ReminderToggle settingKey="enabled" title="Aktifkan Reminder" desc="Master switch untuk semua pengingat ujian dan ngawas." />
          <ReminderToggle settingKey="dayBefore" title="H-1 Sore" desc="Ingatkan ujian besok sekitar pukul 18.00." />
          <ReminderToggle settingKey="fiveHoursBefore" title="5 Jam Sebelum" desc="Pengingat awal untuk siap-siap sebelum sesi ujian." />
          <ReminderToggle settingKey="oneHourBefore" title="1 Jam Sebelum" desc="Pengingat dekat sebelum ujian dimulai." />
          <ReminderToggle settingKey="atStart" title="Saat Mulai" desc="Pengingat tepat saat jadwal ujian masuk waktu mulai." />
          <ReminderToggle settingKey="proctorThirtyMinutes" title="Ngawas 30 Menit" desc="Ingatkan jadwal ngawas 30 menit sebelumnya." />
        </div>
      </div>

      {/* ── Section: Reset Data Ujian ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <span className="text-base">🗑️</span>
          <span className="text-xs font-black uppercase tracking-widest text-red">Reset Data</span>
          <div className="flex-1 h-px bg-gradient-to-r from-red/20 to-transparent" />
        </div>

        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-red/20 bg-red/5 hover:bg-red/10 transition-all text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-red/10 border border-red/20 grid place-items-center flex-shrink-0">
              <Trash2 className="h-4 w-4 text-red" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-red">Reset Semua Data Ujian</div>
              <div className="text-xs text-text3 mt-0.5">Hapus jadwal ujian, ngawas, koreksi, dan mode ujian</div>
            </div>
          </button>
        ) : (
          <div className="rounded-2xl border-2 border-red/30 bg-red/5 p-4 space-y-3 animate-slide-up">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-red">Yakin reset semua data ujian?</div>
                <div className="text-xs text-text2 mt-1 leading-relaxed">
                  Ini akan menghapus:<br />
                  • Semua jadwal ujian mapel<br />
                  • Semua sesi ngawas<br />
                  • Semua status koreksi<br />
                  • Mode ujian & pengaturan reminder
                </div>
                <div className="text-xs text-red/80 font-semibold mt-2">⚠️ Aksi ini tidak bisa dibatalkan.</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border2 bg-surface text-sm font-bold text-text2 hover:bg-surface2 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleResetExamData}
                className="flex-1 py-2.5 rounded-xl bg-red text-white text-sm font-bold hover:brightness-110 transition-all active:scale-[0.97]"
              >
                Ya, Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}