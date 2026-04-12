import { useState } from 'react';
import { getDailyBriefing } from '@/lib/briefing';
import { getData, now, DAYS_ID, todayNum } from '@/lib/data';

export default function DailyBriefing() {
  const items = getDailyBriefing();
  const [isExpanded, setIsExpanded] = useState(false);
  const hasUrgent = items.some(i => i.urgent);
  const todayName = DAYS_ID[todayNum()];
  const dateStr = now().toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });

  // If not urgent and not expanded, show a very compact version
  const showCompact = !hasUrgent && !isExpanded;

  return (
    <div className={`rounded-[20px] border p-4 mb-3 animate-slide-up relative overflow-hidden transition-all duration-300 ${
      hasUrgent
        ? 'bg-amber/5 border-amber/25 shadow-sm'
        : 'bg-surface/60 border-border2/60 shadow-sm'
    }`}>
      {/* Subtle glow top */}
      {hasUrgent && (
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber/40 to-transparent" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{hasUrgent ? '⚡' : '🗂️'}</span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-text3">Briefing Harian</div>
            <div className="text-[10px] text-text3 opacity-70">{todayName}, {dateStr}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasUrgent && (
            <span className="text-[9px] font-bold bg-amber/15 text-amber border border-amber/25 px-2 py-1 rounded-full uppercase tracking-wide">
              Penting
            </span>
          )}
          {!hasUrgent && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[10px] font-bold text-primary px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
            >
              {isExpanded ? 'Sembunyikan' : 'Lihat Detail'}
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className={`space-y-2 transition-all duration-300 origin-top ${showCompact ? 'max-h-0 opacity-0 pointer-events-none mt-0' : 'max-h-[500px] opacity-100 mt-3'}`}>
        {items.map((item, i) => (
          <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-xl border ${
            item.type === 'ujian-hari-ini' ? 'bg-amber/10 border-amber/20' :
            item.type === 'koreksi-overdue' ? 'bg-red/8 border-red/15' :
            item.type === 'ujian-dekat' && item.urgent ? 'bg-red/8 border-red/15' :
            item.type === 'semua-beres' ? 'bg-green/8 border-green/15' :
            'bg-surface2/60 border-border/50'
          }`}>
            <span className="text-base flex-shrink-0 mt-[1px]">{item.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className={`text-[10px] font-bold uppercase tracking-wide mb-[2px] ${
                item.urgent && item.type !== 'semua-beres' ? 'text-amber' :
                item.type === 'koreksi-overdue' ? 'text-red' :
                item.type === 'semua-beres' ? 'text-green' :
                'text-text3'
              }`}>{item.label}</div>
              <div className="text-[12px] font-medium text-foreground/90 leading-snug">{item.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
