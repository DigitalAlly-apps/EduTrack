# EduTrack — Codex Handoff

## Context

EduTrack is a mobile-first teaching tracker and personal teaching assistant for a teacher. The current product already tracks schedules, teaching sessions, material/bab progress, next-session notes, exam work, calendar/history, and cloud sync.

The next task is a **UX/product rebrand and light information-architecture redesign**, not a rewrite of the tracking engine.

## Product direction

Primary navigation should be presented to the user as:

- **Hari Ini** — execute today's teaching work
- **Kendali** — monitor progress, risks, calendar, and history; decide what to adjust
- **Ujian** — manage exam agenda, proctoring, and correction work
- **Kelola** — configure classes, subjects, materials, schedules, semesters, holidays, leave, data, app settings, and info

The product should feel like a **tracker + assistant**, but not like an AI chatbot. Assistance should appear contextually as useful, actionable information.

Example good assistant message:

> Fiqh 8A membutuhkan 7 sesi, tetapi hanya 5 sesi tersedia sebelum UAS. Kurang 2 sesi.

Avoid generic messages such as “Tetap semangat”, “Jaga ritme”, or AI-slop copy.

## Important technical guardrails

Do **not** rename internal route/view IDs unless truly necessary.

Keep these internal values for compatibility:

```text
today
progress
exam
setup
info
```

User-facing labels may change while internal IDs remain unchanged.

Do not casually change:

- `ViewType`
- localStorage keys
- progress data model
- `materialsDone` semantics
- `completedMaterialIds`
- `getTeachingPosition()` behavior
- Supabase sync
- `edutrack-data-changed`
- remote sync event contract
- existing backward-compatibility logic

The progress engine was recently repaired so **Hari Ini and Progres/Kendali must stay synchronized**. Avoid unrelated tracking refactors during this rebrand.

## Current mapping → target mapping

```text
Internal ID   Current UI        Target UI
------------------------------------------------
today         Hari Ini          Hari Ini
progress      Progres           Kendali
exam          Ujian             Ujian
setup         Atur/Pengaturan   Kelola
info          Informasi         accessible from Kelola, not primary nav
```

Mobile and desktop navigation should communicate the same four primary areas:

**Hari Ini · Kendali · Ujian · Kelola**

`info` can remain an internal view/deep-link target for backward compatibility, but should be reached through **Kelola → Tentang EduTrack** rather than occupying primary navigation.

## 1. Hari Ini

Purpose: answer **“Apa yang harus saya kerjakan sekarang?”**

Do not redesign it into a statistics dashboard. Keep the existing teaching workflow strong.

Preferred hierarchy:

1. current/next teaching session
2. class + subject + current material
3. `Pertemuan X dari Y`
4. previous/next-session note
5. main action to record teaching
6. urgent contextual attention
7. “Kemarin belum dicatat” — H-1 only
8. secondary information such as tomorrow, tasks, administrative actions collapsed/lower in hierarchy

The existing `TodayView` already contains most of this behavior. Prioritize hierarchy and copy over broad feature additions.

## 2. Progres → Kendali

This is the main rebrand.

Current `ProgressView` sub-tabs:

```text
Progres | Kalender | Riwayat
```

Target:

```text
Ringkasan | Kalender | Riwayat
```

### Ringkasan

Purpose: answer **“Pengajaran kelas ini aman atau butuh tindakan?”**

Preferred hierarchy:

1. level/class selector
2. class condition summary
3. subjects requiring attention first
4. subject cards
5. detailed tracker/planning controls via progressive disclosure

Keep summary concepts such as:

- Aman
- Mepet
- Kurang sesi

Subject card should prioritize four things:

1. **Bab sekarang**
2. **Pertemuan X/Y**
3. **Berikutnya**
4. **Kondisi waktu/sesi**

Example:

```text
FIQH
Zakat Hasil Bumi
Pertemuan 2 dari 3

Berikutnya
Latihan perhitungan zakat

⚠ Kurang 2 sesi

[Buka detail]
```

Inside detail/expanded controls, keep editing features such as:

- next-session note
- estimated number of sessions
- plan/bab list
- complete bab now
- undo/correction
- detailed required/available session tracker

The UI must remain **readable + editable**. Detail should not dominate the first view.

### Calendar

Treat Calendar as a visual teaching audit, not merely colored squares.

Keep statuses clearly understandable:

- Selesai
- Sebagian
- Terlewat
- Libur
- Tidak ada jadwal
- Mendatang

