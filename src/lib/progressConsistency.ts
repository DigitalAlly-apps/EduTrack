import { dateFromKey, dateKey, getData, saveData } from './data';
import type { AppData, Material, Schedule, Session, SubjectStatus } from './types';

export type CalendarDayStatus = 'done' | 'partial' | 'missed' | 'holiday' | 'noclass' | 'future';

export type CalendarDaySummary = {
  date: string;
  status: CalendarDayStatus;
  sessionCount: number;
  schedCount: number;
  skippedCount: number;
};

export type CalendarAuditEntry = {
  schedule: Schedule;
  session?: Session;
  recorded: boolean;
};

export type CalendarDayAudit = CalendarDaySummary & {
  entries: CalendarAuditEntry[];
};

function getMaterialsFromSnapshot(data: AppData, subjectId: string, classId: string): Material[] {
  const cls = data.classes.find(c => c.id === classId);
  const byClass = data.materials.filter(m => m.subjectId === subjectId && m.classId === classId);
  if (byClass.length) return [...byClass].sort((a, b) => a.order - b.order);

  if (cls?.level) {
    const byLevel = data.materials.filter(m => m.subjectId === subjectId && m.level === cls.level && !m.classId);
    if (byLevel.length) return [...byLevel].sort((a, b) => a.order - b.order);
  }

  return data.materials
    .filter(m => m.subjectId === subjectId && !m.level && !m.classId)
    .sort((a, b) => a.order - b.order);
}

function isHolidayForSubject(data: AppData, date: string, subjectLevel?: string) {
  return (data.holidays ?? []).some(h =>
    typeof h === 'string'
      ? h === date
      : h.date === date && (!h.level || h.level === subjectLevel)
  );
}

/**
 * Menjaga progress lama (`materialsDone`) dan progress berbasis bab
 * (`completedMaterialIds`) tetap menunjuk posisi yang sama.
 *
 * Saat sebuah bab ditutup lebih cepat, seluruh bab sebelum bab tersebut
 * dianggap sudah selesai dan `materialsDone` dimajukan sampai akhir bab itu.
 * Ini penting karena beberapa tampilan legacy masih membaca materialsDone.
 */
export function normalizeProgressConsistency(): boolean {
  const data = getData();
  let changed = false;

  for (const progress of data.progress) {
    const materials = getMaterialsFromSnapshot(data, progress.subjectId, progress.classId);
    if (!materials.length) continue;

    const completed = new Set(progress.completedMaterialIds ?? []);
    data.sessions
      .filter(session =>
        session.classId === progress.classId &&
        session.subjectId === progress.subjectId &&
        session.materialCompleted &&
        session.materialId &&
        session.materialId !== 'SKIPPED'
      )
      .forEach(session => completed.add(session.materialId!));

    const completedIndexes = materials
      .map((material, index) => completed.has(material.id) ? index : -1)
      .filter(index => index >= 0);

    if (completedIndexes.length) {
      const highestCompletedIndex = Math.max(...completedIndexes);
      let targetSessionsDone = 0;
      for (let index = 0; index <= highestCompletedIndex; index++) {
        const material = materials[index];
        completed.add(material.id);
        targetSessionsDone += material.sessions ?? 1;
      }

      if ((progress.materialsDone ?? 0) < targetSessionsDone) {
        progress.materialsDone = targetSessionsDone;
        changed = true;
      }
    }

    const normalizedIds = materials.filter(material => completed.has(material.id)).map(material => material.id);
    const oldIds = progress.completedMaterialIds ?? [];
    if (normalizedIds.length !== oldIds.length || normalizedIds.some((id, index) => id !== oldIds[index])) {
      progress.completedMaterialIds = normalizedIds;
      changed = true;
    }
  }

  if (changed) saveData(data);
  return changed;
}

export function getTrackerMessage(status: SubjectStatus): string {
  const needed = status.sessionsNeeded ?? status.remaining;
  const available = status.sessLeft ?? 0;
  const holidayText = status.holidaysInPeriod ? ` (${status.holidaysInPeriod} sesi terdampak libur)` : '';

  if (needed <= 0) return 'Materi target sudah selesai.';
  if (available <= 0) return `Butuh ${needed} sesi, tetapi tidak ada sesi terjadwal tersisa${holidayText}.`;

  const deficit = needed - available;
  if (deficit > 0) {
    return `Kurang ${deficit} sesi. Butuh ${needed}, tersedia ${available}${holidayText}. Tambah jadwal atau padatkan ${deficit} sesi materi.`;
  }

  if (deficit === 0) {
    return `Pas: butuh ${needed} dan tersedia ${available} sesi${holidayText}. Jangan sampai ada sesi terlewat.`;
  }

  const buffer = available - needed;
  return `Aman. Ada cadangan ${buffer} sesi: butuh ${needed}, tersedia ${available}${holidayText}.`;
}

