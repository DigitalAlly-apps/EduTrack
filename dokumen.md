# EduTrack - Ringkasan Lengkap Aplikasi

Dokumen ini dibuat agar agent AI bisa memahami keseluruhan aplikasi EduTrack hanya dari satu file ini.

## Gambaran Umum

EduTrack adalah aplikasi web/PWA mobile-first untuk membantu guru/pengajar mengatur jadwal mengajar, kelas, mata pelajaran, silabus/materi, progres pembelajaran, persiapan ujian, koreksi, jurnal harian, reminder, dan backup data.

Karakter utama aplikasi:

- Single page app dengan satu route utama `/`.
- Dirancang seperti aplikasi mobile dengan lebar maksimal sekitar 430px.
- Data utama disimpan di `localStorage`, bukan backend.
- Bisa berjalan sebagai PWA standalone.
- Fokus pada kebutuhan guru: hari ini mengajar apa, materi berikutnya apa, progres sudah aman atau tertinggal, ujian/koreksi apa yang mendekat, dan data perlu dibackup atau tidak.

Stack utama:

- React 18 + TypeScript.
- Vite sebagai dev server/build tool.
- Tailwind CSS untuk styling.
- shadcn/Radix UI components di `src/components/ui`.
- React Router DOM untuk routing minimal.
- TanStack React Query provider sudah dipasang, tetapi data domain utama tidak memakai query server.
- Vite PWA untuk service worker.
- DnD Kit untuk drag-and-drop urutan materi.
- Vitest + Testing Library untuk unit test.
- Playwright tersedia untuk E2E.
- Lucide React, Recharts, Sonner, React Hook Form, Zod, dan dependensi UI lain tersedia.

## Cara Menjalankan

Script di `package.json`:

- `npm run dev`: menjalankan Vite dev server.
- `npm run build`: build production.
- `npm run build:dev`: build mode development.
- `npm run lint`: menjalankan ESLint.
- `npm run preview`: preview hasil build.
- `npm run test`: menjalankan Vitest sekali.
- `npm run test:watch`: menjalankan Vitest watch mode.

Konfigurasi Vite:

- File: `vite.config.ts`.
- Dev server host `::`, port `8080`.
- React plugin memakai `@vitejs/plugin-react-swc`.
- Alias `@` mengarah ke `./src`.
- PWA memakai `vite-plugin-pwa` dengan `registerType: autoUpdate`.
- Manifest PWA tidak didefinisikan di config karena memakai `public/manifest.json`.

## Struktur Folder Penting

- `src/main.tsx`: entry React, render `App`, import CSS.
- `src/App.tsx`: provider global, router, toaster, route `/` dan catch-all `NotFound`.
- `src/pages/Index.tsx`: shell aplikasi utama, state view/tab utama, onboarding, theme, refresh.
- `src/pages/NotFound.tsx`: halaman fallback.
- `src/lib/types.ts`: tipe domain utama aplikasi.
- `src/lib/data.ts`: localStorage database layer, kalkulasi jadwal/progres, backup, smart features.
- `src/lib/examData.ts`: data dan logika mode ujian/koreksi.
- `src/lib/briefing.ts`: briefing harian dari data ujian/koreksi.
- `src/lib/notifications.ts`: local notification scheduler.
- `src/lib/utils.ts`: utility umum, terutama helper class name.
- `src/components/TodayView.tsx`: tab jadwal hari ini, aksi selesai/lewati/geser, jurnal, briefing.
- `src/components/ProgressView.tsx`: tab progres, kalender, riwayat, heatmap, prediksi, saran pace.
- `src/components/ExamView.tsx`: tab ujian dan status koreksi.
- `src/components/SetupView.tsx`: tab kelola data akademik, libur, backup, izin.
- `src/components/Onboarding.tsx`: onboarding saat data kosong.
- `src/components/BottomNav.tsx`: navigasi bawah antar view.
- `src/components/Header.tsx`: header dan toggle theme.
- `src/components/DailyBriefing.tsx`: tampilan briefing harian.
- `src/components/QuickAddModal.tsx`: modal quick add, saat ini state dibuka dari `Index` tetapi tidak terlihat ada trigger utama di shell.
- `src/components/SmartReschedulerModal.tsx`: modal saran reschedule hari tertentu.
- `src/components/TeacherLeaveModal.tsx`: flow izin/sakit/titip tugas.
- `src/components/WeeklyReviewCard.tsx`: ringkasan mingguan.
- `src/components/HeatmapCard.tsx`: heatmap status jadwal/progres.
- `src/components/ExamPrepCard.tsx`: mode persiapan ujian.
- `src/components/AICard.tsx`: kartu insight AI-like.
- `src/components/InfoView.tsx`: tab informasi aplikasi.
- `src/components/ui/*`: komponen shadcn/Radix reusable.
- `src/index.css`: Tailwind layer, CSS variables, tema dark/light, utility custom.
- `src/App.css`: CSS tambahan lama/khusus app.
- `tailwind.config.ts`: konfigurasi Tailwind dan token warna.
- `public/manifest.json`: manifest PWA.
- `public/icons`: icon PWA.
- `vitest.config.ts`, `src/test/*`: konfigurasi dan setup test unit.
- `playwright.config.ts`, `playwright-fixture.ts`: konfigurasi E2E.

