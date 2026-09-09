import {
  AppData,
  Material,
  Subject,
  ClassItem,
  Semester,
  Schedule
} from './types';

import {
  getData,
  getMaterials,
  getSubjectSemester,
  getCurrentExamPhase,
  getSubjectStatus,
  getTeachingPosition,
  getTotalSessionsNeeded,
  updateData
} from './data';

export interface SyllabusOverview {
  subjectId: string;
  classId: string;
  subjectName: string;
  className: string;
  totalMaterials: number;
  totalSessions: number;
  utsMaterials: number;
  utsSessions: number;
  uasMaterials: number;
  uasSessions: number;
  untaggedMaterials: number;
  isBalanced: boolean;
  balance: 'balanced' | 'uts-heavy' | 'uas-heavy' | 'untagged';
  utsSessionsDone: number;
  uasSessionsDone: number;
  utsPct: number;
  uasPct: number;
}

export interface DistributionSuggestion {
  materialId: string;
  materialName: string;
  sessions: number;
  suggestedPeriod: 'UTS' | 'UAS';
  order: number;
}

export interface ExamReadiness {
  classId: string;
  subjectId: string;
  phase: 'UTS' | 'UAS' | null;
  score: number;
  status: 'ahead' | 'on-track' | 'tight' | 'behind' | 'critical' | 'complete' | 'no-data';
  materialsTotal: number;
  materialsDone: number;
  sessionsTotal: number;
  sessionsDone: number;
  sessionsAvailable: number;
  daysToExam: number | null;
  recommendation: string;
  phaseLabel: string;
}

export interface SyllabusAlert {
  classId: string;
  subjectId: string;
  className: string;
  subjectName: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  phase: 'UTS' | 'UAS' | null;
  message: string;
  detail?: string;
  daysToExam?: number;
}

export function suggestExamPeriodDistribution(materials: Material[]): DistributionSuggestion[] {
  const suggestions: DistributionSuggestion[] = [];
  if (materials.length === 0) return suggestions;
  if (materials.length === 1) {
    return [{
      materialId: materials[0].id,
      materialName: materials[0].name,
      sessions: materials[0].sessions ?? 1,
      suggestedPeriod: 'UTS',
      order: materials[0].order
    }];
  }

  const totalSessions = materials.reduce((sum, m) => sum + (m.sessions ?? 1), 0);
  let cumulative = 0;
  let hasUas = false;

  for (let i = 0; i < materials.length; i++) {
    const m = materials[i];
    const sessions = m.sessions ?? 1;
    let period: 'UTS' | 'UAS' = 'UTS';

    if (i === materials.length - 1 && !hasUas) {
      period = 'UAS';
    } else if (i > 0 && cumulative + sessions / 2 > totalSessions / 2) {
      period = 'UAS';
      hasUas = true;
    }

    cumulative += sessions;
    suggestions.push({
      materialId: m.id,
      materialName: m.name,
      sessions,
      suggestedPeriod: period,
      order: m.order
    });
  }
  return suggestions;
}

export function applyExamPeriodDistribution(suggestions: DistributionSuggestion[]): void {
  updateData((d) => {
    suggestions.forEach(s => {
      const mat = d.materials.find(m => m.id === s.materialId);
      if (mat) {
        mat.examPeriod = s.suggestedPeriod;
      }
    });
  });
}

