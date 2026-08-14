export interface SessionDraft {
  note: string;
  reminder: string;
  lastPage: string;
}

const keyFor = (sessionId: string) => `edutrack_session_draft_${sessionId}`;

export function loadSessionDraft(sessionId: string): SessionDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.note !== 'string' || typeof parsed?.reminder !== 'string' || typeof parsed?.lastPage !== 'string') return null;
    return parsed;
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
