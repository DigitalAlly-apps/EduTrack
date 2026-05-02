import { createPortal } from 'react-dom';
import { useState, useMemo } from 'react';
import { getData, suggestDayReschedule, applySmartReschedule, dateFromKey } from '@/lib/data';
import { toast } from '@/hooks/use-toast';

interface SmartReschedulerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateStr: string;
  onSuccess?: () => void;
}

export default function SmartReschedulerModal({ open, onOpenChange, dateStr, onSuccess }: SmartReschedulerModalProps) {
  const [resolutions, setResolutions] = useState<Record<string, 'skip' | 'postpone' | 'deliver' | 'keep'>>({});
  const [noteForDeliver, setNoteForDeliver] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const data = useMemo(() => getData(), [open]); // refresh when opened
  const suggestions = useMemo(() => suggestDayReschedule(dateStr), [dateStr, data]);

  const handleApply = () => {
    setLoading(true);
    const actions = suggestions.map(s => ({
      ...s,
      action: resolutions[s.scheduleId] || s.action, // use suggestion default if not changed
      note: noteForDeliver[s.scheduleId],
    }));

    applySmartReschedule(dateStr, actions);
    setLoading(false);
    toast({ title: 'Jadwal hari ini telah disesuaikan' });
    onOpenChange(false);
    onSuccess?.();
  };

  if (!open) return null;

  const dayName = dateFromKey(dateStr).toLocaleDateString('id-ID', { weekday: 'long' });
  const dateFormatted = dateFromKey(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });

  return createPortal(
    <div className="fixed inset-0 z-[600] bg-[rgba(0,0,0,0.7)] flex flex-col justify-end animate-in fade-in transition-all" onClick={() => onOpenChange(false)}>
      <div className="bg-surface2 rounded-t-[24px] p-5 pb-safe pb-10 w-full max-w-[430px] mx-auto animate-slide-up max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-border2 rounded-full mx-auto mb-4" />
        
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-[19px] font-medium tracking-tight mb-0.5">🧠 Smart Rescheduler</div>
            <div className="text-sm text-text2">{dayName}, {dateFormatted}</div>
          </div>
        </div>

        <div className="text-[12px] text-text2 mb-4 leading-relaxed">
          Sistem menyarankan penanganan untuk setiap kelas yang jatuh pada hari ini. Ubah jika diperlukan.
        </div>

        {/* Schedule list */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2 mb-4">
          {suggestions.length === 0 ? (
            <div className="text-center py-8 text-text2 text-sm">Tidak ada jadwal pada hari ini.</div>
          ) : (
            suggestions.map(s => {
              const schedule = data.schedules.find(sch => sch.id === s.scheduleId);
              if (!schedule) return null;
              const cls = data.classes.find(c => c.id === schedule.classId);
              const sub = data.subjects.find(su => su.id === schedule.subjectId);
              const className = cls?.name || '-';
              const subjectName = sub?.name || '-';
              const time = `${schedule.startTime} (${schedule.duration} mnt)`;

              return (
                <div key={s.scheduleId} className="bg-surface border border-border/60 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-[13px] font-bold text-foreground">{className} • {subjectName}</div>
                      <div className="text-[11px] text-text3 mt-0.5">🕐 {time}</div>
                    </div>
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded text-nowrap">{s.reason}</span>
                  </div>

                  <select
                    value={resolutions[s.scheduleId] || s.action}
                    onChange={e => setResolutions({ ...resolutions, [s.scheduleId]: e.target.value as any })}
                    className="w-full bg-surface2 border border-border2 rounded-lg px-2 py-1.5 text-[12px] text-foreground"
                  >
                    <option value="skip">⏭ Skip / Dilewati hari ini</option>
                    <option value="postpone">📅 Tunda ke minggu depan</option>
                    <option value="deliver">✅ Selesai (tanpa sesi)</option>
                    <option value="keep">🔒 Tetap dijadwal (tidak diubah)</option>
                  </select>

                  {resolutions[s.scheduleId] === 'deliver' && (
                    <textarea
                      value={noteForDeliver[s.scheduleId] || ''}
                      onChange={e => setNoteForDeliver({ ...noteForDeliver, [s.scheduleId]: e.target.value })}
                      placeholder="Catatan (opsional)…"
                      className="w-full mt-2 bg-surface border border-border2 rounded-md px-2 py-1.5 text-[12px] min-h-[50px] focus:border-primary focus:outline-none"
                      autoFocus
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-3 border-t border-border/50">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 py-3 rounded-xl bg-surface2 border border-border2 text-sm font-semibold transition-all hover:bg-surface3"
          >
            Batal
          </button>
          <button
            onClick={handleApply}
            disabled={loading}
            className={`flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold transition-all active:scale-[0.98] ${loading ? 'opacity-70' : ''}`}
          >
            {loading ? 'Menyimpan…' : 'Terapkan Semua'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