## Routing dan Shell App

Routing ada di `src/App.tsx`:

- `/`: render `Index`.
- `*`: render `NotFound`.

Provider global yang dibungkus di `App`:

- `QueryClientProvider` dari TanStack React Query.
- `TooltipProvider`.
- `Toaster` dari shadcn toast.
- `Sonner` toaster.
- `BrowserRouter`.

Shell utama ada di `src/pages/Index.tsx`.

State utama shell:

- `view`: tab utama, default `today`.
- `refreshKey`: angka untuk force refresh komponen tertentu.
- `showOnboarding`: tampil jika data kosong dan user belum onboarded.
- `quickAddOpen`: state modal quick add.
- `theme`: `dark` atau `light`, disimpan di `localStorage` key `pengajar_theme`.

View utama:

- `today`: `TodayView`.
- `progress`: `ProgressView`.
- `exam`: `ExamView`.
- `setup`: `SetupView`.
- `info`: `InfoView`.

Navigasi:

- `BottomNav` mengubah `view`.
- App juga listen custom event `edutrack-nav` dan `set-tab` untuk pindah view dari komponen lain.

Saat view `today` aktif, app:

- Mengecek apakah data kosong untuk menampilkan onboarding.
- Memanggil `initNotifications()`.
- Memanggil `pruneOldSessions()`.

## Model Data Utama

Semua tipe utama ada di `src/lib/types.ts`.

### AppData

Semua data domain utama disimpan dalam object `AppData`:

- `teacherName`: nama guru.
- `classes`: daftar kelas/rombongan belajar.
- `subjects`: daftar mata pelajaran.
- `materials`: daftar materi/silabus.
- `schedules`: jadwal mengajar mingguan.
- `progress`: progres per kelas + mapel.
- `sessions`: catatan sesi mengajar selesai/dilewati.
- `tasks`: tugas guru/inbox tugas.
- `notes`: catatan bebas.
- `lastBackup`: tanggal backup terakhir.
- `reminderDismissed`: tanggal reminder backup pernah ditutup.
- `holidays`: tanggal libur global atau per level.
- `scheduleOverrides`: override jadwal per tanggal.
- `academicYear`: tahun ajaran.

### ClassItem

Kelas/rombongan belajar:

- `id`
- `name`
- `color`
- `level`: tingkatan kelas, contoh `10`, `11`.

### Subject

Mata pelajaran:

- `id`
- `name`
- `level`
- `examDate`: tanggal ujian atau `null`.

### Material

Materi/silabus:

- `id`
- `subjectId`
- `level`: materi shared untuk semua rombel di level tertentu.
- `classId`: materi override khusus kelas tertentu.
- `name`
- `order`
- `sessions`: jumlah pertemuan yang dibutuhkan untuk materi ini, default 1.

Hierarki materi di `getMaterials(subjectId, classId)`:

1. Materi khusus `classId` jika ada.
2. Materi shared per `level` kelas.
3. Materi legacy tanpa `level` dan tanpa `classId`.
4. Fallback semua materi untuk `subjectId`.

