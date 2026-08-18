export * from './data';

import { dateKey, getData } from './data';
import type { MissingTeachingSession } from './types';

/**
 * Safety net pencatatan hanya untuk H-1.
 * EduTrack tidak mengejar utang input berminggu-minggu di tab Hari Ini;
 * histori yang lebih lama tetap bisa dilihat dari Kalender/Riwayat.
 */
export function getMissingTeachingSessions(): MissingTeachingSession[] {
  const data = getData();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = dateKey(yesterday);
  const result: MissingTeachingSession[] = [];

  for (const schedule of data.schedules) {
    if (!schedule.days.includes(yesterday.getDay())) continue;
    if (data.sessions.some(session => session.scheduleId === schedule.id && session.date === dateStr)) continue;

    const subject = data.subjects.find(item => item.id === schedule.subjectId);
    const isHoliday = data.holidays.some(holiday =>
      typeof holiday === 'string'
        ? holiday === dateStr
        : holiday.date === dateStr && (!holiday.level || holiday.level === subject?.level),
    );
    if (isHoliday) continue;

    const cancelled = data.scheduleOverrides?.some(override =>
      override.scheduleId === schedule.id && override.date === dateStr && override.skipped,
    );
    if (cancelled) continue;

    result.push({
      schedule,
      date: dateStr,
      className: data.classes.find(item => item.id === schedule.classId)?.name ?? '?',
      subjectName: subject?.name ?? '?',
    });
  }

  return result;
}
