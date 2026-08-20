import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, History, LayoutDashboard, Loader2, Pencil, RotateCcw, X } from 'lucide-react';
import {
  composeSessionNote,
  dateFromKey,
  dateKey,
  getData,
  getMaterials,
  getMonthCalendar,
  getSessionHistory,
  getSubjectStatus,
  getTeachingPosition,
  getTotalSessionsNeeded,
  markMaterialCompleted,
  splitSessionNote,
  undoLastSession,
  updateMaterial,
  updateMaterialEstimate,
  type DayStatus,
} from '@/lib/data';
import { normalizeProgressConsistency } from '@/lib/progressConsistency';
import { useToast } from '@/hooks/use-toast';
import type { Material } from '@/lib/types';

type Tab = 'progress' | 'kalender' | 'history';
type EducationLevel = 'sd' | 'mts' | 'other';
type ViewMode = 'detailed' | 'compact';

const PRESET_NEXT_NOTES = [
  'Rangkum isi bab & tulis poin penting di papan tulis',
  'Lanjut pembahasan halaman berikutnya',
  'Latihan soal & pembahasan buku tulis',
  'Ulangi pembahasan contoh & cek hafalan',
  'Kuis & evaluasi bab',
  'Selesaikan bab hari ini',
] as const;

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
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel>(() => (localStorage.getItem('edutrack-progress-level') as EducationLevel) || 'sd');
  const [selectedClassId, setSelectedClassId] = useState('');

  useEffect(() => {
    normalizeProgressConsistency();
    const refresh = () => setRevision(v => v + 1);
    window.addEventListener('edutrack-data-changed', refresh);
    return () => window.removeEventListener('edutrack-data-changed', refresh);
  }, []);

  const tabs = [
    { id: 'progress' as const, label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'kalender' as const, label: 'Kalender', icon: CalendarDays },
    { id: 'history' as const, label: 'Riwayat', icon: History },
  ];

  return (
    <div className="pt-1">
      <div className="mb-[18px] flex gap-1 rounded-2xl border border-border/60 bg-surface/50 p-1 shadow-sm backdrop-blur-md">
        {tabs.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition ${
                active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-text3 hover:bg-surface2/50 hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {item.label}
            </button>
          );
        })}
      </div>
      {tab === 'progress' && (
        <ProgressTab
          revision={revision}
          selectedLevel={selectedLevel}
          setSelectedLevel={setSelectedLevel}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
        />
      )}
      {tab === 'kalender' && <CalendarTab revision={revision} classId={selectedClassId} />}
      {tab === 'history' && <HistoryTab revision={revision} />}
    </div>
  );
}

