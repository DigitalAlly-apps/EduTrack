import { getData, dateKey } from './data';
import { getCorrections, getAllExamSubjects } from './examData';

export interface BriefingItem {
  type: 'ujian-hari-ini' | 'ujian-dekat' | 'koreksi-pending' | 'koreksi-overdue' | 'semua-beres';
  emoji: string;
  label: string;
  text: string;
  urgent: boolean;
}

export function getDailyBriefing(): BriefingItem[] {
  const data = getData();
  const corrections = getCorrections();
  const allExams = getAllExamSubjects();
  const todayStr = dateKey();
  const items: BriefingItem[] = [];

  // 1. Ujian hari ini
  const todayExams = allExams.filter(e => e.daysLeft === 0);
  if (todayExams.length > 0) {
    items.push({
      type: 'ujian-hari-ini',
      emoji: '📝',
      label: 'Ujian Hari Ini',
      text: todayExams.map(e => e.subjectName).join(', '),
      urgent: true,
    });
  }

  // 2. Ujian mendekat (H-1, H-2, H-3) — bukan hari ini
  const nearExams = allExams.filter(e => e.daysLeft > 0 && e.daysLeft <= 3);
  nearExams.forEach(e => {
    items.push({
      type: 'ujian-dekat',
      emoji: e.daysLeft === 1 ? '🚨' : '⚠️',
      label: e.daysLeft === 1 ? 'Besok Ujian' : `${e.daysLeft} Hari Lagi`,
      text: e.subjectName,
      urgent: e.daysLeft === 1,
    });
  });

  // 3. Koreksi overdue (ujian sudah > 5 hari lalu, masih ada yang belum/sedang)
  const overdueExams = allExams.filter(e => e.daysLeft < -5);
  overdueExams.forEach(exam => {
    const pending = exam.classes.filter(c => {
      const corr = corrections.find(x => x.subjectId === exam.subjectId && x.classId === c.classId && x.examDate === exam.examDate);
      return !corr || corr.status !== 'selesai';
    });
    if (pending.length > 0) {
      items.push({
        type: 'koreksi-overdue',
        emoji: '🔴',
        label: 'Koreksi Terlambat',
        text: `${exam.subjectName} — ${pending.map(c => c.className).join(', ')} belum selesai`,
        urgent: true,
      });
    }
  });

  // 4. Koreksi pending biasa (ujian sudah lewat, belum semua selesai)
  const recentPastExams = allExams.filter(e => e.daysLeft < 0 && e.daysLeft >= -5);
  recentPastExams.forEach(exam => {
    const pending = exam.classes.filter(c => {
      const corr = corrections.find(x => x.subjectId === exam.subjectId && x.classId === c.classId && x.examDate === exam.examDate);
      return !corr || corr.status !== 'selesai';
    });
    if (pending.length > 0) {
      items.push({
        type: 'koreksi-pending',
        emoji: '✏️',
        label: 'Perlu Dikoreksi',
        text: `${exam.subjectName} — ${pending.map(c => c.className).join(', ')}`,
        urgent: false,
      });
    }
  });

  // 5. Semua beres (tidak ada item lain)
  if (items.length === 0) {
    items.push({
      type: 'semua-beres',
      emoji: '✅',
      label: 'Semua Terkendali',
      text: 'Tidak ada ujian mendekat atau koreksi pending.',
      urgent: false,
    });
  }

  return items;
}
