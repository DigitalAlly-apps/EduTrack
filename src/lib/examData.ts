import { getData, updateData, genId, now, DAYS_ID, timeToMin, currentMin, fmt, dateKey, dateFromKey } from './data';
import type { ExamSchedule } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────
export type CorrectionStatus = 'belum' | 'sedang' | 'selesai';

// ── Exam Day Mode (stop KBM tracking) ─────────────────────────────────────────
// Disimpan per tanggal — aktif = KBM hari ini tidak ditampilkan sebagai "tugas"
const EXAM_MODE_KEY = 'edutrack_exam_mode';
export function getExamDayMode(): boolean {
  try {
    const val = localStorage.getItem(EXAM_MODE_KEY);
    if (!val) return false;
    const parsed: { date?: string; active: boolean } = JSON.parse(val);
    return !!parsed.active;
  } catch { return false; }
}
export function setExamDayMode(active: boolean): void {
  localStorage.setItem(EXAM_MODE_KEY, JSON.stringify({ date: dateKey(), active }));
}
export function toggleExamDayMode(): void {
  setExamDayMode(!getExamDayMode());
}

// ── Exam Reminder Preferences ────────────────────────────────────────────────
export interface ExamReminderSettings {
  enabled: boolean;
  dayBefore: boolean;
  fiveHoursBefore: boolean;
  oneHourBefore: boolean;
  atStart: boolean;
  proctorThirtyMinutes: boolean;
}

export type ExamReminderSettingKey = keyof ExamReminderSettings;

export const DEFAULT_EXAM_REMINDER_SETTINGS: ExamReminderSettings = {
  enabled: true,
  dayBefore: true,
  fiveHoursBefore: true,
  oneHourBefore: true,
  atStart: false,
  proctorThirtyMinutes: true,
};

const EXAM_REMINDER_SETTINGS_KEY = 'edutrack_exam_reminder_settings';

export function getExamReminderSettings(): ExamReminderSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXAM_REMINDER_SETTINGS_KEY) || '{}');
    return { ...DEFAULT_EXAM_REMINDER_SETTINGS, ...(typeof parsed === 'object' && parsed ? parsed : {}) };
  } catch {
    return { ...DEFAULT_EXAM_REMINDER_SETTINGS };
  }
}

export function setExamReminderSettings(settings: ExamReminderSettings): void {
  localStorage.setItem(EXAM_REMINDER_SETTINGS_KEY, JSON.stringify(settings));
}

export function updateExamReminderSetting(key: ExamReminderSettingKey, value: boolean): ExamReminderSettings {
  const next = { ...getExamReminderSettings(), [key]: value };
  setExamReminderSettings(next);
  return next;
}

// ── Ngawas (Exam Proctoring) ───────────────────────────────────────────────────
// Guru bisa ngawas ujian mapel lain dengan waktu ngawas yang berbeda dari ujian mapelnya sendiri
export interface ProctorSession {
  id: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  subjectName: string; // nama mapel yang diawasi (free-text)
  location?: string;   // ruangan opsional
  note?: string;
  createdAt: string;
}

// Proctoring is now unified into ExamSchedule

export type ExamStatus = 'MENDATANG' | 'HARI INI' | 'BERLANGSUNG' | 'SELESAI' | 'TERLEWAT';

export function getExamStatus(date: string, startTime: string, endTime: string): ExamStatus {
  const tToday = dateKey();
  if (date > tToday) return 'MENDATANG';
  if (date < tToday) return 'TERLEWAT';
  
  // Hari ini
  const curMin = currentMin();
  const startMin = timeToMin(startTime);
  const endMin = timeToMin(endTime);
  
  if (curMin < startMin) return 'HARI INI';
  if (curMin >= endMin) return 'SELESAI';
  return 'BERLANGSUNG';
}

// ── Jadwal Ujian Detail (mapel sendiri) ───────────────────────────────────────
export type ExamScheduleDraft = Omit<ExamSchedule, 'id' | 'createdAt'>;

function compareExamSchedules(a: ExamSchedule, b: ExamSchedule) {
  return a.date.localeCompare(b.date) || timeToMin(a.startTime) - timeToMin(b.startTime);
}