Selecting a date should explain the state, for example:

```text
Rabu, 19 Agustus
2 dari 3 KBM tercatat

✓ Fiqh — 8A
✓ Akhlak — 9A
○ Imla — 7A
```

### History

Treat History as the teaching journal/audit trail.

It should make past teaching understandable and support correction when appropriate.

## 3. Ujian

Current ExamView includes:

```text
Agenda | Koreksi | Riwayat | Settings
```

Target primary work tabs:

```text
Agenda | Koreksi | Riwayat
```

The Ujian view should focus on work:

- today's/upcoming exams
- proctoring sessions
- correction queue/status
- relevant exam readiness information

Configuration/reminder/reset controls that are administrative should move toward **Kelola** where practical.

Do not remove useful exam functionality merely to simplify labels.

## 4. Kelola

`SetupView` becomes user-facing **Kelola**.

Recommended grouping:

### Akademik
- Kelas
- Mata Pelajaran
- Materi & Silabus
- Semester

### Jadwal & Kehadiran
- Jadwal Mengajar
- Hari Libur
- Izin Mengajar

### Aplikasi & Data
- Sinkronisasi
- Pengingat Ujian / exam-related settings where appropriate
- Backup & Data
- Tentang EduTrack

Integrate/access `InfoView` through **Kelola → Tentang EduTrack**. Preserve the internal `info` route/view if useful for compatibility.

## 5. Product language

Use Indonesian consistently.

Preferred mental model:

- **Hari Ini** = Kerjakan
- **Kendali** = Pantau, pahami, putuskan
- **Ujian** = Persiapkan & koreksi
- **Kelola** = Atur sistem

The word **progres** is still valid as a content term, e.g. “Progres materi 64%”. It is only being removed as the primary tab identity.

Avoid over-marketing copy and decorative assistant language. Use concrete operational language.

## 6. UX principles

- mobile-first
- readable before feature-rich
- editable near the data being edited
- progressive disclosure for detailed tracking
- no manual browser refresh after mutations
- do not hide important state behind color alone
- critical modals/bottom sheets must not sit under floating navigation
- preserve current light/dark readability
- avoid gratuitous animations, gradients, emojis, or “AI dashboard” styling
- do not redesign every screen merely for visual novelty

## Files to read before implementation

Read these first:

1. `PRD.md`
2. `codebase.md`
3. `src/pages/Index.tsx`
4. `src/components/BottomNav.tsx`
5. `src/components/ProgressView.tsx`
6. `src/components/TodayView.tsx`
7. `src/components/ExamView.tsx`
8. `src/components/SetupView.tsx`
9. `src/components/InfoView.tsx`
10. `src/lib/types.ts`
11. `src/lib/data.ts`
12. `src/lib/progressConsistency.ts`

## Required workflow for Codex

Before editing code:

1. inspect the files above and current git status
2. explain the current architecture relevant to the rebrand
3. produce an implementation plan
4. list exact files expected to change
5. identify any risky areas or compatibility constraints

Then implement unless the user explicitly asks for plan-only.

After implementation:

1. inspect the full diff for accidental scope creep
2. run relevant tests
3. run production build
4. verify mobile navigation and desktop navigation labels are consistent
5. verify `Hari Ini` and `Kendali` still show synchronized material position
6. verify Info/Tentang remains reachable
7. verify Ujian functionality remains intact after moving/hiding settings
8. report what changed and any remaining follow-up

## Definition of Done

The rebrand is done when:

- primary user-facing navigation is **Hari Ini · Kendali · Ujian · Kelola**
- mobile and desktop navigation agree
- `progress` internal ID remains compatible while UI says **Kendali**
- Kendali sub-tabs are **Ringkasan · Kalender · Riwayat**
- Kendali first view clearly shows current bab, meeting position, next action/note, and schedule condition
- detailed tracker/editing remains accessible without overwhelming the default view
- Ujian prioritizes agenda/correction/history rather than configuration
- Info is no longer primary navigation and is reachable from Kelola as **Tentang EduTrack**
- no progress-engine regression
- no manual refresh requirement introduced
- build/tests pass

## Suggested implementation order

1. navigation labels and shell consistency
2. Kendali terminology + information hierarchy
3. Kelola grouping + Tentang EduTrack entry
4. Ujian settings placement/cleanup
5. Hari Ini hierarchy polish only where needed
6. regression testing and build

Do not perform a large architecture rewrite as part of this task.