export function getSyllabusOverview(subjectId: string, classId: string): SyllabusOverview | null {
  const data = getData();
  const materials = getMaterials(subjectId, classId);
  if (!materials.length) return null;

  const subjectName = data.subjects.find(s => s.id === subjectId)?.name || 'Unknown';
  const className = data.classes.find(c => c.id === classId)?.name || 'Unknown';
  
  let totalSessions = 0;
  let utsMaterials = 0, utsSessions = 0;
  let uasMaterials = 0, uasSessions = 0;
  let untaggedMaterials = 0;
  
  const utsMatIds = new Set<string>();
  const uasMatIds = new Set<string>();

  materials.forEach(m => {
    const s = m.sessions ?? 1;
    totalSessions += s;
    if (m.examPeriod === 'UTS') {
      utsMaterials++;
      utsSessions += s;
      utsMatIds.add(m.id);
    } else if (m.examPeriod === 'UAS') {
      uasMaterials++;
      uasSessions += s;
      uasMatIds.add(m.id);
    } else {
      untaggedMaterials++;
    }
  });

  const isBalanced = Math.abs(utsSessions - uasSessions) <= 2;
  let balance: 'balanced' | 'uts-heavy' | 'uas-heavy' | 'untagged' = 'balanced';
  if (untaggedMaterials === materials.length) balance = 'untagged';
  else if (!isBalanced) balance = utsSessions > uasSessions ? 'uts-heavy' : 'uas-heavy';

  let utsSessionsDone = 0;
  let uasSessionsDone = 0;

  const pos = getTeachingPosition(classId, subjectId, data);
  const explicitCompletedIds = new Set(pos.completedMaterialIds);

  materials.forEach(m => {
    if (explicitCompletedIds.has(m.id)) {
      if (utsMatIds.has(m.id)) utsSessionsDone += m.sessions ?? 1;
      if (uasMatIds.has(m.id)) uasSessionsDone += m.sessions ?? 1;
    }
  });

  data.sessions.forEach(sess => {
    if (sess.classId === classId && sess.subjectId === subjectId && sess.materialId && sess.materialId !== 'SKIPPED') {
      if (!explicitCompletedIds.has(sess.materialId)) {
        if (utsMatIds.has(sess.materialId)) utsSessionsDone++;
        else if (uasMatIds.has(sess.materialId)) uasSessionsDone++;
      }
    }
  });

  utsSessionsDone = Math.min(utsSessionsDone, utsSessions);
  uasSessionsDone = Math.min(uasSessionsDone, uasSessions);

  return {
    subjectId,
    classId,
    subjectName,
    className,
    totalMaterials: materials.length,
    totalSessions,
    utsMaterials,
    utsSessions,
    uasMaterials,
    uasSessions,
    untaggedMaterials,
    isBalanced,
    balance,
    utsSessionsDone,
    uasSessionsDone,
    utsPct: utsSessions ? Math.round((utsSessionsDone / utsSessions) * 100) : 0,
    uasPct: uasSessions ? Math.round((uasSessionsDone / uasSessions) * 100) : 0
  };
}

export function getAllSyllabusOverviews(): SyllabusOverview[] {
  const data = getData();
  const res: SyllabusOverview[] = [];
  
  data.subjects.forEach(sub => {
    data.classes.forEach(cls => {
      const hasSched = data.schedules.some(s => s.subjectId === sub.id && s.classId === cls.id);
      if (hasSched) {
        const ov = getSyllabusOverview(sub.id, cls.id);
        if (ov) res.push(ov);
      }
    });
  });
  return res;
}

function calculateScoreFromStatus(statusInfo: ReturnType<typeof getSubjectStatus>): { score: number; status: ExamReadiness['status'] } {
  const sessionsDone = statusInfo.done;
  const sessionsTotal = statusInfo.total;
  const sessionsAvailable = statusInfo.sessLeft ?? 0;
  const daysToExam = statusInfo.daysLeft ?? null;

  if (sessionsTotal === 0) return { score: 0, status: 'no-data' };
  if (sessionsDone >= sessionsTotal) return { score: 100, status: 'complete' };
  if (daysToExam === null) return { score: 0, status: 'no-data' };

  const compScore = Math.min(40, (sessionsDone / sessionsTotal) * 40);
  
  const sessionsRemaining = sessionsTotal - sessionsDone;
  let paceScore = 0;
  if (sessionsAvailable >= sessionsRemaining) paceScore = 40;
  else if (sessionsAvailable >= sessionsRemaining * 0.8) paceScore = 28;
  else if (sessionsAvailable >= sessionsRemaining * 0.5) paceScore = 16;
  
  let timeScore = 0;
  if (daysToExam > 30) timeScore = 20;
  else if (daysToExam > 14) timeScore = 15;
  else if (daysToExam > 7) timeScore = 10;
  else if (daysToExam > 3) timeScore = 5;
  
  const score = Math.round(compScore + paceScore + timeScore);
  
  let status: ExamReadiness['status'] = 'critical';
  if (score >= 90) status = 'ahead';
  else if (score >= 75) status = 'on-track';
  else if (score >= 55) status = 'tight';
  else if (score >= 35) status = 'behind';

  return { score, status };
}

