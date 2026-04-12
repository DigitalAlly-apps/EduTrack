import { getData, todayNum, currentMin, timeToMin, now } from './data';
import { getAllExamSubjects, getCorrections } from './examData';

let checkInt: ReturnType<typeof setInterval>;
let notifiedIds: Set<string> = new Set();

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
      body, icon: '/icon-192.png', badge: '/icon-192.png',
      vibrate: [200, 100, 200], tag, requireInteraction: true,
    }).catch(e => console.error(e));
  } else {
    new Notification(title, { body, icon: '/icon-192.png' });
  }
}

async function checkAndNotify() {
  if (Notification.permission !== 'granted') return;
  const data = getData();
  const today = todayNum();
  const curMin = currentMin();
  const todayStr = now().toISOString().slice(0, 10);

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
        showNotif(`Kelas segera mulai: ${cls.name}`, `${sub.name} pukul ${s.startTime} (5 mnt lagi).`, key);
        notifiedIds.add(key);
      }
    }
  });

  // 2. Notif ujian besok (hanya sekali per hari, jam 18:00–18:05)
  if (curMin >= 18 * 60 && curMin <= 18 * 60 + 5) {
    const allExams = getAllExamSubjects();
    const tomorrow = allExams.filter(e => e.daysLeft === 1);
    tomorrow.forEach(e => {
      const key = `exam-tomorrow-${e.subjectId}-${todayStr}`;
      if (notifiedIds.has(key)) return;
      showNotif(`🚨 Ujian Besok!`, `${e.subjectName} diujikan besok. Pastikan semuanya siap.`, key);
      notifiedIds.add(key);
    });

    // 3. Notif ujian 3 hari lagi
    const in3 = allExams.filter(e => e.daysLeft === 3);
    in3.forEach(e => {
      const key = `exam-3days-${e.subjectId}-${todayStr}`;
      if (notifiedIds.has(key)) return;
      showNotif(`⚠️ Ujian 3 Hari Lagi`, `${e.subjectName} akan diujikan dalam 3 hari.`, key);
      notifiedIds.add(key);
    });
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
        if (notifiedIds.has(key)) return;
        showNotif(`🔴 Koreksi Terlambat`, `${exam.subjectName}: ${pending.map(c => c.className).join(', ')} belum selesai dikoreksi.`, key);
        notifiedIds.add(key);
      }
    });
  }

  // 5. Notif kelas selesai
  scheds.forEach(s => {
    const endMin = timeToMin(s.startTime) + (s.duration || 45);
    if (curMin >= endMin && curMin <= endMin + 15) {
      const key = `end-${s.id}-${todayStr}`;
      if (notifiedIds.has(key)) return;
      const isDone = data.sessions.some(se => se.scheduleId === s.id && se.date === todayStr);
      if (isDone) return;
      const cls = data.classes.find(c => c.id === s.classId);
      if (cls) {
        showNotif(`Kelas selesai: ${cls.name}`, `Waktunya tandai materi hari ini sudah selesai atau dilewati.`, key);
        notifiedIds.add(key);
      }
    }
  });
}
