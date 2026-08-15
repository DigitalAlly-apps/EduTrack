export interface SessionDraft {
  nextTopic: string;
  supportingNote: string;
  lastPage: string;
}

const keyFor = (sessionId: string) => `edutrack_session_draft_${sessionId}`;

export function loadSessionDraft(sessionId: string): SessionDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lastPage !== 'string') return null;
    // Draft lama tetap dapat dipulihkan setelah pembaruan UI.
    const nextTopic = typeof parsed?.nextTopic === 'string' ? parsed.nextTopic : parsed?.note;
    const supportingNote = typeof parsed?.supportingNote === 'string' ? parsed.supportingNote : parsed?.reminder;
    if (typeof nextTopic !== 'string' || typeof supportingNote !== 'string') return null;
    return { nextTopic, supportingNote, lastPage: parsed.lastPage };
  } catch {
    return null;
  }
}

export function saveSessionDraft(sessionId: string, draft: SessionDraft) {
  try {
    localStorage.setItem(keyFor(sessionId), JSON.stringify(draft));
  } catch {
    // Draft hanya pelindung tambahan; editor tetap berfungsi saat storage penuh/tidak tersedia.
  }
}

export function clearSessionDraft(sessionId: string) {
  try {
    localStorage.removeItem(keyFor(sessionId));
  } catch {
    // Tidak perlu mengganggu alur simpan sesi utama.
  }
}