export function getExamReadiness(subjectId: string, classId: string): ExamReadiness {
  const data = getData();
  const sub = data.subjects.find(s => s.id === subjectId)!;
  const cls = data.classes.find(c => c.id === classId)!;
  
  const statusInfo = getSubjectStatus(sub, cls, data);
  const semester = getSubjectSemester(sub, data);
  const phase = semester ? getCurrentExamPhase(semester) : null;
  const phaseLabel = phase === 'UTS' ? 'UTS' : (phase === 'UAS' ? 'UAS' : 'Ujian');
  
  const pos = getTeachingPosition(classId, subjectId, data);
  const completedIds = new Set(pos.completedMaterialIds);
  const mats = getMaterials(subjectId, classId);
  const targetMats = mats.filter(m => {
    if (phase === 'UTS') return m.examPeriod === 'UTS';
    if (phase === 'UAS') return m.examPeriod === 'UAS' || !m.examPeriod;
    return true;
  });

  const sessionsDone = statusInfo.done;
  const sessionsTotal = statusInfo.total;
  const sessionsAvailable = statusInfo.sessLeft ?? 0;
  const daysToExam = statusInfo.daysLeft ?? null;

  let materialsDoneCount = 0;
  let sDone = 0;
  for (const m of targetMats) {
    const s = m.sessions ?? 1;
    if (completedIds.has(m.id)) {
      materialsDoneCount++;
      sDone += s;
    } else if (sDone + s <= sessionsDone) {
      materialsDoneCount++;
      sDone += s;
    } else {
      sDone += s;
    }
  }

  const { score, status } = calculateScoreFromStatus(statusInfo);

  let rec = '';
  if (status === 'complete') rec = 'Materi sudah selesai semua.';
  else if (status === 'ahead') rec = 'Sangat aman, bisa untuk pengayaan.';
  else if (status === 'on-track') rec = 'Aman, lanjutkan ritme mengajar saat ini.';
  else if (status === 'tight') rec = 'Jadwal mepet, jangan sampai ada sesi yang kosong.';
  else if (status === 'behind') rec = 'Tertinggal, perlu tambahan sesi atau ringkas materi.';
  else if (status === 'critical') rec = 'Kritis! Sangat butuh kelas tambahan segera.';
  else if (status === 'no-data') rec = 'Belum ada data materi atau jadwal ujian.';

  return {
    classId,
    subjectId,
    phase: phase === 'UTS' || phase === 'UAS' ? phase : null,
    score,
    status,
    materialsTotal: targetMats.length,
    materialsDone: materialsDoneCount,
    sessionsTotal,
    sessionsDone,
    sessionsAvailable,
    daysToExam,
    recommendation: rec,
    phaseLabel
  };
}

