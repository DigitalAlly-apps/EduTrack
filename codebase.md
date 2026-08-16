# EduTrack — Codebase Architecture & Technical Reference

Dokumen ini menjelaskan struktur arsitektur teknis, data model, alur data, dan komponen aplikasi EduTrack.

## 1. Stack & Teknologi

- **Frontend Core**: React 18 + TypeScript + Vite (`@vitejs/plugin-react-swc`).
- **Styling**: Tailwind CSS + CSS Variables (`src/index.css`, `tailwind.config.ts`).
- **UI Components**: Radix UI / shadcn components (`src/components/ui`), Lucide React icons.
- **State & Persistence**: LocalStorage-first (`pengajar_v4`), tanpa backend server wajib.
- **Drag and Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`.
- **Testing**: Vitest (`vitest.config.ts`) + Testing Library (`src/test/data.test.ts`).
- **PWA**: `vite-plugin-pwa` dengan `registerType: autoUpdate`.

## 2. Struktur Folder & Modul Utama

```
EduTrack/
├── src/
│   ├── main.tsx              # Entry point React
│   ├── App.tsx               # Provider global, routing (/ & catch-all)
│   ├── index.css             # Design tokens & Tailwind layer
│   ├── pages/
│   │   └── Index.tsx         # Shell aplikasi utama & navigation state
│   ├── lib/
│   │   ├── types.ts          # Definisi TypeScript interface
│   │   ├── data.ts           # Data storage layer, calculation, & business logic
│   │   ├── examData.ts       # Logika ujian & status koreksi
│   │   ├── briefing.ts       # Logika briefing harian
│   │   ├── notifications.ts  # Local notification scheduler
│   │   └── sessionDraft.ts   # Local draft manager
│   ├── components/
│   │   ├── TodayView.tsx     # Tab Jadwal Hari Ini & Quick Actions
│   │   ├── ProgressView.tsx  # Tab Progres KBM, Pace Suggestions, & History
│   │   ├── ExamView.tsx      # Tab Ujian & Koreksi
│   │   ├── SetupView.tsx     # Tab Kelola Data Akademik & Silabus
│   │   ├── InfoView.tsx      # Tab Informasi Aplikasi
│   │   ├── BottomNav.tsx     # Navigasi bawah mobile
│   │   └── ui/               # Komponen shadcn / Radix reusable
│   └── test/
│       ├── setup.ts          # Setup environment test
│       └── data.test.ts      # Unit tests
```

## 3. Data Model (`src/lib/types.ts`)

- **`Material`**: Bab/materi silabus (`id`, `subjectId`, `classId?`, `level?`, `name`, `order`, `sessions` (jumlah pertemuan, default 1), `pageStart`, `pageEnd`, `note`, `examPeriod`).
- **`Progress`**: Progres per kelas+mapel (`id`, `classId`, `subjectId`, `materialsDone` (jumlah sesi selesai), `lastSession`, `completedMaterialIds` (materi yang ditandai selesai lebih cepat)).
- **`Session`**: Record pencatatan KBM (`id`, `scheduleId`, `classId`, `subjectId`, `date`, `materialId`, `materialCompleted`, `completedAt`, `note`, `lastPageReached`).
- **`Schedule`**: Jadwal mingguan (`id`, `classId`, `subjectId`, `days`, `startTime`, `duration`).

## 4. Key Data Functions (`src/lib/data.ts`)

- `getData()` & `saveData(d)`: Membaca & menyimpan ke LocalStorage `pengajar_v4`.
- `getTeachingPosition(classId, subjectId)`: Menghitung posisi bab aktif, pertemuan ke-N di bab ini, total sesi selesai, dan status penyelesaian.
- `markMaterialCompleted(classId, subjectId, materialId)`: Menandai bab selesai instan dan memajukan KBM ke bab selanjutnya.
- `updateMaterialEstimate(materialId, sessions)`: Mengubah estimasi jumlah pertemuan bab.
- `applyPaceSuggestion(suggestion)` / `applyMergeSuggestion()` / `applyTrimSuggestion()`: Otomatis memadatkan/memangkas sesi materi berdasarkan target ujian.
- `recordTeachingSession(scheduleId, date, materialId, completed, note, lastPage)`: Mencatat KBM harian.
- `undoLastSession(classId, subjectId)`: Membatalkan sesi terakhir.

## 5. Alur Data & Event Dispatch

1. Perubahan data domain dilakukan via `updateData(fn)` di `data.ts`.
2. UI memicu `window.dispatchEvent(new Event('edutrack-data-changed'))` atau memanggil callback `onRefresh()`.
3. View mendengarkan event dan meng-update state/tampilan tanpa perlunya reload halaman.
