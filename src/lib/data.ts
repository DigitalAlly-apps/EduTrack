import { AppData, TodayScheduleItem, Insight, SubjectStatus, Subject, ClassItem, PaceSuggestion, RescheduleAction, Schedule, Material, HeatmapRow, HeatmapCell, ExamPrepItem, PredictiveFinish } from './types';

const DB_KEY = 'pengajar_v4';
const CORR_KEY = 'edutrack_corrections';

const DEFAULT_DATA: AppData = {
  teacherName: '', classes: [], subjects: [], materials: [], schedules: [],
  progress: [], sessions: [], tasks: [], notes: [], lastBackup: null, reminderDismissed: null, holidays: [], scheduleOverrides: [],
  academicYear: '',
};

export function getData(): AppData {
  try {
    const raw = localStorage.getItem(DB_KEY) || localStorage.getItem('pengajar_v3') || localStorage.getItem('pengajar_v2');
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return structuredClone(DEFAULT_DATA);
    // Deep merge: pastikan semua array field tidak null/undefined agar tidak crash
    const merged = { ...structuredClone(DEFAULT_DATA), ...parsed };
    const arrayFields = ['classes','subjects','materials','schedules','progress','sessions','tasks','notes','holidays','scheduleOverrides'] as const;
    for (const f of arrayFields) {
      if (!Array.isArray(merged[f])) merged[f] = [] as any;
    }
    return merged;
  } catch { return structuredClone(DEFAULT_DATA); }
}

export function saveData(d: AppData) { localStorage.setItem(DB_KEY, JSON.stringify(d)); }

export function updateData(fn: (d: AppData) => void): AppData {
  const d = getData(); fn(d); saveData(d); return d;
}

export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function getMaterialsFromData(data: AppData, subjectId: string, classId: string): import('./types').Material[] {
  const cls = data.classes.find(c => c.id === classId);

  const byClass = data.materials.filter(m => m.subjectId === subjectId && m.classId === classId);
  if (byClass.length > 0) return byClass.sort((a, b) => a.order - b.order);

  if (cls?.level) {
    const byLevel = data.materials.filter(m => m.subjectId === subjectId && m.level === cls.level && !m.classId);
    if (byLevel.length > 0) return byLevel.sort((a, b) => a.order - b.order);
  }

  const legacy = data.materials.filter(m => m.subjectId === subjectId && !m.level && !m.classId);
  if (legacy.length > 0) return legacy.sort((a, b) => a.order - b.order);

  return [];
}

/**
 * Ambil materi untuk kombinasi mapel + rombel, dengan hierarki fallback:
 * 1. Materi override khusus rombel ini (classId match)
 * 2. Materi shared untuk level/tingkatan rombel ini (level match)
 * 3. Materi lama tanpa level/classId (backward-compat)
 * Materi class-specific milik kelas lain tidak pernah dipakai sebagai fallback.
 */
export function getMaterials(subjectId: string, classId: string): import('./types').Material[] {
  const data = getData();
  return getMaterialsFromData(data, subjectId, classId);
}

