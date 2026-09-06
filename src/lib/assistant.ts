import { getData, getSubjectStatus, getTodaySchedules } from './data';
import { getAllExamSubjects, getCorrections } from './examData';
import type { AppData, SubjectStatus } from './types';
import type { NavigationTarget } from './navigation';

export type AssistantPriority = 'urgent' | 'attention' | 'ready';

export interface AssistantItem {
  id: string;
  priority: AssistantPriority;
  title: string;
  reason: string;
  action: string;
  view: 'today' | 'progress' | 'exam' | 'exam-corrections' | 'setup';
  target?: NavigationTarget;
}

const priorityWeight: Record<AssistantPriority, number> = { urgent: 0, attention: 1, ready: 2 };

function progressItems(data: AppData): AssistantItem[] {
  const items: AssistantItem[] = [];
  for (const cls of data.classes) {
    for (const subject of data.subjects) {
      if (!data.schedules.some(schedule => schedule.classId === cls.id && schedule.subjectId === subject.id)) continue;
      const status: SubjectStatus = getSubjectStatus(subject, cls, data);
      if (!status.total || status.daysLeft === undefined) {
        items.push({ id: `incomplete:${cls.id}:${subject.id}`, priority: 'ready', title: `${cls.name} · ${subject.name}`, reason: !status.total ? 'Belum bisa diperkirakan. Tambahkan materi dan estimasi pertemuan.' : 'Belum bisa diperkirakan. Lengkapi semester dan batas ujian.', action: 'Lengkapi data', view: 'setup', target: { view: 'setup', classId: cls.id, subjectId: subject.id, section: !status.total ? 'materials' : 'semesters' } });
        continue;
      }
      if (status.status === 'on-track') continue;
      const priority: AssistantPriority = status.status === 'behind' ? 'urgent' : 'attention';
      const capacity = status.sessLeft ?? 0;
      const needed = status.sessionsNeeded ?? status.remaining;
      items.push({
        id: `pace:${cls.id}:${subject.id}`,
        priority,
        title: `${cls.name} · ${subject.name}`,
        reason: capacity > 0
          ? `Butuh ${needed} sesi, tersedia ${capacity} sebelum batas ujian.`
          : status.rec,
        action: 'Tinjau progres',
        view: 'progress',
        target: { view: 'progress', classId: cls.id, subjectId: subject.id, section: 'summary' },
      });
    }
  }
  return items;
}

export function getAssistantItems(): AssistantItem[] {
  const data = getData();
  const items: AssistantItem[] = [];
  const today = getTodaySchedules();
  const unrecorded = today.filter(item => !item.done);
  if (unrecorded.length) {
    items.push({
      id: 'today:agenda',
      priority: 'ready',
      title: `${unrecorded.length} sesi belum dicatat`,
      reason: `Mulai dari ${unrecorded[0].className} · ${unrecorded[0].subjectName}.`,
      action: 'Buka agenda',
      view: 'today',
    });
  }

  const corrections = getCorrections();
  for (const exam of getAllExamSubjects()) {
    if (exam.daysLeft >= 0) {
      if (exam.daysLeft <= 3) items.push({ id: `exam:${exam.subjectId}:${exam.examDate}`, priority: exam.daysLeft === 0 ? 'urgent' : 'attention', title: `${exam.daysLeft === 0 ? 'Ujian hari ini' : `Ujian ${exam.daysLeft} hari lagi`} · ${exam.subjectName}`, reason: `${exam.classes.length} kelas · ${exam.examDate}`, action: 'Lihat persiapan', view: 'exam', target: { view: 'exam', section: 'agenda', subjectId: exam.subjectId } });
      continue;
    }
    const pending = exam.classes.filter(cls => !corrections.some(c => c.classId === cls.classId && c.subjectId === exam.subjectId && c.examDate === exam.examDate && c.status === 'selesai'));
    if (!pending.length) continue;
    items.push({
      id: `correction:${exam.subjectId}:${exam.examDate}`,
      priority: exam.daysLeft < -5 ? 'urgent' : 'attention',
      title: `Koreksi ${exam.subjectName}`,
      reason: `${pending.length} kelas belum selesai dikoreksi.`,
      action: 'Buka koreksi',
      view: 'exam-corrections',
      target: { view: 'exam', section: 'koreksi' },
    });
  }

  items.push(...progressItems(data));
  return [...new Map(items.map(item => [item.id, item])).values()].sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);
}
