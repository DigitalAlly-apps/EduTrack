import { useState } from 'react';
import {
  getData, updateData, genId, DAYS_SHORT, checkOverlap,
} from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, X } from 'lucide-react';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function QuickAddModal({ open, onClose, onRefresh }: QuickAddModalProps) {
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [duration, setDuration] = useState('45');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const { toast } = useToast();
  const data = getData();

  const toggleDay = (d: number) => {
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const add = () => {
    if (!classId || !subjectId || !startTime || !selectedDays.length) {
      toast({ title: 'Lengkapi semua field' }); return;
    }
    if (checkOverlap(classId, selectedDays, startTime, parseInt(duration) || 45)) {
      toast({ title: 'Waktu bentrok' }); return;
    }
    updateData(d => {
      d.schedules.push({ id: genId(), classId, subjectId, days: [...selectedDays], startTime, duration: parseInt(duration) || 45 });
      if (!d.progress.find(p => p.classId === classId && p.subjectId === subjectId))
        d.progress.push({ id: genId(), classId, subjectId, materialsDone: 0, lastSession: null });
    });
    onClose();
    toast({ title: 'Jadwal ditambahkan' });
    onRefresh();
    setClassId(''); setSubjectId(''); setSelectedDays([]);
  };

  if (!open) return null;

  return (
    <div className="app-overlay z-[500] transition-opacity" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="app-bottom-sheet">
        <div className="app-sheet-handle" />
        <div className="flex items-start gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary grid place-items-center flex-shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <div className="app-sheet-title">Tambah Jadwal</div>
            <div className="app-sheet-desc">Buat jadwal mingguan cepat tanpa membuka menu Kelola.</div>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Kelas</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} className="form-select-style">
            <option value="">Pilih kelas...</option>
            {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Mata Pelajaran</label>
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="form-select-style">
            <option value="">Pilih mapel...</option>
            {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Hari</label>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS_SHORT.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                className={`rounded-xl text-xs font-bold border transition-all min-h-[38px] ${
                  selectedDays.includes(i) ? 'bg-primary border-primary text-primary-foreground' : 'bg-surface border-border text-text2 hover:border-border3'
                }`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Jam Mulai</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="form-input-style" />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold tracking-[0.5px] uppercase text-text2 mb-[7px]">Durasi</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="form-input-style" />
          </div>
        </div>

        <button onClick={add} className="btn-primary-style flex items-center justify-center gap-2"><CalendarDays className="h-4 w-4" /> Tambah Jadwal</button>
        <button onClick={onClose} className="w-full py-[13px] text-text2 text-[13px] mt-2 flex items-center justify-center gap-1.5"><X className="h-4 w-4" /> Batal</button>
      </div>
    </div>
  );
}
