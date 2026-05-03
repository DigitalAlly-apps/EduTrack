import { useState, useMemo, useEffect } from 'react';
import {
  getData, genId, applyTeacherLeave, DAYS_SHORT, dateKey, dateFromKey
} from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, ClipboardList, HeartPulse, SkipForward, X } from 'lucide-react';

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
    return dateKey(tomorrow);
  });
  
  const [reason, setReason] = useState('Sakit');
  
  // Track resolutions per schedule id
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
    <div className="app-overlay z-[500] transition-opacity" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="app-bottom-sheet">
        <div className="app-sheet-handle" />
        
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-amber/10 border border-amber/30 flex items-center justify-center text-amber flex-shrink-0">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <div className="app-sheet-title">Pengajuan Izin</div>
            <div className="app-sheet-desc">Atur sesi kelas jika Anda berhalangan hadir.</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Tanggal</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="form-input-style" 
            />
          </div>
          <div>
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
            <div className="text-center py-6 bg-surface border border-border2 rounded-2xl text-text3 text-sm">
              Tidak ada jadwal mengajar pada hari ini.
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map(s => {
                const res = resolutions[s.id] || { action: 'deliver', note: '' };
                const isDeliver = res.action === 'deliver';
                
                return (
                  <div key={s.id} className="bg-surface border border-border2 rounded-2xl p-4 shadow-sm transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 pr-2">
                        <div className="text-[14px] font-bold text-foreground leadig-tight">{s.className}</div>
                        <div className="text-[12px] text-text2">{s.subjectName} • {s.startTime}</div>
                        {s.nextMat && (
                          <div className="text-[10px] text-text3 mt-0.5 truncate">Materi Reguler: {s.nextMat.name}</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0 bg-surface2 p-1 rounded-2xl border border-border2/50">
                        <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${isDeliver ? 'bg-green/10 text-green ring-1 ring-green/30' : 'text-text3 hover:bg-surface3'}`}>
                          <input type="radio" checked={isDeliver} onChange={() => handleActionChange(s.id, 'deliver')} className="hidden" />
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span className={isDeliver ? 'opacity-100' : 'opacity-50'}>Titip Tugas</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${!isDeliver ? 'bg-red/10 text-red ring-1 ring-red/30' : 'text-text3 hover:bg-surface3'}`}>
                          <input type="radio" checked={!isDeliver} onChange={() => handleActionChange(s.id, 'skip')} className="hidden" />
                          <SkipForward className="h-3.5 w-3.5" />
                          <span className={!isDeliver ? 'opacity-100' : 'opacity-50'}>Skip Kelas</span>
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
                          className="w-full bg-surface2 border border-border2 rounded-xl px-3 py-2 text-[12px] text-foreground focus:border-primary focus:outline-none placeholder:text-text3"
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
            <ClipboardList className="h-4 w-4" /> Terapkan Izin
          </button>
        </div>
        <button onClick={onClose} className="w-full py-[13px] text-text2 text-[13px] mt-1 font-medium flex items-center justify-center gap-1.5"><X className="h-4 w-4" /> Batal</button>
      </div>
    </div>
  );
}