### Schedule

Jadwal mengajar mingguan:

- `id`
- `classId`
- `subjectId`
- `days`: angka hari JavaScript, 0 Minggu sampai 6 Sabtu.
- `startTime`: string `HH:mm`.
- `duration`: menit.

### Progress

Progres per kelas + mapel:

- `id`
- `classId`
- `subjectId`
- `materialsDone`: jumlah sesi/materi yang sudah tercapai.
- `lastSession`: tanggal sesi terakhir atau `null`.

Catatan: `materialsDone` sebenarnya menghitung sesi selesai, bukan selalu jumlah bab, karena materi bisa punya `sessions > 1`.

### Session

Catatan realisasi sesi mengajar:

- `id`
- `scheduleId`
- `classId`
- `subjectId`
- `date`: `YYYY-MM-DD`.
- `materialId`: id materi, `null`, atau string khusus `SKIPPED`.
- `completedAt`: ISO datetime.
- `note`: catatan opsional.

Jika `materialId === 'SKIPPED'`, sesi dianggap dilewati/kosong dan tidak menaikkan progres.

### TeacherTask

Task/inbox guru:

- `id`
- `classId`
- `subjectId`
- `title`
- `deadline`: `YYYY-MM-DD`.
- `status`: `pending` atau `done`.

### TodayScheduleItem

Turunan `Schedule` untuk tampilan hari ini:

- `className`, `subjectName`.
- `nextMat`: materi berikutnya.
- `done`: sudah dicatat hari ini atau belum.
- `active`: sedang berlangsung berdasarkan waktu saat ini.
- `endTime`.
- `totalMats`: total sesi yang dibutuhkan.
- `materialsDone`.
- `sessionId`, `note`, `skipped`.

### SubjectStatus

Status progres kelas + mapel:

- `status`: `on-track`, `tight`, atau `behind`.
- `label`, `pct`, `done`, `total`, `remaining`.
- `sessLeft`: sesi efektif tersisa sebelum ujian.
- `sessionsNeeded`.
- `holidaysInPeriod`.
- `rec`: rekomendasi teks.
- `daysLeft`.
- `nextSched`.

### ExamCorrection

Data koreksi ujian ada di `src/lib/examData.ts`, disimpan terpisah dari `AppData`.

Koreksi ujian:

- `id`
- `subjectId`
- `classId`
- `examDate`
- `status`: `belum`, `sedang`, atau `selesai`.
- `updatedAt`.

## Storage dan Persistensi

Data utama disimpan di localStorage, file `src/lib/data.ts`.

Key utama:

- `pengajar_v4`: database utama saat ini.
- `pengajar_v3`, `pengajar_v2`: fallback dibaca untuk kompatibilitas data lama.
- `pengajar_theme`: tema dark/light.
- `pengajar_onboarded`: marker onboarding.
- `edutrack_corrections`: data status koreksi ujian.

Fungsi storage utama:

- `getData()`: membaca data dari localStorage, fallback v3/v2, deep merge dengan default.
- `saveData(d)`: simpan `AppData` ke `pengajar_v4`.
- `updateData(fn)`: baca data, mutasi lewat callback, simpan, lalu return data baru.
- `genId()`: id sederhana dari timestamp dan random string.

Default data:

- Semua array kosong.
- `teacherName` kosong.
- `lastBackup` dan `reminderDismissed` null.
- `academicYear` kosong.

Tidak ada backend aktif untuk data domain. Dependensi Supabase ada di package, tetapi tidak tampak digunakan untuk domain utama aplikasi.

## Flow Onboarding dan Demo

Onboarding muncul jika:

- `classes.length === 0` dan `schedules.length === 0`, atau data dasar kosong.
- `localStorage.getItem('pengajar_onboarded')` belum ada.

Onboarding bisa:

- Menyelesaikan onboarding dan refresh app.
- Memanggil `loadDemo()` untuk mengisi data demo.

`loadDemo()` mengisi:

- Guru/tahun ajaran tetap memakai nilai existing jika ada.
- Kelas contoh: `10A`, `10B`, `11 IPA`.
- Mapel contoh: Matematika dan Fisika.
- Materi per level.
- Jadwal mingguan.
- Progress awal.
- Sessions/tasks/notes kosong.