function getSyncedSubjectExamDate(schedules: ExamSchedule[], subjectId: string) {
  const subjectSchedules = schedules
    .filter(s => s.subjectId === subjectId)
    .sort(compareExamSchedules);
  return subjectSchedules[0]?.date || null;
}

export function getExamSchedules(): ExamSchedule[] {
  const data = getData();
  return [...(data.examSchedules || [])].sort(compareExamSchedules);
}

export function addExamSchedule(schedule: ExamScheduleDraft): ExamSchedule {
  let created: ExamSchedule | null = null;
  updateData(d => {
    if (!Array.isArray(d.examSchedules)) d.examSchedules = [];
    created = { ...schedule, id: genId(), createdAt: now().toISOString() };
    d.examSchedules.push(created);
    const subject = d.subjects.find(s => s.id === schedule.subjectId);
    if (subject) subject.examDate = getSyncedSubjectExamDate(d.examSchedules, schedule.subjectId);
  });
  return created!;
}

export function deleteExamSchedule(id: string): void {
  updateData(d => {
    const deleted = (d.examSchedules || []).find(s => s.id === id);
    d.examSchedules = (d.examSchedules || []).filter(s => s.id !== id);
    if (deleted) {
      const subject = d.subjects.find(s => s.id === deleted.subjectId);
      if (subject) subject.examDate = getSyncedSubjectExamDate(d.examSchedules, deleted.subjectId);
    }
  });
}

export interface ExamCorrection {
  id: string;
  subjectId: string;
  classId: string;
  examDate: string;
  status: CorrectionStatus;
  updatedAt: string;
}

export interface ExamWatchItem {
  scheduleId?: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  examDate: string;
  startTime: string;
  endTime: string;
  duration: number;
  location?: string;
  note?: string;
  status: ExamStatus;    // MENDATANG, HARI INI, BERLANGSUNG, SELESAI, TERLEWAT
  daysLeft: number;      // 0 = hari ini, positif = akan datang, negatif = sudah lewat
  correction: ExamCorrection | null;
  examType?: 'UTS' | 'UAS' | 'Umum'; // jenis ujian
}

// ── Corrections CRUD ──────────────────────────────────────────────────────────
const CORR_KEY = 'edutrack_corrections';
export function getCorrections(): ExamCorrection[] {
  try { return JSON.parse(localStorage.getItem(CORR_KEY) || '[]'); } catch { return []; }
}
export function upsertCorrection(subjectId: string, classId: string, examDate: string, status: CorrectionStatus) {
  const all = getCorrections();
  const ex = all.find(c => c.subjectId === subjectId && c.classId === classId && c.examDate === examDate);
  if (ex) { ex.status = status; ex.updatedAt = now().toISOString(); }
  else all.push({ id: genId(), subjectId, classId, examDate, status, updatedAt: now().toISOString() });
  localStorage.setItem(CORR_KEY, JSON.stringify(all));
}

// ── Build exam watch items for today ─────────────────────────────────────────
// Menggunakan jadwal (schedules) yang sudah ada — di hari ujian (examDate),
// semua kelas yang mapelnya sedang diujikan ditampilkan otomatis.
export function getTodayExamItems(): ExamWatchItem[] {
  const data = getData();
  const corrections = getCorrections();
  const todayStr = dateKey();

  const detailedItems = (data.examSchedules || [])
    .filter(s => s.date === todayStr && s.supervisorId === (data.teacherName || 'Pengawas'))
    .map(s => {
      const cls = data.classes.find(c => c.id === s.classId);
      const sub = data.subjects.find(x => x.id === s.subjectId);
      const startMin = timeToMin(s.startTime);
      const endMin = timeToMin(s.endTime);
      const correction = corrections.find(c => c.subjectId === s.subjectId && c.classId === s.classId && c.examDate === s.date) || null;
      return {
        scheduleId: s.id,
        subjectId: s.subjectId,
        subjectName: s.subjectName || sub?.name || '?',
        classId: s.classId,
        className: cls?.name || '?',
        examDate: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: Math.max(0, endMin - startMin),
        location: s.location,
        note: s.note,
        status: getExamStatus(s.date, s.startTime, s.endTime),
        daysLeft: 0,
        correction,
        examType: s.examType,
      };
    })
    .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

  return detailedItems;
}

