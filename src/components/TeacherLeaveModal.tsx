import { useState, useMemo, useEffect } from 'react';
import {
  getData, genId, applyTeacherLeave, DAYS_SHORT
} from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

interface TeacherLeaveModalProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function TeacherLeaveModal({ open, onClose, onRefresh }: TeacherLeaveModalProps) {
  const { toast } = useToast();
  const data = getData();
  
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  
  const [reason, setReason] = useState('Sakit');
  
  // Track resolutions per schedule id
  const [resolutions, setResolutions] = useState<Record<string, { action: 'deliver' | 'skip'; note: string }>>({});

  const dayOfWeek = date ? new Date(date).getDay() : -1;
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

  // Set default resolutions when schedules change
  useEffect(() => {
    const newRes: Record<string, { action: 'deliver' | 'skip'; note: string }> = {};
    schedules.forEach(s => {
      newRes[s.id] = resolutions[s.id] || { action: 'deliver', note: 'Tugas Mandiri/Catatan' };
    });
    setResolutions(newRes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules]);

  const handleActionChange = (id: string, action: 'deliver' | 'skip') => {
    setResolutions(prev => ({
      ...prev,
      [id]: { ...prev[id], action }
    }));
  };

  const handleNoteChange = (id: string, note: string) => {
    setResolutions(prev => ({
      ...prev,
      [id]: { ...prev[id], note }
    }));
  };

  const saveLeave = () => {
    if (!date) {
      toast({ title: 'Pilih tanggal izin terlebih dahulu' });
      return;
    }
    
    // Check if there are schedules
    if (schedules.length === 0) {
      toast({ title: 'Tidak ada jadwal di tanggal ini' });
      return;
    }

    const resArray = Object.entries(resolutions).map(([scheduleId, res]) => ({
      scheduleId,
      action: res.action,
      note: res.action === 'deliver' ? res.note || `Otomatis: Tugas Mandiri (${reason})` : `Otomatis: Kelas Kosong/Diluar Jadwal (${reason})`
    }));

    applyTeacherLeave(date, reason, resArray);
    toast({ title: '✓ Izin Disimpan', description: `Sesi besok otomatis disetup via sistem.` });
    onRefresh();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-[rgba(0,0,0,0.75)] flex items-end transition-opacity" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-[430px] mx-auto bg-surface2 rounded-t-[26px] p-5 pb-10 max-h-[88dvh] overflow-y-auto animate-slide-up">
        <div className="w-9 h-[3px] bg-[hsl(var(--border2))] rounded-full mx-auto mb-[18px]" />
        
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/30 flex items-center justify-center text-xl flex-shrink-0">
            🏥
          </div>
          <div>
            <div className="font-display text-[22px] font-medium tracking-tight leading-none mb-1">Pengajuan Izin</div>
            <div className="text-[12px] text-text2">Atur sesi kelas jika Anda berhalangan hadir.</div>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Tanggal</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="form-input-style" 
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Alasan</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="form-select-style">
              <option value="Sakit">Badan Sakit</option>
              <option value="Cuti/Izin">Cuti / Urusan</option>
              <option value="Dinas Luar">Dinas Luar</option>
            </select>
          </div>
        </div>

        <div className="mb-2">
          <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Penyesuaian Jadwal ({schedules.length} Kelas)</label>
          
          {schedules.length === 0 ? (
            <div className="text-center py-6 bg-surface border border-border2 rounded-xl text-text3 text-sm">
              Tidak ada jadwal mengajar pada hari ini.
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map(s => {
                const res = resolutions[s.id] || { action: 'deliver', note: '' };
                const isDeliver = res.action === 'deliver';
                
                return (
                  <div key={s.id} className="bg-surface border border-border2 rounded-xl p-3 shadow-sm transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 pr-2">
                        <div className="text-[14px] font-bold text-foreground leadig-tight">{s.className}</div>
                        <div className="text-[12px] text-text2">{s.subjectName} • {s.startTime}</div>
                        {s.nextMat && (
                          <div className="text-[10px] text-text3 mt-0.5 truncate">Materi Reguler: {s.nextMat.name}</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0 bg-surface2 p-1 rounded-lg border border-border2/50">
                        <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${isDeliver ? 'bg-green/10 text-green ring-1 ring-green/30' : 'text-text3 hover:bg-surface3'}`}>
                          <input type="radio" checked={isDeliver} onChange={() => handleActionChange(s.id, 'deliver')} className="hidden" />
                          <span className={isDeliver ? 'opacity-100' : 'opacity-50'}>✓ Titip Tugas</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${!isDeliver ? 'bg-red/10 text-red ring-1 ring-red/30' : 'text-text3 hover:bg-surface3'}`}>
                          <input type="radio" checked={!isDeliver} onChange={() => handleActionChange(s.id, 'skip')} className="hidden" />
                          <span className={!isDeliver ? 'opacity-100' : 'opacity-50'}>⏭ Skip Kelas</span>
                        </label>
                      </div>
                    </div>
                    
                    {isDeliver && (
                      <div className="mt-2 animate-slide-up origin-top">
                        <input
                          type="text"
                          placeholder="Contoh: Kerjakan Modul Hal 45-48"
                          value={res.note}
                          onChange={e => handleNoteChange(s.id, e.target.value)}
                          className="w-full bg-surface2 border border-border2 rounded-md px-2.5 py-1.5 text-[11px] text-foreground focus:border-primary focus:outline-none placeholder:text-text3"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={saveLeave} disabled={schedules.length === 0} className="flex-1 btn-primary-style disabled:opacity-50 disabled:cursor-not-allowed">
            ✓ Terapkan Izin
          </button>
        </div>
        <button onClick={onClose} className="w-full py-[13px] text-text2 text-[13px] mt-1 font-medium">Batal</button>
      </div>
    </div>
  );
}
