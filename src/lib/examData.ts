import { getData, genId, now, DAYS_ID, timeToMin, currentMin, fmt } from './data';

// ── Types ─────────────────────────────────────────────────────────────────────
export type CorrectionStatus = 'belum' | 'sedang' | 'selesai';

export interface ExamCorrection {
  id: string;
  subjectId: string;
  classId: string;
  examDate: string;
  status: CorrectionStatus;
  updatedAt: string;
}

export interface ExamWatchItem {
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  examDate: string;
  startTime: string;
  endTime: string;
  duration: number;
  isActive: boolean;     // sedang dalam rentang waktu ujian sekarang
  isDone: boolean;       // sudah selesai hari ini (past endTime)
  daysLeft: number;      // 0 = hari ini, positif = akan datang, negatif = sudah lewat
  correction: ExamCorrection | null;
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
  const todayStr = now().toISOString().slice(0, 10);
  const curMin = currentMin();

  const items: ExamWatchItem[] = [];

  data.subjects
    .filter(s => s.examDate === todayStr)
    .forEach(sub => {
      // Semua kelas yang punya jadwal untuk mapel ini
      const relevantSchedules = data.schedules.filter(sc => sc.subjectId === sub.id);
      
      if (relevantSchedules.length === 0) {
        // Mapel ini diujikan hari ini tapi tidak ada jadwal ngajarnya — tetap tampilkan
        data.classes.forEach(cls => {
          const correction = corrections.find(c => c.subjectId === sub.id && c.classId === cls.id && c.examDate === todayStr) || null;
          items.push({
            subjectId: sub.id, subjectName: sub.name,
            classId: cls.id, className: cls.name,
            examDate: todayStr,
            startTime: '07:00', endTime: '09:00', duration: 120,
            isActive: false, isDone: false, daysLeft: 0,
            correction,
          });
        });
        return;
      }

      relevantSchedules.forEach(sc => {
        const cls = data.classes.find(c => c.id === sc.classId);
        if (!cls) return;
        const startMin = timeToMin(sc.startTime);
        const endMin = startMin + (sc.duration || 90);
        const endTime = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
        const isActive = curMin >= startMin && curMin < endMin;
        const isDone = curMin >= endMin;
        const correction = corrections.find(c => c.subjectId === sub.id && c.classId === cls.id && c.examDate === todayStr) || null;
        items.push({
          subjectId: sub.id, subjectName: sub.name,
          classId: cls.id, className: cls.name,
          examDate: todayStr,
          startTime: sc.startTime, endTime,
          duration: sc.duration || 90,
          isActive, isDone, daysLeft: 0,
          correction,
        });
      });
    });

  return items.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
}

// ── Semua ujian (untuk tab "Semua Ujian") ────────────────────────────────────
export interface ExamSubjectItem {
  subjectId: string;
  subjectName: string;
  examDate: string;
  daysLeft: number;
  classes: {
    classId: string;
    className: string;
    correction: ExamCorrection | null;
  }[];
}

export function getAllExamSubjects(): ExamSubjectItem[] {
  const data = getData();
  const corrections = getCorrections();
  const today = new Date(); today.setHours(0,0,0,0);

  return data.subjects
    .filter(s => s.examDate)
    .map(s => {
      const examDt = new Date(s.examDate!); examDt.setHours(0,0,0,0);
      const daysLeft = Math.round((examDt.getTime() - today.getTime()) / 864e5);

      // Kelas yang relevan = yang punya schedule mapel ini
      const relCls = data.classes.filter(cls =>
        data.schedules.some(sc => sc.subjectId === s.id && sc.classId === cls.id)
      );
      const classList = (relCls.length > 0 ? relCls : data.classes).map(cls => ({
        classId: cls.id,
        className: cls.name,
        correction: corrections.find(c => c.subjectId === s.id && c.classId === cls.id && c.examDate === s.examDate!) || null,
      }));

      return { subjectId: s.id, subjectName: s.name, examDate: s.examDate!, daysLeft, classes: classList };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
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
