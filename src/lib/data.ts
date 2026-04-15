import { AppData, TodayScheduleItem, Insight, SubjectStatus, Subject, ClassItem } from './types';

const DB_KEY = 'pengajar_v4';

const DEFAULT_DATA: AppData = {
  teacherName: '', classes: [], subjects: [], materials: [], schedules: [],
  progress: [], sessions: [], tasks: [], notes: [], lastBackup: null, reminderDismissed: null, holidays: [], scheduleOverrides: [],
};

export function getData(): AppData {
  try {
    const raw = localStorage.getItem(DB_KEY) || localStorage.getItem('pengajar_v3') || localStorage.getItem('pengajar_v2');
    if (!raw) return structuredClone(DEFAULT_DATA);
    return { ...structuredClone(DEFAULT_DATA), ...JSON.parse(raw) };
  } catch { return structuredClone(DEFAULT_DATA); }
}

export function saveData(d: AppData) { localStorage.setItem(DB_KEY, JSON.stringify(d)); }

export function updateData(fn: (d: AppData) => void): AppData {
  const d = getData(); fn(d); saveData(d); return d;
}

export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Helper utama: ambil materi untuk kombinasi mapel+kelas
// - Jika ada materi dengan classId spesifik => pakai itu
// - Jika tidak ada => fallback ke materi tanpa classId (shared/lama)
export function getMaterials(subjectId: string, classId: string) {
  const data = getData();
  const specific = data.materials.filter(m => m.subjectId === subjectId && m.classId === classId);
  if (specific.length > 0) return specific.sort((a, b) => a.order - b.order);
  // fallback: materi lama yang tidak punya classId (backward-compat)
  return data.materials.filter(m => m.subjectId === subjectId && !m.classId).sort((a, b) => a.order - b.order);
}