## View Hari Ini

Komponen: `src/components/TodayView.tsx`.

Fungsi utama:

- Menampilkan jadwal mengajar hari ini.
- Menampilkan kelas aktif berdasarkan jam saat ini.
- Menampilkan kelas berikutnya.
- Menampilkan progress selesai hari ini.
- Menampilkan `DailyBriefing`.
- Menampilkan reminder backup jika sudah 7+ hari belum backup.
- Menampilkan countdown ujian dekat.
- Menampilkan task pending.
- Menandai sesi selesai dengan undo delay.
- Menandai sesi dilewati.
- Menggeser jadwal hari ini.
- Menerapkan hari pendek atau pulang cepat.
- Menulis catatan sesi dan reminder untuk pertemuan depan.
- Menyalin jurnal harian otomatis ke clipboard.
- Menjalankan smart rescheduler.

Data jadwal hari ini dibuat oleh `getTodaySchedules()`:

- Ambil jadwal yang `days` berisi hari ini.
- Skip jadwal jika hari ini libur untuk level mapel tersebut.
- Terapkan `scheduleOverrides` untuk tanggal hari ini.
- Skip jika override `skipped` true.
- Tentukan `active` dari jam sekarang di antara start dan end.
- Tentukan `done` dari adanya `Session` dengan `scheduleId` dan tanggal hari ini.
- Tentukan `nextMat` dari progres dan daftar materi.

Aksi sesi:

- `markDone(scheduleId, note?)`: membuat `Session`, menaikkan progress, simpan data.
- `skipSession(scheduleId)`: membuat `Session` dengan `materialId: SKIPPED`, tidak menaikkan progress.
- `undoLastSession(classId, subjectId)`: menghapus sesi non-skipped terakhir dan menurunkan `materialsDone`.
- `postponeSchedule(scheduleId, diffMinutes)`: membuat/memperbarui override start time untuk hari ini.

Jurnal harian:

- Dibuat oleh `generateDailyJournal()`.
- Format teks cocok untuk copy ke WhatsApp/laporan.
- Mengelompokkan sesi selesai dan dilewati hari ini.
- Menyertakan catatan jika ada.

## Briefing Harian

Logika: `src/lib/briefing.ts`.

`getDailyBriefing()` mengembalikan daftar item:

- `ujian-hari-ini`: ada ujian hari ini.
- `ujian-dekat`: ujian H-1 sampai H-3.
- `koreksi-overdue`: ujian sudah lewat lebih dari 5 hari dan koreksi belum selesai.
- `koreksi-pending`: ujian baru lewat sampai 5 hari dan koreksi belum selesai.
- `semua-beres`: fallback jika tidak ada masalah.

Briefing memakai data dari:

- `getData()`.
- `getCorrections()`.
- `getAllExamSubjects()`.

## View Progres

Komponen: `src/components/ProgressView.tsx`.

Tab internal:

- `progress`: status progres per kelas/mapel.
- `kalender`: kalender status harian.
- `history`: riwayat sesi.

Fitur progress:

- Grouping progress berdasarkan kelas.
- Filter semua mapel atau mapel bermasalah.
- Status warna hijau/amber/merah berdasarkan `getSubjectStatus()`.
- Weekly Review via `WeeklyReviewCard`.
- AI-like pace suggestions via `generatePaceSuggestions()`.
- Heatmap 8 minggu via `getHeatmapData(8)`.
- Predictive finish date via `getPredictiveFinishes()`.
- Exam prep mode via `getExamPrepItems()` untuk ujian dalam 14 hari.

`getSubjectStatus(sub, cls, data)` menghitung:

- Total sesi materi berdasarkan `sessions` di setiap material.
- Sesi yang sudah selesai dari `progress.materialsDone`.
- Sesi tersisa.
- Jika mapel punya `examDate`, hitung hari tersisa dan sesi efektif tersisa sampai ujian.
- Libur mengurangi sesi efektif.
- Status menjadi `behind`, `tight`, atau `on-track`.

Pace suggestions:

- `calculatePaceForCombination(classId, subjectId)` menganalisis satu kombinasi kelas+mapel.
- `generatePaceSuggestions()` menghasilkan saran semua kombinasi.
- Tipe saran: `add_sessions`, `merge_sessions`, `trim_materials`, `no_issue`.
- `applyPaceSuggestion()` membuat task catch-up untuk tanggal yang disarankan.
- `addExtraSession()` membuat extra schedule override untuk tanggal tertentu.

Heatmap:

- `getHeatmapData(weeks)` membuat row per kelas+mapel.
- Cell status: `on-track`, `tight`, `behind`, `no-class`, `no-data`.
- Berdasarkan jumlah sesi terjadwal dan sesi selesai per minggu.

Predictive finish:

- `getPredictiveFinishes()` memprediksi kapan materi selesai berdasarkan jadwal tersisa sampai ujian.
- Pace: `ahead`, `on-track`, atau `behind`.

Exam prep mode:

- `getExamPrepItems()` hanya menampilkan ujian upcoming dalam 14 hari.
- Status: `critical`, `warning`, `ok`.
- Rekomendasi: tambah sesi extra, fokus materi inti, review, atau aman.

## View Ujian

Komponen: `src/components/ExamView.tsx`.

Logika data: `src/lib/examData.ts`.

Tab internal:

- `hari-ini`: ujian hari ini.
- `semua`: daftar semua ujian, upcoming dan past.

Data ujian berasal dari `Subject.examDate`. Tidak ada entitas exam terpisah selain subject date dan correction status.

`getTodayExamItems()`:

- Ambil subject yang `examDate` sama dengan hari ini.
- Cari semua schedule dengan `subjectId` tersebut.
- Jika tidak ada schedule, tetap tampilkan subject untuk semua kelas dengan default jam `07:00-09:00`.
- Jika ada schedule, buat item per jadwal/kelas.
- Hitung `isActive` dan `isDone` dari jam sekarang.
- Sertakan correction status.

`getAllExamSubjects()`:

- Ambil semua subject yang punya `examDate`.
- Hitung `daysLeft`.
- Tentukan kelas relevan dari schedule subject tersebut; jika tidak ada, pakai semua kelas.
- Sertakan correction per kelas.
- Sort berdasarkan `daysLeft`.

Status koreksi:

- Disimpan di localStorage key `edutrack_corrections`.
- Status: `belum`, `sedang`, `selesai`.
- `upsertCorrection()` membuat/memperbarui status.
- `STATUS_NEXT`: `belum -> sedang -> selesai -> belum`.

## View Setup/Kelola

Komponen: `src/components/SetupView.tsx`.

Tab kelola:

- `classes`: daftar kelas.
- `subjects`: mata pelajaran.
- `materials`: materi dan silabus.
- `schedules`: jadwal mengajar.
- `holidays`: hari libur.
- `leave`: izin mengajar.
- `data`: backup dan data.

Fitur umum setup:

- Edit nama guru.
- Edit tahun ajaran.
- Tambah/edit/hapus kelas.
- Tambah/edit/hapus mapel, termasuk `level` dan `examDate`.
- Bulk update exam date per level.
- Tambah/edit/hapus materi.
- Bulk add materi.
- Drag-and-drop reorder materi dengan DnD Kit.
- Tambah/edit/hapus jadwal.
- Cek overlap jadwal pada kelas yang sama dengan `checkOverlap()`.
- Kelola hari libur global/per level.
- Melihat dampak libur terhadap jadwal.
- Izin mengajar/titip tugas.
- Backup JSON, import JSON, export CSV session.
- Load demo data.
- Estimasi ukuran localStorage.
- Prune data lama.

Fungsi data terkait:

- `updateClass()`.
- `setAcademicYear()`.
- `updateSubject()`.
- `bulkUpdateExamDateByLevel()`.
- `updateMaterial()`.
- `updateSchedule()`.
- `reorderMaterials()`.
- `bulkAddMaterials()`.
- `addHoliday()`, `removeHoliday()`, `getHolidayImpactSummary()`.
- `exportJSON()`, `importJSON()`, `exportCSV()`.
- `estimateStorageSize()`.
- `pruneOldSessions()`.

