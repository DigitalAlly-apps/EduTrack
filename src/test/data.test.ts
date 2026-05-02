import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applySmartReschedule,
  applyTeacherLeave,
  dateKey,
  exportJSON,
  getData,
  getMaterials,
  markDone,
  saveData,
  skipSession,
} from '@/lib/data';
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
    const { importJSON } = await import('@/lib/data');
    await importJSON(new File([backupText], 'backup.json', { type: 'application/json' }));

    expect(getData().classes).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem('edutrack_corrections') || '[]')).toHaveLength(1);
  });
});