// ── Semua ujian (untuk tab "Semua Ujian") ────────────────────────────────────
export interface ExamSubjectItem {
  subjectId: string;
  subjectName: string;
  examDate: string;
  daysLeft: number;
  examType?: 'UTS' | 'UAS' | 'Umum'; // jenis ujian dari jadwal pertama
  classes: {
    classId: string;
    className: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    note?: string;
    correction: ExamCorrection | null;
  }[];
}

export function getAllExamSubjects(): ExamSubjectItem[] {
  const data = getData();
  const corrections = getCorrections();
  const today = dateFromKey(dateKey());

  const grouped = new Map<string, ExamSubjectItem>();

  getExamSchedules().forEach(schedule => {
    const sub = data.subjects.find(s => s.id === schedule.subjectId);
    const cls = data.classes.find(c => c.id === schedule.classId);
    const examDt = dateFromKey(schedule.date);
    const daysLeft = Math.round((examDt.getTime() - today.getTime()) / 864e5);
    const key = `${schedule.subjectId}:${schedule.date}:${schedule.examType ?? 'Umum'}`;
    
    const item = grouped.get(key) || {
      subjectId: schedule.subjectId,
      subjectName: schedule.subjectName || sub?.name || '?',
      examDate: schedule.date,
      daysLeft,
      examType: schedule.examType ?? 'Umum',
      classes: [],
    };

    if (!item.classes.some((c: any) => c.classId === schedule.classId)) {
      item.classes.push({
        classId: schedule.classId,
        className: cls?.name || '?',
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        location: schedule.location,
        note: schedule.note,
        correction: corrections.find(c => c.subjectId === schedule.subjectId && c.classId === schedule.classId && c.examDate === schedule.date) || null,
      });
    }
    grouped.set(key, item);
  });

  return [...grouped.values()].sort((a, b) => a.daysLeft - b.daysLeft || a.subjectName.localeCompare(b.subjectName));
}

// ── Koreksi queue (independen dari jadwal agenda) ─────────────────────────────
export interface CorrectionQueueItem {
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  examDate: string | null;
  startTime: string | null;
  endTime: string | null;
  daysLeft: number | null;
  status: CorrectionStatus | null;
  isOverdue: boolean;
  isScheduled: boolean;
  isExamFinished: boolean;
}

function correctionItemKey(subjectId: string, classId: string, examDate: string | null) {
  return `${subjectId}:${classId}:${examDate || 'unscheduled'}`;
}

function sortCorrectionQueue(a: CorrectionQueueItem, b: CorrectionQueueItem) {
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  const aDays = a.daysLeft ?? Infinity;
  const bDays = b.daysLeft ?? Infinity;
  if (aDays !== bDays) return aDays - bDays;
  return a.subjectName.localeCompare(b.subjectName) || a.className.localeCompare(b.className);
}

