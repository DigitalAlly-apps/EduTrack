import { useState, useMemo, memo, useCallback, useEffect } from 'react';
import {
  getData, getMaterials, getSubjectStatus, fmt, getSessionHistory, now, getMonthCalendar, DayStatus, getTotalSessionsNeeded, dateKey, dateFromKey,
  generatePaceSuggestions, applyPaceSuggestion, addExtraSession,
  getPredictiveFinishes, getExamPrepItems, undoLastSession,
} from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import WeeklyReviewCard from './WeeklyReviewCard';
import ExamPrepCard from './ExamPrepCard';
import { PaceSuggestion, PredictiveFinish, ExamPrepItem } from '@/lib/types';

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
    <div className="relative bg-gradient-to-br from-primary/8 via-primary/3 to-transparent border border-primary/20 rounded-2xl overflow-hidden mb-4 animate-slide-up shadow-sm">
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
      <div className="flex bg-surface/40 backdrop-blur-md border border-border/60 rounded-2xl mb-[18px] p-1 shadow-sm gap-1">
        <button onClick={() => setTab('progress')} className={`flex-1 py-[8px] text-[11px] font-bold tracking-wide uppercase rounded-[10px] transition-all duration-300 ${tab === 'progress' ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]' : 'text-text3 hover:text-foreground hover:bg-surface2/50'}`}>Progres</button>
        <button onClick={() => setTab('kalender')} className={`flex-1 py-[8px] text-[11px] font-bold tracking-wide uppercase rounded-[10px] transition-all duration-300 ${tab === 'kalender' ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]' : 'text-text3 hover:text-foreground hover:bg-surface2/50'}`}>Kalender</button>
        <button onClick={() => setTab('history')} className={`flex-1 py-[8px] text-[11px] font-bold tracking-wide uppercase rounded-[10px] transition-all duration-300 ${tab === 'history' ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]' : 'text-text3 hover:text-foreground hover:bg-surface2/50'}`}>Riwayat</button>
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
  predictiveFinish?: PredictiveFinish | undefined;
};

type GroupData = { clsName: string; cards: CardData[]; issues: number };

function getActiveMaterialProgress(mats: any[], sessionsDone: number) {
  let cumulative = 0;
  for (let i = 0; i < mats.length; i++) {
    const material = mats[i];
    const sessions = material.sessions ?? 1;
    if (sessionsDone < cumulative + sessions) {
      return {
        material,
        materialNumber: i + 1,
        sessionIndex: sessionsDone - cumulative + 1,
        totalSessionsInMat: sessions,
        isComplete: false,
      };
    }
    cumulative += sessions;
  }

  return {
    material: null,
    materialNumber: mats.length,
    sessionIndex: 0,
    totalSessionsInMat: 0,
    isComplete: mats.length > 0,
  };
}

