import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTeachingPosition, saveData } from '@/lib/data';
import { getReliableMonthCalendar, getTrackerMessage, normalizeProgressConsistency } from '@/lib/progressConsistency';
import type { AppData, SubjectStatus } from '@/lib/types';

function makeData(): AppData {
  return {
    teacherName: 'Guru Test',
    classes: [{ id: 'c1', name: '7A', color: 'blue', level: '7' }],
    subjects: [{ id: 's1', name: 'Fiqih', level: '7', examDate: null }],
    materials: [
      { id: 'm1', subjectId: 's1', classId: 'c1', name: 'Bab 1', order: 1, sessions: 3 },
      { id: 'm2', subjectId: 's1', classId: 'c1', name: 'Bab 2', order: 2, sessions: 2 },
    ],
    schedules: [{ id: 'sc1', classId: 'c1', subjectId: 's1', days: [2], startTime: '08:00', duration: 45 }],
    progress: [{ id: 'p1', classId: 'c1', subjectId: 's1', materialsDone: 1, lastSession: '2026-08-18' }],
    sessions: [],
    tasks: [],
    notes: [],
    lastBackup: null,
    reminderDismissed: null,
    holidays: [],
    scheduleOverrides: [],
    examSchedules: [],
    semesters: [],
    academicYear: '2026/2027',
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 18, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('normalizeProgressConsistency', () => {
  it('moves both legacy session count and teaching position to the next chapter after early completion', () => {
    const data = makeData();
    data.sessions.push({
      id: 'sess1', scheduleId: 'sc1', classId: 'c1', subjectId: 's1', date: '2026-08-18',
      materialId: 'm1', materialCompleted: true, completedAt: '2026-08-18T03:00:00.000Z',
    });
    data.progress[0].completedMaterialIds = ['m1'];
    saveData(data);

    expect(normalizeProgressConsistency()).toBe(true);

    const position = getTeachingPosition('c1', 's1');
    expect(position.material?.id).toBe('m2');
    expect(position.sessionIndex).toBe(1);
    expect(position.completedMaterialIds).toContain('m1');
  });

  it('fills previous chapters when a later chapter is explicitly completed', () => {
    const data = makeData();
    data.materials.push({ id: 'm3', subjectId: 's1', classId: 'c1', name: 'Bab 3', order: 3, sessions: 1 });
    data.progress[0].materialsDone = 4;
    data.progress[0].completedMaterialIds = ['m2'];
    saveData(data);

    normalizeProgressConsistency();
    const position = getTeachingPosition('c1', 's1');
    expect(position.completedMaterialIds).toEqual(expect.arrayContaining(['m1', 'm2']));
    expect(position.material?.id).toBe('m3');
  });
});

describe('tracker wording', () => {
  it('states the concrete deficit instead of telling the teacher to keep pace', () => {
    const status: SubjectStatus = {
      status: 'tight', label: 'Mepet target', pct: 50, done: 5, total: 12,
      remaining: 7, sessLeft: 5, sessionsNeeded: 7, holidaysInPeriod: 0,
      rec: 'Jaga ritme.', nextSched: null,
    };
    expect(getTrackerMessage(status)).toContain('Kurang 2 sesi');
    expect(getTrackerMessage(status)).not.toContain('Jaga ritme');
  });
});

describe('reliable progress calendar', () => {
  it('does not count a skipped session as a completed teaching session', () => {
    const data = makeData();
    data.sessions.push({
      id: 'skip1', scheduleId: 'sc1', classId: 'c1', subjectId: 's1', date: '2026-08-18',
      materialId: 'SKIPPED', completedAt: '2026-08-18T03:00:00.000Z',
    });
    saveData(data);

    const day = getReliableMonthCalendar('2026-08').find(item => item.date === '2026-08-18');
    expect(day).toMatchObject({ status: 'missed', sessionCount: 0, schedCount: 1, skippedCount: 1 });
  });

  it('marks a scheduled holiday as holiday instead of missed', () => {
    const data = makeData();
    data.holidays = ['2026-08-18'];
    saveData(data);

    const day = getReliableMonthCalendar('2026-08').find(item => item.date === '2026-08-18');
    expect(day?.status).toBe('holiday');
  });
});