// Time utils
export const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function now() { return new Date(); }
export function dateKey(date = now()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
export function dateFromKey(value: string) { return new Date(`${value}T12:00:00`); }
export function daysUntilDateKey(value: string) { return Math.ceil((dateFromKey(value).getTime() - now().getTime()) / 864e5); }
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
    const dateStr = dateKey(date);
    
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

// Helper to calculate total sessions needed across a list of materials
export function getTotalSessionsNeeded(mats: import('./types').Material[]): number {
  return mats.reduce((sum, m) => sum + (m.sessions ?? 1), 0);
}

// Helper to find which material and which session count we are on
function getMaterialForSession(mats: import('./types').Material[], sessionsDone: number) {
  let currentSess = 0;
  for (const m of mats) {
    const sessions = m.sessions ?? 1;
    if (sessionsDone < currentSess + sessions) {
      return { material: m, sessionIndex: sessionsDone - currentSess + 1, totalSessionsInMat: sessions };
    }
    currentSess += sessions;
  }
  return { material: null, sessionIndex: 0, totalSessionsInMat: 0 };
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
  const todayStr = dateKey();
  const holidays = data.holidays || [];
  return holidays.some(h => (typeof h === 'string' ? h === todayStr : (h.date === todayStr && !h.level)));
}

export function getTodaySchedules(): TodayScheduleItem[] {
  const data = getData();
  const today = todayNum();
  const todayStr = dateKey();

  const buildItem = (s: Schedule, override?: NonNullable<AppData['scheduleOverrides']>[number]): TodayScheduleItem | null => {
    const cls = data.classes.find(c => c.id === s.classId) || { name: '?' };
    const sub = data.subjects.find(x => x.id === s.subjectId) || { name: '?' };
    const prog = data.progress.find(p => p.classId === s.classId && p.subjectId === s.subjectId) || { materialsDone: 0 };
    const mats = getMaterialsFromData(data, s.subjectId, s.classId);
    const { material } = getMaterialForSession(mats, prog.materialsDone);

    const session = data.sessions.find(se => se.scheduleId === s.id && se.date === todayStr);
    const done = !!session;
    if (override?.skipped) return null;

    const effectiveStartTime = override ? override.startTime : s.startTime;
    const effectiveDuration = override?.durationOverride ?? (s.duration || 45);

    const endMin = timeToMin(effectiveStartTime) + effectiveDuration;
    const curMin = currentMin();
    const active = curMin >= timeToMin(effectiveStartTime) && curMin < endMin && !done;

    return {
      ...s,
      duration: effectiveDuration,
      startTime: effectiveStartTime,
      className: cls.name,
      subjectName: sub.name,
      nextMat: material,
      done,
      active,
      endTime: minToTime(endMin),
      totalMats: getTotalSessionsNeeded(mats),
      materialsDone: prog.materialsDone,
      sessionId: session?.id,
      note: session?.note,
      skipped: session?.materialId === 'SKIPPED'
    };
  };

  const regularItems = data.schedules
    .filter(s => {
      if (!s.days.includes(today)) return false;
      const sub = data.subjects.find(x => x.id === s.subjectId);
      if (isDateHolidayForSubject(todayStr, sub?.level)) return false;
      return true;
    })
    .map(s => {
      const override = (data.scheduleOverrides || []).find(o => o.scheduleId === s.id && o.date === todayStr);
      return buildItem(s, override);
    })
    .filter(Boolean) as TodayScheduleItem[];

  const extraItems = (data.scheduleOverrides || [])
    .filter(o => o.date === todayStr && o.isExtra && !o.skipped)
    .map(o => {
      const sched = data.schedules.find(s => s.id === o.scheduleId);
      return sched ? buildItem(sched, o) : null;
    })
    .filter(Boolean) as TodayScheduleItem[];

  return [...regularItems, ...extraItems]
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
      const sched = data.schedules.filter(s => s.classId === cls.id && s.subjectId === sub.id);
      if (sched.length === 0) return;

      const prog = data.progress.find(p => p.classId === cls.id && p.subjectId === sub.id) || { materialsDone: 0 };
      const totalSess = getTotalSessionsNeeded(mats);
      const remainingSess = totalSess - prog.materialsDone;
      if (remainingSess <= 0) return;
      
      if (sub.examDate) {
        const daysLeft = daysUntilDateKey(sub.examDate);
        const { sessLeft, holidaysInPeriod } = estimateEffectiveSessions(sched, daysLeft, holidays, sub.level);
        
        if (sessLeft > 0 && remainingSess > sessLeft + 1) {
          const extra = remainingSess - sessLeft;
          if (!seen.has(key)) {
            out.push({
              type: 'warn',
              directive: 'Perlu diperhatikan',
              text: `<strong>${cls.name}</strong> butuh ${remainingSess} sesi di ${sub.name}, tapi hanya ${sessLeft} tersedia${holidaysInPeriod > 0 ? ` (${holidaysInPeriod} libur). ⚡ <b>Saran:</b> Jadwalkan ${extra} kelas pengganti / ekstra jam` : `. Kurangi ${extra} sesi atau tambah jadwal`}.`,
            });
            seen.add(key);
          }
        } else if (sessLeft > 0 && remainingSess <= sessLeft) {
          const { material } = getMaterialForSession(mats, prog.materialsDone);
          if (!seen.has(key)) {
            out.push({
              type: 'tip',
              directive: 'Disarankan hari ini',
              text: `Fokus pada <strong>${material ? material.name : sub.name}</strong>${material?.sessions && material.sessions > 1 ? ` (${material.sessions} pertemuan)` : ''} untuk kelas <strong>${cls.name}</strong>.`,
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
  
  const totalSessions = getTotalSessionsNeeded(mats);
  const doneSessions = prog.materialsDone;
  const remainingSessions = totalSessions - doneSessions;
  const pct = Math.round((doneSessions / totalSessions) * 100);

  let status: 'on-track' | 'tight' | 'behind' = 'on-track', label = 'Sesuai jadwal', rec = 'Lanjutkan seperti biasa.';
  const nextSched = getNextScheduleForClass(cls.id, sub.id);
  const holidays = data.holidays ?? [];
  if (sub.examDate) {
    const daysLeft = daysUntilDateKey(sub.examDate);
    const sched = data.schedules.filter(s => s.classId === cls.id && s.subjectId === sub.id);
    const { sessLeft, holidaysInPeriod } = estimateEffectiveSessions(sched, daysLeft, holidays, sub.level);
    if (remainingSessions <= 0) {
      status = 'on-track'; label = 'Selesai ✓'; rec = 'Semua materi sudah selesai!';
    } else if (sessLeft === 0) {
      status = 'behind'; label = 'Perlu perhatian';
      rec = holidaysInPeriod > 0
        ? `Tidak ada sesi tersisa (${holidaysInPeriod} hari libur memangkas jadwal).`
        : 'Belum ada sesi terjadwal tersisa.';
    } else if (remainingSessions > sessLeft + 2) {
      status = 'behind'; label = 'Perlu percepatan';
      const ratio = (remainingSessions / sessLeft).toFixed(1);
      rec = `Butuh ${remainingSessions} sesi, tersedia ${sessLeft}${holidaysInPeriod > 0 ? ` (−${holidaysInPeriod} libur)` : ''}. Ideal: ${ratio}× per sesi.`;
    } else if (remainingSessions > sessLeft) {
      status = 'tight'; label = 'Mepet target';
      rec = `Butuh ${remainingSessions} sesi, tersedia ${sessLeft}${holidaysInPeriod > 0 ? ` (−${holidaysInPeriod} libur)` : ''}. Jaga ritme.`;
    } else {
      status = 'on-track'; label = 'Sesuai jadwal';
      rec = remainingSessions === sessLeft
        ? `Pas — ${sessLeft} sesi tersisa untuk ${remainingSessions} sesi materi. Jangan ada yang terlewat!`
        : 'Pertahankan ritme ini.';
    }
    return { status, label, pct, done: doneSessions, total: totalSessions, remaining: remainingSessions, sessLeft, sessionsNeeded: remainingSessions, holidaysInPeriod, rec, daysLeft, nextSched };
  }
  return { status, label, pct, done: doneSessions, total: totalSessions, remaining: remainingSessions, sessLeft: 0, sessionsNeeded: remainingSessions, holidaysInPeriod: 0, rec, nextSched };
}

export function markDone(scheduleId: string, note?: string) {
  const data = getData();
  const sched = data.schedules.find(s => s.id === scheduleId);
  if (!sched) return;
  const todayStr = dateKey();
  if (data.sessions.some(s => s.scheduleId === scheduleId && s.date === todayStr)) return;
  
  const prog = data.progress.find(p => p.classId === sched.classId && p.subjectId === sched.subjectId);
  const mats = getMaterials(sched.subjectId, sched.classId);
  const { material } = getMaterialForSession(mats, prog ? prog.materialsDone : 0);
  
  data.sessions.push({ id: genId(), scheduleId, classId: sched.classId, subjectId: sched.subjectId, date: todayStr, materialId: material?.id || null, completedAt: now().toISOString(), note });
  
  if (prog) { 
    prog.materialsDone = Math.min(prog.materialsDone + 1, getTotalSessionsNeeded(mats));
    prog.lastSession = todayStr; 
  } else {
    data.progress.push({ id: genId(), classId: sched.classId, subjectId: sched.subjectId, materialsDone: 1, lastSession: todayStr });
  }
  saveData(data);
}

export function skipSession(scheduleId: string) {
  const data = getData();
  const sched = data.schedules.find(s => s.id === scheduleId);
  if (!sched) return;
  const todayStr = dateKey();
  if (data.sessions.some(s => s.scheduleId === scheduleId && s.date === todayStr)) return;
  data.sessions.push({ id: genId(), scheduleId, classId: sched.classId, subjectId: sched.subjectId, date: todayStr, materialId: 'SKIPPED', completedAt: now().toISOString() });
  saveData(data);
}

/** Undo/koreksi: hapus sesi terakhir (non-skipped) dan turunkan materialsDone 1 */
export function undoLastSession(classId: string, subjectId: string): boolean {
  const data = getData();
  // Cari sesi terakhir yang bukan SKIPPED
  const lastSess = data.sessions
    .filter(s => s.classId === classId && s.subjectId === subjectId && s.materialId !== 'SKIPPED')
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  if (!lastSess) return false;
  data.sessions = data.sessions.filter(s => s.id !== lastSess.id);
  const prog = data.progress.find(p => p.classId === classId && p.subjectId === subjectId);
  if (prog && prog.materialsDone > 0) prog.materialsDone--;
  saveData(data);
  return true;
}

export function postponeSchedule(scheduleId: string, diffMinutes: number) {
  const data = getData();
  const todayStr = dateKey();
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
  const dayOfWeek = dateFromKey(dateStr).getDay();
  
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
  const dayOfWeek = dateFromKey(dateStr).getDay();
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

function getFutureDate(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return dateKey(d); }
function getYesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d); }

export function loadDemo() {
  const currentName = getData().teacherName || '';
  const currentYear = getData().academicYear || '';
  saveData({
    teacherName: currentName,
    academicYear: currentYear,
    classes: [{ id: 'c1', name: '10A', color: 'blue', level: '10' }, { id: 'c2', name: '10B', color: 'green', level: '10' }, { id: 'c3', name: '11 IPA', color: 'purple', level: '11' }],
    subjects: [{ id: 's1', name: 'Matematika', examDate: getFutureDate(45) }, { id: 's2', name: 'Fisika', examDate: getFutureDate(30) }],
    materials: [
      // Matematika level 10 — shared untuk 10A dan 10B
      { id: 'm1', subjectId: 's1', level: '10', name: 'Bab 1 — Persamaan Linear', order: 1, sessions: 1 },
      { id: 'm2', subjectId: 's1', level: '10', name: 'Bab 2 — Sistem Persamaan', order: 2, sessions: 2 },
      { id: 'm3', subjectId: 's1', level: '10', name: 'Bab 3 — Fungsi Kuadrat', order: 3, sessions: 2 },
      { id: 'm4', subjectId: 's1', level: '10', name: 'Bab 4 — Pertidaksamaan', order: 4, sessions: 1 },
      { id: 'm5', subjectId: 's1', level: '10', name: 'Bab 5 — Trigonometri', order: 5, sessions: 3 },
      // Fisika level 11
      { id: 'm6', subjectId: 's2', level: '11', name: 'Bab 1 — Gerak Lurus', order: 1, sessions: 1 },
      { id: 'm7', subjectId: 's2', level: '11', name: 'Bab 2 — Gerak Melingkar', order: 2, sessions: 2 },
      { id: 'm8', subjectId: 's2', level: '11', name: 'Bab 3 — Hukum Newton', order: 3, sessions: 2 },
      // Fisika level 10 — materi berbeda dari level 11
      { id: 'm9', subjectId: 's2', level: '10', name: 'Bab 1 — Besaran & Satuan', order: 1, sessions: 1 },
      { id: 'm10', subjectId: 's2', level: '10', name: 'Bab 2 — Gerak Lurus', order: 2, sessions: 2 },
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
  try {
    const data = getData();
    let corrections: unknown[] = [];
    try {
      const parsedCorrections = JSON.parse(localStorage.getItem(CORR_KEY) || '[]');
      if (Array.isArray(parsedCorrections)) corrections = parsedCorrections;
    } catch {
      corrections = [];
    }
    const backup = { ...data, corrections };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `edutrack_backup_${dateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    markBackupDone();
  } catch (err) {
    console.error('[Backup] Export failed:', err);
  }
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
  a.href = url; a.download = `edutrack_sessions_${dateKey()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        if (typeof raw !== 'object' || raw === null) throw new Error('Format tidak valid');
        // Safe merge: pastikan semua field DEFAULT_DATA ada, tidak crash meski backup lama
        const merged: AppData = {
          ...structuredClone(DEFAULT_DATA),
          ...raw,
          // Pastikan array-array tidak null/undefined
          classes: Array.isArray(raw.classes) ? raw.classes : [],
          subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
          materials: Array.isArray(raw.materials) ? raw.materials : [],
          schedules: Array.isArray(raw.schedules) ? raw.schedules : [],
          progress: Array.isArray(raw.progress) ? raw.progress : [],
          sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
          tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
          notes: Array.isArray(raw.notes) ? raw.notes : [],
          holidays: Array.isArray(raw.holidays) ? raw.holidays : [],
          scheduleOverrides: Array.isArray(raw.scheduleOverrides) ? raw.scheduleOverrides : [],
        };
        saveData(merged);
        const corrections = Array.isArray(raw.corrections)
          ? raw.corrections
          : Array.isArray(raw.examCorrections)
            ? raw.examCorrections
            : null;
        if (corrections) {
          localStorage.setItem(CORR_KEY, JSON.stringify(corrections));
        }
        resolve();
      } catch (err) {
        reject(new Error('File tidak valid atau rusak'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file);
  });
}

// v5 New helpers
export function updateClass(id: string, name: string) {
  updateData(d => { const c = d.classes.find(x => x.id === id); if (c) c.name = name.trim(); });
}
export function setAcademicYear(year: string) {
  updateData(d => { d.academicYear = year.trim(); });
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
export function reorderMaterials(subjectId: string, orderedIds: string[], level?: string, classId?: string) {
  updateData(d => {
    orderedIds.forEach((id, i) => {
      const m = d.materials.find(x => x.id === id);
      if (m && m.subjectId === subjectId &&
          (classId ? m.classId === classId : m.classId === undefined) &&
          (level ? m.level === level : m.level === undefined)) {
        m.order = i + 1;
      }
    });
  });
}
export function bulkAddMaterials(subjectId: string, names: string[], sessions = 1, level?: string, classId?: string) {
  updateData(d => {
    // Hitung maxOrder hanya untuk scope yang sama (level atau classId)
    const scopedMats = d.materials.filter(m =>
      m.subjectId === subjectId &&
      (classId ? m.classId === classId : m.classId === undefined) &&
      (level ? m.level === level : m.level === undefined)
    );
    let maxOrder = Math.max(0, ...scopedMats.map(m => m.order));
    names.forEach(name => {
      if (name.trim()) d.materials.push({ id: genId(), subjectId, level, classId, name: name.trim(), order: ++maxOrder, sessions });
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
      const days = daysUntilDateKey(sub.examDate);
      if (days >= 0 && days <= 60) res.push({ subject: sub.name, daysLeft: days });
    }
  });
  return res.sort((a, b) => a.daysLeft - b.daysLeft);
}
export function shouldShowBackupReminder() {
  const data = getData();
  if (data.classes.length === 0) return false;
  const todayStr = dateKey();
  if (data.reminderDismissed === todayStr) return false;
  if (!data.lastBackup) return true;
  const daysSince = Math.ceil((now().getTime() - new Date(data.lastBackup).getTime()) / 864e5);
  return daysSince >= 7;
}
export function dismissBackupReminder() {
  updateData(d => { d.reminderDismissed = dateKey(); });
}
export function markBackupDone() {
  updateData(d => { d.lastBackup = dateKey(); d.reminderDismissed = null; });
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
        const dayOfWeek = dateFromKey(dateStr).getDay();
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
    const dayOfWeek = dateFromKey(dateStr).getDay();
    resolutions.forEach(res => {
      const sched = d.schedules.find(s => s.id === res.scheduleId);
      if (!sched || !sched.days.includes(dayOfWeek)) return;
      
      let session = d.sessions.find(s => s.scheduleId === res.scheduleId && s.date === dateStr);
      if (session) return; // Don't override existing session

      const prog = d.progress.find(p => p.classId === sched.classId && p.subjectId === sched.subjectId);
      const mats = getMaterialsFromData(d, sched.subjectId, sched.classId);
      const { material: mat } = getMaterialForSession(mats, prog ? prog.materialsDone : 0);
      const totalSessions = getTotalSessionsNeeded(mats);

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
          prog.materialsDone = Math.min(prog.materialsDone + 1, totalSessions);
          prog.lastSession = dateStr;
        } else if (!prog) {
          d.progress.push({
            id: genId(),
            classId: sched.classId,
            subjectId: sched.subjectId,
            materialsDone: mat ? Math.min(1, totalSessions) : 0,
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
  const cutStr = dateKey(cutoff);
  updateData(d => {
    const before = d.sessions.length;
    d.sessions = d.sessions.filter(s => s.date >= cutStr);
    // Juga hapus task done yang sudah > 30 hari lewat deadline
    const taskCutoff = new Date();
    taskCutoff.setDate(taskCutoff.getDate() - 30);
    const taskCutStr = dateKey(taskCutoff);
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
    return { used, total, pct: Math.round(used / total * 100) };
  } catch { 
    return { used: 0, total: 5242880, pct: 0 }; 
  }
}

// ── Killer Features ──────────────────────────────────────────────────────────

export function getTeacherStreak(): number {
  const data = getData();
  if (data.schedules.length === 0) return 0;
  
  let streak = 0;
  const holidays = data.holidays ?? [];
  const baseDate = new Date();
  
  // Check up to 365 days back
  for (let i = 0; i < 365; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    const dateStr = dateKey(d);
    const dayOfWeek = d.getDay();
    
    // Check if this day is a holiday
    const isHoliday = holidays.some(h => typeof h === 'string' ? h === dateStr : (h.date === dateStr && !h.level));
    
    // Find all schedules for this day
    const scheds = data.schedules.filter(s => {
      if (!s.days.includes(dayOfWeek)) return false;
      const sub = data.subjects.find(x => x.id === s.subjectId);
      if (isDateHolidayForSubject(dateStr, sub?.level)) return false;
      return true;
    });
    
    if (scheds.length > 0 && !isHoliday) {
      // It was a scheduled workday. Did they complete all sessions?
      const sessionsThatDay = data.sessions.filter(s => s.date === dateStr);
      // Wait, we just check if they did at least 1 session to keep it forgiving
      if (sessionsThatDay.length > 0) {
        streak++;
      } else {
        // If today is not done yet, don't break the streak immediately
        if (i > 0) break; 
      }
    }
  }
  return streak;
}

export function generateDailyJournal(): string {
  const data = getData();
  const todayStr = dateKey();
  const dateFormatted = now().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  const todaySessions = data.sessions.filter(s => s.date === todayStr);
  if (todaySessions.length === 0) return `Jurnal Mengajar - ${dateFormatted}\n\nTidak ada sesi mengajar yang tercatat hari ini.`;
  
  let journal = `*JURNAL MENGAJAR*\n📅 ${dateFormatted}\n👨‍🏫 ${data.teacherName || 'Guru'}\n\n`;
  
  let completed = 0;
  let skipped = 0;
  
  todaySessions.forEach(sess => {
    const cls = data.classes.find(c => c.id === sess.classId)?.name || 'Kelas Terhapus';
    const sub = data.subjects.find(s => s.id === sess.subjectId)?.name || 'Mapel Terhapus';
    
    if (sess.materialId === 'SKIPPED') {
      skipped++;
      journal += `⏩ *${cls} - ${sub}*\nStatus: Dilewati / Kosong\n`;
    } else {
      completed++;
      const mat = data.materials.find(m => m.id === sess.materialId);
      const matName = mat ? mat.name : 'Selesai tanpa materi';
      journal += `✅ *${cls} - ${sub}*\nMateri: ${matName}\n`;
    }
    if (sess.note) {
      journal += `Catatan: ${sess.note}\n`;
    }
    journal += '\n';
  });
  
  journal += `*Ringkasan:* Selesai ${completed} kelas, Dilewati ${skipped} kelas.\n_Dibuat otomatis oleh EduTrack_`;
  return journal;
}

// ── Weekly Review & Calendar ─────────────────────────────────────────────────

export interface WeeklyStats {
  completed: number;
  skipped: number;
  total: number;
  prevCompleted: number;
  materialsCovered: number;
  weekStartStr: string;
  weekEndStr: string;
  uniqueClasses: number;
}

export function getWeeklyStats(): WeeklyStats {
  const data = getData();
  const today = now();
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromMonday);
  const weekStartStr = dateKey(weekStart);
  const weekEndStr = dateKey(today);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(weekStart.getDate() - 1);
  const prevWeekStartStr = dateKey(prevWeekStart);
  const prevWeekEndStr = dateKey(prevWeekEnd);
  const thisWeek = data.sessions.filter(s => s.date >= weekStartStr && s.date <= weekEndStr);
  const prevWeek = data.sessions.filter(s => s.date >= prevWeekStartStr && s.date <= prevWeekEndStr);
  const completed = thisWeek.filter(s => s.materialId !== 'SKIPPED').length;
  const skipped = thisWeek.filter(s => s.materialId === 'SKIPPED').length;
  const prevCompleted = prevWeek.filter(s => s.materialId !== 'SKIPPED').length;
  const materialsCovered = new Set(thisWeek.filter(s => s.materialId && s.materialId !== 'SKIPPED').map(s => s.materialId)).size;
  const uniqueClasses = new Set(thisWeek.map(s => s.classId)).size;
  return { completed, skipped, total: thisWeek.length, prevCompleted, materialsCovered, weekStartStr, weekEndStr, uniqueClasses };
}

export type DayStatus = 'done' | 'partial' | 'missed' | 'holiday' | 'noclass' | 'future';

export function getMonthCalendar(yearMonth: string): { date: string; status: DayStatus; sessionCount: number; schedCount: number }[] {
  const data = getData();
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = dateKey();
  const result: { date: string; status: DayStatus; sessionCount: number; schedCount: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
    if (dateStr > todayStr) { result.push({ date: dateStr, status: 'future', sessionCount: 0, schedCount: 0 }); continue; }
    const dayOfWeek = dateFromKey(dateStr).getDay();
    const isHoliday = (data.holidays ?? []).some(h => typeof h === 'string' ? h === dateStr : (h.date === dateStr && !h.level));
    const scheds = data.schedules.filter(s => {
      if (!s.days.includes(dayOfWeek)) return false;
      const sub = data.subjects.find(x => x.id === s.subjectId);
      return !isDateHolidayForSubject(dateStr, sub?.level);
    });
    if (isHoliday) { result.push({ date: dateStr, status: 'holiday', sessionCount: 0, schedCount: 0 }); continue; }
    if (scheds.length === 0) { result.push({ date: dateStr, status: 'noclass', sessionCount: 0, schedCount: 0 }); continue; }
    const sessions = data.sessions.filter(s => s.date === dateStr);
    const sessionCount = sessions.length;
    const schedCount = scheds.length;
    if (sessionCount === 0) result.push({ date: dateStr, status: 'missed', sessionCount: 0, schedCount });
    else if (sessionCount >= schedCount) result.push({ date: dateStr, status: 'done', sessionCount, schedCount });
    else result.push({ date: dateStr, status: 'partial', sessionCount, schedCount });
  }
   return result;
 }

// ==================== SMART RESCHEDULER ====================

/**
 * Smart reschedule for an entire day — returns AI suggestions for each schedule
 */
export function suggestDayReschedule(dateStr: string): RescheduleAction[] {
  const data = getData();
  const dayOfWeek = dateFromKey(dateStr).getDay();
  const suggestions: RescheduleAction[] = [];

  const daySchedules = data.schedules.filter(s => s.days.includes(dayOfWeek));

  daySchedules.forEach(sched => {
    const cls = data.classes.find(c => c.id === sched.classId);
    const sub = data.subjects.find(su => su.id === sched.subjectId);
    if (!cls || !sub) return;

    // Check exam proximity — don't skip if exam within 7 days
    if (sub.examDate) {
      const daysToExam = Math.ceil((dateFromKey(sub.examDate).getTime() - dateFromKey(dateStr).getTime()) / 864e5);
      if (daysToExam <= 7) {
        suggestions.push({ 
          scheduleId: sched.id, 
          action: 'keep', 
          reason: `Ujian ${sub.name} ${daysToExam} hari lagi`
        });
        return;
      }
    }

    // Check subject status — can't skip if behind/tight
    const status = getSubjectStatus(sub, cls, data);
    if (status.status === 'behind' || status.status === 'tight') {
      suggestions.push({ 
        scheduleId: sched.id, 
        action: 'keep', 
        reason: status.label 
      });
      return;
    }

    // Otherwise safe to postpone
    suggestions.push({ 
      scheduleId: sched.id, 
      action: 'postpone', 
      days: 7, 
      reason: 'Bisa ditunda ke minggu depan'
    });
  });

  return suggestions;
}

/**
 * Apply a batch of reschedule actions for a specific date
 */
export function applySmartReschedule(dateStr: string, actions: RescheduleAction[]) {
  const data = getData();
  if (!data.scheduleOverrides) data.scheduleOverrides = [];

  actions.forEach(action => {
    const sched = data.schedules.find(s => s.id === action.scheduleId);
    if (!sched) return;

    if (action.action === 'skip') {
      const existing = data.scheduleOverrides.find(o => o.scheduleId === action.scheduleId && o.date === dateStr);
      if (existing) {
        existing.skipped = true;
      } else {
        data.scheduleOverrides.push({
          date: dateStr,
          scheduleId: action.scheduleId,
          startTime: sched.startTime,
          skipped: true,
        });
      }

      // Auto-create catch-up task for skipped session
      const cls = data.classes.find(c => c.id === sched.classId);
      const sub = data.subjects.find(su => su.id === sched.subjectId);
      if (cls && sub) {
        const catchUpDate = dateFromKey(dateStr);
        catchUpDate.setDate(catchUpDate.getDate() + 7);
        data.tasks.push({
          id: genId(),
          classId: sched.classId,
          subjectId: sched.subjectId,
          title: `Kejar sesi ${cls.name} – ${sub.name} yang dilewati`,
          deadline: dateKey(catchUpDate),
          status: 'pending'
        });
      }
    }

    if (action.action === 'postpone' && action.days) {
      const existing = data.scheduleOverrides.find(o => o.scheduleId === action.scheduleId && o.date === dateStr);
      if (existing) existing.skipped = true;
      else data.scheduleOverrides.push({ date: dateStr, scheduleId: action.scheduleId, startTime: sched.startTime, skipped: true });

      const target = dateFromKey(dateStr);
      target.setDate(target.getDate() + action.days);
      const targetStr = dateKey(target);
      if (sched.days.includes(target.getDay())) {
        const cls = data.classes.find(c => c.id === sched.classId);
        const sub = data.subjects.find(su => su.id === sched.subjectId);
        data.tasks.push({
          id: genId(),
          classId: sched.classId,
          subjectId: sched.subjectId,
          title: `Lanjutkan sesi tertunda${cls && sub ? `: ${cls.name} – ${sub.name}` : ''}`,
          deadline: targetStr,
          status: 'pending'
        });
        return;
      }
      const existingExtra = data.scheduleOverrides.find(o => o.scheduleId === action.scheduleId && o.date === targetStr && o.isExtra);
      if (existingExtra) {
        existingExtra.startTime = sched.startTime;
        existingExtra.durationOverride = sched.duration;
        existingExtra.skipped = false;
      } else {
        data.scheduleOverrides.push({
          date: targetStr,
          scheduleId: action.scheduleId,
          startTime: sched.startTime,
          durationOverride: sched.duration,
          isExtra: true,
        });
      }
    }

    if (action.action === 'deliver') {
      if (data.sessions.some(s => s.scheduleId === action.scheduleId && s.date === dateStr)) return;
      const prog = data.progress.find(p => p.classId === sched.classId && p.subjectId === sched.subjectId);
      const mats = getMaterialsFromData(data, sched.subjectId, sched.classId);
      const { material } = getMaterialForSession(mats, prog ? prog.materialsDone : 0);
      data.sessions.push({
        id: genId(),
        scheduleId: action.scheduleId,
        classId: sched.classId,
        subjectId: sched.subjectId,
        date: dateStr,
        materialId: material?.id || null,
        completedAt: now().toISOString(),
        note: action.note ? `[Izin] ${action.note}` : '[Izin] Selesai tanpa sesi tatap muka'
      });
      const totalSessions = getTotalSessionsNeeded(mats);
      if (prog) {
        prog.materialsDone = Math.min(prog.materialsDone + 1, totalSessions);
        prog.lastSession = dateStr;
      } else {
        data.progress.push({ id: genId(), classId: sched.classId, subjectId: sched.subjectId, materialsDone: material ? 1 : 0, lastSession: dateStr });
      }
    }

    // 'keep' → do nothing
  });

  saveData(data);
}

// ==================== HEATMAP (FEATURE 4) ====================

/**
 * Get start of week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1); // Monday = 0
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Generate heatmap data for all class+subject combinations
 * Returns rows for the next N weeks (default 8)
 */
export function getHeatmapData(weeks: number = 8): HeatmapRow[] {
  const data = getData();
  const rows: HeatmapRow[] = [];
  const today = now();

  // Build week buckets: weekStart -> { cells_by_class_subject }
  const weekBuckets: Record<string, Record<string, { done: number; scheduled: number }>> = {};

  for (let w = 0; w < weeks; w++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + (w * 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = dateKey(weekStart);
    weekBuckets[weekKey] = {};
  }

  // Iterate all class+subject schedules
  data.classes.forEach(cls => {
    data.subjects.forEach(sub => {
      const scheds = data.schedules.filter(s => s.classId === cls.id && s.subjectId === sub.id);
      if (scheds.length === 0) return;

      // Create row
      const row: HeatmapRow = {
        className: cls.name,
        subjectName: sub.name,
        classId: cls.id,
        subjectId: sub.id,
        cells: []
      };

      // Build week-by-week stats
      for (let w = 0; w < weeks; w++) {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + (w * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const weekKey = dateKey(weekStart);
        const bucket = weekBuckets[weekKey]![`${cls.id}-${sub.id}`] = { done: 0, scheduled: 0 };

        // Count scheduled sessions in this week
        for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = dateKey(d);
          const dayOfWeek = d.getDay();

          scheds.forEach(s => {
            if (!s.days.includes(dayOfWeek)) return;
            // Check holiday
            const subLevel = data.subjects.find(su => su.id === s.subjectId)?.level;
            if (isDateHolidayForSubject(dateStr, subLevel)) return;
            bucket.scheduled++;
          });
        }

        // Count completed sessions in this week
        data.sessions.forEach(sess => {
          if (sess.classId !== cls.id || sess.subjectId !== sub.id) return;
          const sessDate = dateFromKey(sess.date);
          if (sessDate >= weekStart && sessDate <= weekEnd && sess.materialId !== 'SKIPPED') {
            bucket.done++;
          }
        });
      }

      // Build cells array
      for (let w = 0; w < weeks; w++) {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + (w * 7));
        const weekKey = dateKey(weekStart);
        const bucket = weekBuckets[weekKey]![`${cls.id}-${sub.id}`] || { done: 0, scheduled: 0 };

        let status: HeatmapCell['status'] = 'no-data';
        if (bucket.scheduled === 0) {
          status = 'no-class';
        } else if (bucket.done >= bucket.scheduled) {
          status = 'on-track';
        } else if (bucket.done === 0 && bucket.scheduled > 0) {
          status = 'behind';
        } else if (bucket.done < bucket.scheduled) {
          status = 'tight';
        }

        row.cells.push({
          weekStart: weekKey,
          weekLabel: `Minggu ${w + 1}`,
          status,
          sessionsDone: bucket.done,
          sessionsScheduled: bucket.scheduled,
        });
      }

      rows.push(row);
    });
  });

  return rows;
}

// ==================== PREDICTIVE FINISH DATE (FEATURE 5) ====================

/**
 * Calculate predicted finish date for each class+subject based on current pace
 */
export function getPredictiveFinishes(): PredictiveFinish[] {
  const data = getData();
  const results: PredictiveFinish[] = [];

  data.subjects.forEach(sub => {
    if (!sub.examDate) return; // Only subjects with exam date

    data.classes.forEach(cls => {
      const scheds = data.schedules.filter(s => s.classId === cls.id && s.subjectId === sub.id);
      if (scheds.length === 0) return;

      const mats = getMaterials(sub.id, cls.id);
      if (!mats.length) return;

      const prog = data.progress.find(p => p.classId === cls.id && p.subjectId === sub.id) || { materialsDone: 0 };
      const totalSessNeeded = getTotalSessionsNeeded(mats);
      const remainingSess = totalSessNeeded - prog.materialsDone;

      // Calculate current weekly pace from last 4 weeks of actual sessions
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const recentSessions = data.sessions.filter(s =>
        s.classId === cls.id && s.subjectId === sub.id &&
        new Date(s.date) >= fourWeeksAgo && s.materialId !== 'SKIPPED'
      );
      const sessionsPerWeek = recentSessions.length / 4;

      // ── Estimate scheduled sessions remaining until exam ──────────────────
      const daysToExam = sub.examDate
        ? daysUntilDateKey(sub.examDate)
        : 999;
      const holidays = data.holidays ?? [];
      const { sessLeft } = estimateEffectiveSessions(scheds, daysToExam, holidays, sub.level);

      let predictedFinishDate: string | null = null;
      let pace: 'ahead' | 'on-track' | 'behind' = 'on-track';
      let daysDifference: number | null = null; // examDate - predictedFinishDate in days

      if (remainingSess <= 0) {
        // Already completed
        predictedFinishDate = dateKey(new Date());
        if (sub.examDate) {
          const diff = daysUntilDateKey(sub.examDate);
          daysDifference = diff;
          if (diff > 0) pace = 'ahead';
          else if (diff === 0) pace = 'on-track';
          else pace = 'behind';
        } else {
          daysDifference = null;
          pace = 'ahead';
        }
      } else if (sessLeft > 0) {
        // PRIMARY: Gunakan frekuensi jadwal terjadwal untuk prediksi.
        // schedFreqPerWeek = rata-rata sesi per minggu berdasarkan jadwal yang tersisa.
        const schedFreqPerWeek = sessLeft / Math.max(daysToExam / 7, 1);
        const weeksNeeded = schedFreqPerWeek > 0
          ? Math.ceil(remainingSess / schedFreqPerWeek)
          : daysToExam / 7;

        // PERBAIKAN: Jangan gunakan historical pace sebagai override.
        // Historical pace bisa sangat rendah untuk mapel baru (sedikit sesi tercatat),
        // dan menyebabkan prediksi jauh ke depan padahal jadwal sudah cukup.
        // Cukup gunakan jadwal terjadwal — lebih akurat dan tidak misleading.
        const finalWeeksNeeded = weeksNeeded;

        const finish = new Date();
        finish.setDate(finish.getDate() + Math.round(finalWeeksNeeded * 7));
        predictedFinishDate = dateKey(finish);

        if (sub.examDate) {
          const diff = Math.ceil((dateFromKey(sub.examDate).getTime() - finish.getTime()) / 864e5);
          daysDifference = diff;
          if (sessLeft >= remainingSess) {
            // Cukup sesi — tidak pernah "behind"
            pace = diff >= 0 ? 'ahead' : 'on-track';
          } else if (diff < -7) {
            // Hanya "behind" jika terlambat lebih dari 1 minggu
            pace = 'behind';
          } else if (diff < 0) {
            pace = 'on-track'; // mepet tapi masih bisa dikejar
          } else {
            pace = 'ahead';
          }
        } else {
          daysDifference = null;
          pace = 'ahead';
        }
      } else if (sessionsPerWeek > 0) {
        // Fallback: no remaining scheduled sessions, use historical pace
        const weeksNeeded = Math.ceil(remainingSess / sessionsPerWeek);
        const finish = new Date();
        finish.setDate(finish.getDate() + (weeksNeeded * 7));
        predictedFinishDate = dateKey(finish);

        if (sub.examDate) {
          const diff = Math.ceil((dateFromKey(sub.examDate).getTime() - finish.getTime()) / 864e5);
          daysDifference = diff;
          if (diff < 0) pace = 'behind';
          else if (diff === 0) pace = 'on-track';
          else pace = 'ahead';
        } else {
          daysDifference = null;
          pace = 'ahead';
        }
      } else {
        // No recent activity and no scheduled sessions — can't predict
        return;
      }

      results.push({
        classId: cls.id,
        subjectId: sub.id,
        predictedFinishDate,
        examDate: sub.examDate,
        daysDifference,
        pace,
      });
    });
  });

  return results;
}

// ==================== EXAM PREP MODE (FEATURE 8) ====================

export function getExamPrepItems(): ExamPrepItem[] {
  const data = getData();
  const items: ExamPrepItem[] = [];
  const today = now();
  const prepWindowDays = 14; // H-14

  data.subjects.forEach(sub => {
    if (!sub.examDate) return;

    const daysToExam = Math.ceil((dateFromKey(sub.examDate).getTime() - today.getTime()) / 864e5);
    if (daysToExam > prepWindowDays || daysToExam < 0) return; // Only upcoming exams within 14 days

    data.classes.forEach(cls => {
      const scheds = data.schedules.filter(s => s.classId === cls.id && s.subjectId === sub.id);
      if (scheds.length === 0) return;

      const mats = getMaterials(sub.id, cls.id);
      const prog = data.progress.find(p => p.classId === cls.id && p.subjectId === sub.id) || { materialsDone: 0 };
      const totalSess = getTotalSessionsNeeded(mats);
      const remainingSess = totalSess - prog.materialsDone;
      const progressPct = Math.round((prog.materialsDone / totalSess) * 100);

      const holidays = data.holidays ?? [];
      const { sessLeft } = estimateEffectiveSessions(scheds, daysToExam, holidays, sub.level);

      let status: 'critical' | 'warning' | 'ok' = 'ok';
      let recommendedActions: string[] = [];

      if (remainingSess <= 0) {
        status = 'ok';
        recommendedActions = ['✅ Semua materi sudah selesai!'];
      } else if (sessLeft === 0) {
        status = 'critical';
        recommendedActions = ['⚠️ Tidak ada sesi tersisa sebelum ujian. Pertimbangkan tambah jadwal darurat.'];
      } else if (remainingSess > sessLeft) {
        status = 'critical';
        const deficit = remainingSess - sessLeft;
        recommendedActions = [
          `🚨 Ketinggalan ${deficit} sesi!`,
          `📅 Tambah ${deficit} sesi extra`,
          `📚 Fokus ke materi inti (trim jika perlu)`,
        ];
      } else if (remainingSess > sessLeft * 0.8) {
        status = 'warning';
        recommendedActions = [
          `⏰ Mepet target! ${remainingSess} sesi dalam ${daysToExam} hari`,
          `📌 Prioritaskan materi yang belum selesai`,
          `🔁 Review secara rutin`,
        ];
      } else {
        status = 'ok';
        recommendedActions = [
          `✅ Masih-safe: ${remainingSess} sesi dengan ${daysToExam} hari`,
          `📖 Lanjutkan ritme normal`,
          `🧠 Mulai review 2 hari sebelum ujian`,
        ];
      }

      items.push({
        classId: cls.id, className: cls.name,
        subjectId: sub.id, subjectName: sub.name,
        examDate: sub.examDate,
        daysLeft: daysToExam,
        status,
        progressPct,
        sessionsNeeded: remainingSess,
        sessionsDone: prog.materialsDone,
        recommendedActions,
      });
    });
  });

  // Sort by urgency (critical first, then by daysLeft ascending)
  return items.sort((a, b) => {
    const priority = { critical: 3, warning: 2, ok: 1 };
    const diff = priority[b.status] - priority[a.status];
    if (diff !== 0) return diff;
    return (a.daysLeft || 0) - (b.daysLeft || 0);
  });
}


// ==================== AI AUTO-PACING ====================

/**
 * Calculate pace status for a single class+subject combo, with smart suggestions
 */
export function calculatePaceForCombination(classId: string, subjectId: string) {
  const data = getData();
  const cls = data.classes.find(c => c.id === classId);
  const sub = data.subjects.find(s => s.id === subjectId);
  if (!cls || !sub) return null;

  const mats = getMaterials(subjectId, classId);
  if (!mats.length) return null;

  const prog = data.progress.find(p => p.classId === classId && p.subjectId === subjectId) || { materialsDone: 0 };
  const totalSess = getTotalSessionsNeeded(mats);
  const doneSess = prog.materialsDone;
  const remainingSess = totalSess - doneSess;
  if (remainingSess <= 0) return { type: 'no_issue' as const, description: 'Semua materi sudah selesai!' };

  const scheds = data.schedules.filter(s => s.classId === classId && s.subjectId === subjectId);
  if (!scheds.length) return { type: 'no_issue' as const, description: 'Belum ada jadwal untuk kelas ini.' };

  const holidays = data.holidays ?? [];
  const daysLeft = sub.examDate ? daysUntilDateKey(sub.examDate) : 999;
  const { sessLeft, holidaysInPeriod } = estimateEffectiveSessions(scheds, daysLeft, holidays, sub.level);

  const { material: nextMat } = getMaterialForSession(mats, doneSess);

  if (sessLeft === 0) {
    return {
      type: 'add_sessions' as const,
      classId, class: cls.name, subjectId, subject: sub.name,
      description: `Tidak ada sesi tersisa${holidaysInPeriod > 0 ? ` (${holidaysInPeriod} hari libur)` : ''}. Perlu tambah jadwal.`,
      actionable: true,
      estimatedExtraSessions: remainingSess,
    };
  }

  if (remainingSess > sessLeft + 2) {
    const deficit = remainingSess - sessLeft;
    const suggestedDates = suggestAvailableDates(scheds, daysLeft, holidays, deficit, sub.level);
    const matsToTrim = suggestMaterialsToTrim(mats, doneSess, deficit);
    return {
      type: 'add_sessions' as const,
      classId, class: cls.name, subjectId, subject: sub.name,
      description: `Ketinggalan ${deficit} sesi. Butuh ${remainingSess} sesi, tapi hanya ${sessLeft} tersisa.`,
      actionable: true,
      estimatedExtraSessions: deficit,
      suggestedDates,
      materialsToTrim: matsToTrim,
    };
  }

  if (remainingSess > sessLeft) {
    return {
      type: 'add_sessions' as const,
      classId, class: cls.name, subjectId, subject: sub.name,
      description: `Mepet target: butuh ${remainingSess} sesi, tersedia ${sessLeft}.`,
      actionable: true,
      estimatedExtraSessions: remainingSess - sessLeft,
      suggestedDates: suggestAvailableDates(scheds, daysLeft, holidays, remainingSess - sessLeft, sub.level),
    };
  }

  if (remainingSess === sessLeft && sessLeft <= 3 && scheds.length >= 2) {
    return {
      type: 'merge_sessions' as const,
      classId, class: cls.name, subjectId, subject: sub.name,
      description: `Sisa ${remainingSess} sesi dengan ${scheds.length} slot jadwal. Pertimbangkan gabungkan beberapa sesi.`,
      actionable: true,
    };
  }

  return {
    type: 'no_issue' as const,
    classId, class: cls.name, subjectId, subject: sub.name,
    description: 'On track. Lanjutkan!',
    actionable: false,
  };
}

/**
 * Generate suggestions for ALL class+subject combinations
 */
export function generatePaceSuggestions(): PaceSuggestion[] {
  const data = getData();
  const suggestions: PaceSuggestion[] = [];

  data.subjects.forEach(sub => {
    data.classes.forEach(cls => {
      const result = calculatePaceForCombination(cls.id, sub.id);
      if (result && result.type !== 'no_issue') {
        suggestions.push(result);
      }
    });
  });

  return suggestions.sort((a, b) => {
    const priority = { add_sessions: 3, merge_sessions: 2, trim_materials: 1 };
    return (priority[b.type] || 0) - (priority[a.type] || 0);
  });
}

/**
 * Suggest available dates (weekdays) to add extra sessions
 */
function suggestAvailableDates(
  existingScheds: Schedule[],
  daysLeft: number,
  holidays: (string | { date: string; level?: string })[],
  neededSessions: number,
  subjectLevel?: string
): string[] {
  const suggested: string[] = [];
  const existingDays = existingScheds.flatMap(s => s.days);

  for (let d = 1; d <= daysLeft && suggested.length < neededSessions; d++) {
    const date = new Date();
    date.setDate(date.getDate() + d);
    const dateStr = dateKey(date);
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const isHoliday = holidays.some(h =>
      typeof h === 'string' ? h === dateStr : h.date === dateStr && (!h.level || h.level === subjectLevel)
    );
    if (isHoliday) continue;

    const alreadyScheduled = existingScheds.some(s => s.days.includes(dayOfWeek));
    if (!alreadyScheduled) {
      suggested.push(dateStr);
    }
  }
  return suggested;
}

/**
 * Suggest which materials could be trimmed/condensed
 */
function suggestMaterialsToTrim(
  mats: Material[],
  doneSessions: number,
  deficit: number
): string[] {
  const remainingMats = mats.filter((_, idx) => {
    let cumSessions = 0;
    for (let i = 0; i < idx; i++) cumSessions += mats[i].sessions ?? 1;
    return cumSessions >= doneSessions;
  }).slice(0, Math.ceil(deficit / 2));

  return remainingMats.map(m => m.name);
}

/**
 * Apply a pace suggestion — creates catch-up tasks for suggested extra sessions
 */
export function applyPaceSuggestion(suggestion: PaceSuggestion) {
  if (suggestion.type !== 'add_sessions' || !suggestion.suggestedDates?.length) return;

  updateData(d => {
    const sched = d.schedules.find(s => s.classId === suggestion.classId && s.subjectId === suggestion.subjectId);
    if (!sched) return;

    suggestion.suggestedDates!.forEach(dateStr => {
      d.tasks.push({
        id: genId(),
        classId: suggestion.classId,
        subjectId: suggestion.subjectId,
        title: `📚 Extra session: ${suggestion.subject} (catch-up)`,
        deadline: dateStr,
        status: 'pending'
      });
    });
  });
}

/**
 * Add an extra session (override) on a specific date for a schedule
 */
export function addExtraSession(scheduleId: string, dateStr: string, startTime?: string, durationOverride?: number) {
  const data = getData();
  const sched = data.schedules.find(s => s.id === scheduleId);
  if (!sched) return;

  if (!data.scheduleOverrides) data.scheduleOverrides = [];

  // Check if extra session already exists on this date
  const existingExtra = data.scheduleOverrides.find(
    o => o.scheduleId === scheduleId && o.date === dateStr && o.isExtra
  );
  if (existingExtra) return; // already added

  data.scheduleOverrides.push({
    date: dateStr,
    scheduleId: scheduleId,
    startTime: startTime || sched.startTime,
    durationOverride: durationOverride || sched.duration,
    isExtra: true,
  });

  saveData(data);
}
