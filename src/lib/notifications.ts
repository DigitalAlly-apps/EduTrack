import { getData, todayNum, currentMin, timeToMin, dateKey } from './data';
import { getAllExamSubjects, getCorrections, getExamSchedules, getProctorSessions, getExamReminderSettings } from './examData';

let checkInt: ReturnType<typeof setInterval>;
const notifiedIds: Set<string> = new Set();

export async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  const perm = await Notification.requestPermission();
  if (perm === 'granted') startLocalScheduler();
  return perm === 'granted';
}

export async function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    startLocalScheduler();
  }
}

export function startLocalScheduler() {
  if (checkInt) clearInterval(checkInt);
  checkInt = setInterval(checkAndNotify, 60000);
  checkAndNotify();
}

async function showNotif(title: string, body: string, tag: string) {
  let swReg: ServiceWorkerRegistration | undefined;
  if ('serviceWorker' in navigator) {
    swReg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  }
  if (swReg) {
    swReg.showNotification(title, {
      body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200], tag, requireInteraction: true,
    } as NotificationOptions).catch(e => console.error(e));
  } else {
    new Notification(title, { body, icon: '/icons/icon-192.png' });
  }
}

function wasNotified(key: string) {
  return notifiedIds.has(key) || localStorage.getItem(`edutrack_notified_${key}`) === '1';
}

function markNotified(key: string) {
  notifiedIds.add(key);
  localStorage.setItem(`edutrack_notified_${key}`, '1');
}

async function showOnce(title: string, body: string, key: string) {
  if (wasNotified(key)) return;
  await showNotif(title, body, key);
  markNotified(key);
}

function isWithinReminderWindow(diffMin: number, targetMin: number) {
  return diffMin <= targetMin && diffMin > targetMin - 5;
}