function buildCorrectionEligibleItems(): CorrectionQueueItem[] {
  const data = getData();
  const allExams = getAllExamSubjects();
  const todayItems = getTodayExamItems();
  const corrections = getCorrections();
  const items: CorrectionQueueItem[] = [];
  const seen = new Set<string>();

  const addItem = (item: CorrectionQueueItem) => {
    const k = correctionItemKey(item.subjectId, item.classId, item.examDate);
    if (seen.has(k)) return;
    seen.add(k);
    items.push(item);
  };

  // Add all scheduled exams
  for (const exam of allExams) {
    for (const cls of exam.classes) {
      const status = cls.correction?.status ?? null;
      let isExamFinished = false;
      if (exam.daysLeft < 0) {
         isExamFinished = true;
      } else if (exam.daysLeft === 0) {
         const todayItem = todayItems.find(t => t.subjectId === exam.subjectId && t.classId === cls.classId && t.examDate === exam.examDate);
         isExamFinished = todayItem ? todayItem.isDone : false;
      }

      addItem({
        subjectId: exam.subjectId,
        subjectName: exam.subjectName,
        classId: cls.classId,
        className: cls.className,
        examDate: exam.examDate,
        startTime: cls.startTime || null,
        endTime: cls.endTime || null,
        daysLeft: exam.daysLeft,
        status,
        isOverdue: exam.daysLeft < -5 && status !== 'selesai',
        isScheduled: true,
        isExamFinished
      });
    }
  }



  // Include any stray corrections that might not match current subjects/classes
  const todayStr = dateKey();
  for (const corr of corrections) {
    const k = correctionItemKey(corr.subjectId, corr.classId, corr.examDate);
    if (seen.has(k)) continue;

    const sub = data.subjects.find(s => s.id === corr.subjectId);
    const cls = data.classes.find(c => c.id === corr.classId);
    const today = dateFromKey(todayStr);
    const examDt = dateFromKey(corr.examDate);
    const daysLeft = Math.round((examDt.getTime() - today.getTime()) / 864e5);

    addItem({
      subjectId: corr.subjectId,
      subjectName: sub?.name || '?',
      classId: corr.classId,
      className: cls?.name || '?',
      examDate: corr.examDate,
      startTime: null,
      endTime: null,
      daysLeft,
      status: corr.status,
      isOverdue: daysLeft < -5 && corr.status !== 'selesai',
      isScheduled: false, // Old/stray data
      isExamFinished: daysLeft < 0,
    });
  }

  return items.sort(sortCorrectionQueue);
}

export function getCorrectionQueue(options?: { includeCompleted?: boolean }): CorrectionQueueItem[] {
  const includeCompleted = options?.includeCompleted ?? false;
  const items = buildCorrectionEligibleItems();
  if (includeCompleted) return items;
  return items.filter(i => i.status !== 'selesai');
}

export function getCorrectionStats() {
  const all = buildCorrectionEligibleItems();
  const pending = all.filter(i => i.status !== 'selesai');
  return {
    total: all.length,
    done: all.filter(i => i.status === 'selesai').length,
    pending: pending.length,
    overdue: pending.filter(i => i.isOverdue).length,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function fmtDate(d: string) {
  return dateFromKey(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDayLabel(daysLeft: number) {
  if (daysLeft === 0) return 'HARI INI';
  if (daysLeft === 1) return 'Besok';
  if (daysLeft < 0) return `${Math.abs(daysLeft)} hari lalu`;
  return `${daysLeft} hari lagi`;
}
export function dayLabelColor(daysLeft: number) {
  if (daysLeft < 0) return 'text-text3';
  if (daysLeft === 0) return 'text-amber font-bold';
  if (daysLeft <= 7) return 'text-red';
  return 'text-green';
}

export const STATUS_LABEL: Record<CorrectionStatus, string> = { belum: 'Belum', sedang: 'Sedang', selesai: 'Selesai' };
export const STATUS_NEXT: Record<CorrectionStatus, CorrectionStatus> = { belum: 'sedang', sedang: 'selesai', selesai: 'belum' };
export const STATUS_CLS: Record<CorrectionStatus, string> = {
  belum: 'text-red bg-red/10 border-red/20',
  sedang: 'text-amber bg-amber/10 border-amber/20',
  selesai: 'text-green bg-green/10 border-green/20',
};
export { fmt };

// ── Reset semua data ujian ────────────────────────────────────────────────────
// Menghapus semua jadwal ujian, sesi ngawas, koreksi, mode ujian, dan reminder.
// Tidak menghapus data lain (kelas, mapel, jadwal KBM, materi, dll).
export function resetAllExamData(): void {
  updateData(d => {
    d.examSchedules = [];
    d.subjects.forEach(s => { s.examDate = null; });
  });
  localStorage.removeItem(PROCTOR_KEY);
  localStorage.removeItem(CORR_KEY);
  localStorage.removeItem(EXAM_MODE_KEY);
  localStorage.removeItem(EXAM_REMINDER_SETTINGS_KEY);
}