## Hari Libur, Override, dan Reschedule

Hari libur disimpan di `AppData.holidays`.

Bentuk holiday:

- String tanggal `YYYY-MM-DD` untuk libur global.
- Object `{ date, level }` untuk libur level tertentu.

Helper:

- `isDateHolidayForSubject(dateStr, subjectLevel?)`.
- `isTodayHolidayGlobal()`.
- `getHolidayImpactSummary()`.

Schedule override disimpan di `AppData.scheduleOverrides`.

Tipe override dari `types.ts`:

- `date`
- `scheduleId`
- `startTime`
- `durationOverride?`
- `skipped?`

Catatan: `data.ts` juga memakai properti `isExtra` di `addExtraSession()`, tetapi tipe `scheduleOverrides` di `types.ts` belum mencantumkan `isExtra`. Jika mengubah area ini, sinkronkan tipe agar TypeScript aman.

Fitur override:

- `postponeSchedule(scheduleId, diffMinutes)`: geser jadwal pada tanggal hari ini.
- `applyShortDayOverride(dateStr)`: membuat jadwal hari itu lebih pendek dan rapat berurutan.
- `applyEarlyDismissal(dateStr, skipAfterTime)`: skip jadwal yang mulai setelah jam tertentu.
- `suggestDayReschedule(dateStr)`: saran keep/postpone berdasarkan jarak ujian dan status materi.
- `applySmartReschedule(dateStr, actions)`: menerapkan batch action reschedule.
- `applyTeacherLeave(dateStr, reason, resolutions)`: mencatat izin/sakit/titip tugas sebagai deliver atau skip.

## Tasks dan Reminder

Task guru disimpan di `AppData.tasks`.

Helper:

- `getTasks()`.
- `addTask(classId, subjectId, title, deadline)`.
- `toggleTask(id)`.
- `deleteTask(id)`.

Task dibuat manual dari UI atau otomatis dari beberapa fitur:

- Saat skip sesi, toast menawarkan membuat task catch-up minggu depan.
- `applySmartReschedule()` membuat task catch-up untuk sesi yang di-skip.
- `applyPaceSuggestion()` membuat task extra session berdasarkan tanggal saran.

Catatan sesi:

- `updateSessionNote(sessionId, note)` menyimpan catatan pada session.
- `TodayView` memakai marker teks `---REMINDER_DEPAN---` untuk menyimpan reminder pertemuan depan di dalam note.
- Ada dukungan marker lama `---BELUM_KUMPUL---`.

## Backup, Import, Export, dan Pruning

Backup JSON:

- `exportJSON()` membuat file `edutrack_backup_YYYY-MM-DD.json`.
- Setelah export berhasil, `markBackupDone()` mengisi `lastBackup` dan reset `reminderDismissed`.

Import JSON:

- `importJSON(file)` membaca file backup.
- Validasi minimal: JSON object.
- Safe merge dengan default data.
- Pastikan semua array penting tetap array.

Export CSV:

- `exportCSV()` membuat file `edutrack_sessions_YYYY-MM-DD.csv`.
- Kolom: `Tanggal,Kelas,Mapel,Materi`.
- Sesi skipped ditulis sebagai `(Dilewati)`.

Reminder backup:

- `shouldShowBackupReminder()` true jika ada kelas dan belum backup lebih dari 7 hari atau belum pernah backup.
- `dismissBackupReminder()` menyimpan tanggal dismiss hari ini.

Pruning:

- `pruneOldSessions()` menghapus sessions lebih dari 90 hari.
- Menghapus task `done` yang deadline-nya sudah lewat lebih dari 30 hari.
- Dipanggil saat startup view `today`.

Estimasi storage:

- `estimateStorageSize()` menghitung estimasi seluruh isi localStorage, asumsi total 5MB.

## Notifikasi Lokal

Logika: `src/lib/notifications.ts`.

Fungsi:

- `requestNotifPermission()`: minta izin Notification API, lalu start scheduler jika granted.
- `initNotifications()`: start scheduler jika permission sudah granted.
- `startLocalScheduler()`: interval `checkAndNotify` setiap 60 detik.