// Time utils
export const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function now() { return new Date(); }
export function todayNum() { return now().getDay(); }
export function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
export function currentMin() { const n = now(); return n.getHours() * 60 + n.getMinutes(); }
export function minToTime(m: number) { return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`; }
export function fmt(t: string) { const [h, m] = t.split(':').map(Number); const hh = h % 12 || 12; return `${hh}:${m.toString().padStart(2, '0')}`; }
export function fmtCountdown(diffMin: number) {
  if (diffMin <= 0) return 'Sekarang';
  if (diffMin < 60) return `${diffMin} mnt lagi`;
  const h = Math.floor(diffMin / 60), m = diffMin % 60;
  return m > 0 ? `${h}j ${m}m lagi` : `${h} jam lagi`;
}

export function getGreeting() {
  const h = now().getHours();
  if (h < 11) return 'Selamat pagi,';
  if (h < 15) return 'Selamat siang,';
  if (h < 18) return 'Selamat sore,';
  return 'Selamat malam,';
}

export function checkOverlap(classId: string, days: number[], startTime: string, duration: number) {
  const data = getData();
  const startMin = timeToMin(startTime), endMin = startMin + duration;
  for (const s of data.schedules) {
    if (s.classId !== classId) continue;
    const commonDays = s.days.filter(d => days.includes(d));
    if (commonDays.length > 0) {
      const es = timeToMin(s.startTime), ee = es + (s.duration || 45);
      if (startMin < ee && endMin > es) return true;
    }
  }
  return false;
}

// Returns the number of schedule sessions available in the next `daysLeft` days,
// minus any sessions that fall on a holiday date.
function estimateEffectiveSessions(schedules: { days: number[] }[], daysLeft: number, holidays: (string | { date: string; level?: string })[], subjectLevel?: string): { sessLeft: number; holidaysInPeriod: number } {
  let sessLeft = 0, holidaysInPeriod = 0;
  const base = new Date();
  for (let d = 0; d < daysLeft; d++) {
    const date = new Date(base);
    date.setDate(base.getDate() + d);
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().slice(0, 10);
    
    let isHoliday = false;
    for (const h of holidays) {
      if (typeof h === 'string') {
        if (h === dateStr) { isHoliday = true; break; }
      } else {
        if (h.date === dateStr && (!h.level || h.level === subjectLevel)) { isHoliday = true; break; }
      }
    }

    schedules.forEach(s => {
      if (s.days.includes(dayOfWeek)) {
        if (isHoliday) {
          holidaysInPeriod++;
        } else {
          sessLeft++;
        }
      }
    });
  }
  return { sessLeft, holidaysInPeriod };
}

// Returns total sessions needed to finish remaining materials (sum of material.sessions)
function getRemainingSessNeeded(mats: { sessions?: number }[], doneSoFar: number): number {
  return mats.slice(doneSoFar).reduce((sum, m) => sum + (m.sessions ?? 1), 0);
}

export function isDateHolidayForSubject(dateStr: string, subjectLevel?: string): boolean {
  const data = getData();
  const holidays = data.holidays || [];
  for (const h of holidays) {
    if (typeof h === 'string') {
      if (h === dateStr) return true;
    } else {
      if (h.date === dateStr && (!h.level || h.level === subjectLevel)) return true;
    }
  }
  return false;
}
export function isTodayHolidayGlobal(): boolean {
  const data = getData();
  const todayStr = now().toISOString().slice(0, 10);
  const holidays = data.holidays || [];
  return holidays.some(h => (typeof h === 'string' ? h === todayStr : (h.date === todayStr && !h.level)));
}

export function getTodaySchedules(): TodayScheduleItem[] {
  const data = getData();
  const today = todayNum();
  const todayStr = now().toISOString().slice(0, 10);
  
  return (data.schedules
    .filter(s => {
      if (!s.days.includes(today)) return false;
      const sub = data.subjects.find(x => x.id === s.subjectId);
      if (isDateHolidayForSubject(todayStr, sub?.level)) return false;
      return true;
    })
    .map(s => {
      const cls = data.classes.find(c => c.id === s.classId) || { name: '?' };
      const sub = data.subjects.find(x => x.id === s.subjectId) || { name: '?' };
      const prog = data.progress.find(p => p.classId === s.classId && p.subjectId === s.subjectId) || { materialsDone: 0 };
      const mats = getMaterials(s.subjectId, s.classId);
      const nextMat = mats[prog.materialsDone] || null;
      const session = data.sessions.find(se => se.scheduleId === s.id && se.date === todayStr);
      const done = !!session;
      
      const override = (data.scheduleOverrides || []).find(o => o.scheduleId === s.id && o.date === todayStr);
      if (override?.skipped) return null;

      const effectiveStartTime = override ? override.startTime : s.startTime;
      const effectiveDuration = override?.durationOverride ?? (s.duration || 45);
      
      const endMin = timeToMin(effectiveStartTime) + effectiveDuration;
      const curMin = currentMin();
      const active = curMin >= timeToMin(effectiveStartTime) && curMin < endMin && !done;
      
      return { 
        ...s, 
        duration: effectiveDuration,
        startTime: effectiveStartTime, // apply override
        className: cls.name, 
        subjectName: sub.name, 
        nextMat, 
        done, 
        active, 
        endTime: minToTime(endMin), 
        totalMats: mats.length, 
        materialsDone: prog.materialsDone, 
        sessionId: session?.id, 
        note: session?.note,
        skipped: session?.materialId === 'SKIPPED'
      };
    })
    .filter(Boolean) as TodayScheduleItem[])
    .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
}

export function getActiveSession(items: TodayScheduleItem[]) { return items.find(x => x.active && !x.done) || null; }
export function getNextSession(items: TodayScheduleItem[]) { const cur = currentMin(); return items.find(x => !x.done && timeToMin(x.startTime) > cur) || null; }

export function getInsights(): Insight[] {
  const data = getData();
  const holidays = data.holidays ?? [];
  const out: Insight[] = [];
  const seen = new Set<string>();

  data.subjects.forEach(sub => {
    data.classes.forEach(cls => {
      const mats = getMaterials(sub.id, cls.id);
      if (!mats.length) return;
      const key = `${cls.id}-${sub.id}`;
      // hanya generate insight jika kelas ini punya jadwal untuk mapel ini
      const sched = data.schedules.filter(s => s.classId === cls.id && s.subjectId === sub.id);
      if (sched.length === 0) return;

      const prog = data.progress.find(p => p.classId === cls.id && p.subjectId === sub.id) || { materialsDone: 0 };
      const remaining = mats.length - prog.materialsDone;
      if (remaining <= 0) return;
      const sessionsNeeded = getRemainingSessNeeded(mats, prog.materialsDone);
      
      if (sub.examDate) {
        const daysLeft = Math.ceil((new Date(sub.examDate).getTime() - now().getTime()) / 864e5);
        const { sessLeft, holidaysInPeriod } = estimateEffectiveSessions(sched, daysLeft, holidays, sub.level);
        
        if (sessLeft > 0 && sessionsNeeded > sessLeft + 1) {
          const extra = sessionsNeeded - sessLeft;
          if (!seen.has(key)) {
            out.push({
              type: 'warn',
              directive: 'Perlu diperhatikan',
              text: `<strong>${cls.name}</strong> butuh ${sessionsNeeded} sesi di ${sub.name}, tapi hanya ${sessLeft} tersedia${holidaysInPeriod > 0 ? ` (${holidaysInPeriod} libur). ⚡ <b>Saran:</b> Jadwalkan ${extra} kelas pengganti / ekstra jam` : `. Kurangi ${extra} sesi atau tambah jadwal`}.`,
            });
            seen.add(key);
          }
        } else if (sessLeft > 0 && sessionsNeeded <= sessLeft) {
          const nextMat = mats[prog.materialsDone];
          if (!seen.has(key)) {
            out.push({
              type: 'tip',
              directive: 'Disarankan hari ini',
              text: `Fokus pada <strong>${nextMat ? nextMat.name : sub.name}</strong>${nextMat?.sessions && nextMat.sessions > 1 ? ` (${nextMat.sessions} pertemuan)` : ''} untuk kelas <strong>${cls.name}</strong>.`,
            });
            seen.add(key);
          }
        }
      }
    });
  });
  return out.slice(0, 3);
}

export function getNextScheduleForClass(classId: string, subjectId: string) {
  const data = getData();
  const scheds = data.schedules.filter(s => s.classId === classId && s.subjectId === subjectId);
  if (!scheds.length) return null;
  const today = todayNum();
  const curMin = currentMin();
  for (let d = 0; d <= 7; d++) {
    const day = (today + d) % 7;
    for (const s of scheds) {
      if (!s.days.includes(day)) continue;
      if (d === 0 && timeToMin(s.startTime) <= curMin) continue;
      const dayName = d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : DAYS_ID[day];
      return { dayName, time: s.startTime };
    }
  }
  return null;
}

export function getSubjectStatus(sub: Subject, cls: ClassItem, data: AppData): SubjectStatus {
  const mats = getMaterials(sub.id, cls.id);
  if (!mats.length) return { status: 'on-track', label: 'Tidak ada materi', pct: 0, done: 0, total: 0, remaining: 0, rec: 'Tambahkan materi.', nextSched: null };
  const prog = data.progress.find(p => p.classId === cls.id && p.subjectId === sub.id) || { materialsDone: 0 };
  const done = prog.materialsDone, total = mats.length, remaining = total - done, pct = Math.round((done / total) * 100);
  const sessionsNeeded = getRemainingSessNeeded(mats, done);
  let status: 'on-track' | 'tight' | 'behind' = 'on-track', label = 'Sesuai jadwal', rec = 'Lanjutkan seperti biasa.';
  const nextSched = getNextScheduleForClass(cls.id, sub.id);
  const holidays = data.holidays ?? [];
  if (sub.examDate) {
    const daysLeft = Math.ceil((new Date(sub.examDate).getTime() - now().getTime()) / 864e5);
    const sched = data.schedules.filter(s => s.classId === cls.id && s.subjectId === sub.id);
    const { sessLeft, holidaysInPeriod } = estimateEffectiveSessions(sched, daysLeft, holidays, sub.level);
    if (remaining === 0) {
      status = 'on-track'; label = 'Selesai ✓'; rec = 'Semua materi sudah selesai!';
    } else if (sessLeft === 0) {
      status = 'behind'; label = 'Perlu perhatian';
      rec = holidaysInPeriod > 0
        ? `Tidak ada sesi tersisa (${holidaysInPeriod} hari libur memangkas jadwal).`
        : 'Belum ada sesi terjadwal tersisa.';
    } else if (sessionsNeeded > sessLeft + 2) {
      status = 'behind'; label = 'Perlu percepatan';
      const ratio = (sessionsNeeded / sessLeft).toFixed(1);
      rec = `Butuh ${sessionsNeeded} sesi, tersedia ${sessLeft}${holidaysInPeriod > 0 ? ` (−${holidaysInPeriod} libur)` : ''}. Ideal: ${ratio}× per sesi.`;
    } else if (sessionsNeeded > sessLeft) {
      status = 'tight'; label = 'Mepet target';
      rec = `Butuh ${sessionsNeeded} sesi, tersedia ${sessLeft}${holidaysInPeriod > 0 ? ` (−${holidaysInPeriod} libur)` : ''}. Jaga ritme.`;
    } else {
      status = 'on-track'; label = 'Sesuai jadwal';
      rec = sessionsNeeded === sessLeft
        ? `Pas — ${sessLeft} sesi tersisa untuk ${sessionsNeeded} sesi materi. Jangan ada yang terlewat!`
        : 'Pertahankan ritme ini.';
    }
    return { status, label, pct, done, total, remaining, sessLeft, sessionsNeeded, holidaysInPeriod, rec, daysLeft, nextSched };
  }
  return { status, label, pct, done, total, remaining, sessLeft: 0, sessionsNeeded, holidaysInPeriod: 0, rec, nextSched };
}

export function markDone(scheduleId: string, note?: string) {
  const data = getData();
  const sched = data.schedules.find(s => s.id === scheduleId);
  if (!sched) return;
  const todayStr = now().toISOString().slice(0, 10);
  if (data.sessions.some(s => s.scheduleId === scheduleId && s.date === todayStr)) return;
  const prog = data.progress.find(p => p.classId === sched.classId && p.subjectId === sched.subjectId);
  const mats = getMaterials(sched.subjectId, sched.classId);
  const mat = mats[prog ? prog.materialsDone : 0] || null;
  data.sessions.push({ id: genId(), scheduleId, classId: sched.classId, subjectId: sched.subjectId, date: todayStr, materialId: mat?.id || null, completedAt: now().toISOString(), note });
  if (prog) { if (mat) prog.materialsDone = Math.min(prog.materialsDone + 1, mats.length); prog.lastSession = todayStr; }
  else data.progress.push({ id: genId(), classId: sched.classId, subjectId: sched.subjectId, materialsDone: mat ? 1 : 0, lastSession: todayStr });
  saveData(data);
}

export function skipSession(scheduleId: string) {
  const data = getData();
  const sched = data.schedules.find(s => s.id === scheduleId);
  if (!sched) return;
  const todayStr = now().toISOString().slice(0, 10);
  if (data.sessions.some(s => s.scheduleId === scheduleId && s.date === todayStr)) return;
  data.sessions.push({ id: genId(), scheduleId, classId: sched.classId, subjectId: sched.subjectId, date: todayStr, materialId: 'SKIPPED', completedAt: now().toISOString() });
  saveData(data);
}

export function postponeSchedule(scheduleId: string, diffMinutes: number) {
  const data = getData();
  const todayStr = now().toISOString().slice(0, 10);
  const sched = data.schedules.find(s => s.id === scheduleId);
  if (!sched) return;
  
  if (!data.scheduleOverrides) data.scheduleOverrides = [];
  
  const existingOverride = data.scheduleOverrides.find(o => o.scheduleId === scheduleId && o.date === todayStr);
  const currentStartMin = timeToMin(existingOverride ? existingOverride.startTime : sched.startTime);
  const newStartMin = currentStartMin + diffMinutes;
  const newStartTime = minToTime(newStartMin);
  
  if (existingOverride) {
    existingOverride.startTime = newStartTime;
  } else {
    data.scheduleOverrides.push({ date: todayStr, scheduleId, startTime: newStartTime });
  }
  saveData(data);
}

export function applyShortDayOverride(dateStr: string) {
  const data = getData();
  const dayOfWeek = new Date(dateStr).getDay();
  
  const scheds = data.schedules
    .filter(s => s.days.includes(dayOfWeek) && !isDateHolidayForSubject(dateStr, data.subjects.find(x => x.id === s.subjectId)?.level))
    .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
  
  if (!scheds.length) return;
  if (!data.scheduleOverrides) data.scheduleOverrides = [];
  
  // Clear existing overrides for this date
  data.scheduleOverrides = data.scheduleOverrides.filter(o => o.date !== dateStr);
  
  let currentStart = timeToMin(scheds[0].startTime);
  
  for (const s of scheds) {
    const originalDur = s.duration || 45;
    const newDur = Math.round(originalDur / 2);
    
    data.scheduleOverrides.push({
      date: dateStr,
      scheduleId: s.id,
      startTime: minToTime(currentStart),
      durationOverride: newDur
    });
    currentStart += newDur;
  }
  saveData(data);
}

export function applyEarlyDismissal(dateStr: string, skipAfterTime: string) {
  const data = getData();
  const dayOfWeek = new Date(dateStr).getDay();
  const limitMin = timeToMin(skipAfterTime);
  
  const scheds = data.schedules.filter(s => s.days.includes(dayOfWeek));
  if (!data.scheduleOverrides) data.scheduleOverrides = [];
  
  let count = 0;
  for (const s of scheds) {
    const override = data.scheduleOverrides.find(o => o.scheduleId === s.id && o.date === dateStr);
    const effectiveStartMin = timeToMin(override ? override.startTime : s.startTime);
    
    if (effectiveStartMin >= limitMin) {
      if (override) {
        override.skipped = true;
      } else {
        data.scheduleOverrides.push({
          date: dateStr,
          scheduleId: s.id,
          startTime: s.startTime,
          skipped: true
        });
      }
      count++;
    }
  }
  saveData(data);
  return count;
}

function getFutureDate(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function getYesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }

export function loadDemo() {
  const currentName = getData().teacherName || '';
  saveData({
    teacherName: currentName,
    classes: [{ id: 'c1', name: '10A', color: 'blue' }, { id: 'c2', name: '10B', color: 'green' }, { id: 'c3', name: '11 IPA', color: 'purple' }],
    subjects: [{ id: 's1', name: 'Matematika', examDate: getFutureDate(45) }, { id: 's2', name: 'Fisika', examDate: getFutureDate(30) }],
    materials: [
      // Matematika — kelas 10A punya materi sendiri
      { id: 'm1', subjectId: 's1', classId: 'c1', name: 'Bab 1 — Persamaan Linear', order: 1, sessions: 1 },
      { id: 'm2', subjectId: 's1', classId: 'c1', name: 'Bab 2 — Sistem Persamaan', order: 2, sessions: 2 },
      { id: 'm3', subjectId: 's1', classId: 'c1', name: 'Bab 3 — Fungsi Kuadrat', order: 3, sessions: 2 },
      // Matematika — kelas 10B punya materi sendiri (progress berbeda)
      { id: 'm9', subjectId: 's1', classId: 'c2', name: 'Bab 1 — Persamaan Linear', order: 1, sessions: 1 },
      { id: 'm10', subjectId: 's1', classId: 'c2', name: 'Bab 2 — Sistem Persamaan', order: 2, sessions: 2 },
      { id: 'm11', subjectId: 's1', classId: 'c2', name: 'Bab 3 — Pertidaksamaan', order: 3, sessions: 1 },
      { id: 'm12', subjectId: 's1', classId: 'c2', name: 'Bab 4 — Trigonometri', order: 4, sessions: 3 },
      // Fisika — kelas 11 IPA & 10A berbagi subjectId tapi materi terpisah
      { id: 'm6', subjectId: 's2', classId: 'c3', name: 'Bab 1 — Gerak Lurus', order: 1, sessions: 1 },
      { id: 'm7', subjectId: 's2', classId: 'c3', name: 'Bab 2 — Gerak Melingkar', order: 2, sessions: 2 },
      { id: 'm8', subjectId: 's2', classId: 'c3', name: 'Bab 3 — Hukum Newton', order: 3, sessions: 2 },
      { id: 'm13', subjectId: 's2', classId: 'c1', name: 'Bab 1 — Gerak Lurus', order: 1, sessions: 1 },
      { id: 'm14', subjectId: 's2', classId: 'c1', name: 'Bab 2 — Dinamika', order: 2, sessions: 2 },
    ],
    schedules: [
      { id: 'sc1', classId: 'c1', subjectId: 's1', days: [1, 3], startTime: '08:00', duration: 45 },
      { id: 'sc2', classId: 'c2', subjectId: 's1', days: [1, 4], startTime: '10:00', duration: 45 },
      { id: 'sc3', classId: 'c3', subjectId: 's2', days: [2, 5], startTime: '09:00', duration: 45 },
      { id: 'sc4', classId: 'c1', subjectId: 's2', days: [2], startTime: '11:00', duration: 45 },
    ],
    progress: [
      { id: 'p1', classId: 'c1', subjectId: 's1', materialsDone: 2, lastSession: getYesterdayStr() },
      { id: 'p2', classId: 'c2', subjectId: 's1', materialsDone: 1, lastSession: getYesterdayStr() },
      { id: 'p3', classId: 'c3', subjectId: 's2', materialsDone: 2, lastSession: getYesterdayStr() },
      { id: 'p4', classId: 'c1', subjectId: 's2', materialsDone: 1, lastSession: getYesterdayStr() },
    ],
    sessions: [], tasks: [], notes: [], lastBackup: null, reminderDismissed: null, holidays: [], scheduleOverrides: [],
  });
}

export function exportJSON() {
  const data = getData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `edutrack_backup_${now().toISOString().slice(0, 10)}.json`; a.click();
  URL.revokeObjectURL(url);
  markBackupDone();
}

export function exportCSV() {
  const data = getData();
  let csv = 'Tanggal,Kelas,Mapel,Materi\n';
  data.sessions.forEach(s => {
    const cls = data.classes.find(c => c.id === s.classId) || { name: '?' };
    const sub = data.subjects.find(x => x.id === s.subjectId) || { name: '?' };
    const mat = data.materials.find(m => m.id === s.materialId) || { name: s.materialId === 'SKIPPED' ? '(Dilewati)' : '—' };
    csv += `${s.date},"${cls.name}","${sub.name}","${mat.name}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `edutrack_sessions_${now().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const d = JSON.parse(e.target?.result as string);
        saveData(d);
        resolve();
      } catch { reject(new Error('File tidak valid')); }
    };
    reader.readAsText(file);
  });
}

