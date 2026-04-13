export interface ClassItem {
  id: string;
  name: string;
  color: string;
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
  holidays: string[]; // tanggal libur/skip: YYYY-MM-DD
  scheduleOverrides?: { date: string; scheduleId: string; startTime: string }[]; // override jam mulai untuk tanggal tertentu
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
