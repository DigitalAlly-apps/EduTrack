import type { ViewType, SetupTab } from './types';

export interface NavigationTarget {
  view: ViewType;
  classId?: string;
  subjectId?: string;
  date?: string;
  section?: 'summary' | 'materials' | 'history' | 'calendar' | 'agenda' | 'koreksi' | 'riwayat' | 'settings' | SetupTab;
}

export function navigateTo(target: NavigationTarget) {
  window.dispatchEvent(new CustomEvent('edutrack-nav', { detail: target }));
}

export function parseNavigationTarget(value: unknown): NavigationTarget | null {
  const candidate = value === 'exam-corrections' ? { view: 'exam', section: 'koreksi' }
    : typeof value === 'string' ? { view: value } : value;
  if (!candidate || typeof candidate !== 'object' || !('view' in candidate)) return null;
  if (!['today', 'progress', 'exam', 'setup', 'info'].includes(String(candidate.view))) return null;
  const result: NavigationTarget = { view: candidate.view as ViewType };
  for (const key of ['classId', 'subjectId', 'date', 'section'] as const) {
    if (key in candidate && typeof candidate[key] === 'string') Object.assign(result, { [key]: candidate[key] });
  }
  return result;
}