// v5 New helpers
export function updateClass(id: string, name: string) {
  updateData(d => { const c = d.classes.find(x => x.id === id); if (c) c.name = name.trim(); });
}
export function updateSubject(id: string, name: string, level: string, examDate: string) {
  updateData(d => { const s = d.subjects.find(x => x.id === id); if (s) { s.name = name.trim(); s.level = level || ''; s.examDate = examDate || null; } });
}
export function bulkUpdateExamDateByLevel(level: string, examDate: string) {
  updateData(d => {
    d.subjects.forEach(s => {
      if (s.level === level) s.examDate = examDate || null;
    });
  });
}
export function updateMaterial(id: string, name: string, sessions?: number) {
  updateData(d => { const m = d.materials.find(x => x.id === id); if (m) { m.name = name.trim(); if (sessions !== undefined) m.sessions = sessions; } });
}
export function updateSchedule(id: string, days: number[], startTime: string, duration: number) {
  updateData(d => { const s = d.schedules.find(x => x.id === id); if (s) { s.days = [...days]; s.startTime = startTime; s.duration = duration; }});
}
export function reorderMaterials(subjectId: string, orderedIds: string[], classId?: string) {
  updateData(d => {
    orderedIds.forEach((id, i) => {
      const m = d.materials.find(x => x.id === id);
      if (m && m.subjectId === subjectId && (classId ? m.classId === classId : !m.classId)) m.order = i + 1;
    });
  });
}
export function bulkAddMaterials(subjectId: string, names: string[], sessions = 1, classId?: string) {
  updateData(d => {
    let maxOrder = Math.max(0, ...d.materials.filter(m => m.subjectId === subjectId && (classId ? m.classId === classId : !m.classId)).map(m => m.order));
    names.forEach(name => {
      if (name.trim()) d.materials.push({ id: genId(), subjectId, classId, name: name.trim(), order: ++maxOrder, sessions });
    });
  });
}
export function getSessionHistory(monthPrefix: string) { // YYYY-MM
  const data = getData();
  return data.sessions
    .filter(s => s.date.startsWith(monthPrefix))
    .sort((a, b) => b.date.localeCompare(a.date) || b.completedAt.localeCompare(a.completedAt));
}
export function getExamCountdowns() {
  const data = getData();
  const res: { subject: string; daysLeft: number }[] = [];
  data.subjects.forEach(sub => {
    if (sub.examDate) {
      const ms = new Date(sub.examDate).getTime() - now().getTime();
      const days = Math.ceil(ms / 864e5);
      if (days >= 0 && days <= 60) res.push({ subject: sub.name, daysLeft: days });
    }
  });
  return res.sort((a, b) => a.daysLeft - b.daysLeft);
}
export function shouldShowBackupReminder() {
  const data = getData();
  if (data.classes.length === 0) return false;
  const todayStr = now().toISOString().slice(0, 10);
  if (data.reminderDismissed === todayStr) return false;
  if (!data.lastBackup) return true;
  const daysSince = Math.ceil((now().getTime() - new Date(data.lastBackup).getTime()) / 864e5);
  return daysSince >= 7;
}
export function dismissBackupReminder() {
  updateData(d => { d.reminderDismissed = now().toISOString().slice(0, 10); });
}
export function markBackupDone() {
  updateData(d => { d.lastBackup = now().toISOString().slice(0, 10); d.reminderDismissed = null; });
}

