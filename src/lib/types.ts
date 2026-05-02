export interface ClassItem {
  id: string;
  name: string;
  color: string;
  level?: string; // tingkatan kelas, cth: "3", "4", "7", "10"
}
export interface Subject {
  id: string;
  name: string;
  level?: string;
  examDate: string | null;
}
export interface Material {
  id: string;
  subjectId: string;
  level?: string;   // tingkatan kelas — materi shared untuk semua rombel di level ini
  classId?: string; // override rombel — jika diisi, materi ini khusus untuk rombel tertentu
  name: string;
  order: number;
  sessions?: number; // jumlah pertemuan yang dibutuhkan untuk bab ini (default 1)
}
export interface Schedule {
  id: string;
  classId: string;
  subjectId: string;
  days: number[];
  startTime: string;
  duration: number;
}
export interface Progress {
  id: string;
  classId: string;
  subjectId: string;
  materialsDone: number;
  lastSession: string | null;
}
export interface Session {
  id: string;
  scheduleId: string;
  classId: string;
  subjectId: string;
  date: string;
  materialId: string | null;
  completedAt: string;
  note?: string;
}
export interface TeacherTask {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  deadline: string; // YYYY-MM-DD
  status: 'pending' | 'done';
}
export interface AppData {
  teacherName: string;
  classes: ClassItem[];
  subjects: Subject[];
  materials: Material[];
  schedules: Schedule[];
  progress: Progress[];
  sessions: Session[];
  tasks: TeacherTask[];
  notes: string[];
  lastBackup: string | null;
  reminderDismissed: string | null;
  holidays: (string | { date: string; level?: string })[];
  scheduleOverrides?: { date: string; scheduleId: string; startTime: string; durationOverride?: number; skipped?: boolean; isExtra?: boolean }[];
  academicYear?: string; // e.g., "2024/2025" or "2025 Semester Ganjil"
}
export interface TodayScheduleItem extends Schedule {
  className: string;
  subjectName: string;
  nextMat: Material | null;
  done: boolean;
  active: boolean;
  endTime: string;
  totalMats: number;
  materialsDone: number;
  sessionId?: string;
  note?: string;
  skipped?: boolean;
}
export interface SubjectStatus {
  status: 'on-track' | 'tight' | 'behind';
  label: string;
  pct: number;
  done: number;
  total: number;
  remaining: number;
  sessLeft?: number;       // sesi efektif tersisa (sudah dikurangi libur)
  sessionsNeeded?: number; // total sesi yang dibutuhkan (sum dari material.sessions)
  holidaysInPeriod?: number; // jumlah hari libur yang jatuh dalam range
  rec: string;
  daysLeft?: number;
  nextSched: { dayName: string; time: string } | null;
}
export interface Insight {
  type: 'warn' | 'tip';
  directive: string;
  text: string;
}
export type ViewType = 'today' | 'progress' | 'setup' | 'info' | 'exam';
export type SetupTab = 'classes' | 'subjects' | 'materials' | 'schedules' | 'holidays' | 'data' | 'leave';

export type PaceSuggestionType = 'add_sessions' | 'merge_sessions' | 'trim_materials' | 'no_issue';
export interface PaceSuggestion {
  classId: string;
  class: string;
  subjectId: string;
  subject: string;
  type: PaceSuggestionType;
  description: string;
  actionable: boolean;
  estimatedExtraSessions?: number;
  suggestedDates?: string[];
  materialsToTrim?: string[];
}
export type RescheduleAction = {
  scheduleId: string;
  action: 'skip' | 'postpone' | 'deliver' | 'keep';
  withScheduleId?: string;
  days?: number;
  reason?: string;
  note?: string;
};

// Heatmap for Progress tab
export interface HeatmapCell {
  weekStart: string; // YYYY-MM-DD
  weekLabel: string; // "Minggu 1", "Minggu 2"
  status: 'on-track' | 'tight' | 'behind' | 'no-class' | 'no-data';
  sessionsDone: number;
  sessionsScheduled: number;
}
export interface HeatmapRow {
  className: string;
  subjectName: string;
  classId: string;
  subjectId: string;
  cells: HeatmapCell[];
}

// Exam Prep Mode
export interface ExamPrepItem {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  examDate: string;
  daysLeft: number;
  status: 'critical' | 'warning' | 'ok';
  progressPct: number;
  sessionsNeeded: number;
  sessionsDone: number;
  recommendedActions: string[];
}

// Predictive Finish Date
export interface PredictiveFinish {
  classId: string;
  subjectId: string;
  predictedFinishDate: string; // YYYY-MM-DD
  examDate: string | null;
  daysDifference: number | null; // pred - exam (negative = late)
  pace: 'ahead' | 'on-track' | 'behind';
}
