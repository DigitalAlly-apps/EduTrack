import { useMemo } from 'react';
import { HeatmapRow } from '@/lib/types';

interface HeatmapCardProps {
  rows: HeatmapRow[];
}

export default function HeatmapCard({ rows }: HeatmapCardProps) {

  if (rows.length === 0) return null;

  const statusColors: Record<string, string> = {
    'on-track': 'bg-green/20 border-green/30',
    'tight': 'bg-amber/20 border-amber/30',
    'behind': 'bg-red/20 border-red/30',
    'no-class': 'bg-surface2 border-border/30',
    'no-data': 'bg-transparent border-transparent',
  };

  return (
    <div className="bg-surface/60 border border-border/60 rounded-2xl p-4 mb-4 animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🗺️</span>
        <div>
          <div className="text-[13px] font-bold text-foreground">Heatmap Mingguan</div>
          <div className="text-[10px] text-text3">Visualisasi progres 8 minggu ke depan</div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <div className="min-w-[400px]">
          {/* Header row */}
          <div className="grid grid-cols-9 gap-1 mb-1 px-1">
            <div className="text-[10px] font-bold text-text3 uppercase tracking-wider col-span-2">Kelas • Mapel</div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="text-[9px] text-text3 text-center font-medium">
                M{i + 1}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {rows.slice(0, 6).map((row, rowIdx) => (
            <div key={`${row.classId}-${row.subjectId}`} className="grid grid-cols-9 gap-1 mb-1 items-center">
              <div className="truncate text-[10px] font-semibold text-foreground col-span-2 px-1" title={`${row.className} - ${row.subjectName}`}>
                {row.className} • {row.subjectName}
              </div>
              {row.cells.map((cell, cellIdx) => (
                <div
                  key={cellIdx}
                  className={`aspect-square rounded-[4px] border text-[9px] flex items-center justify-center font-bold transition-all
                    ${statusColors[cell.status]}
                    ${cell.status === 'on-track' ? 'text-green' : ''}
                    ${cell.status === 'tight' ? 'text-amber' : ''}
                    ${cell.status === 'behind' ? 'text-red' : ''}
                    hover:scale-110 cursor-pointer
                  `}
                  title={`${cell.weekLabel}: ${cell.sessionsDone}/${cell.sessionsScheduled} sesi`}
                >
                  {cell.sessionsDone > 0 ? cell.sessionsDone : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green/20 border border-green/30" />
          <span className="text-[9px] text-text2">On Track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber/20 border border-amber/30" />
          <span className="text-[9px] text-text2">Mepet</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red/20 border border-red/30" />
          <span className="text-[9px] text-text2">Behind</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-surface2 border border-border/30" />
          <span className="text-[9px] text-text2">Tidak Ada</span>
        </div>
      </div>
    </div>
  );
}