// ── Holiday helpers ─────────────────────────────────────────────────────────
export function getHolidays(): (string | { date: string; level?: string })[] {
  return getData().holidays ?? [];
}
export function addHoliday(date: string) {
  updateData(d => {
    if (!d.holidays) d.holidays = [];
    if (!d.holidays.includes(date)) d.holidays.push(date);
    d.holidays.sort();
  });
}
export function removeHoliday(date: string) {
  updateData(d => { if (d.holidays) d.holidays = d.holidays.filter(h => h !== date); });
}
export function getHolidayImpactSummary(): { subjectName: string; className: string; impactCount: number }[] {
  const data = getData();
  const holidays = data.holidays ?? [];
  if (!holidays.length) return [];
  const results: { subjectName: string; className: string; impactCount: number }[] = [];
  data.subjects.forEach(sub => {
    data.classes.forEach(cls => {
      const sched = data.schedules.filter(s => s.classId === cls.id && s.subjectId === sub.id);
      if (!sched.length) return;
      let impact = 0;
      holidays.forEach(h => {
        const dateStr = typeof h === 'string' ? h : h.date;
        const level = typeof h === 'string' ? undefined : h.level;
        if (level && level !== sub.level) return;
        const dayOfWeek = new Date(dateStr).getDay();
        if (sched.some(s => s.days.includes(dayOfWeek))) impact++;
      });
      if (impact > 0) results.push({ subjectName: sub.name, className: cls.name, impactCount: impact });
    });
  });
  return results;
}

