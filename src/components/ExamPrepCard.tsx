import { ExamPrepItem } from '@/lib/types';
import { AlertTriangle, BookOpenCheck, CheckCircle2, Target, Timer } from 'lucide-react';

interface ExamPrepCardProps {
  items: ExamPrepItem[];
}

export default function ExamPrepCard({ items }: ExamPrepCardProps) {
  const criticalCount = items.filter(i => i.status === 'critical').length;
  const warningCount = items.filter(i => i.status === 'warning').length;

  return (
    <div className="bg-gradient-to-br from-amber/10 via-amber/5 to-transparent border border-amber/20 rounded-2xl overflow-hidden shadow-sm animate-slide-up">
      <div className="p-4 border-b border-amber/10">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-amber/10 border border-amber/20 text-amber grid place-items-center">
              <BookOpenCheck className="h-4 w-4" />
            </div>
            <div className="text-[13px] font-bold text-foreground">Exam Prep Mode — H-14</div>
          </div>
          <div className="flex gap-1.5">
            {criticalCount > 0 && (
              <span className="text-[9px] font-bold bg-red text-white px-2 py-0.5 rounded-full">{criticalCount} Critical</span>
            )}
            {warningCount > 0 && (
              <span className="text-[9px] font-bold bg-amber text-white px-2 py-0.5 rounded-full">{warningCount} Warning</span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-text2">
          {items.length} ujian mendatang. Fokus pada materi yang belum siap.
        </div>
      </div>

      <div className="p-4 space-y-3">
        {items.map((item, idx) => (
          <div
            key={`${item.classId}-${item.subjectId}`}
            className={`rounded-xl border p-3 transition-all ${
              item.status === 'critical'
                ? 'bg-red/5 border-red/20'
                : item.status === 'warning'
                ? 'bg-amber/5 border-amber/20'
                : 'bg-green/5 border-green/20'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="text-[12px] font-bold text-foreground">
                  {item.className} • {item.subjectName}
                </div>
                <div className="text-[10px] text-text3 mt-0.5">
                  Ujian dalam {item.daysLeft} hari • {item.progressPct}% selesai
                </div>
              </div>
              <div
                className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase flex items-center gap-1 ${
                  item.status === 'critical'
                    ? 'bg-red text-white'
                    : item.status === 'warning'
                    ? 'bg-amber text-white'
                    : 'bg-green text-white'
                }`}
              >
                {item.status === 'critical' ? <AlertTriangle className="h-3 w-3" /> : item.status === 'warning' ? <Timer className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                {item.status === 'critical' ? 'Critical' : item.status === 'warning' ? 'Warning' : 'OK'}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-surface rounded-full overflow-hidden mb-2">
              <div
                className={`h-full transition-all ${
                  item.status === 'critical' ? 'bg-red' : item.status === 'warning' ? 'bg-amber' : 'bg-green'
                }`}
                style={{ width: `${item.progressPct}%` }}
              />
            </div>

            {/* Recommended actions */}
            {item.recommendedActions.length > 0 && (
              <div className="space-y-1">
                {item.recommendedActions.map((action, i) => {
                  return (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-text2">
                      <Target className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber" />
                      <span>{action}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