Jenis notifikasi:

- Kelas mulai 5 menit lagi.
- Ujian besok, dikirim jam 18:00-18:05.
- Ujian 3 hari lagi, dikirim jam 18:00-18:05.
- Persiapan mengajar besok, dikirim jam 20:00-20:05.
- Koreksi terlambat, dikirim jam 07:00-07:05.
- Kelas selesai tetapi belum ditandai, dalam 15 menit setelah end time.

Notifikasi memakai service worker registration jika ada; fallback ke `new Notification()`.

Catatan penting: icon di notification memakai `/icon-192.png`, sedangkan manifest icon berada di `/icons/icon-192.png`. Jika notifikasi icon tidak muncul, ini kemungkinan penyebabnya.

## PWA

Manifest: `public/manifest.json`.

Metadata:

- `name`: `EduTrack — Asisten Pengajar Digital`.
- `short_name`: `EduTrack`.
- `description`: asisten pengajar digital untuk melacak progres, jadwal, dan materi otomatis.
- `start_url`: `/`.
- `display`: `standalone`.
- `background_color`: `#0D0D14`.
- `theme_color`: `#6C63FF`.
- `orientation`: `portrait`.
- Icons: `/icons/icon-192.png`, `/icons/icon-512.png`.
- Shortcut: `Jadwal Hari Ini` menuju `/?view=today`.

Catatan: `Index.tsx` tidak tampak membaca query param `view`, jadi shortcut `/?view=today` pada praktiknya tetap membuka app default `today`. Jika ingin shortcut view lain, perlu implementasi parsing query param.

## UI dan Styling

Tailwind config:

- `tailwind.config.ts`.
- `darkMode: ['class']`.
- Content scan mencakup `src/**/*.{ts,tsx}`.
- Warna berbasis CSS variables seperti `--background`, `--foreground`, `--primary`, dan lain-lain.
- Plugin `tailwindcss-animate`.

Tema:

- Default `dark`.
- Toggle theme menyimpan nilai ke `localStorage` key `pengajar_theme`.
- Jika light, `document.documentElement.className = 'light'`; jika dark, class kosong.

Layout:

- Shell utama `max-w-[430px] mx-auto h-screen flex flex-col overflow-hidden`.
- Konten scroll vertikal di area tengah.
- Bottom nav fixed dalam shell.
- Banyak UI memakai kelas Tailwind custom seperti `bg-surface`, `text-text2`, `border-border` yang didefinisikan di CSS variables.

Komponen UI:

- Folder `src/components/ui` berisi komponen shadcn/Radix, termasuk button, card, dialog, drawer, toast, toaster, sonner, form, select, tabs, table, etc.
- Toast app memakai hook `src/hooks/use-toast.ts` dan komponen toaster.

## Testing

Unit test:

- Script `npm run test` menjalankan `vitest run`.
- Config: `vitest.config.ts`.
- Setup: `src/test/setup.ts`.
- Contoh test: `src/test/example.test.ts`.

E2E:

- Config Playwright: `playwright.config.ts`.
- Fixture: `playwright-fixture.ts`.
- Tidak terlihat script package khusus Playwright di `package.json`; jalankan manual dengan `npx playwright test` jika diperlukan.

Lint:

- Script `npm run lint` menjalankan `eslint .`.
- Config: `eslint.config.js`.

## Hal yang Perlu Diperhatikan Agent AI