/**
 * Kalender operasional: membandingkan jadwal yang benar-benar diharapkan
 * (setelah libur + override) dengan sesi mengajar nyata. SKIPPED tidak dihitung
 * sebagai sesi selesai.
 */
export function getCalendarDayAudit(date: string, classId?: string): CalendarDayAudit {
  const data = getData();
  const today = dateKey();
  const dayOfWeek = dateFromKey(date).getDay();
  const isGlobalHoliday = (data.holidays ?? []).some(holiday =>
    typeof holiday === 'string' ? holiday === date : holiday.date === date && !holiday.level
  );
  const baseSchedules = data.schedules.filter(schedule =>
    (!classId || schedule.classId === classId) && schedule.days.includes(dayOfWeek)
  );
  const overrides = (data.scheduleOverrides ?? []).filter(override => override.date === date);
  let holidayAffected = false;

  const expectedSchedules = baseSchedules
    .filter(schedule => {
      const subject = data.subjects.find(item => item.id === schedule.subjectId);
      if (isHolidayForSubject(data, date, subject?.level)) {
        holidayAffected = true;
        return false;
      }
      const override = overrides.find(item => item.scheduleId === schedule.id && !item.isExtra);
      return !override?.skipped;
    })
    .map(schedule => {
      const override = overrides.find(item => item.scheduleId === schedule.id && !item.isExtra);
      return override
        ? { ...schedule, startTime: override.startTime, duration: override.durationOverride ?? schedule.duration }
        : schedule;
    });

  for (const override of overrides) {
    if (!override.isExtra || override.skipped) continue;
    const schedule = data.schedules.find(item => item.id === override.scheduleId);
    if (!schedule || (classId && schedule.classId !== classId)) continue;
    const subject = data.subjects.find(item => item.id === schedule.subjectId);
    if (isHolidayForSubject(data, date, subject?.level)) {
      holidayAffected = true;
      continue;
    }
    if (!expectedSchedules.some(item => item.id === schedule.id)) {
      expectedSchedules.push({ ...schedule, startTime: override.startTime, duration: override.durationOverride ?? schedule.duration });
    }
  }

  const entries = expectedSchedules
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(schedule => {
      const session = data.sessions.find(item => item.scheduleId === schedule.id && item.date === date);
      return { schedule, session, recorded: Boolean(session && session.materialId !== 'SKIPPED') };
    });
  const schedCount = entries.length;
  const sessionCount = entries.filter(entry => entry.recorded).length;
  const skippedCount = entries.filter(entry => entry.session?.materialId === 'SKIPPED').length;
  const status: CalendarDayStatus = schedCount === 0
    ? holidayAffected || isGlobalHoliday ? 'holiday' : 'noclass'
    : date > today ? 'future'
    : sessionCount === 0 ? 'missed'
    : sessionCount >= schedCount ? 'done'
    : 'partial';

  return { date, status, sessionCount, schedCount, skippedCount, entries };
}

export function getCalendarHealthSummary(yearMonth: string, classId?: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = dateKey();
  const days = Array.from({ length: daysInMonth }, (_, index) =>
    getCalendarDayAudit(`${yearMonth}-${String(index + 1).padStart(2, '0')}`, classId)
  );
  const elapsedDays = days.filter(day => day.date <= today);
  return {
    days,
    planned: elapsedDays.reduce((sum, day) => sum + day.schedCount, 0),
    recorded: elapsedDays.reduce((sum, day) => sum + day.sessionCount, 0),
    missing: elapsedDays.reduce((sum, day) => sum + day.schedCount - day.sessionCount, 0),
    holidays: days.filter(day => day.status === 'holiday').length,
    attention: elapsedDays.filter(day => day.schedCount > day.sessionCount),
  };
}

export function getReliableMonthCalendar(yearMonth: string, classId?: string): CalendarDaySummary[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) =>
    getCalendarDayAudit(`${yearMonth}-${String(index + 1).padStart(2, '0')}`, classId)
  ).map(({ entries: _entries, ...summary }) => summary);
}
