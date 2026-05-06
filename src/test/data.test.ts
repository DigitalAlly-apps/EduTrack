import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applySmartReschedule,
  applyTeacherLeave,
  bulkAddMaterials,
  dateKey,
  exportJSON,
  getData,
  getMaterials,
  getDailyPriorities,
  getPredictiveFinishes,
  getTodaySchedules,
  getTeachingPosition,
  importJSON,
  markDone,
  parseMaterialDraftLine,
  parseMaterialDraftLines,
  saveData,
  skipSession,
  updateMaterial,
} from '@/lib/data';
import { addExamSchedule, deleteExamSchedule, getExamSchedules, getTodayExamItems } from '@/lib/examData';
import { AppData } from '@/lib/types';

const baseData = (day = new Date().getDay()): AppData => ({
  teacherName: 'Guru Test',
  classes: [
    { id: 'c1', name: '10A', color: 'blue', level: '10' },
    { id: 'c2', name: '10B', color: 'green', level: '10' },
    { id: 'c3', name: '11A', color: 'purple', level: '11' },
  ],
  subjects: [{ id: 's1', name: 'Matematika', level: '10', examDate: null }],
  materials: [
    { id: 'm1', subjectId: 's1', classId: 'c1', name: 'Khusus 10A', order: 1, sessions: 2 },
    { id: 'm2', subjectId: 's1', level: '11', name: 'Shared 11', order: 1, sessions: 1 },
  ],
  schedules: [{ id: 'sc1', classId: 'c1', subjectId: 's1', days: [day], startTime: '08:00', duration: 45 }],
  progress: [{ id: 'p1', classId: 'c1', subjectId: 's1', materialsDone: 0, lastSession: null }],
  sessions: [],
  tasks: [],
  notes: [],
  lastBackup: null,
  reminderDismissed: null,
  holidays: [],
  scheduleOverrides: [],
  academicYear: '',
});

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const readBlobText = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(blob);
});

describe('dateKey', () => {
  it('formats dates using local calendar fields', () => {
    expect(dateKey(new Date(2025, 0, 2, 0, 30))).toBe('2025-01-02');
  });
});

describe('materials scoping', () => {
  it('does not leak class-specific materials to another class', () => {
    saveData(baseData());

    expect(getMaterials('s1', 'c1').map(m => m.name)).toEqual(['Khusus 10A']);
    expect(getMaterials('s1', 'c2')).toEqual([]);
    expect(getMaterials('s1', 'c3').map(m => m.name)).toEqual(['Shared 11']);
  });

  it('keeps old material data valid when optional page fields are missing', () => {
    saveData(baseData());

    const material = getMaterials('s1', 'c1')[0];
    expect(material.name).toBe('Khusus 10A');
    expect(material.pageStart).toBeUndefined();
    expect(material.pageEnd).toBeUndefined();
    expect(material.note).toBeUndefined();
  });

  it('stores optional page and note fields when updating material', () => {
    saveData(baseData());

    updateMaterial('m1', 'Bab 1 — Aljabar', 3, { pageStart: ' 12 ', pageEnd: '20', note: ' fokus latihan ' });

    const material = getMaterials('s1', 'c1')[0];
    expect(material).toMatchObject({
      name: 'Bab 1 — Aljabar',
      sessions: 3,
      pageStart: '12',
      pageEnd: '20',
      note: 'fokus latihan',
    });
  });

  it('supports legacy and detailed bulk material input', () => {
    const data = baseData();
    data.materials = [];
    saveData(data);

    bulkAddMaterials('s1', ['Bab Lama'], 2, undefined, 'c1');
    bulkAddMaterials('s1', [{ name: 'Bab Detail', sessions: 3, pageStart: '1', pageEnd: '12', note: 'ulang konsep dasar' }], 1, undefined, 'c1');

    expect(getMaterials('s1', 'c1')).toMatchObject([
      { name: 'Bab Lama', sessions: 2 },
      { name: 'Bab Detail', sessions: 3, pageStart: '1', pageEnd: '12', note: 'ulang konsep dasar' },
    ]);
  });

  it('parses detailed bulk material lines with sessions, pages, and notes', () => {
    expect(parseMaterialDraftLine('Bab 1 - Bilangan Bulat | 2x | hal 1-12 | banyak latihan soal', 1)).toEqual({
      name: 'Bab 1 - Bilangan Bulat',
      sessions: 2,
      pageStart: '1',
      pageEnd: '12',
      note: 'banyak latihan soal',
    });

    expect(parseMaterialDraftLines('Bab 2 - Pecahan\nBab 3 - Persen | 3 pertemuan | halaman 13 | ulang konsep', 2)).toEqual([
      { name: 'Bab 2 - Pecahan', sessions: 2 },
      { name: 'Bab 3 - Persen', sessions: 3, pageStart: '13', note: 'ulang konsep' },
    ]);
  });

  it('returns the active teaching position for multi-session materials', () => {
    const data = baseData();
    data.materials = [
      { id: 'm1', subjectId: 's1', classId: 'c1', name: 'Bab 1', order: 1, sessions: 1, pageStart: '1', pageEnd: '8', note: 'pemanasan' },
      { id: 'm2', subjectId: 's1', classId: 'c1', name: 'Bab 2', order: 2, sessions: 2, pageStart: '9', pageEnd: '20', note: 'latihan banyak' },
    ];
    data.progress[0].materialsDone = 1;
    saveData(data);

    expect(getTeachingPosition('c1', 's1')).toMatchObject({
      material: { id: 'm2', name: 'Bab 2', pageStart: '9', pageEnd: '20', note: 'latihan banyak' },
      materialNumber: 2,
      sessionIndex: 1,
      totalSessionsInMaterial: 2,
      totalSessionsDone: 1,
      totalSessionsAll: 3,
      isComplete: false,
    });

    data.progress[0].materialsDone = 3;
    saveData(data);
    expect(getTeachingPosition('c1', 's1')).toMatchObject({
      material: null,
      totalSessionsDone: 3,
      totalSessionsAll: 3,
      isComplete: true,
    });
  });
});

