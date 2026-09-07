import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DailyWorkspace from '@/components/DailyWorkspace';
import ProgressWorkspace from '@/components/ProgressWorkspace';
import {
  composeSessionNote, dateKey, getData, getLastPageReached, getNextMeetingNote,
  getNextStartPage, getTeachingPosition, recordTeachingSession, saveData,
  splitSessionNote, updateNextMeetingNote, updateSessionNote,
} from '@/lib/data';
import { normalizeProgressConsistency } from '@/lib/progressConsistency';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  const data = getData();
  data.classes = [{ id: 'c1', name: '7A', color: 'blue', level: '7' }];
  data.subjects = [{ id: 's1', name: 'Fiqih', level: '7', examDate: null }];
  data.materials = [
    { id: 'm1', subjectId: 's1', classId: 'c1', name: 'Bab 1', order: 1, sessions: 3 },
    { id: 'm2', subjectId: 's1', classId: 'c1', name: 'Bab 2', order: 2, sessions: 2 },
  ];
  data.schedules = [{ id: 'sc1', classId: 'c1', subjectId: 's1', days: [0, 1, 2, 3, 4, 5, 6], startTime: '08:00', duration: 45 }];
  saveData(data);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function daysAgo(offset: number) {
  const date = new Date(); date.setDate(date.getDate() - offset); return dateKey(date);
}

describe('rencana pertemuan compatibility', () => {
  it('keeps legacy topic and reminder separate and respects an explicitly cleared plan', () => {
    recordTeachingSession('sc1', daysAgo(1), 'm1', false, 'Topik lama\n---BELUM_KUMPUL---\nBawa buku');
    expect(splitSessionNote(getNextMeetingNote('c1', 's1').text)).toEqual({ mainNote: 'Topik lama', reminder: 'Bawa buku' });
    updateNextMeetingNote('c1', 's1', '');
    expect(getNextMeetingNote('c1', 's1').text).toBe('');
  });

  it('keeps the latest plan when recording or editing an older meeting, then updates it from the latest editor', () => {
    const plan = composeSessionNote('Lanjut bab', 'Periksa PR');
    recordTeachingSession('sc1', dateKey(), 'm1', false, plan, '25', plan);
    const latestId = getData().sessions[0].id;
    recordTeachingSession('sc1', daysAgo(2), 'm1', false, 'Rencana lama', '', 'Rencana lama');
    const olderId = getData().sessions[1].id;
    expect(getNextMeetingNote('c1', 's1').text).toBe(plan);
    updateSessionNote(olderId, 'Koreksi lama');
    expect(getNextMeetingNote('c1', 's1').text).toBe(plan);
    updateSessionNote(latestId, composeSessionNote('Latihan', 'Bawa LKS'), '30');
    expect(splitSessionNote(getNextMeetingNote('c1', 's1').text)).toEqual({ mainNote: 'Latihan', reminder: 'Bawa LKS' });
    expect(getData().sessions.find(s => s.id === latestId)?.lastPageReached).toBe('30');
    updateSessionNote(latestId, '', '');
    expect(getNextMeetingNote('c1', 's1').text).toBe('');
  });

  it('retains explicit no-material, completed chapter, skipped and duplicate recording semantics', () => {
    expect(recordTeachingSession('sc1', daysAgo(2), null, false, 'Rencana')).toBe(true);
    expect(getData().sessions[0].materialId).toBeNull();
    recordTeachingSession('sc1', daysAgo(1), 'm1', true);
    normalizeProgressConsistency();
    expect(getTeachingPosition('c1', 's1').material?.id).toBe('m2');
    const before = getData().progress[0].materialsDone;
    expect(recordTeachingSession('sc1', dateKey(), 'm2', true, '', undefined, 'Kejar pertemuan berikutnya', true)).toBe(true);
    expect(recordTeachingSession('sc1', dateKey(), 'm2')).toBe(false);
    expect(getData().progress[0].materialsDone).toBe(before);
    expect(getData().sessions[2]).toMatchObject({ materialId: 'SKIPPED', materialCompleted: false });
    expect(getNextMeetingNote('c1', 's1').text).toBe('Kejar pertemuan berikutnya');
  });

  it('preserves a separately saved plan and old event text on page-only edits', () => {
    recordTeachingSession('sc1', dateKey(), 'm1', false, 'Catatan kejadian lama', '25', 'Rencana terpisah');
    const session = getData().sessions[0];
    updateSessionNote(session.id, session.note!, '26');
    expect(getNextMeetingNote('c1', 's1').text).toBe('Rencana terpisah');
    expect(getData().sessions[0].note).toBe('Catatan kejadian lama');
  });
});

