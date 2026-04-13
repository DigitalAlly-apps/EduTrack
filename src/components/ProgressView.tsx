import { useState, useMemo, memo, useCallback } from 'react';
import { getData, getSubjectStatus, fmt, getSessionHistory, now } from '@/lib/data';
import AICard from './AICard';

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
  const [tab, setTab] = useState<'progress' | 'history'>('progress');
  return (
    <div className="pt-1">
      <div className="flex bg-surface/40 backdrop-blur-md border border-border/60 rounded-[14px] mb-[18px] p-1 shadow-sm">
        <button onClick={() => setTab('progress')} className={`flex-1 py-[8px] text-[12px] font-bold tracking-wide uppercase rounded-[10px] transition-all duration-300 ${tab === 'progress' ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]' : 'text-text3 hover:text-foreground hover:bg-surface2/50'}`}>Progres</button>
        <button onClick={() => setTab('history')} className={`flex-1 py-[8px] text-[12px] font-bold tracking-wide uppercase rounded-[10px] transition-all duration-300 ${tab === 'history' ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]' : 'text-text3 hover:text-foreground hover:bg-surface2/50'}`}>Riwayat Sesi</button>
      </div>
      {tab === 'progress' ? <ProgressTab /> : <HistoryTab />}
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
};

type GroupData = { clsName: string; cards: CardData[]; issues: number };