describe('session actions', () => {
  it('markDone records a session and advances progress, while skipSession does not advance progress', () => {
    const data = baseData();
    data.schedules.push({ id: 'sc2', classId: 'c1', subjectId: 's1', days: [new Date().getDay()], startTime: '09:00', duration: 45 });
    saveData(data);

    markDone('sc1', 'Selesai');
    expect(getData().sessions).toHaveLength(1);
    expect(getData().progress[0].materialsDone).toBe(1);

    skipSession('sc2');
    const afterSkip = getData();
    expect(afterSkip.sessions).toHaveLength(2);
    expect(afterSkip.sessions.find(s => s.scheduleId === 'sc2')?.materialId).toBe('SKIPPED');
    expect(afterSkip.progress[0].materialsDone).toBe(1);
  });
});

describe('daily priorities', () => {
  it('summarizes the next teaching action with material pages', () => {
    const data = baseData(new Date().getDay());
    data.schedules[0].startTime = '23:59';
    data.materials[0] = { ...data.materials[0], name: 'Bab 1', pageStart: '1', pageEnd: '8', note: 'pemanasan' };
    saveData(data);

    expect(getDailyPriorities()[0]).toMatchObject({
      type: 'next',
      title: 'Berikutnya: 10A',
      detail: expect.stringContaining('Bab 1, Pertemuan 1/2, Hal. 1-8'),
    });
  });

  it('includes urgent task priority when task is due today', () => {
    const data = baseData(new Date().getDay());
    data.tasks.push({ id: 't1', classId: 'c1', subjectId: 's1', title: 'Cek PR', deadline: dateKey(), status: 'pending' });
    saveData(data);

    expect(getDailyPriorities().some(p => p.type === 'task' && p.urgent && p.detail.includes('Cek PR'))).toBe(true);
  });
});

describe('predictive finish', () => {
  it('uses actual scheduled teaching dates instead of weekly averages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-04T06:00:00'));
    const data = baseData(1);
    data.subjects[0].examDate = '2026-05-15';
    data.schedules[0].days = [1, 3];
    data.schedules[0].startTime = '08:00';
    data.materials = [{ id: 'm1', subjectId: 's1', classId: 'c1', name: 'Bab 1', order: 1, sessions: 4 }];
    saveData(data);

    expect(getPredictiveFinishes()[0]).toMatchObject({
      classId: 'c1',
      subjectId: 's1',
      predictedFinishDate: '2026-05-13',
      daysDifference: 2,
      pace: 'on-track',
    });
    vi.useRealTimers();
  });

  it('marks prediction behind when real sessions before exam are insufficient', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-04T06:00:00'));
    const data = baseData(1);
    data.subjects[0].examDate = '2026-05-08';
    data.schedules[0].days = [1];
    data.schedules[0].startTime = '08:00';
    data.materials = [{ id: 'm1', subjectId: 's1', classId: 'c1', name: 'Bab 1', order: 1, sessions: 2 }];
    saveData(data);

    expect(getPredictiveFinishes()[0]).toMatchObject({
      predictedFinishDate: '2026-05-11',
      daysDifference: -3,
      pace: 'behind',
    });
    vi.useRealTimers();
  });
});