describe('active workspace flows', () => {
  it('records topic, reminder and next page through the active form and restores its draft', () => {
    const show = () => render(<MemoryRouter><DailyWorkspace refreshKey={0} onRefresh={() => {}} /></MemoryRouter>);
    const first = show();
    fireEvent.click(screen.getAllByRole('button', { name: 'Catat hasil' })[0]);
    fireEvent.change(screen.getByLabelText(/Materi selanjutnya/), { target: { value: 'Latihan bab 2' } });
    fireEvent.change(screen.getByLabelText(/Informasi selain materi/), { target: { value: 'Bawa LKS' } });
    fireEvent.change(screen.getByLabelText(/Pertemuan selanjutnya hal/), { target: { value: '25' } });
    expect(screen.queryByLabelText(/Yang terjadi hari ini/)).not.toBeInTheDocument();
    first.unmount();
    show();
    fireEvent.click(screen.getAllByRole('button', { name: 'Catat hasil' })[0]);
    expect(screen.getByLabelText(/Materi selanjutnya/)).toHaveValue('Latihan bab 2');
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    const session = getData().sessions[0];
    expect(splitSessionNote(session.note)).toEqual({ mainNote: 'Latihan bab 2', reminder: 'Bawa LKS' });
    expect(session.lastPageReached).toBe('25');
    expect(getNextMeetingNote('c1', 's1').text).toBe(session.note);
  });

  it('shows the recorded next page even when the most recent session has no page', () => {
    recordTeachingSession('sc1', daysAgo(2), 'm1', false, '', '25');
    recordTeachingSession('sc1', daysAgo(1), 'm1');
    render(<MemoryRouter><DailyWorkspace refreshKey={0} onRefresh={() => {}} /></MemoryRouter>);
    expect(screen.getByText(/Pertemuan selanjutnya hal\. 25/)).toBeInTheDocument();
    expect(getNextStartPage(getLastPageReached('c1', 's1')!).nextPage).toBe('25');
  });

  it('exposes general history even when there are no current schedules', () => {
    recordTeachingSession('sc1', dateKey(), 'm1', false, 'Riwayat tetap ada');
    const data = getData(); data.schedules = []; saveData(data);
    render(<MemoryRouter><ProgressWorkspace /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Riwayat' }));
    expect(screen.getByText(/Riwayat tetap ada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Catat KBM Terlupa/ })).toBeInTheDocument();
  });

  it('records the H-1 reminder on yesterday, not today', () => {
    render(<MemoryRouter><DailyWorkspace refreshKey={0} onRefresh={() => {}} /></MemoryRouter>);
    expect(screen.getAllByRole('button', { name: 'Catat KBM kemarin' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Catat KBM kemarin' }));
    fireEvent.change(screen.getByLabelText(/Materi selanjutnya/), { target: { value: 'Rencana kemarin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(getData().sessions[0].date).toBe(daysAgo(1));
    expect(getData().sessions.some(s => s.date === dateKey())).toBe(false);
  });

  it('dismisses only the H-1 reminder without advancing teaching progress', () => {
    render(<MemoryRouter><DailyWorkspace refreshKey={0} onRefresh={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Tidak terlaksana' }));
    expect(getData().scheduleOverrides).toContainEqual(expect.objectContaining({ scheduleId: 'sc1', date: daysAgo(1), skipped: true }));
    expect(getData().sessions).toHaveLength(0);
    expect(getTeachingPosition('c1', 's1').totalSessionsDone).toBe(0);
  });

  it('adds and completes a persisted task through the workspace', () => {
    const show = () => render(<MemoryRouter><DailyWorkspace refreshKey={0} onRefresh={() => {}} /></MemoryRouter>);
    const first = show();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah Tugas' }));
    fireEvent.change(screen.getByLabelText('Nama tugas'), { target: { value: 'Periksa LKS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan tugas' }));
    expect(getData().tasks[0]).toMatchObject({ title: 'Periksa LKS', classId: 'c1', subjectId: 's1', status: 'pending' });
    first.unmount(); show();
    fireEvent.click(screen.getByRole('button', { name: 'Tandai tugas Periksa LKS selesai' }));
    expect(getData().tasks[0].status).toBe('done');
  });

  it('applies early dismissal to the selected date and only after the cutoff', () => {
    const data = getData();
    data.schedules.push({ ...data.schedules[0], id: 'late', startTime: '11:00' }); saveData(data);
    render(<MemoryRouter initialEntries={[`/?date=${daysAgo(1)}`]}><DailyWorkspace refreshKey={0} onRefresh={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Aksi hari ini'));
    fireEvent.click(screen.getByRole('button', { name: 'Pulang Awal' }));
    fireEvent.change(screen.getByLabelText('Mulai libur dari jam'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Terapkan' }));
    expect(getData().scheduleOverrides).toEqual([expect.objectContaining({ scheduleId: 'late', date: daysAgo(1), skipped: true })]);
    expect(getData().sessions).toHaveLength(0);
  });

  it('applies subject dismissal to the chosen class without touching other classes', () => {
    const data = getData();
    data.classes.push({ ...data.classes[0], id: 'c2', name: '7B' });
    data.schedules.push({ ...data.schedules[0], id: 'sc2', classId: 'c2' }); saveData(data);
    render(<MemoryRouter><DailyWorkspace refreshKey={0} onRefresh={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Aksi hari ini'));
    fireEvent.click(screen.getByRole('button', { name: 'Libur Mapel' }));
    fireEvent.change(screen.getByLabelText('Kelas yang diliburkan'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Terapkan' }));
    expect(getData().scheduleOverrides).toEqual([expect.objectContaining({ scheduleId: 'sc1', date: dateKey(), skipped: true })]);
  });

  it('keeps the record form and inputs when persistent storage rejects the save', () => {
    render(<MemoryRouter><DailyWorkspace refreshKey={0} onRefresh={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Catat hasil' })[0]);
    fireEvent.change(screen.getByLabelText(/Materi selanjutnya/), { target: { value: 'Jangan hilang' } });
    const original = localStorage.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      if (key === 'pengajar_v4') throw new Error('Quota exceeded');
      original(key, value);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Belum tersimpan');
    expect(screen.getByLabelText(/Materi selanjutnya/)).toHaveValue('Jangan hilang');
    expect(getData().sessions).toHaveLength(0);
  });
});
