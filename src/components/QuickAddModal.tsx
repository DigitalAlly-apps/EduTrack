import { useState } from 'react';
import {
  getData, updateData, genId, DAYS_SHORT, checkOverlap,
} from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

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
    <div className="fixed inset-0 z-[500] bg-[rgba(0,0,0,0.75)] flex items-end transition-opacity" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-[430px] mx-auto bg-surface2 rounded-t-[26px] p-5 pb-10 max-h-[88dvh] overflow-y-auto animate-slide-up">
        <div className="w-9 h-[3px] bg-[hsl(var(--border2))] rounded-full mx-auto mb-[18px]" />
        <div className="font-display text-[22px] font-medium tracking-tight mb-[18px]">Tambah Jadwal</div>

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
          <div className="flex gap-1 flex-wrap">
            {DAYS_SHORT.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                className={`px-[11px] py-[7px] rounded-full text-xs font-medium border transition-all min-h-[36px] ${
                  selectedDays.includes(i) ? 'bg-teal-dim border-teal text-teal' : 'bg-surface border-border text-text2'
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

        <button onClick={add} className="btn-primary-style">Tambah Jadwal</button>
        <button onClick={onClose} className="w-full py-[13px] text-text2 text-[13px] mt-2">Batal</button>
      </div>
    </div>
  );
}