// ─── ProgressTab ──────────────────────────────────────────────────────────────
function ProgressTab({ predictiveFinishes, examPrepItems }: {
  predictiveFinishes: PredictiveFinish[];
  examPrepItems: ExamPrepItem[];
}) {
  const [filter, setFilter] = useState<'semua' | 'bermasalah'>('semua');
  const [isMounting, setIsMounting] = useState(true);
  
  useEffect(() => {
    setIsMounting(false);
  }, []);

  // All heavy computation in ONE memo — satisfies Rules of Hooks
  const computed = useMemo(() => {
    try {
      const data = getData();
      if (!data.classes.length) {
        return { allCards: [], groupedByClass: {}, classIds: [], hasSchedules: false, hasClasses: false };
      }

      const cards: CardData[] = [];
      let hasSched = false;

      data.classes.forEach(cls => {
        data.subjects.forEach(sub => {
          if (!data.schedules.some(s => s.classId === cls.id && s.subjectId === sub.id)) return;
          hasSched = true;
          const st = getSubjectStatus(sub, cls, data);
          const mats = getMaterials(sub.id, cls.id);
          const prog = data.progress.find(p => p.classId === cls.id && p.subjectId === sub.id);
          const totalSessDone = prog?.materialsDone ?? 0;
          const totalSessAll = getTotalSessionsNeeded(mats);
          const pred = predictiveFinishes.find(p => p.classId === cls.id && p.subjectId === sub.id);
          cards.push({
            clsId: cls.id, clsName: cls.name,
            subId: sub.id, subName: sub.name,
            st, urgency: getUrgencyScore(st),
            effectiveColor: getEffectiveStatus(st),
            mats, matsDone: totalSessDone, totalSessDone, totalSessAll,
            predictiveFinish: pred,
          });
        });
      });

      // Group by class
      const grp: Record<string, GroupData> = {};
      cards.forEach(card => {
        if (!grp[card.clsId]) grp[card.clsId] = { clsName: card.clsName, cards: [], issues: 0 };
        grp[card.clsId].cards.push(card);
        if (card.effectiveColor !== 'green') grp[card.clsId].issues++;
      });
      const classIds = Object.keys(grp).sort((a, b) => {
        const diff = grp[b].issues - grp[a].issues;
        return diff !== 0 ? diff : grp[a].clsName.localeCompare(grp[b].clsName);
      });

      return { allCards: cards, groupedByClass: grp, classIds, hasSchedules: hasSched, hasClasses: true };
    } catch (e) {
      console.error('ProgressTab computation error:', e);
      return { allCards: [], groupedByClass: {}, classIds: [], hasSchedules: false, hasClasses: false };
    }
  }, [predictiveFinishes]);

  const { allCards, groupedByClass, classIds, hasSchedules, hasClasses } = computed;

  const bermasalahCount = allCards.filter(c => c.effectiveColor !== 'green').length;

  const filteredClassIds = filter === 'bermasalah'
    ? classIds.filter(id => groupedByClass[id].issues > 0)
    : classIds;

  if (isMounting) return (
    <div className="space-y-4 py-4 animate-pulse">
      <div className="flex gap-2">
         <div className="h-12 flex-1 bg-surface2 rounded-2xl" />
         <div className="h-12 flex-1 bg-surface2 rounded-2xl" />
      </div>
      <div className="space-y-6">
        {[1,2,3].map(i => (
          <div key={i} className="h-32 bg-surface2 rounded-2xl" />
        ))}
      </div>
    </div>
  );

  if (!hasClasses) return (
    <div className="text-center py-12 px-6 animate-slide-up">
      <span className="text-5xl block mb-4">📈</span>
      <div className="font-display text-2xl font-medium tracking-tight mb-2">Belum ada data progres</div>
      <div className="text-sm text-text2 leading-relaxed max-w-[280px] mx-auto">Tambahkan kelas, mata pelajaran, dan jadwal terlebih dahulu.</div>
    </div>
  );

  if (!hasSchedules) return (
    <div className="text-center py-12 px-6 animate-slide-up">
      <span className="text-5xl block mb-4">📈</span>
      <div className="font-display text-2xl font-medium tracking-tight mb-2">Belum ada jadwal terhubung</div>
      <div className="text-sm text-text2 leading-relaxed max-w-[280px] mx-auto">Hubungkan kelas dengan mata pelajaran di menu Kelola.</div>
    </div>
  );

    return (
      <>
        <div className="mt-2">
        {/* Filter bar */}
        <div className="mb-5 flex gap-2 w-full">
          <button
            onClick={() => setFilter('semua')}
            className={`flex-1 min-h-[44px] rounded-2xl flex flex-col items-center justify-center transition-all ${filter === 'semua' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-surface border border-border text-text2 hover:bg-surface2'}`}
          >
            <span className="text-lg font-bold">{allCards.length}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Semua Mapel</span>
          </button>
          <button
            onClick={() => setFilter('bermasalah')}
            className={`flex-1 min-h-[44px] rounded-2xl flex flex-col items-center justify-center transition-all ${filter === 'bermasalah' ? 'bg-red text-white shadow-md' : 'bg-surface border border-red/20 text-red hover:bg-red/5'}`}
          >
            <span className="text-lg font-bold">{bermasalahCount}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Perlu Perhatian</span>
          </button>
        </div>

        {classIds.length === 0 && (
          <div className="text-center py-10 border border-dashed border-border2 rounded-3xl mb-6">
            <span className="text-3xl block mb-2">✅</span>
            <div className="text-sm font-medium text-text2">Semua mapel sesuai target!</div>
          </div>
        )}

         <div className="mb-8 space-y-4">
           <WeeklyReviewCard />
           <PaceSuggestionsCard />
          </div>

         {/* Exam Prep Mode - only show if there are upcoming exams within 14 days */}
         {examPrepItems.length > 0 && (
           <div className="mb-8">
             <ExamPrepCard items={examPrepItems} />
           </div>
         )}

         <div className="space-y-6">
           {filteredClassIds.map(clsId => (
             <ClassGroup
               key={clsId}
               group={groupedByClass[clsId]}
             />
           ))}
         </div>
       </div>
    </>
  );
}