function ProgressTab({
  revision,
  selectedLevel,
  setSelectedLevel,
  selectedClassId,
  setSelectedClassId,
}: {
  revision: number;
  selectedLevel: EducationLevel;
  setSelectedLevel: (level: EducationLevel) => void;
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('edutrack-progress-viewmode') as ViewMode) || 'detailed');
  const data = useMemo(() => getData(), [revision]);
  const levels = (['sd', 'mts', 'other'] as EducationLevel[]).filter(level => data.classes.some(cls => getEducationLevel(cls.level) === level));
  const classes = data.classes.filter(cls => getEducationLevel(cls.level) === selectedLevel).sort((a, b) => a.name.localeCompare(b.name, 'id'));

  useEffect(() => {
    if (levels.length && !levels.includes(selectedLevel)) setSelectedLevel(levels[0]);
  }, [levels.join('|'), selectedLevel, setSelectedLevel]);

  useEffect(() => {
    if (!classes.length) {
      setSelectedClassId('');
      return;
    }
    const stored = localStorage.getItem(`edutrack-progress-class-${selectedLevel}`);
    if (!classes.some(c => c.id === selectedClassId)) setSelectedClassId(classes.some(c => c.id === stored) ? stored! : classes[0].id);
  }, [selectedLevel, classes.map(c => c.id).join('|'), selectedClassId, setSelectedClassId]);

  const selectLevel = (level: EducationLevel) => {
    localStorage.setItem('edutrack-progress-level', level);
    setSelectedLevel(level);
  };

  const selectClass = (id: string) => {
    localStorage.setItem(`edutrack-progress-class-${selectedLevel}`, id);
    setSelectedClassId(id);
  };

  const setMode = (mode: ViewMode) => {
    localStorage.setItem('edutrack-progress-viewmode', mode);
    setViewMode(mode);
  };

  const selectedClass = data.classes.find(c => c.id === selectedClassId);
  const subjects = selectedClass
    ? data.subjects
        .filter(s => data.schedules.some(sc => sc.classId === selectedClassId && sc.subjectId === s.id))
        .map(subject => ({ subject, status: getSubjectStatus(subject, selectedClass, data) }))
        .sort((a, b) => {
          const score = (s: ReturnType<typeof getSubjectStatus>) => (s.status === 'behind' ? 2 : s.status === 'tight' ? 1 : 0);
          return score(b.status) - score(a.status) || a.subject.name.localeCompare(b.subject.name, 'id');
        })
    : [];

  const onTrackCount = subjects.filter(s => s.status.status === 'on-track').length;
  const tightCount = subjects.filter(s => s.status.status === 'tight').length;
  const behindCount = subjects.filter(s => s.status.status === 'behind').length;

  if (!data.classes.length) return <EmptyState title="Belum ada data progres" text="Tambahkan kelas, mata pelajaran, dan jadwal terlebih dahulu." />;

  return (
    <div className="space-y-4">
      {/* Selection Card */}
      <section className="app-card p-3.5 sm:p-4">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-text3">Pilih jenjang</p>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface2/70 p-1">
          {(
            [
              ['sd', 'SD'],
              ['mts', 'MTs'],
              ['other', 'Lainnya'],
            ] as const
          ).map(([level, label]) => (
            <button
              key={level}
              disabled={!levels.includes(level)}
              onClick={() => selectLevel(level)}
              className={`min-h-[40px] rounded-lg px-2 text-xs font-black transition-all ${
                selectedLevel === level ? 'bg-primary text-primary-foreground shadow-sm' : 'text-text3 disabled:opacity-35'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-[10px] font-black uppercase tracking-widest text-text3">Kelas</label>
        <select
          value={selectedClassId}
          onChange={e => selectClass(e.target.value)}
          className="mt-1.5 min-h-[44px] w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-bold outline-none focus:border-primary"
        >
          {classes.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </section>

      {/* 1. Mini Summary Strip Banner */}
      {subjects.length > 0 && (
        <section className="grid grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-surface/80 p-2.5 shadow-xs">
          <div className="flex items-center gap-2 rounded-xl bg-green/10 border border-green/20 px-2.5 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green flex-shrink-0" />
            <div className="min-w-0">
              <span className="block text-xs font-black text-green leading-tight">{onTrackCount} Mapel</span>
              <span className="block text-[9px] font-bold text-text3 truncate">Aman</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-amber/10 border border-amber/20 px-2.5 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber flex-shrink-0" />
            <div className="min-w-0">
              <span className="block text-xs font-black text-amber leading-tight">{tightCount} Mapel</span>
              <span className="block text-[9px] font-bold text-text3 truncate">Mepet</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-red/10 border border-red/20 px-2.5 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red flex-shrink-0" />
            <div className="min-w-0">
              <span className="block text-xs font-black text-red leading-tight">{behindCount} Mapel</span>
              <span className="block text-[9px] font-bold text-text3 truncate">Kurang Sesi</span>
            </div>
          </div>
        </section>
      )}

      {/* Subject Cards Section */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-text3">Kendali kelas</p>
            <h2 className="mt-0.5 font-display text-xl font-bold">{selectedClass?.name ?? 'Pilih kelas'}</h2>
          </div>

          {/* 2. View Mode Toggle (Ringkasan vs Detail) */}
          <div className="flex items-center gap-1 rounded-xl bg-surface2/80 p-1 border border-border/50">
            <button
              onClick={() => setMode('compact')}
              className={`min-h-[34px] px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
                viewMode === 'compact' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-text3 hover:text-foreground'
              }`}
            >
              Ringkas
            </button>
            <button
              onClick={() => setMode('detailed')}
              className={`min-h-[34px] px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
                viewMode === 'detailed' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-text3 hover:text-foreground'
              }`}
            >
              Detail
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {subjects.map(({ subject, status }) => (
            <SubjectCard
              key={`${selectedClassId}-${subject.id}-${revision}`}
              classId={selectedClassId}
              subjectId={subject.id}
              subjectName={subject.name}
              status={status}
              revision={revision}
              viewMode={viewMode}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SubjectCard({
  classId,
  subjectId,
  subjectName,
  status,
  revision,
  viewMode,
}: {
  classId: string;
  subjectId: string;
  subjectName: string;
  status: ReturnType<typeof getSubjectStatus>;
  revision: number;
  viewMode: ViewMode;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [editingSessionsMaterial, setEditingSessionsMaterial] = useState<Material | null>(null);
  const [sessionDraft, setSessionDraft] = useState('');
  const [editingNote, setEditingNote] = useState(false);

  // Split notes state: topic (mainNote) & teaching notes (reminder)
  const [topicDraft, setTopicDraft] = useState('');
  const [teachingNoteDraft, setTeachingNoteDraft] = useState('');

  // Loading & confirmation states
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isProcessingFinish, setIsProcessingFinish] = useState(false);
  const [confirmMaterial, setConfirmMaterial] = useState<Material | null>(null);

  const data = useMemo(() => getData(), [revision]);
  const materials = getMaterials(subjectId, classId);
  const progress = data.progress.find(p => p.classId === classId && p.subjectId === subjectId);
  const sessionsTotal = getTotalSessionsNeeded(materials);
  const position = getTeachingPosition(classId, subjectId, data);
  const sessionsDone = position.totalSessionsDone;
  const activeMaterial = position.material;
  const progressPct = sessionsTotal ? Math.min(100, Math.round(Math.min(sessionsDone, sessionsTotal) / sessionsTotal * 100)) : 0;
  const available = status.sessLeft ?? 0;
  const needed = status.sessionsNeeded ?? status.remaining;
  const deficit = Math.max(0, needed - available);
  const tone = status.status === 'behind' ? 'red' : status.status === 'tight' ? 'amber' : 'green';

  const parsedNote = useMemo(() => splitSessionNote(activeMaterial?.note), [activeMaterial?.note]);

  useEffect(() => {
    if (!editingNote) {
      const { mainNote, reminder } = splitSessionNote(activeMaterial?.note);
      setTopicDraft(mainNote);
      setTeachingNoteDraft(reminder);
    }
  }, [activeMaterial?.id, activeMaterial?.note, editingNote]);

  const saveSessions = (m: Material) => {
    const parsed = Number(sessionDraft);
    if (!Number.isInteger(parsed) || parsed < 1) {
      toast({ title: 'Jumlah pertemuan minimal 1', variant: 'destructive' });
      return;
    }
    setIsSavingSession(true);
    updateMaterialEstimate(m.id, parsed);
    setEditingSessionsMaterial(null);
    setIsSavingSession(false);
    notifyDataChanged();
    toast({ title: `✓ Rencana ${m.name}: ${parsed} pertemuan` });
  };

  const saveNextNote = () => {
    if (!activeMaterial) return;
    setIsSavingNote(true);
    const combinedNote = composeSessionNote(topicDraft, teachingNoteDraft);
    updateMaterial(
      activeMaterial.id,
      activeMaterial.name,
      activeMaterial.sessions ?? 1,
      { pageStart: activeMaterial.pageStart, pageEnd: activeMaterial.pageEnd, note: combinedNote },
      activeMaterial.examPeriod
    );
    setIsSavingNote(false);
    setEditingNote(false);
    notifyDataChanged();
    toast({ title: '✓ Catatan pertemuan berikutnya tersimpan' });
  };

  const finishMaterial = () => {
    if (!confirmMaterial) return;
    setIsProcessingFinish(true);
    const name = confirmMaterial.name;
    markMaterialCompleted(classId, subjectId, confirmMaterial.id);
    setIsProcessingFinish(false);
    setConfirmMaterial(null);
    notifyDataChanged();
    toast({ title: `✓ Bab “${name}” selesai. Lanjut ke bab berikutnya.` });
  };

  const undo = () => {
    const ok = undoLastSession(classId, subjectId);
    if (ok) {
      notifyDataChanged();
      toast({ title: 'Progres mundur 1 sesi' });
    } else {
      toast({ title: 'Tidak ada sesi untuk dikoreksi', variant: 'destructive' });
    }
  };

  // 3. Left Accent Border per Urgensi Status
  const borderAccent =
    tone === 'red'
      ? 'border-l-[5px] border-l-red border-t border-r border-b border-red/30'
      : tone === 'amber'
      ? 'border-l-[5px] border-l-amber border-t border-r border-b border-amber/30'
      : 'border-l-[5px] border-l-green border-t border-r border-b border-border/60';

  return (
    <>
      <article className={`overflow-hidden rounded-2xl bg-surface/90 shadow-md transition-all ${borderAccent}`}>
        <div className="p-4 sm:p-5 space-y-3.5">
          {/* Header Mapel & Status Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black tracking-tight text-foreground">{subjectName}</h3>
              <p className="mt-0.5 text-[11px] font-bold text-text3">
                {sessionsDone}/{sessionsTotal} pertemuan selesai · {progressPct}%
              </p>
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black flex-shrink-0 ${
                tone === 'red'
                  ? 'border-red/20 bg-red/10 text-red'
                  : tone === 'amber'
                  ? 'border-amber/20 bg-amber/10 text-amber'
                  : 'border-green/20 bg-green/10 text-green'
              }`}
            >
              {deficit ? `Kurang ${deficit} sesi` : tone === 'amber' ? 'Jadwal mepet' : 'Sesi cukup'}
            </span>
          </div>

          {/* Progress Bar (Higher visibility) */}
          <div className="space-y-1">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  tone === 'red' ? 'bg-red' : tone === 'amber' ? 'bg-amber' : 'bg-green'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* BAB SAAT INI (High Contrast Visual Anchor) */}
          <div className="rounded-xl border border-border/70 bg-surface2/50 p-3.5 shadow-inner">
            <p className="text-[9px] font-black uppercase tracking-widest text-text3">Bab Saat Ini</p>
            {position.isComplete ? (
              <p className="mt-1 text-sm font-black text-green flex items-center gap-1">✓ Semua bab selesai 🎉</p>
            ) : activeMaterial ? (
              <>
                <p className="mt-1 text-[15px] font-black leading-snug text-foreground">{activeMaterial.name}</p>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="font-black text-primary bg-primary/10 border border-primary/25 rounded-lg px-2.5 py-1 shadow-xs">
                    Pertemuan {position.sessionIndex} dari {position.totalSessionsInMaterial}
                  </span>
                  {(activeMaterial.pageStart || activeMaterial.pageEnd) && (
                    <span className="font-bold text-text2 bg-surface px-2 py-1 rounded-md border border-border/50">
                      Hal. {activeMaterial.pageStart}
                      {activeMaterial.pageEnd ? `–${activeMaterial.pageEnd}` : ''}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-text3">Materi belum diatur.</p>
            )}
          </div>

          {/* Mode Ringkas vs Detail Handling */}
          {viewMode === 'compact' ? (
            /* COMPACT MODE: Fast Action Buttons Right on Card */
            activeMaterial && !position.isComplete && (
              <div className="pt-1 flex gap-2">
                <button
                  onClick={() => {
                    const { mainNote, reminder } = splitSessionNote(activeMaterial.note);
                    setTopicDraft(mainNote);
                    setTeachingNoteDraft(reminder);
                    setEditingNote(true);
                  }}
                  className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 text-xs font-bold text-primary hover:bg-primary/20 transition-all shadow-xs"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit Catatan
                </button>
                <button
                  onClick={() => setConfirmMaterial(activeMaterial)}
                  className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 rounded-xl border border-amber/30 bg-amber/10 text-xs font-black text-amber hover:bg-amber/20 transition-all shadow-xs"
                >
                  ⚡ Selesaikan Bab
                </button>
              </div>
            )
          ) : (
            /* DETAILED MODE: Full Next Meeting Notes & Collapsible Lists */
            <>
              {activeMaterial && !position.isComplete && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">📌</span>
                      <p className="text-[10px] font-black uppercase tracking-wider text-primary">Pertemuan Berikutnya</p>
                    </div>
                    {!editingNote && (
                      <button
                        onClick={() => {
                          const { mainNote, reminder } = splitSessionNote(activeMaterial.note);
                          setTopicDraft(mainNote);
                          setTeachingNoteDraft(reminder);
                          setEditingNote(true);
                        }}
                        className="min-h-[38px] flex items-center gap-1.5 rounded-xl border border-primary/30 bg-surface px-3 py-1 text-[11px] font-bold text-primary shadow-xs hover:bg-primary/10 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit catatan
                      </button>
                    )}
                  </div>

                  <div className="mt-2.5 space-y-2 text-xs">
                    {parsedNote.mainNote && (
                      <div className="rounded-lg bg-surface/70 p-2.5 border border-border/50">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-text3">Topik / Yang Akan Dilakukan</span>
                        <p className="mt-0.5 font-bold text-foreground leading-snug">{parsedNote.mainNote}</p>
                      </div>
                    )}
                    {parsedNote.reminder && (
                      <div className="rounded-lg bg-surface/70 p-2.5 border border-border/50">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-amber">Catatan Mengajar</span>
                        <p className="mt-0.5 font-medium text-text2 whitespace-pre-wrap leading-snug">{parsedNote.reminder}</p>
                      </div>
                    )}
                    {!parsedNote.mainNote && !parsedNote.reminder && (
                      <p className="italic text-text3 text-[11px]">Belum ada catatan pertemuan berikutnya. Klik edit untuk menambahkan.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Collapsible Header: Rencana Bab & Edit */}
              <button
                onClick={() => setExpanded(v => !v)}
                className="min-h-[42px] flex w-full items-center justify-between rounded-xl border border-border/60 bg-surface px-3.5 py-2 text-left text-[11px] font-black text-text2 hover:bg-surface2/60 transition-colors"
              >
                <span>Rencana Bab & Edit Pertemuan</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
              </button>
            </>
          )}
        </div>

        {/* Collapsible Content (Detailed Mode) */}
        {viewMode === 'detailed' && expanded && (
          <div className="border-t border-border/50 bg-surface2/30 p-4 space-y-3">
            <div className="space-y-2.5">
              {(() => {
                let consumed = 0;
                const explicitCompleted = new Set(position.completedMaterialIds ?? []);
                return materials.map(m => {
                  const count = m.sessions ?? 1;
                  const finished = explicitCompleted.has(m.id) || sessionsDone >= consumed + count;
                  const current = position.material?.id === m.id && !position.isComplete;
                  consumed += count;

                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-3 transition-all ${
                        current ? 'border-primary/30 bg-primary/5 shadow-xs' : 'border-border/50 bg-surface'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-0.5 text-xs font-black ${finished ? 'text-green' : current ? 'text-primary' : 'text-text3'}`}>
                          {finished ? '✓' : current ? '▶' : '○'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold ${finished ? 'text-text3 line-through' : 'text-foreground'}`}>{m.name}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingSessionsMaterial(m);
                                setSessionDraft(String(count));
                              }}
                              className="min-h-[36px] rounded-lg border border-border bg-surface2 px-3 py-1 text-[10px] font-bold text-text2 hover:border-primary/40 transition-colors flex items-center gap-1"
                            >
                              {count} pertemuan ✏️
                            </button>

                            {current && (
                              <button
                                onClick={() => setConfirmMaterial(m)}
                                className="min-h-[36px] rounded-lg border border-amber/30 bg-amber/10 px-3 py-1 text-[10px] font-black text-amber hover:bg-amber/20 transition-colors flex items-center gap-1"
                              >
                                ⚡ Selesaikan bab sekarang
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Undo Action & Tracker Collapse */}
            <div className="border-t border-border/50 pt-3 space-y-3">
              <button
                onClick={() => setAnalysisOpen(v => !v)}
                className="flex w-full items-center justify-between text-left text-[11px] font-bold text-text3 hover:text-foreground"
              >
                <span>Analisis Tracker Sesi (Detail)</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${analysisOpen ? 'rotate-180' : ''}`} />
              </button>

              {analysisOpen && (
                <div className="rounded-xl bg-surface/80 border border-border/60 p-3 text-[11px] animate-fade-in">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <b className="block text-sm font-black">{needed}</b>
                      <span className="text-text3 text-[10px]">dibutuhkan</span>
                    </div>
                    <div>
                      <b className="block text-sm font-black">{available}</b>
                      <span className="text-text3 text-[10px]">tersedia</span>
                    </div>
                    <div>
                      <b className={`block text-sm font-black ${deficit ? 'text-red' : 'text-green'}`}>
                        {deficit ? `-${deficit}` : 'Aman'}
                      </b>
                      <span className="text-text3 text-[10px]">kondisi</span>
                    </div>
                  </div>
                  {status.rec && <p className="mt-2.5 border-t border-border/40 pt-2 leading-relaxed text-text2">{status.rec}</p>}
                </div>
              )}

              {sessionsDone > 0 && (
                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  <span className="text-[10px] text-text3">Salah input progres?</span>
                  <button
                    onClick={undo}
                    className="min-h-[36px] rounded-lg border border-amber/25 bg-amber/10 px-3 py-1.5 text-[10px] font-black text-amber hover:bg-amber/20 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Mundur 1 sesi
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </article>

      {/* 5. Mobile-First Bottom Sheet: Edit Catatan Pertemuan Berikutnya */}
      {editingNote &&
        createPortal(
          <div className="app-overlay z-[1000]" onClick={() => setEditingNote(false)}>
            <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
              <div className="app-sheet-handle" />
              <div className="app-sheet-title text-[18px]">Catatan Pertemuan Berikutnya</div>
              <p className="mt-1 text-[12px] font-bold text-text2">
                {subjectName} · {activeMaterial?.name}
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-text3 mb-1.5">
                    Materi / Topik Pertemuan Berikutnya
                  </label>
                  <select
                    value={PRESET_NEXT_NOTES.includes(topicDraft as any) ? topicDraft : topicDraft ? '__custom__' : ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setTopicDraft('');
                      } else {
                        setTopicDraft(val);
                      }
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-primary/30 bg-surface px-3 py-2.5 text-xs font-bold outline-none focus:border-primary mb-2"
                  >
                    <option value="">-- Pilih rencana pertemuan berikutnya --</option>
                    {PRESET_NEXT_NOTES.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    <option value="__custom__">✍️ Ketik topik/rencana khusus...</option>
                  </select>

                  {(!PRESET_NEXT_NOTES.includes(topicDraft as any) || topicDraft === '') && (
                    <input
                      type="text"
                      value={topicDraft}
                      onChange={e => setTopicDraft(e.target.value)}
                      placeholder="Contoh: Rangkuman Bab Thaharah / Ketik topik..."
                      className="min-h-[44px] w-full rounded-xl border border-primary/30 bg-surface px-3 py-2.5 text-xs font-bold outline-none focus:border-primary"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-text3 mb-1.5">
                    Catatan Mengajar / Instruksi Untuk Saya
                  </label>
                  <textarea
                    value={teachingNoteDraft}
                    onChange={e => setTeachingNoteDraft(e.target.value)}
                    placeholder="Contoh: Rangkum isi bab, tulis 5 poin di papan tulis, latihan hal 32..."
                    className="min-h-[85px] w-full resize-none rounded-xl border border-primary/30 bg-surface p-3 text-xs font-medium outline-none focus:border-primary"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setEditingNote(false)}
                    disabled={isSavingNote}
                    className="flex-1 min-h-[44px] rounded-xl border border-border2 bg-surface text-xs font-bold text-text2"
                  >
                    Batal
                  </button>
                  <button
                    onClick={saveNextNote}
                    disabled={isSavingNote}
                    className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black text-primary-foreground shadow-md disabled:opacity-50"
                  >
                    {isSavingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {isSavingNote ? 'Menyimpan…' : 'Simpan Catatan'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 5. Mobile-First Bottom Sheet: Ubah Estimasi Pertemuan Bab */}
      {editingSessionsMaterial &&
        createPortal(
          <div className="app-overlay z-[1000]" onClick={() => setEditingSessionsMaterial(null)}>
            <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
              <div className="app-sheet-handle" />
              <div className="app-sheet-title text-[18px]">Ubah Estimasi Pertemuan</div>
              <p className="mt-1 text-[12px] font-bold text-text2">{editingSessionsMaterial.name}</p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-text3 mb-1.5">
                    Dibutuhkan Berapa Pertemuan?
                  </label>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={sessionDraft}
                    onChange={e => setSessionDraft(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-primary/30 bg-surface px-4 text-base font-black outline-none focus:border-primary text-center"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setEditingSessionsMaterial(null)}
                    disabled={isSavingSession}
                    className="flex-1 min-h-[44px] rounded-xl border border-border2 bg-surface text-xs font-bold text-text2"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => saveSessions(editingSessionsMaterial)}
                    disabled={isSavingSession}
                    className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black text-primary-foreground shadow-md disabled:opacity-50"
                  >
                    {isSavingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {isSavingSession ? 'Menyimpan…' : 'Simpan Estimasi'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Confirmation Modal for Selesaikan Bab */}
      {confirmMaterial &&
        createPortal(
          <div className="app-overlay z-[1000]" onClick={() => setConfirmMaterial(null)}>
            <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
              <div className="app-sheet-handle" />
              <div className="app-sheet-title text-[20px] flex items-center gap-2">
                <span>⚡</span> Selesaikan Bab Sekarang?
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-text2">
                Selesaikan <strong>"{confirmMaterial.name}"</strong> sekarang? Sisa rencana pertemuan bab ini akan dilewati dan materi aktif
                langsung berpindah ke bab berikutnya.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setConfirmMaterial(null)}
                  disabled={isProcessingFinish}
                  className="flex-1 min-h-[44px] rounded-xl border border-border2 bg-surface py-3 text-sm font-bold text-text2"
                >
                  Batal
                </button>
                <button
                  onClick={finishMaterial}
                  disabled={isProcessingFinish}
                  className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground shadow-md disabled:opacity-50"
                >
                  {isProcessingFinish ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isProcessingFinish ? 'Memproses…' : 'Ya, Selesaikan'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function HistoryTab({ revision }: { revision: number }) {
  const [month, setMonth] = useState(dateKey().slice(0, 7));
  const items = useMemo(() => getSessionHistory(month), [month, revision]);
  const data = useMemo(() => getData(), [revision]);
  const grouped = items.reduce((r, s) => {
    (r[s.date] ||= []).push(s);
    return r;
  }, {} as Record<string, typeof items>);
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-3">
        <span className="text-[11px] font-black uppercase tracking-wide text-text3">Pilih bulan</span>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="form-input-style min-h-0 w-auto px-3 py-1.5 text-xs font-bold" />
      </div>
      {!dates.length ? (
        <EmptyState title="Tidak ada riwayat" text="Belum ada sesi tercatat di bulan ini." />
      ) : (
        <div className="space-y-5">
          {dates.map(date => (
            <section key={date}>
              <h3 className="mb-2 text-[11px] font-black text-primary">
                {dateFromKey(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <div className="space-y-2">
                {grouped[date].map(session => {
                  const cls = data.classes.find(i => i.id === session.classId)?.name ?? '?';
                  const subject = data.subjects.find(i => i.id === session.subjectId)?.name ?? '?';
                  const material = data.materials.find(i => i.id === session.materialId);
                  const { mainNote, reminder } = splitSessionNote(session.note);
                  return (
                    <div key={session.id} className="rounded-xl border border-border bg-surface p-3">
                      <p className="text-[13px] font-black">
                        {cls} · {subject}
                      </p>
                      <p className="mt-0.5 text-[11px] text-text2">{material?.name ?? (session.materialId === 'SKIPPED' ? 'Dilewati' : 'Tanpa materi')}</p>
                      {mainNote && <p className="mt-1 text-[11px] text-text3">Berikutnya: {mainNote}</p>}
                      {reminder && <p className="mt-1 text-[10px] font-semibold text-amber">📌 {reminder}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarTab({ revision, classId }: { revision: number; classId?: string }) {
  const [month, setMonth] = useState(dateKey().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(dateKey());
  const days = useMemo(() => getMonthCalendar(month, classId), [month, classId, revision]);
  const data = useMemo(() => getData(), [revision]);
  const firstDay = new Date(`${month}-01T12:00:00`).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const tones: Record<DayStatus, string> = {
    done: 'bg-green/10 text-green',
    partial: 'bg-amber/10 text-amber',
    missed: 'bg-red/10 text-red',
    holiday: 'bg-surface2 text-text3',
    noclass: 'text-text3',
    future: 'text-text3/40',
  };
  const legendItems = [
    {
      tone: 'bg-green/20 border-green/40 text-green',
      dot: 'bg-green',
      label: 'Selesai (Hijau)',
      desc: 'Semua KBM terjadwal pada hari tersebut telah dilaksanakan & dicatat.',
    },
    {
      tone: 'bg-amber/20 border-amber/40 text-amber',
      dot: 'bg-amber',
      label: 'Sebagian (Kuning)',
      desc: 'Sebagian KBM selesai, namun masih ada jadwal yang belum dicatat.',
    },
    {
      tone: 'bg-red/20 border-red/40 text-red',
      dot: 'bg-red',
      label: 'Terlewat (Merah)',
      desc: 'Ada jadwal KBM tetapi 0 sesi yang dicatat (KBM terlewat/alpa).',
    },
    {
      tone: 'bg-surface2 border-border/70 text-text2',
      dot: 'bg-text3',
      label: 'Libur (Abu-abu)',
      desc: 'Hari libur sekolah/nasional atau tidak ada jadwal KBM.',
    },
  ];
  const selectedDay = days.find(day => day.date === selectedDate);
  const selectedSessions = data.sessions.filter(session =>
    session.date === selectedDate && (!classId || session.classId === classId),
  );
  const selectedStatusLabel: Record<DayStatus, string> = {
    done: 'Selesai', partial: 'Sebagian', missed: 'Terlewat', holiday: 'Libur', noclass: 'Tidak ada jadwal', future: 'Mendatang',
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-3 shadow-xs">
        <span className="text-[11px] font-black uppercase tracking-wide text-text3">Bulan</span>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="form-input-style min-h-0 w-auto px-3 py-1.5 text-xs font-bold" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="grid grid-cols-7 border-b border-border/50 bg-surface2/40">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(day => (
            <div key={day} className="py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-text3">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 p-1.5 gap-0.5">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map(day => (
            <button
              key={day.date}
              onClick={() => setSelectedDate(day.date)}
              aria-pressed={selectedDate === day.date}
              className={`m-0.5 grid min-h-10 place-items-center rounded-xl text-xs font-black transition-all ${tones[day.status]} ${
                day.date === dateKey() ? 'ring-2 ring-primary shadow-sm' : ''
              } ${
                selectedDate === day.date ? 'outline outline-2 outline-offset-1 outline-primary' : ''
              }`}
            >
              {Number(day.date.slice(8))}
            </button>
          ))}
        </div>
      </div>

      {selectedDay && (
        <section className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-text3">Audit pengajaran</p>
          <h3 className="mt-1 text-sm font-black">
            {dateFromKey(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <p className="mt-1 text-[12px] font-bold text-text2">
            {selectedStatusLabel[selectedDay.status]} · {selectedDay.sessionCount} dari {selectedDay.schedCount} KBM tercatat
          </p>
          {selectedSessions.length > 0 ? (
            <div className="mt-3 space-y-2">
              {selectedSessions.map(session => {
                const cls = data.classes.find(item => item.id === session.classId)?.name ?? '?';
                const subject = data.subjects.find(item => item.id === session.subjectId)?.name ?? '?';
                return <div key={session.id} className="rounded-xl border border-border/60 bg-surface2/40 px-3 py-2 text-[12px] font-bold">✓ {subject} — {cls}</div>;
              })}
            </div>
          ) : selectedDay.schedCount > 0 ? (
            <p className="mt-3 rounded-xl bg-surface2/50 px-3 py-2 text-[12px] text-text3">Belum ada KBM yang tercatat pada tanggal ini.</p>
          ) : null}
        </section>
      )}

      {/* Keterangan Warna Kalender */}
      <div className="mt-4 rounded-2xl border border-border/70 bg-surface/80 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-text3">Keterangan Warna Kalender</h4>
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
            Lingkaran biru = Hari Ini
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {legendItems.map(item => (
            <div key={item.label} className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-surface2/40 p-2.5">
              <span className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-md border ${item.tone} flex items-center justify-center`}>
                <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
              </span>
              <div>
                <span className="block text-[11px] font-bold text-foreground">{item.label}</span>
                <span className="block text-[10px] text-text3 leading-snug">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="mb-3 block text-4xl opacity-60">📈</span>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-[280px] text-sm text-text2">{text}</p>
    </div>
  );
}