// ── Task helpers ────────────────────────────────────────────────────────────
export function getTasks() { return getData().tasks ?? []; }
export function addTask(classId: string, subjectId: string, title: string, deadline: string) {
  updateData(d => {
    if (!d.tasks) d.tasks = [];
    d.tasks.push({ id: genId(), classId, subjectId, title, deadline, status: 'pending' });
  });
}
export function toggleTask(id: string) {
  updateData(d => { const t = d.tasks?.find(x => x.id === id); if (t) t.status = t.status === 'pending' ? 'done' : 'pending'; });
}
export function deleteTask(id: string) {
  updateData(d => { if (d.tasks) d.tasks = d.tasks.filter(x => x.id !== id); });
}

// ── Session Journaling ──────────────────────────────────────────────────────
export function updateSessionNote(sessionId: string, note: string) {
  updateData(d => { const s = d.sessions.find(x => x.id === sessionId); if (s) s.note = note.trim(); });
}

export function applyTeacherLeave(dateStr: string, reason: string, resolutions: { scheduleId: string; action: 'deliver' | 'skip'; note?: string }[]) {
  updateData(d => {
    const dayOfWeek = new Date(dateStr).getDay();
    resolutions.forEach(res => {
      const sched = d.schedules.find(s => s.id === res.scheduleId);
      if (!sched || !sched.days.includes(dayOfWeek)) return;
      
      let session = d.sessions.find(s => s.scheduleId === res.scheduleId && s.date === dateStr);
      if (session) return; // Don't override existing session

      const prog = d.progress.find(p => p.classId === sched.classId && p.subjectId === sched.subjectId);
      const mats = getMaterials(sched.subjectId, sched.classId);
      const mat = mats[prog ? prog.materialsDone : 0] || null;

      session = {
        id: genId(),
        scheduleId: res.scheduleId,
        classId: sched.classId,
        subjectId: sched.subjectId,
        date: dateStr,
        materialId: res.action === 'skip' ? 'SKIPPED' : (mat?.id || null),
        completedAt: now().toISOString(),
        note: res.note || `Otomatis: Izin/Sakit (${reason})`
      };
      d.sessions.push(session);

      if (res.action === 'deliver') {
        if (prog && mat) {
          prog.materialsDone = Math.min(prog.materialsDone + 1, mats.length);
          prog.lastSession = dateStr;
        } else if (!prog) {
          d.progress.push({
            id: genId(),
            classId: sched.classId,
            subjectId: sched.subjectId,
            materialsDone: mat ? 1 : 0,
            lastSession: dateStr
          });
        }
      }
    });
  });
}