- Data utama aplikasi ada di localStorage, bukan database/server.
- Jangan menganggap ada login/auth meskipun dependency Supabase ada.
- Key database utama adalah `pengajar_v4`.
- `getData()` harus dipakai untuk membaca data agar fallback dan merge default tetap berjalan.
- `updateData()` adalah cara aman untuk mutasi data domain karena otomatis save.
- `materialsDone` menghitung sesi selesai, bukan selalu jumlah material/bab.
- `Material.sessions` membuat satu materi bisa membutuhkan lebih dari satu pertemuan.
- `getMaterials()` punya hierarki class override, level shared, legacy fallback, lalu all-subject fallback.
- `Session.materialId === 'SKIPPED'` berarti sesi dilewati dan harus dikecualikan dari progres/coverage.
- `scheduleOverrides` dipakai untuk perubahan jadwal per tanggal, bukan jadwal permanen.
- Libur bisa global atau per level; perhitungan progres dan sesi efektif harus memperhatikan level subject.
- Ujian berasal dari `Subject.examDate`, bukan entitas Exam utama.
- Status koreksi ujian disimpan terpisah di `edutrack_corrections`.
- Notifikasi hanya berjalan jika browser mendukung Notification API dan permission granted.
- App mobile-first, perubahan layout harus diuji pada lebar sempit sekitar 430px.
- Banyak kalkulasi di `data.ts`; hindari duplikasi logika di komponen jika sudah ada helper.
- `applySmartReschedule()` memanggil `saveData(data)` setelah sebelumnya helper tertentu bisa sudah menyimpan data sendiri; hati-hati jika refactor agar tidak overwrite perubahan.
- `addExtraSession()` menulis properti `isExtra` yang belum ada di tipe `scheduleOverrides`.
- Shortcut manifest memakai query `?view=today`, tetapi shell default tidak membaca query param.
- Icon notification memakai path `/icon-192.png`, berbeda dari manifest `/icons/icon-192.png`.
- `QuickAddModal` ada di shell, tetapi trigger `setQuickAddOpen(true)` tidak tampak di `Index.tsx`.

## Ringkasan Alur End-to-End

Alur setup awal:

1. User membuka app pertama kali.
2. App membaca `pengajar_v4`; jika kosong, onboarding muncul.
3. User bisa input data manual lewat `SetupView` atau load demo.
4. User mengisi nama guru, tahun ajaran, kelas, mapel, jadwal, materi, dan tanggal ujian.

Alur mengajar harian:

1. User membuka tab `Hari Ini`.
2. App menampilkan jadwal hari ini dari `schedules`, libur, dan override.
3. App menunjukkan kelas aktif/berikutnya dan materi berikutnya berdasarkan progress.
4. Setelah mengajar, user menandai sesi selesai atau dilewati.
5. Jika selesai, `sessions` bertambah dan `progress.materialsDone` naik.
6. Jika dilewati, session disimpan sebagai `SKIPPED` dan progress tidak naik.
7. Setelah semua selesai, user bisa copy jurnal harian.

Alur monitoring progres:

1. User buka tab `Progres`.
2. App menghitung status tiap kelas+mapel dari materi, progress, jadwal, libur, dan tanggal ujian.
3. App menampilkan status aman/mepet/tertinggal.
4. App menampilkan saran pace, heatmap, prediksi selesai, dan exam prep jika relevan.
5. User bisa menerapkan saran yang membuat task catch-up.

Alur ujian dan koreksi:

1. User mengisi `examDate` pada mapel.
2. Tab `Ujian` otomatis menampilkan ujian hari ini, upcoming, dan past.
3. Untuk ujian hari ini, app menentukan status berlangsung/selesai dari jadwal mapel.
4. User bisa mengubah status koreksi per kelas: belum, sedang, selesai.
5. Briefing dan notifikasi memakai status koreksi untuk mengingatkan pekerjaan pending/overdue.

Alur backup:

1. App mengecek `lastBackup`.
2. Jika sudah 7+ hari belum backup, banner muncul.
3. User export JSON backup.
4. `lastBackup` diperbarui.
5. User bisa import JSON backup untuk restore data.

## File Referensi Cepat

- Entry app: `src/main.tsx`
- Routing/provider: `src/App.tsx`
- Shell utama: `src/pages/Index.tsx`
- Tipe domain: `src/lib/types.ts`
- Data utama/localStorage: `src/lib/data.ts`
- Ujian/koreksi: `src/lib/examData.ts`
- Briefing harian: `src/lib/briefing.ts`
- Notifikasi: `src/lib/notifications.ts`
- Hari ini: `src/components/TodayView.tsx`
- Progres: `src/components/ProgressView.tsx`
- Ujian: `src/components/ExamView.tsx`
- Kelola/setup: `src/components/SetupView.tsx`
- PWA manifest: `public/manifest.json`
- Vite config: `vite.config.ts`
- Tailwind config: `tailwind.config.ts`
