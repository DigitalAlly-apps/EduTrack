import { dateFromKey, dateKey, getData, saveData } from './data';
import type { AppData, Material, SubjectStatus } from './types';

export type CalendarDayStatus = 'done' | 'partial' | 'missed' | 'holiday' | 'noclass' | 'future';

export type CalendarDaySummary = {
  date: string;
  status: CalendarDayStatus;
  sessionCount: number;
  schedCount: number;
  skippedCount: number;
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
export function getReliableMonthCalendar(yearMonth: string): CalendarDaySummary[] {
  const data = getData();
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = dateKey();
  const result: CalendarDaySummary[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${yearMonth}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = dateFromKey(date).getDay();
    const baseSchedules = data.schedules.filter(schedule => schedule.days.includes(dayOfWeek));
    const overrides = (data.scheduleOverrides ?? []).filter(override => override.date === date);

    let holidayAffected = false;
    const regularExpected = baseSchedules.filter(schedule => {
      const subject = data.subjects.find(item => item.id === schedule.subjectId);
      if (isHolidayForSubject(data, date, subject?.level)) {
        holidayAffected = true;
        return false;
      }
      const override = overrides.find(item => item.scheduleId === schedule.id && !item.isExtra);
      return !override?.skipped;
    });

    const extraExpected = overrides.filter(override => {
      if (!override.isExtra || override.skipped) return false;
      const schedule = data.schedules.find(item => item.id === override.scheduleId);
      if (!schedule) return false;
      const subject = data.subjects.find(item => item.id === schedule.subjectId);
      return !isHolidayForSubject(data, date, subject?.level);
    });

    const schedCount = regularExpected.length + extraExpected.length;
    const sessions = data.sessions.filter(session => session.date === date);
    const taughtSessions = sessions.filter(session => session.materialId !== 'SKIPPED');
    const skippedCount = sessions.length - taughtSessions.length;
    const sessionCount = taughtSessions.length;

    if (schedCount === 0 && holidayAffected) {
      result.push({ date, status: 'holiday', sessionCount, schedCount, skippedCount });
      continue;
    }

    if (schedCount === 0) {
      result.push({ date, status: 'noclass', sessionCount, schedCount, skippedCount });
      continue;
    }

    if (date > today) {
      result.push({ date, status: 'future', sessionCount, schedCount, skippedCount });
      continue;
    }

    if (sessionCount === 0) {
      result.push({ date, status: 'missed', sessionCount, schedCount, skippedCount });
    } else if (sessionCount >= schedCount) {
      result.push({ date, status: 'done', sessionCount, schedCount, skippedCount });
    } else {
      result.push({ date, status: 'partial', sessionCount, schedCount, skippedCount });
    }
  }

  return result;
}