// ─── ClassGroup — Handles its own state so parent isn't re-rendered ───────────
const ClassGroup = memo(function ClassGroup({ group }: { group: GroupData }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="animate-slide-up">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between mb-3 cursor-pointer group px-1 select-none"
      >
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-bold tracking-tight text-foreground">{group.clsName}</span>
          <span className="text-[12px] font-bold text-text3 bg-surface border border-border px-2 py-0.5 rounded-full">{group.cards.length} Mapel</span>
        </div>
        <div className="flex items-center gap-3">
          {group.issues > 0 && (
            <span className="text-[11px] font-bold bg-red text-white px-2 py-0.5 rounded-md uppercase tracking-wider">{group.issues} Bermasalah</span>
          )}
          <span className={`text-text3 group-hover:text-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-2.5">
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
  const { subName, st, effectiveColor, mats, matsDone, totalSessDone, totalSessAll, predictiveFinish } = card;
  const activeMaterial = getActiveMaterialProgress(mats, totalSessDone);
  const totalProgressText = totalSessAll > 0
    ? `Selesai ${Math.min(totalSessDone, totalSessAll)} dari ${totalSessAll} pertemuan total`
    : 'Belum ada pertemuan terdaftar';

  return (
    <div className={`bg-surface/80 backdrop-blur-sm border rounded-2xl overflow-hidden transition-colors ${
      effectiveColor === 'red' ? 'border-red/30' :
      effectiveColor === 'amber' ? 'border-amber/30' :
      'border-border/60 hover:border-border3'
    }`}>
      <button 
        onClick={() => setShowMats(!showMats)}
        className="w-full relative p-4 flex items-center justify-between hover:bg-surface2/50 transition-colors text-left"
      >
        <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
          effectiveColor === 'red' ? 'bg-red' : 
          effectiveColor === 'amber' ? 'bg-amber' : 
          'bg-green'
        }`} />
        
        <div className="flex-1 min-w-0 pl-3">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="text-[15px] font-bold text-foreground tracking-tight truncate">{subName}</span>
            <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 border ${
              effectiveColor === 'red' ? 'bg-red/10 text-red border-red/20' :
              effectiveColor === 'amber' ? 'bg-amber/10 text-amber border-amber/20' :
              'bg-green-dim/60 text-green border-green/20'
            }`}>{st.label}</span>
          </div>

          <div className="mb-2 rounded-xl bg-surface/60 border border-border/50 px-3 py-2">
            {activeMaterial.isComplete ? (
              <>
                <div className="text-[13px] font-bold text-foreground leading-snug">Semua bab selesai</div>
                <div className="text-[11px] text-text2 mt-0.5">{totalProgressText}</div>
              </>
            ) : activeMaterial.material ? (
              <>
                <div className="text-[13px] font-bold text-foreground leading-snug truncate" title={activeMaterial.material.name}>
                  {activeMaterial.material.name}
                </div>
                <div className="text-[11px] text-text2 mt-0.5">
                  Pertemuan {activeMaterial.sessionIndex}/{activeMaterial.totalSessionsInMat} di bab ini
                </div>
                <div className="text-[11px] text-text3 mt-0.5">{totalProgressText}</div>
              </>
            ) : (
              <>
                <div className="text-[13px] font-bold text-foreground leading-snug">Materi belum diatur</div>
                <div className="text-[11px] text-text2 mt-0.5">Tambahkan bab di menu Kelola.</div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-[12px] text-text2 flex-wrap font-medium">
            <span>{totalProgressText}</span>
            {st.daysLeft !== undefined && (
              <>
                <span className="opacity-40">•</span>
                <button
                  onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('set-tab', { detail: 'exam' })); }}
                  className={`flex items-center gap-0.5 underline-offset-2 hover:underline transition-colors ${st.daysLeft <= 14 ? (st.daysLeft <= 7 ? 'text-red font-bold' : 'text-amber font-bold') : 'text-text3'}`}
                  title="Lihat di tab Ujian"
                >
                  📅 {st.daysLeft} hari ujian ↗
                </button>
              </>
            )}
            {predictiveFinish?.predictedFinishDate && (
              <>
                <span className="opacity-40">•</span>
                <span className={`${
                  predictiveFinish.pace === 'ahead' ? 'text-green' :
                  predictiveFinish.pace === 'behind' ? 'text-red' :
                  'text-foreground'
                }`}>
                  📅 Prediksi: {new Date(predictiveFinish.predictedFinishDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
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
             <div className="flex flex-wrap items-center justify-between mb-4 bg-surface border border-border2 rounded-xl p-3 shadow-sm">
               <div className="text-[11px] font-medium text-text2 flex flex-col gap-[2px]">
                  <span>Sisa Jadwal Mengajar</span>
                  <strong className="text-foreground text-[14px]">{st.sessLeft} <span className="text-[11px] font-normal">Sesi</span></strong>
               </div>
               <div className="w-[1px] h-8 bg-border2"></div>
               <div className="text-[11px] font-medium text-text2 flex flex-col gap-[2px]">
                  <span>Materi Tertinggal</span>
                  <strong className="text-foreground text-[14px]">{st.sessionsNeeded} <span className="text-[11px] font-normal">Sesi</span></strong>
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
                className="text-[11px] font-bold text-amber border border-amber/30 bg-amber/8 px-3 py-1.5 rounded-lg hover:bg-amber/15 transition-colors flex items-center gap-1"
              >
                ↩ Mundur 1 Sesi
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation sheet for undo */}
      {undoConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/70 flex items-end" onClick={() => setUndoConfirm(false)}>
          <div className="w-full max-w-[430px] mx-auto bg-surface2 rounded-t-3xl p-5 pb-10 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-border2 rounded-full mx-auto mb-5" />
            <div className="text-base font-bold mb-1">↩ Koreksi Progres</div>
            <p className="text-[13px] text-text2 mb-2 leading-relaxed">
              Sesi terakhir <strong>{card.subName}</strong> ({card.clsName}) akan dihapus dan progres mundur 1.
            </p>
            <p className="text-[12px] text-red/80 bg-red/8 border border-red/20 rounded-lg px-3 py-2 mb-5">
              ⚠️ Tindakan ini tidak bisa dibatalkan kembali.
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
  const historyItems = getSessionHistory(month);
  const data = getData();

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
                    return (
                      <div key={sess.id} className="bg-surface border border-border rounded-xl p-3 flex gap-3 shadow-sm">
                        <div className="text-[10px] font-bold text-text3 pt-1 uppercase tabular-nums">{timeStr}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold leading-tight mb-1">{cls} <span className="text-text2 font-normal mx-1">•</span> {sub}</div>
                          <div className={`text-[11px] ${sess.materialId === 'SKIPPED' ? 'text-amber' : 'text-text2'}`}>
                            {matName}
                            {sessCount > 1 && <span className="ml-2 bg-primary-dim text-primary text-[9px] font-bold px-[5px] py-[1px] rounded">MULTI-SESI ({sessCount}x)</span>}
                          </div>
                          {sess.note && <div className="text-[11px] text-text3 mt-1 italic">📝 {sess.note}</div>}
                        </div>
                        <div className="text-green text-sm flex-shrink-0 font-bold">✓</div>
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
        <div className="bg-green/8 border border-green/20 rounded-xl p-2 text-center">
          <div className="text-xl font-black text-green">{summary.done}</div>
          <div className="text-[9px] text-text3 font-bold uppercase">Selesai</div>
        </div>
        <div className="bg-amber/8 border border-amber/20 rounded-xl p-2 text-center">
          <div className="text-xl font-black text-amber">{summary.partial}</div>
          <div className="text-[9px] text-text3 font-bold uppercase">Sebagian</div>
        </div>
        <div className="bg-red/8 border border-red/20 rounded-xl p-2 text-center">
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