describe('smart reschedule', () => {
  it('postpones today without creating invalid time and creates a catch-up task for next regular slot', () => {
    const today = dateKey();
    saveData(baseData(new Date().getDay()));

    applySmartReschedule(today, [{ scheduleId: 'sc1', action: 'postpone', days: 7 }]);

    const data = getData();
    expect(data.scheduleOverrides?.find(o => o.date === today && o.scheduleId === 'sc1')?.skipped).toBe(true);
    expect(data.scheduleOverrides?.some(o => o.startTime === '176:00')).toBe(false);
    expect(data.tasks.some(t => t.title.includes('Lanjutkan sesi tertunda'))).toBe(true);
  });
});

describe('teacher leave', () => {
  it('advances multi-session material progress by sessions instead of material index', () => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    const targetDate = dateKey(target);
    const data = baseData(target.getDay());
    data.progress[0].materialsDone = 1;
    saveData(data);

    applyTeacherLeave(targetDate, 'Izin', [{ scheduleId: 'sc1', action: 'deliver', note: 'Tugas mandiri' }]);

    expect(getData().progress[0].materialsDone).toBe(2);
    expect(getData().sessions[0].note).toBe('Tugas mandiri');
  });
});

describe('exam schedules', () => {
  it('stores detailed exam schedules and builds today exam items from them', () => {
    saveData(baseData());
    const today = dateKey();

    const created = addExamSchedule({
      classId: 'c1',
      subjectId: 's1',
      date: today,
      startTime: '07:30',
      endTime: '09:00',
      location: 'R. 1',
      note: 'PTS',
    });

    expect(getExamSchedules()).toHaveLength(1);
    expect(getData().subjects[0].examDate).toBe(today);
    const [item] = getTodayExamItems();
    expect(item).toMatchObject({
      scheduleId: created.id,
      className: '10A',
      subjectName: 'Matematika',
      duration: 90,
      location: 'R. 1',
      note: 'PTS',
    });

    deleteExamSchedule(created.id);
    expect(getExamSchedules()).toHaveLength(0);
    expect(getData().subjects[0].examDate).toBeNull();
  });

  it('syncs subject exam date to the earliest detailed exam schedule', () => {
    saveData(baseData());

    addExamSchedule({ classId: 'c1', subjectId: 's1', date: '2026-05-20', startTime: '09:00', endTime: '10:00' });
    const earliest = addExamSchedule({ classId: 'c2', subjectId: 's1', date: '2026-05-10', startTime: '07:30', endTime: '09:00' });

    expect(getData().subjects[0].examDate).toBe('2026-05-10');

    deleteExamSchedule(earliest.id);
    expect(getData().subjects[0].examDate).toBe('2026-05-20');
  });
});

describe('exam day mode', () => {
  it('stops today KBM schedules while exam mode is active', () => {
    const today = dateKey();
    saveData(baseData(new Date().getDay()));

    expect(getTodaySchedules()).toHaveLength(1);

    localStorage.setItem('edutrack_exam_mode', JSON.stringify({ date: today, active: true }));
    expect(getTodaySchedules()).toEqual([]);
  });
});

describe('backup and import', () => {
  it('exports and imports exam corrections with the JSON backup', async () => {
    saveData(baseData());
    localStorage.setItem('edutrack_corrections', JSON.stringify([{ id: 'corr1', subjectId: 's1', classId: 'c1', examDate: '2025-01-02', status: 'selesai', updatedAt: '2025-01-02T00:00:00.000Z' }]));

    let exportedBlob: Blob | null = null;
    const createObjectURL = vi.fn((blob: Blob) => {
      exportedBlob = blob;
      return 'blob:edutrack-test';
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    exportJSON();

    expect(exportedBlob).not.toBeNull();
    const backupText = await readBlobText(exportedBlob!);
    expect(JSON.parse(backupText).corrections).toHaveLength(1);

    localStorage.clear();
    await importJSON(new File([backupText], 'backup.json', { type: 'application/json' }));

    expect(getData().classes).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem('edutrack_corrections') || '[]')).toHaveLength(1);
  });

  it('imports old backups that do not have material page fields', async () => {
    const oldBackup = JSON.stringify(baseData());

    await importJSON(new File([oldBackup], 'old-backup.json', { type: 'application/json' }));

    const material = getMaterials('s1', 'c1')[0];
    expect(material.name).toBe('Khusus 10A');
    expect(material.pageStart).toBeUndefined();
    expect(material.pageEnd).toBeUndefined();
    expect(material.note).toBeUndefined();
    expect(getData().examSchedules).toEqual([]);
  });
});