// ── Storage optimisation ─────────────────────────────────────────────────────
const SESSION_KEEP_DAYS = 90;

/** Hapus session > 90 hari, panggil saat startup & setelah saveData besar */
export function pruneOldSessions() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SESSION_KEEP_DAYS);
  const cutStr = cutoff.toISOString().slice(0, 10);
  updateData(d => {
    const before = d.sessions.length;
    d.sessions = d.sessions.filter(s => s.date >= cutStr);
    // Juga hapus task done yang sudah > 30 hari lewat deadline
    const taskCutoff = new Date();
    taskCutoff.setDate(taskCutoff.getDate() - 30);
    const taskCutStr = taskCutoff.toISOString().slice(0, 10);
    d.tasks = (d.tasks ?? []).filter(t => !(t.status === 'done' && t.deadline < taskCutStr));
  });
}

/** Estimasi ukuran localStorage untuk key ini (bytes) */
export function estimateStorageSize(): { used: number; total: number; pct: number } {
  try {
    let used = 0;
    for (const key of Object.keys(localStorage)) {
      used += (localStorage.getItem(key) ?? '').length * 2; // UTF-16
    }
    const total = 5 * 1024 * 1024; // 5MB typical
    return { used, total, pct: Math.round((used / total) * 100) };
  } catch { return { used: 0, total: 5242880, pct: 0 }; }
}