async function checkAndNotify() {
  if (Notification.permission !== 'granted') return;
  const data = getData();
  const today = todayNum();
  const curMin = currentMin();
  const todayStr = dateKey();
  const examReminder = getExamReminderSettings();

  // 1. Notif kelas 5 menit sebelum mulai
  const scheds = data.schedules.filter(s => s.days.includes(today));
  scheds.forEach(s => {
    const sMin = timeToMin(s.startTime);
    if (sMin - curMin <= 5 && sMin - curMin > 0) {
      const key = `sched-${s.id}-${s.startTime}`;
      if (notifiedIds.has(key)) return;
      const cls = data.classes.find(c => c.id === s.classId);
      const sub = data.subjects.find(x => x.id === s.subjectId);
      if (cls && sub) {
        showOnce(`Kelas segera mulai: ${cls.name}`, `${sub.name} pukul ${s.startTime} (5 mnt lagi).`, key);
      }
    }
  });

  // 2. Notif ujian besok (hanya sekali per hari, jam 18:00–18:05)
  if (examReminder.enabled && examReminder.dayBefore && curMin >= 18 * 60 && curMin <= 18 * 60 + 5) {
    const allExams = getAllExamSubjects();
    const tomorrow = allExams.filter(e => e.daysLeft === 1);
    tomorrow.forEach(e => {
      const key = `exam-tomorrow-${e.subjectId}-${todayStr}`;
      showOnce(`🚨 Ujian Besok!`, `${e.subjectName} diujikan besok. Pastikan semuanya siap.`, key);
    });

    // 3. Notif ujian 3 hari lagi
    const in3 = allExams.filter(e => e.daysLeft === 3);
    in3.forEach(e => {
      const key = `exam-3days-${e.subjectId}-${todayStr}`;
      showOnce(`⚠️ Ujian 3 Hari Lagi`, `${e.subjectName} akan diujikan dalam 3 hari.`, key);
    });
  }

  if (examReminder.enabled) {
    getExamSchedules().forEach(exam => {
      if (exam.date !== todayStr) return;
      const cls = data.classes.find(c => c.id === exam.classId)?.name || 'Kelas';
      const sub = data.subjects.find(s => s.id === exam.subjectId)?.name || 'Mapel';
      const diff = timeToMin(exam.startTime) - curMin;
      const baseKey = `exam-${exam.id}-${todayStr}`;

      if (examReminder.fiveHoursBefore && isWithinReminderWindow(diff, 5 * 60)) {
        showOnce('Ujian 5 Jam Lagi', `${cls} ${sub} mulai pukul ${exam.startTime}.`, `${baseKey}-5h`);
      }
      if (examReminder.oneHourBefore && isWithinReminderWindow(diff, 60)) {
        showOnce('Ujian 1 Jam Lagi', `${cls} ${sub} mulai pukul ${exam.startTime}.`, `${baseKey}-1h`);
      }
      if (examReminder.atStart && isWithinReminderWindow(diff, 0)) {
        showOnce('Ujian Dimulai', `${cls} ${sub} dimulai sekarang.`, `${baseKey}-start`);
      }
    });

    getProctorSessions().forEach(session => {
      if (session.date !== todayStr) return;
      const diff = timeToMin(session.startTime) - curMin;
      if (examReminder.proctorThirtyMinutes && isWithinReminderWindow(diff, 30)) {
        showOnce('Ngawas 30 Menit Lagi', `${session.subjectName} pukul ${session.startTime}${session.location ? ` di ${session.location}` : ''}.`, `proctor-${session.id}-${todayStr}-30m`);
      }
    });
  }

  // 3.5. Notif cerdas persiapan mengajar (jam 20:00–20:05)
  if (curMin >= 20 * 60 && curMin <= 20 * 60 + 5) {
    const tomorrowNum = (today + 1) % 7;
    const tomorrowScheds = data.schedules.filter(s => s.days.includes(tomorrowNum));
    const key = `prep-tomorrow-${todayStr}`;
    
    if (!notifiedIds.has(key)) {
      if (tomorrowScheds.length > 0) {
        showOnce(
          `Persiapan Besok: ${tomorrowScheds.length} Kelas`, 
          `Kamu punya ${tomorrowScheds.length} jadwal mengajar besok. Jangan lupa istirahat yang cukup malam ini.`, 
          key
        );
      } else if (today !== 6) { // Jangan notif "besok kosong" kalau besok minggu, karena itu normal
        showOnce(
          `Besok Kosong! 🎉`, 
          `Tidak ada jadwal mengajar besok. Santai sedikit malam ini ya!`, 
          key
        );
      }
    }
  }

  // 4. Notif koreksi overdue — jam 07:00–07:05
  if (curMin >= 7 * 60 && curMin <= 7 * 60 + 5) {
    const allExams = getAllExamSubjects();
    const corrections = getCorrections();
    allExams.filter(e => e.daysLeft < -5).forEach(exam => {
      const pending = exam.classes.filter(c => {
        const corr = corrections.find(x => x.subjectId === exam.subjectId && x.classId === c.classId && x.examDate === exam.examDate);
        return !corr || corr.status !== 'selesai';
      });
      if (pending.length > 0) {
        const key = `corr-overdue-${exam.subjectId}-${todayStr}`;
        showOnce(`🔴 Koreksi Terlambat`, `${exam.subjectName}: ${pending.map(c => c.className).join(', ')} belum selesai dikoreksi.`, key);
      }
    });
  }

  // 5. Notif kelas selesai
  scheds.forEach(s => {
    const endMin = timeToMin(s.startTime) + (s.duration || 45);
    if (curMin >= endMin && curMin <= endMin + 15) {
      const key = `end-${s.id}-${todayStr}`;
      const isDone = data.sessions.some(se => se.scheduleId === s.id && se.date === todayStr);
      if (isDone) return;
      const cls = data.classes.find(c => c.id === s.classId);
      if (cls) {
        showOnce(`Kelas selesai: ${cls.name}`, `Waktunya tandai materi hari ini sudah selesai atau dilewati.`, key);
      }
    }
  });
}
