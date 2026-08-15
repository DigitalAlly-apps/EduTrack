import { useState, useMemo, memo, useCallback, useEffect, type ElementType } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, FilePenLine, History, LayoutDashboard, TrendingUp } from 'lucide-react';
import {
  getData, getMaterials, getSubjectStatus, fmt, getSessionHistory, now, getMonthCalendar, DayStatus, getTotalSessionsNeeded, dateKey, dateFromKey,
  generatePaceSuggestions, applyPaceSuggestion, addExtraSession,
  composeSessionNote, getNextStartPage, getPredictiveFinishes, getExamPrepItems, splitSessionNote, undoLastSession, updateSessionNote, getTeachingPosition,
} from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { clearSessionDraft, loadSessionDraft, saveSessionDraft } from '@/lib/sessionDraft';
import WeeklyReviewCard from './WeeklyReviewCard';
import ExamPrepCard from './ExamPrepCard';
import { PaceSuggestion, PredictiveFinish, ExamPrepItem, Session } from '@/lib/types';

// ─── AI PACE SUGGESTIONS CARD ───────────────────────────────────────────────────
function PaceSuggestionsCard() {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<PaceSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const result = generatePaceSuggestions();
      setSuggestions(result.slice(0, 3));
      setLoading(false);
    }, 600);
  }, []);

  const handleApply = (suggestion: PaceSuggestion) => {
    if (suggestion.type === 'add_sessions' && suggestion.suggestedDates?.length) {
      applyPaceSuggestion(suggestion);
      toast({ title: `Ditambahkan ${suggestion.suggestedDates.length} sesi pengganti` });
      fetchSuggestions();
    } else {
      toast({ title: 'Saran tidak bisa diterapkan otomatis' });
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl overflow-hidden mb-4 animate-slide-up shadow-sm">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')]" />
      <div className="relative p-4 flex items-center justify-between border-b border-primary/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-sm">🧠</div>
          <div>
            <div className="text-[13px] font-bold text-foreground">Pengaturan Tempo Otomatis</div>
            <div className="text-[10px] text-text3">Saran cerdas untuk target ujian</div>
          </div>
        </div>
        <button onClick={fetchSuggestions} disabled={loading} className={`w-8 h-8 rounded-lg bg-surface border border-border2 text-text2 text-[12px] grid place-items-center flex-shrink-0 transition-all hover:bg-surface2 ${loading ? 'animate-spin' : ''}`} title="Perbarui saran">↻</button>
      </div>
      <div className="relative p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-text2 text-[12px] py-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.3s' }} />
            <span>Menganalisis target ujian...</span>
          </div>
        ) : suggestions && suggestions.length > 0 ? (
          <div className="space-y-2.5">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-surface/60 backdrop-blur-sm border border-border/60 rounded-xl p-3">
                <div className="flex items-start gap-2.5">
                  <div className="text-base flex-shrink-0 mt-0.5">
                    {s.type === 'add_sessions' ? '⚡' : s.type === 'merge_sessions' ? '🔗' : '✂️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-[12px] font-bold text-foreground truncate">{s.class} • {s.subject}</div>
                      {s.actionable && (
                        <button onClick={() => handleApply(s)} className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full flex-shrink-0">Terapkan</button>
                      )}
                    </div>
                    <div className="text-[11px] text-text2 leading-snug">{s.description}</div>
                    {s.suggestedDates && s.suggestedDates.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {s.suggestedDates.slice(0, 3).map(d => (
                          <span key={d} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{d}</span>
                        ))}
                        {s.suggestedDates.length > 3 && (
                          <span className="text-[9px] text-text3">+{s.suggestedDates.length - 3} lain</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-2xl mb-1.5">✅</div>
            <div className="text-[12px] text-text2 font-medium">Semua target aman. Tidak ada saran urgent.</div>
          </div>
        )}
      </div>
    </div>
  );
}


function getUrgencyScore(st: ReturnType<typeof getSubjectStatus>): number {
  let score = 0;
  if (st.status === 'behind') score += 100;
  else if (st.status === 'tight') score += 50;
  if (st.daysLeft !== undefined) {
    if (st.daysLeft <= 3) score += 80;
    else if (st.daysLeft <= 7) score += 40;
    else if (st.daysLeft <= 14) score += 20;
  }
  return score;
}

function getEffectiveStatus(st: ReturnType<typeof getSubjectStatus>): 'green' | 'amber' | 'red' {
  if (st.daysLeft !== undefined && st.daysLeft <= 3 && st.status !== 'behind') return 'amber';
  if (st.status === 'behind') return 'red';
  if (st.status === 'tight') return 'amber';
  return 'green';
}

export default function ProgressView() {
  const [tab, setTab] = useState<'progress' | 'history' | 'kalender'>('progress');
  const tabs: { id: typeof tab; label: string; icon: ElementType }[] = [
    { id: 'progress', label: 'Progres', icon: LayoutDashboard },
    { id: 'kalender', label: 'Kalender', icon: CalendarDays },
    { id: 'history', label: 'Riwayat', icon: History },
  ];

  // Compute predictive finishes (Feature 5)
  const predictiveFinishes = useMemo(() => {
    try {
      return getPredictiveFinishes();
    } catch (e) {
      console.error('Predictive finishes error:', e);
      return [];
    }
  }, []);

  // Compute exam prep items (Feature 8)
  const examPrepItems = useMemo(() => {
    try {
      return getExamPrepItems();
    } catch (e) {
      console.error('Exam prep items error:', e);
      return [];
    }
  }, []);

  return (
    <div className="pt-1">
      <div className="flex bg-surface/50 backdrop-blur-md border border-border/60 rounded-2xl mb-[18px] p-1 shadow-sm gap-1">
        {tabs.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 min-h-[38px] text-[11px] font-black tracking-wide uppercase rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 ${active ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]' : 'text-text3 hover:text-foreground hover:bg-surface2/50'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
      {tab === 'progress' && <ProgressTab predictiveFinishes={predictiveFinishes} examPrepItems={examPrepItems} />}
      {tab === 'kalender' && <CalendarTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type CardData = {
  clsId: string; clsName: string;
  subId: string; subName: string;
  st: ReturnType<typeof getSubjectStatus>;
  urgency: number;
  effectiveColor: 'green' | 'amber' | 'red';
  mats: any[];
  matsDone: number;
  totalSessDone: number;
  totalSessAll: number;
  teachingPosition: ReturnType<typeof getTeachingPosition>;
  predictiveFinish?: PredictiveFinish | undefined;
};

type GroupData = { clsName: string; cards: CardData[]; issues: number };

function getMaterialPageLabel(material?: { pageStart?: string; pageEnd?: string } | null) {
  if (!material?.pageStart) return '';
  return material.pageEnd ? `Hal. ${material.pageStart}-${material.pageEnd}` : `Hal. ${material.pageStart}`;
}

type EducationLevel = 'sd' | 'mts' | 'other';

function getEducationLevel(level?: string): EducationLevel {
  const normalized = (level ?? '').trim().toLowerCase();
  if (/\b(sd|mi)\b/.test(normalized)) return 'sd';
  if (/\b(mts|smp)\b/.test(normalized)) return 'mts';
  const grade = Number(normalized.match(/\d+/)?.[0]);
  if (Number.isFinite(grade) && grade >= 1 && grade <= 6) return 'sd';
  if (Number.isFinite(grade) && grade >= 7 && grade <= 9) return 'mts';
  return 'other';
}

// ─── ProgressTab ──────────────────────────────────────────────────────────────
function ProgressTab({ predictiveFinishes, examPrepItems }: {
  predictiveFinishes: PredictiveFinish[];
  examPrepItems: ExamPrepItem[];
}) {
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel>('sd');
  const [selectedClassId, setSelectedClassId] = useState('');

  const computed = useMemo(() => {
    try {
      const data = getData();
      const cards: CardData[] = [];
      data.classes.forEach(cls => data.subjects.forEach(sub => {
        if (!data.schedules.some(schedule => schedule.classId === cls.id && schedule.subjectId === sub.id)) return;
        const st = getSubjectStatus(sub, cls, data);
        const mats = getMaterials(sub.id, cls.id);
        const done = data.progress.find(progress => progress.classId === cls.id && progress.subjectId === sub.id)?.materialsDone ?? 0;
        cards.push({
          clsId: cls.id, clsName: cls.name, subId: sub.id, subName: sub.name,
          st, urgency: getUrgencyScore(st), effectiveColor: getEffectiveStatus(st), mats,
          matsDone: done, totalSessDone: done, totalSessAll: getTotalSessionsNeeded(mats),
          teachingPosition: getTeachingPosition(cls.id, sub.id, data),
          predictiveFinish: predictiveFinishes.find(item => item.classId === cls.id && item.subjectId === sub.id),
        });
      }));
      return { classes: data.classes, cards };
    } catch (error) {
      console.error('ProgressTab computation error:', error);
      return { classes: [], cards: [] as CardData[] };
    }
  }, [predictiveFinishes]);

  const availableLevels = useMemo(() => (['sd', 'mts', 'other'] as EducationLevel[]).filter(level => computed.classes.some(cls => getEducationLevel(cls.level) === level)), [computed.classes]);
  const levelClasses = useMemo(() => computed.classes.filter(cls => getEducationLevel(cls.level) === selectedLevel).sort((a, b) => a.name.localeCompare(b.name, 'id')), [computed.classes, selectedLevel]);

  useEffect(() => {
    if (!availableLevels.length) return;
    const storedLevel = localStorage.getItem('edutrack-progress-level') as EducationLevel | null;
    if (!availableLevels.includes(selectedLevel)) setSelectedLevel(storedLevel && availableLevels.includes(storedLevel) ? storedLevel : availableLevels[0]);
  }, [availableLevels, selectedLevel]);

  useEffect(() => {
    if (!levelClasses.length) { setSelectedClassId(''); return; }
    const storageKey = `edutrack-progress-class-${selectedLevel}`;
    const storedClassId = localStorage.getItem(storageKey);
    const nextClassId = levelClasses.some(cls => cls.id === selectedClassId)
      ? selectedClassId
      : levelClasses.some(cls => cls.id === storedClassId) ? storedClassId! : levelClasses[0].id;
    if (nextClassId !== selectedClassId) setSelectedClassId(nextClassId);
  }, [levelClasses, selectedClassId, selectedLevel]);

  const selectLevel = (level: EducationLevel) => { localStorage.setItem('edutrack-progress-level', level); setSelectedLevel(level); };
  const selectClass = (classId: string) => { localStorage.setItem(`edutrack-progress-class-${selectedLevel}`, classId); setSelectedClassId(classId); };
  const selectedClass = levelClasses.find(cls => cls.id === selectedClassId);
  const classCards = useMemo(() => computed.cards.filter(card => card.clsId === selectedClassId).sort((a, b) => b.urgency - a.urgency || a.subName.localeCompare(b.subName, 'id')), [computed.cards, selectedClassId]);
  const shortfallCount = classCards.filter(card => card.effectiveColor === 'red').length;
  const tightCount = classCards.filter(card => card.effectiveColor === 'amber').length;
  const nearExamCount = classCards.filter(card => card.st.daysLeft !== undefined && card.st.daysLeft <= 14).length;

  if (!computed.classes.length) return <EmptyProgress title="Belum ada data progres" text="Tambahkan kelas, mata pelajaran, dan jadwal terlebih dahulu." />;
  if (!computed.cards.length) return <EmptyProgress title="Belum ada jadwal terhubung" text="Hubungkan kelas dengan mata pelajaran di menu Kelola." />;

  return <div className="mt-2 space-y-4">
    <section className="app-card p-3 sm:p-4">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-text3">Pilih jenjang</p>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface2/70 p-1">
        {([['sd', 'SD'], ['mts', 'MTs'], ['other', 'Lainnya']] as const).map(([level, label]) => <button key={level} disabled={!availableLevels.includes(level)} onClick={() => selectLevel(level)} className={`rounded-lg px-2 py-2 text-xs font-black transition ${selectedLevel === level ? 'bg-primary text-primary-foreground shadow-sm' : 'text-text3 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-35'}`}>{label}</button>)}
      </div>
      <label className="mt-3 block text-[10px] font-black uppercase tracking-widest text-text3">Kelas</label>
      <select value={selectedClassId} onChange={event => selectClass(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm font-bold text-foreground outline-none focus:border-primary">
        {levelClasses.map(cls => <option key={cls.id} value={cls.id}>{cls.name}{cls.level ? ` · Level ${cls.level}` : ''}</option>)}
      </select>
    </section>

    <details className="app-card group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 sm:p-4"><div><p className="text-sm font-black text-foreground">Ringkasan kapasitas</p><p className="mt-0.5 text-xs text-text3">{shortfallCount} kurang sesi · {tightCount} mepet · {nearExamCount} ujian dekat</p></div><ChevronDown className="h-4 w-4 text-text3 transition group-open:rotate-180" /></summary>
      <div className="border-t border-border/60 p-3 sm:p-4 space-y-4"><WeeklyReviewCard /><PaceSuggestionsCard />{examPrepItems.length > 0 && <ExamPrepCard items={examPrepItems} />}</div>
    </details>

    <section>
      <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-text3">Kapasitas mengajar</p><h2 className="mt-1 font-display text-xl font-bold text-foreground">{selectedClass?.name ?? 'Pilih kelas'}</h2></div><span className="rounded-full bg-surface2 px-2.5 py-1 text-[10px] font-bold text-text2">{classCards.length} mapel</span></div>
      {classCards.length ? <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{classCards.map(card => <SubjectCard key={`${card.clsId}-${card.subId}`} card={card} />)}</div> : <div className="rounded-2xl border border-dashed border-border2 p-8 text-center text-sm text-text3">Belum ada mapel terjadwal pada kelas ini.</div>}
    </section>
  </div>;
}

function EmptyProgress({ title, text }: { title: string; text: string }) {
  return <div className="animate-slide-up px-6 py-12 text-center"><span className="mb-4 block text-5xl">📈</span><div className="mb-2 font-display text-2xl font-medium tracking-tight">{title}</div><div className="mx-auto max-w-[280px] text-sm leading-relaxed text-text2">{text}</div></div>;
}

// ─── ClassGroup — Handles its own state so parent isn't re-rendered ───────────
const ClassGroup = memo(function ClassGroup({ group }: { group: GroupData }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="animate-slide-up app-card p-3">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between cursor-pointer group select-none px-1 py-1"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center text-primary flex-shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="font-display text-xl font-bold tracking-tight text-foreground block truncate">{group.clsName}</span>
            <span className="text-[12px] font-semibold text-text3">{group.cards.length} mapel dipantau</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {group.issues > 0 && (
            <span className="text-[10px] font-black bg-red text-white px-2 py-1 rounded-full uppercase tracking-wide">{group.issues} Perlu</span>
          )}
          <ChevronDown className={`h-4 w-4 text-text3 group-hover:text-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
          {group.cards.map((card: CardData) => (
            <SubjectCard key={`${card.clsId}-${card.subId}`} card={card} />
          ))}
        </div>
      )}
    </div>
  );
});

// ─── SubjectCard — Handles its own expansion state ────────
const SubjectCard = memo(function SubjectCard({ card }: { card: CardData }) {
  const [showMats, setShowMats] = useState(false);
  const [undoConfirm, setUndoConfirm] = useState(false);
  const { toast } = useToast();
  const { subName, st, effectiveColor, mats, matsDone, totalSessDone, totalSessAll, teachingPosition, predictiveFinish } = card;
  const activeMaterial = teachingPosition;
  const activePageLabel = getMaterialPageLabel(activeMaterial.material);
  const sessionsAvailable = st.sessLeft ?? 0;
  const sessionsNeeded = st.sessionsNeeded ?? st.remaining;
  const sessionDeficit = Math.max(0, sessionsNeeded - sessionsAvailable);
  // Pertemuan bonus: terjadi ketika ujian mundur sehingga ada slot jadwal lebih
  // dari yang dibutuhkan silabus. Hanya relevan jika ada info jadwal (sessLeft ada)
  const bonusSessions = (st.sessLeft !== undefined && st.sessLeft !== null && sessionsNeeded > 0)
    ? Math.max(0, sessionsAvailable - sessionsNeeded)
    : 0;
  const totalProgressText = totalSessAll > 0
    ? `Selesai ${Math.min(totalSessDone, totalSessAll)} dari ${totalSessAll} pertemuan total`
    : 'Belum ada pertemuan terdaftar';
  const progressPct = totalSessAll > 0 ? Math.min(100, Math.round((Math.min(totalSessDone, totalSessAll) / totalSessAll) * 100)) : 0;
  const statusTone = effectiveColor === 'red'
    ? 'text-red bg-red/10 border-red/20'
    : effectiveColor === 'amber'
      ? 'text-amber bg-amber/10 border-amber/20'
      : 'text-green bg-green/10 border-green/20';
  const capacityLabel = effectiveColor === 'red'
    ? `Kurang ${sessionDeficit} sesi`
    : effectiveColor === 'amber'
      ? 'Jadwal mepet'
      : 'Sesi cukup';

  return (
    <div className={`bg-surface/80 backdrop-blur-sm border rounded-2xl overflow-hidden transition-colors shadow-sm ${
      effectiveColor === 'red' ? 'border-red/30' :
      effectiveColor === 'amber' ? 'border-amber/30' :
      'border-border/60 hover:border-border3'
    }`}>
      <button 
        onClick={() => setShowMats(!showMats)}
        className="w-full relative p-4 flex items-start justify-between hover:bg-surface2/50 transition-colors text-left"
      >
        <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
          effectiveColor === 'red' ? 'bg-red' : 
          effectiveColor === 'amber' ? 'bg-amber' : 
          'bg-green'
        }`} />
        
        <div className="flex-1 min-w-0 pl-3">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <span className="text-[15px] font-black text-foreground tracking-tight truncate block">{subName}</span>
              <span className="text-[12px] font-bold text-text2">Sisa {sessionsAvailable} sesi · Butuh {sessionsNeeded}</span>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0 border ${statusTone}`}>{capacityLabel}</span>
          </div>

          <div className="h-2 bg-surface2 rounded-full overflow-hidden border border-border/40 mb-3">
            <div
              className={`h-full rounded-full transition-all duration-700 ${effectiveColor === 'red' ? 'bg-red' : effectiveColor === 'amber' ? 'bg-amber' : 'bg-green'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="mb-3 rounded-2xl bg-surface/60 border border-border/50 px-3 py-2.5">
            {activeMaterial.isComplete ? (
              <>
                <div className="text-[13px] font-bold text-foreground leading-snug">Semua bab selesai</div>
                <div className="text-[12px] text-text2 mt-0.5">{totalProgressText}</div>
              </>
            ) : activeMaterial.material ? (
              <>
                <div className="text-[13px] font-bold text-foreground leading-snug truncate" title={activeMaterial.material.name}>
                  {activeMaterial.material.name}
                </div>
                <div className="text-[12px] text-text2 mt-0.5">
                  Pertemuan {activeMaterial.sessionIndex}/{activeMaterial.totalSessionsInMaterial} di bab ini
                </div>
                {activePageLabel && <div className="text-[11px] text-text2 mt-0.5">{activePageLabel}</div>}
                {activeMaterial.material.note && <div className="text-[11px] text-text3 mt-0.5 truncate">Catatan: {activeMaterial.material.note}</div>}
              </>
            ) : (
              <>
                <div className="text-[13px] font-bold text-foreground leading-snug">Materi belum diatur</div>
                <div className="text-[11px] text-text2 mt-0.5">Tambahkan bab di menu Kelola.</div>
              </>
            )}
          </div>
           
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-xl bg-surface2/60 border border-border/50 px-2 py-2 text-center">
              <div className="text-[10px] font-black text-text3 uppercase tracking-wide">Selesai</div>
              <div className="text-sm font-black text-foreground mt-0.5">{Math.min(totalSessDone, totalSessAll)}</div>
            </div>
            <div className="rounded-xl bg-surface2/60 border border-border/50 px-2 py-2 text-center">
              <div className="text-[10px] font-black text-text3 uppercase tracking-wide">Total</div>
              <div className="text-sm font-black text-foreground mt-0.5">{totalSessAll}</div>
            </div>
            <div className={`rounded-xl border px-2 py-2 text-center ${sessionDeficit > 0 ? 'bg-red/10 border-red/20' : 'bg-green/10 border-green/20'}`}>
              <div className="text-[10px] font-black text-text3 uppercase tracking-wide">Kurang</div>
              <div className={`text-sm font-black mt-0.5 ${sessionDeficit > 0 ? 'text-red' : 'text-green'}`}>{sessionDeficit}</div>
            </div>
          </div>

          {/* Banner Pertemuan Bonus — muncul saat ujian mundur */}
          {bonusSessions > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-2xl bg-green/10 border border-green/25 px-3 py-2.5">
              <span className="text-base flex-shrink-0 mt-0.5">🎉</span>
              <div className="min-w-0">
                <div className="text-[12px] font-black text-green leading-tight">
                  {bonusSessions} Pertemuan Bonus Tersedia!
                </div>
                <div className="text-[11px] text-text2 mt-0.5 leading-snug">
                  Waktu ujian mundur — ada {bonusSessions} sesi ekstra. Manfaatkan untuk pengayaan atau latihan soal.
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[12px] text-text2 flex-wrap font-medium">
            {st.daysLeft !== undefined && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('set-tab', { detail: 'exam' })); }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors ${st.daysLeft <= 14 ? (st.daysLeft <= 7 ? 'text-red font-bold border-red/20 bg-red/10' : 'text-amber font-bold border-amber/20 bg-amber/10') : 'text-text3 border-border bg-surface'}`}
                  title="Lihat di tab Ujian"
                >
                  <CalendarDays className="h-3.5 w-3.5" /> {st.daysLeft} hari ujian
                </button>
              </>
            )}
            {predictiveFinish?.predictedFinishDate && (
              <>
                <span className={`inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 ${
                  predictiveFinish.pace === 'ahead' ? 'text-green' :
                  predictiveFinish.pace === 'behind' ? 'text-red' :
                  'text-foreground'
                }`}>
                  <TrendingUp className="h-3.5 w-3.5" /> Prediksi: {new Date(predictiveFinish.predictedFinishDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </span>
                {predictiveFinish.examDate && predictiveFinish.daysDifference !== null && (
                  <span className={`
                    ${predictiveFinish.daysDifference < 0 ? 'text-red font-bold' :
                      predictiveFinish.daysDifference === 0 ? 'text-red font-bold' :
                      predictiveFinish.daysDifference <= 3 ? 'text-amber font-bold' :
                      'text-text3'}
                  `}>
                    {predictiveFinish.daysDifference < 0
                      ? ` (terlambat ${Math.abs(predictiveFinish.daysDifference)} hari)`
                      : predictiveFinish.daysDifference === 0
                      ? ' (hari ujian)'
                      : ` (${predictiveFinish.daysDifference} hari sebelum ujian)`}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="pl-3 flex-shrink-0 text-text3 opacity-70">
          <span className={`inline-block transition-transform duration-200 text-lg ${showMats ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {/* Expanded Details Area */}
      {showMats && (
        <div className="p-4 pt-2 border-t border-border/40 bg-surface3/10 shadow-inner">
           {st.daysLeft !== undefined && (
             <div className="mb-4 bg-surface border border-border2 rounded-xl p-3 shadow-sm">
               <div className="grid grid-cols-3 gap-2 text-center">
                 <div className="rounded-lg bg-surface2/60 border border-border/50 px-2 py-2">
                   <div className="text-[10px] font-bold text-text3 uppercase tracking-wide">Butuh</div>
                   <div className="text-[15px] font-black text-foreground mt-0.5">{sessionsNeeded}</div>
                   <div className="text-[9px] text-text3">sesi materi</div>
                 </div>
                 <div className="rounded-lg bg-surface2/60 border border-border/50 px-2 py-2">
                   <div className="text-[10px] font-bold text-text3 uppercase tracking-wide">Tersedia</div>
                   <div className="text-[15px] font-black text-foreground mt-0.5">{sessionsAvailable}</div>
                   <div className="text-[9px] text-text3">jadwal lagi</div>
                 </div>
                  <div className={`rounded-lg border px-2 py-2 ${sessionDeficit > 0 ? 'bg-red/10 border-red/20' : 'bg-green/10 border-green/20'}`}>
                   <div className="text-[10px] font-bold text-text3 uppercase tracking-wide">Kurang</div>
                   <div className={`text-[15px] font-black mt-0.5 ${sessionDeficit > 0 ? 'text-red' : 'text-green'}`}>{sessionDeficit}</div>
                   <div className="text-[9px] text-text3">sesi</div>
                 </div>
               </div>
               <div className="mt-2 text-[11px] text-text2 leading-snug">
                 {sessionDeficit > 0
                   ? `Materi masih butuh ${sessionsNeeded} sesi, tapi jadwal tersisa hanya ${sessionsAvailable}. Perlu tambah ${sessionDeficit} sesi atau ringkas materi.`
                   : bonusSessions > 0
                   ? `Semua ${sessionsNeeded} sesi materi bisa selesai tepat waktu. Masih ada ${bonusSessions} pertemuan bonus tersisa setelah materi selesai.`
                   : `Jadwal masih cukup untuk menyelesaikan ${sessionsNeeded} sesi materi.`}
               </div>
             </div>
           )}

           {/* Panel Pertemuan Bonus di expanded view — di luar daysLeft block */}
           {bonusSessions > 0 && (
             <div className="mb-4 flex items-start gap-3 rounded-xl bg-green/10 border border-green/25 p-3">
               <div className="w-9 h-9 rounded-xl bg-green/15 border border-green/25 flex items-center justify-center text-lg flex-shrink-0">
                 🎉
               </div>
               <div className="min-w-0">
                 <div className="text-[13px] font-black text-green leading-tight">
                   {bonusSessions} Pertemuan Bonus
                 </div>
                 <div className="text-[11px] text-text2 mt-1 leading-snug">
                   Ujian mapel ini mundur sehingga ada <span className="font-bold text-foreground">{bonusSessions} sesi ekstra</span> di luar kebutuhan silabus ({sessionsNeeded} sesi). Gunakan untuk:
                 </div>
                 <div className="mt-1.5 flex flex-wrap gap-1.5">
                   {['📚 Pengayaan materi', '✏️ Latihan soal', '🔁 Review bab sebelumnya', '📝 Simulasi ujian'].map(tip => (
                     <span key={tip} className="text-[10px] font-semibold text-green bg-green/10 border border-green/20 px-2 py-0.5 rounded-full">{tip}</span>
                   ))}
                 </div>
               </div>
             </div>
           )}

           <div className="mb-3 text-[10px] font-bold text-text3 uppercase tracking-wider">Daftar Materi</div>

          <div className="space-y-[3px]">
            {(() => {
              let currentTotal = 0;
              return mats.map((mat: any) => {
                const sessions = mat.sessions ?? 1;
                const isFinished = totalSessDone >= currentTotal + sessions;
                const isCurrent = totalSessDone >= currentTotal && totalSessDone < currentTotal + sessions;
                const sessionIndex = totalSessDone - currentTotal + 1;
                const pageLabel = getMaterialPageLabel(mat);
                currentTotal += sessions;
                
                return (
                  <div key={mat.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isCurrent ? 'bg-primary-dim/30 border border-primary-border/20 shadow-sm' : 
                    isFinished ? 'opacity-50' : 'opacity-[0.35]'
                  }`}>
                    <span className={`text-[12px] mt-[1px] flex-shrink-0 ${isFinished ? 'text-green' : isCurrent ? 'text-primary' : 'text-text3'}`}>
                      {isFinished ? '✓' : isCurrent ? '▶' : '○'}
                    </span>
                    <span className={`text-[13px] leading-snug flex-1 ${
                      isFinished ? 'line-through decoration-text3/50' :
                      isCurrent ? 'font-bold text-foreground' : 'font-medium text-text2'
                    }`}>
                      {mat.name}
                      {pageLabel && (
                        <span className="block mt-0.5 text-[10px] font-semibold opacity-70">{pageLabel}</span>
                      )}
                      {mat.note && (
                        <span className="block mt-0.5 text-[10px] font-medium opacity-60">Catatan: {mat.note}</span>
                      )}
                      {isCurrent && (
                        <span className="block mt-0.5 text-[10px] font-bold text-primary opacity-90">
                          Pertemuan {sessionIndex}/{sessions} sekarang
                        </span>
                      )}
                      {!isCurrent && sessions > 1 && (
                        <span className="ml-2 text-[10px] opacity-60">{sessions} pertemuan</span>
                      )}
                    </span>
                  </div>
                );
              });
            })()}
            {mats.length === 0 && <div className="text-[12px] text-text3 italic py-2 text-center">Materi belum diatur untuk mapel ini.</div>}
          </div>

          {/* Undo/Koreksi progres */}
          {totalSessDone > 0 && (
            <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between">
              <span className="text-[11px] text-text3">Salah input? Koreksi progres:</span>
              <button
                onClick={() => setUndoConfirm(true)}
                className="text-[11px] font-bold text-amber border border-amber/30 bg-amber/10 px-3 py-1.5 rounded-lg hover:bg-amber/15 transition-colors flex items-center gap-1"
              >
                ↩ Mundur 1 Sesi
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation sheet for undo */}
      {undoConfirm && (
        <div className="app-overlay z-[500]" onClick={() => setUndoConfirm(false)}>
          <div className="app-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="app-sheet-handle" />
            <div className="app-sheet-title text-[20px] mb-1">Koreksi Progres</div>
            <p className="text-[13px] text-text2 mb-2 leading-relaxed">
              Sesi terakhir <strong>{card.subName}</strong> ({card.clsName}) akan dihapus dan progres mundur 1.
            </p>
            <p className="text-[12px] text-red/80 bg-red/10 border border-red/20 rounded-2xl px-3 py-2 mb-5">
              Tindakan ini tidak bisa dibatalkan kembali.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setUndoConfirm(false)} className="flex-1 py-3 bg-surface border border-border2 rounded-xl text-sm font-medium">Batal</button>
              <button
                onClick={() => {
                  const ok = undoLastSession(card.clsId, card.subId);
                  setUndoConfirm(false);
                  if (ok) toast({ title: '↩ Progres dikoreksi' });
                  else toast({ title: 'Tidak ada sesi untuk diundo', variant: 'destructive' });
                }}
                className="flex-1 py-3 bg-amber/15 border border-amber/30 text-amber rounded-xl text-sm font-bold"
              >
                Ya, Koreksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── HistoryTab ───────────────────────────────────────────────────────────────
function HistoryTab() {
  const [month, setMonth] = useState(dateKey().slice(0, 7));
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [reminderDraft, setReminderDraft] = useState('');
  const [lastPageDraft, setLastPageDraft] = useState('');
  const { toast } = useToast();
  const historyItems = getSessionHistory(month);
  const data = getData();

  const openEditor = (session: Session) => {
    const { mainNote, reminder } = splitSessionNote(session.note);
    const draft = loadSessionDraft(session.id);
    setEditingSessionId(session.id);
    setNoteDraft(draft?.nextTopic ?? mainNote);
    setReminderDraft(draft?.supportingNote ?? reminder);
    setLastPageDraft(draft?.lastPage ?? session.lastPageReached ?? '');
  };

  const closeEditor = (discardDraft = true) => {
    if (discardDraft && editingSessionId) clearSessionDraft(editingSessionId);
    setEditingSessionId(null);
    setNoteDraft('');
    setReminderDraft('');
    setLastPageDraft('');
  };

  const saveEditor = () => {
    if (!editingSessionId) return;
    updateSessionNote(editingSessionId, composeSessionNote(noteDraft, reminderDraft), lastPageDraft);
    clearSessionDraft(editingSessionId);
    closeEditor(false);
    toast({ title: 'Catatan riwayat diperbarui' });
  };

  useEffect(() => {
    if (!editingSessionId) return;
    saveSessionDraft(editingSessionId, {
      nextTopic: noteDraft,
      supportingNote: reminderDraft,
      lastPage: lastPageDraft,
    });
  }, [editingSessionId, noteDraft, reminderDraft, lastPageDraft]);

  const grouped = historyItems.reduce((acc, sess) => {
    if (!acc[sess.date]) acc[sess.date] = [];
    acc[sess.date].push(sess);
    return acc;
  }, {} as Record<string, typeof historyItems>);

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-surface border border-border rounded-2xl p-3 flex justify-between items-center mb-4">
        <div className="text-[11px] font-bold text-text3 uppercase tracking-wide">Pilih Bulan</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="form-input-style min-h-0 py-1.5 px-3 w-auto text-xs" />
      </div>
      {dates.length === 0 ? (
        <div className="text-center py-12 px-6 border border-dashed border-border2 rounded-3xl">
          <span className="text-4xl block mb-3 opacity-50">📜</span>
          <div className="text-[15px] font-medium mb-1">Tidak ada riwayat</div>
          <div className="text-xs text-text2">Belum ada sesi tercatat di bulan ini.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {dates.map(date => {
            const dateStr = dateFromKey(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
            return (
              <div key={date}>
                <div className="text-[11px] font-bold tracking-wider text-primary mb-2 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />{dateStr}
                </div>
                <div className="flex flex-col gap-[6px]">
                  {grouped[date].map(sess => {
                    const cls = data.classes.find(c => c.id === sess.classId)?.name || '?';
                    const sub = data.subjects.find(s => s.id === sess.subjectId)?.name || '?';
                    const matObj = data.materials.find(m => m.id === sess.materialId);
                    const matName = matObj ? matObj.name : (sess.materialId === 'SKIPPED' ? 'Dilewati/Kosong' : 'Selesai tanpa materi');
                    const sessCount = matObj?.sessions || 1;
                    const timeStr = new Date(sess.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const { mainNote, reminder } = splitSessionNote(sess.note);
                    const isEditing = editingSessionId === sess.id;
                    return (
                      <div key={sess.id} className="bg-surface border border-border rounded-xl p-3 shadow-sm">
                        <div className="flex gap-3">
                          <div className="text-[10px] font-bold text-text3 pt-1 uppercase tabular-nums">{timeStr}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-bold leading-tight mb-1">{cls} <span className="text-text2 font-normal mx-1">•</span> {sub}</div>
                            <div className={`text-[11px] ${sess.materialId === 'SKIPPED' ? 'text-amber' : 'text-text2'}`}>
                              {matName}
                              {sessCount > 1 && <span className="ml-2 bg-primary-dim text-primary text-[9px] font-bold px-[5px] py-[1px] rounded">MULTI-SESI ({sessCount}x)</span>}
                            </div>
                            {(sess.lastPageReached || mainNote || reminder) && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-snug">
                                {sess.lastPageReached && <span className="font-bold text-primary">📄 s/d hal. {sess.lastPageReached}</span>}
                                {mainNote && <span className="text-text3 italic">📖 Berikutnya: {mainNote}</span>}
                                {reminder && <span className="rounded-full border border-amber/25 bg-amber/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber">📌 Catatan pendukung tersimpan</span>}
                              </div>
                            )}
                          </div>
                          {sess.materialId !== 'SKIPPED' && (
                            <button
                              onClick={() => isEditing ? closeEditor() : openEditor(sess)}
                              className="flex h-8 flex-shrink-0 items-center justify-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-2 text-[10px] font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                              aria-label={`Edit catatan sesi ${cls} ${sub}`}
                            >
                              <FilePenLine className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                          )}
                          <div className="text-green text-sm flex-shrink-0 font-bold">✓</div>
                        </div>

                        {isEditing && sess.materialId !== 'SKIPPED' && (
                          <div className="mt-3 border-t border-border/60 pt-3 space-y-2.5 animate-slide-up">
                            <textarea
                              autoFocus
                              value={noteDraft}
                              onChange={e => setNoteDraft(e.target.value)}
                              placeholder="Bab / subbab pertemuan berikutnya..."
                              className="min-h-[54px] w-full resize-none rounded-lg border border-border2 bg-surface2 p-2 text-[12px] focus:border-primary focus:outline-none placeholder:text-text3"
                            />
                            <div className="flex items-center gap-2">
                              <label htmlFor={`history-last-page-${sess.id}`} className="text-[11px] font-bold text-primary">📄 Sampai halaman</label>
                              <input
                                id={`history-last-page-${sess.id}`}
                                type="number"
                                min="1"
                                value={lastPageDraft}
                                onChange={e => setLastPageDraft(e.target.value)}
                                placeholder="mis. 10"
                                className="w-24 rounded-lg border border-primary/30 bg-surface2 px-2.5 py-1 text-[12px] font-bold focus:border-primary focus:outline-none"
                              />
                              {lastPageDraft && <span className="text-[10px] font-semibold text-green">→ mulai {getNextStartPage(lastPageDraft).nextPage}</span>}
                            </div>
                            <textarea
                              value={reminderDraft}
                              onChange={e => setReminderDraft(e.target.value)}
                              placeholder="📌 Catatan pendukung pertemuan berikutnya..."
                              className="min-h-[54px] w-full resize-none rounded-lg border border-amber/30 bg-surface2 p-2 text-[12px] focus:border-amber focus:outline-none placeholder:text-text3"
                            />
                            <div className="flex justify-end gap-2">
                              <span className="mr-auto self-center text-[10px] text-text3">Draft tersimpan otomatis</span>
                              <button onClick={() => closeEditor()} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-text2">Batal</button>
                              <button onClick={saveEditor} className="rounded-lg bg-green px-3 py-1.5 text-[11px] font-bold text-surface">Simpan</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CalendarTab ───────────────────────────────────────────────────────────────
function CalendarTab() {
  const [month, setMonth] = useState(dateKey().slice(0, 7));
  const days = useMemo(() => getMonthCalendar(month), [month]);

  const DAYS_HEAD = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  const statusConfig: Record<DayStatus, { dot: string; bg: string; label: string }> = {
    done:    { dot: 'bg-green',   bg: 'bg-green/10 border-green/30',   label: '✓ Semua' },
    partial: { dot: 'bg-amber',   bg: 'bg-amber/10 border-amber/30',   label: '⚡ Sebagian' },
    missed:  { dot: 'bg-red',     bg: 'bg-red/10 border-red/30',       label: '✗ Terlewat' },
    holiday: { dot: 'bg-text3',   bg: 'bg-surface3 border-border2',    label: '🏖 Libur' },
    noclass: { dot: '',           bg: 'bg-transparent border-transparent', label: '' },
    future:  { dot: '',           bg: 'bg-transparent border-transparent', label: '' },
  };

  const summary = {
    done: days.filter(d => d.status === 'done').length,
    partial: days.filter(d => d.status === 'partial').length,
    missed: days.filter(d => d.status === 'missed').length,
    holiday: days.filter(d => d.status === 'holiday').length,
  };

  // Calendar needs offset: first day of month
  const firstDay = new Date(month + '-01T12:00:00').getDay(); // 0=Sun
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0

  return (
    <div className="animate-in fade-in duration-300">
      {/* Month picker */}
      <div className="bg-surface border border-border rounded-2xl p-3 flex justify-between items-center mb-4">
        <div className="text-[11px] font-bold text-text3 uppercase tracking-wide">Bulan</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="form-input-style min-h-0 py-1.5 px-3 w-auto text-xs" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-3">
        {([['done','Selesai'],['partial','Sebagian'],['missed','Terlewat'],['holiday','Libur']] as const).map(([s, l]) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${statusConfig[s].dot}`} />
            <span className="text-[10px] text-text2 font-medium">{l}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-surface/60 border border-border/60 rounded-2xl overflow-hidden mb-4">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-border/40">
          {DAYS_HEAD.map(d => (
            <div key={d} className="text-center py-2 text-[10px] font-bold uppercase text-text3">{d}</div>
          ))}
        </div>
        {/* Days grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
          {days.map(day => {
            const d = parseInt(day.date.slice(8));
            const cfg = statusConfig[day.status];
            const isToday = day.date === dateKey();
            return (
              <div key={day.date}
                className={`border border-transparent m-0.5 rounded-lg flex flex-col items-center justify-center py-1.5 min-h-[36px] relative ${cfg.bg} ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
              >
                <span className={`text-[12px] font-bold ${
                  day.status === 'missed' ? 'text-red' :
                  day.status === 'done' ? 'text-green' :
                  day.status === 'partial' ? 'text-amber' :
                  day.status === 'future' ? 'text-text3/40' :
                  'text-text2'
                }`}>{d}</span>
                {cfg.dot && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${cfg.dot}`} />}
                {day.status !== 'noclass' && day.status !== 'future' && day.schedCount > 0 && (
                  <span className="text-[8px] text-text3 mt-0.5">{day.sessionCount}/{day.schedCount}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-green/10 border border-green/20 rounded-xl p-2 text-center">
          <div className="text-xl font-black text-green">{summary.done}</div>
          <div className="text-[9px] text-text3 font-bold uppercase">Selesai</div>
        </div>
        <div className="bg-amber/10 border border-amber/20 rounded-xl p-2 text-center">
          <div className="text-xl font-black text-amber">{summary.partial}</div>
          <div className="text-[9px] text-text3 font-bold uppercase">Sebagian</div>
        </div>
        <div className="bg-red/10 border border-red/20 rounded-xl p-2 text-center">
          <div className="text-xl font-black text-red">{summary.missed}</div>
          <div className="text-[9px] text-text3 font-bold uppercase">Terlewat</div>
        </div>
        <div className="bg-surface2 border border-border rounded-xl p-2 text-center">
          <div className="text-xl font-black text-text2">{summary.holiday}</div>
          <div className="text-[9px] text-text3 font-bold uppercase">Libur</div>
        </div>
      </div>
    </div>
  );
}