export function getSyllabusAlerts(todayClassSubjectPairs?: {classId: string, subjectId: string}[]): SyllabusAlert[] {
  const data = getData();
  const alerts: SyllabusAlert[] = [];

  const todayPairs = new Set(todayClassSubjectPairs?.map(p => `${p.classId}-${p.subjectId}`) || []);

  data.subjects.forEach(sub => {
    data.classes.forEach(cls => {
      const hasSched = data.schedules.some(s => s.subjectId === sub.id && s.classId === cls.id);
      const mats = getMaterials(sub.id, cls.id);
      if (!hasSched || !mats.length) return;

      const semester = getSubjectSemester(sub, data);
      const phase = semester ? getCurrentExamPhase(semester) : null;
      if (!phase) return;

      const statusInfo = getSubjectStatus(sub, cls, data);
      if (statusInfo.daysLeft === undefined && statusInfo.status !== 'on-track') return;

      const daysLeft = statusInfo.daysLeft ?? 999;
      let severity: SyllabusAlert['severity'] = 'info';
      let msg = '';

      if (statusInfo.status === 'behind' && daysLeft < 14) {
        severity = 'critical';
        msg = `${sub.name} ${cls.name}: Kurang ${statusInfo.remaining} sesi, deadline ${daysLeft} hari`;
      } else if (statusInfo.status === 'behind' || statusInfo.status === 'tight') {
        severity = 'warning';
        msg = `${sub.name} ${cls.name}: Jadwal mepet sebelum ${phase}`;
      } else if (statusInfo.status === 'on-track' && statusInfo.pct >= 100) {
        severity = 'success';
        msg = `${sub.name} ${cls.name}: Materi ${phase} selesai ✓`;
      } else if (statusInfo.status === 'on-track') {
        severity = 'info';
        msg = `${sub.name} ${cls.name}: Progress ${statusInfo.pct}% — ${statusInfo.remaining} sesi tersisa`;
      }

      alerts.push({
        classId: cls.id,
        subjectId: sub.id,
        className: cls.name,
        subjectName: sub.name,
        severity,
        phase: phase === 'UTS' || phase === 'UAS' ? phase : null,
        message: msg,
        daysToExam: statusInfo.daysLeft
      });
    });
  });

  const severityWeight = { critical: 4, warning: 3, success: 2, info: 1 };
  
  alerts.sort((a, b) => {
    const isAToday = todayPairs.has(`${a.classId}-${a.subjectId}`);
    const isBToday = todayPairs.has(`${b.classId}-${b.subjectId}`);
    if (isAToday !== isBToday) return isAToday ? -1 : 1;
    
    if (severityWeight[a.severity] !== severityWeight[b.severity]) {
      return severityWeight[b.severity] - severityWeight[a.severity];
    }
    
    return (a.daysToExam ?? 999) - (b.daysToExam ?? 999);
  });

  return alerts.slice(0, 10);
}

export function getClassReadinessSummary(classId: string): { subjectId: string; subjectName: string; utsScore: number; uasScore: number; overallStatus: string }[] {
  const data = getData();
  const cls = data.classes.find(c => c.id === classId);
  if (!cls) return [];
  
  const subjects = data.subjects.filter(sub => data.schedules.some(s => s.subjectId === sub.id && s.classId === classId));
  
  const results = subjects.map(sub => {
    const currentReadiness = getExamReadiness(sub.id, classId);
    
    let utsScore = 0;
    let uasScore = 0;
    const semester = getSubjectSemester(sub, data);

    if (semester) {
      // Temporarily mock UTS phase
      const dataUts = structuredClone(data);
      const semUts = dataUts.semesters!.find(s => s.id === semester.id)!;
      semUts.utsDate = '2099-12-31';
      semUts.uasDate = '2099-12-31';
      const utsStatus = getSubjectStatus(sub, cls, dataUts);
      utsScore = calculateScoreFromStatus(utsStatus).score;

      // Temporarily mock UAS phase
      const dataUas = structuredClone(data);
      const semUas = dataUas.semesters!.find(s => s.id === semester.id)!;
      semUas.utsDate = '2000-01-01'; 
      semUas.uasDate = '2099-12-31';
      const uasStatus = getSubjectStatus(sub, cls, dataUas);
      uasScore = calculateScoreFromStatus(uasStatus).score;
    } else {
       // fallback if no semester config
       const ov = getSyllabusOverview(sub.id, classId);
       if (ov) {
         utsScore = ov.utsPct;
         uasScore = ov.uasPct;
       }
    }

    return {
      subjectId: sub.id,
      subjectName: sub.name,
      utsScore,
      uasScore,
      overallStatus: currentReadiness.status
    };
  });

  const statusWeights: Record<string, number> = {
    'critical': 5,
    'behind': 4,
    'tight': 3,
    'no-data': 2,
    'on-track': 1,
    'ahead': 0,
    'complete': -1
  };
  
  results.sort((a, b) => (statusWeights[b.overallStatus] || 0) - (statusWeights[a.overallStatus] || 0));
  
  return results;
}