// ─── ProgressTab ──────────────────────────────────────────────────────────────
function ProgressTab() {
  const [filter, setFilter] = useState<'semua' | 'bermasalah'>('semua');

  // Heavy computation — memoized once per mount
  const { allCards, hasSchedules, hasClasses } = useMemo(() => {
    const data = getData();
    if (!data.classes.length) return { allCards: [], hasSchedules: false, hasClasses: false };

    const cards: CardData[] = [];
    let hasSched = false;

    data.classes.forEach(cls => {
      data.subjects.forEach(sub => {
        if (!data.schedules.some(s => s.classId === cls.id && s.subjectId === sub.id)) return;
        hasSched = true;
        const st = getSubjectStatus(sub, cls, data);
        const mats = data.materials.filter(m => m.subjectId === sub.id).sort((a, b) => a.order - b.order);
        const prog = data.progress.find(p => p.classId === cls.id && p.subjectId === sub.id);
        const matsDone = prog?.materialsDone ?? 0;
        const totalSessDone = mats.slice(0, matsDone).reduce((s, m) => s + ((m.sessions as number) ?? 1), 0);
        const totalSessAll = mats.reduce((s, m) => s + ((m.sessions as number) ?? 1), 0);
        cards.push({
          clsId: cls.id, clsName: cls.name,
          subId: sub.id, subName: sub.name,
          st, urgency: getUrgencyScore(st),
          effectiveColor: getEffectiveStatus(st),
          mats, matsDone, totalSessDone, totalSessAll,
        });
      });
    });

    return { allCards: cards, hasSchedules: hasSched, hasClasses: true };
  }, []);

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

  const filtered = filter === 'bermasalah'
    ? allCards.filter(c => c.effectiveColor !== 'green')
    : allCards;

  const bermasalahCount = allCards.filter(c => c.effectiveColor !== 'green').length;

  // Group by class
  const { groupedByClass, classIds } = useMemo(() => {
    const grp: Record<string, GroupData> = {};
    filtered.forEach(card => {
      if (!grp[card.clsId]) grp[card.clsId] = { clsName: card.clsName, cards: [], issues: 0 };
      grp[card.clsId].cards.push(card);
      if (card.effectiveColor !== 'green') grp[card.clsId].issues++;
    });
    const ids = Object.keys(grp).sort((a, b) => {
      const diff = grp[b].issues - grp[a].issues;
      return diff !== 0 ? diff : grp[a].clsName.localeCompare(grp[b].clsName);
    });
    return { groupedByClass: grp, classIds: ids };
  }, [filtered]);

  return (
    <>
      <AICard />
      <div className="mt-4">
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
          <div className="text-center py-10 border border-dashed border-border2 rounded-[20px]">
            <span className="text-3xl block mb-2">✅</span>
            <div className="text-sm font-medium text-text2">Semua mapel sesuai target!</div>
          </div>
        )}

        <div className="space-y-6">
          {classIds.map(clsId => (
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
          <span className="text-[11px] font-bold text-text3 bg-surface border border-border px-2 py-0.5 rounded-full">{group.cards.length} Mapel</span>
        </div>
        <div className="flex items-center gap-3">
          {group.issues > 0 && (
            <span className="text-[10px] font-bold bg-red text-white px-2 py-0.5 rounded-md uppercase tracking-wider">{group.issues} Bermasalah</span>
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
  const { subName, st, effectiveColor, mats, matsDone } = card;

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
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 border ${
              effectiveColor === 'red' ? 'bg-red/10 text-red border-red/20' :
              effectiveColor === 'amber' ? 'bg-amber/10 text-amber border-amber/20' :
              'bg-green-dim/60 text-green border-green/20'
            }`}>{st.label}</span>
          </div>
          
          <div className="flex items-center gap-2 text-[11px] text-text2 flex-wrap font-medium">
            <span><strong className="text-foreground">{st.done}</strong>/{st.total} Bab</span>
            <span className="opacity-40">•</span>
            <span>{st.pct}% Selesai</span>
            {st.daysLeft !== undefined && (
              <>
                <span className="opacity-40">•</span>
                <span className={st.daysLeft <= 14 ? (st.daysLeft <= 7 ? 'text-red font-bold' : 'text-amber font-bold') : 'text-text3'}>
                  ⏳ {st.daysLeft} hari ujian
                </span>
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
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1.5 flex-1 bg-surface3 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-700 ${effectiveColor === 'green' ? 'bg-green' : effectiveColor === 'amber' ? 'bg-amber' : 'bg-red'}`} 
                style={{ width: `${Math.max(2, st.pct)}%` }} 
              />
            </div>
            {mats.length > 0 && <span className="text-[10px] font-bold text-text3">PROGRES BAB</span>}
          </div>

          <div className="space-y-[3px]">
            {mats.map((mat: any, idx: number) => {
              const isDone = idx < matsDone;
              const isActive = idx === matsDone;
              return (
                <div key={mat.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive ? 'bg-primary-dim/30 border border-primary-border/20 shadow-sm' : 
                  isDone ? 'opacity-50' : 'opacity-[0.35]'
                }`}>
                  <span className={`text-[12px] mt-[1px] flex-shrink-0 ${isDone ? 'text-green' : isActive ? 'text-primary' : 'text-text3'}`}>
                    {isDone ? '✓' : isActive ? '▶' : '○'}
                  </span>
                  <span className={`text-[13px] leading-snug flex-1 ${
                    isDone ? 'line-through decoration-text3/50' :
                    isActive ? 'font-bold text-foreground' : 'font-medium text-text2'
                  }`}>{mat.name}</span>
                </div>
              );
            })}
            {mats.length === 0 && <div className="text-[12px] text-text3 italic py-2 text-center">Materi belum diatur untuk mapel ini.</div>}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── HistoryTab ───────────────────────────────────────────────────────────────
function HistoryTab() {
  const [month, setMonth] = useState(now().toISOString().slice(0, 7));
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
      <div className="bg-surface border border-border rounded-[16px] p-3 flex justify-between items-center mb-4">
        <div className="text-[11px] font-bold text-text3 uppercase tracking-wide">Pilih Bulan</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="form-input-style min-h-0 py-1.5 px-3 w-auto text-xs" />
      </div>
      {dates.length === 0 ? (
        <div className="text-center py-12 px-6 border border-dashed border-border2 rounded-[20px]">
          <span className="text-4xl block mb-3 opacity-50">📜</span>
          <div className="text-[15px] font-medium mb-1">Tidak ada riwayat</div>
          <div className="text-xs text-text2">Belum ada sesi tercatat di bulan ini.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {dates.map(date => {
            const dateStr = new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
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
