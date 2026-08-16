# EduTrack — Product Requirements Document (PRD)

Dokumen ini berisi spesifikasi produk, fitur utama, alur pengguna, serta aturan bisnis aplikasi EduTrack.

## 1. Visi Produk

EduTrack adalah asisten pengajar digital mobile-first berbasis PWA yang membantu pengajar/guru mengelola KBM harian, silabus/materi, progres pembelajaran, persiapan ujian, koreksi, jurnal harian, dan backup data tanpa ketergantungan backend server.

---

## 2. Fitur Utama

### A. Jadwal Hari Ini & Mengajar (`TodayView`)
- **Tampilan KBM Real-time**: Menampilkan kelas aktif, jam mengajar, dan materi yang harus diajarkan.
- **Pencatatan Sesi**: Menandai KBM selesai (`markDone`), mencatat halaman terakhir (`lastPageReached`), dan catatan pengingat untuk pertemuan berikutnya (`---REMINDER_DEPAN---`).
- **Quick Action "⚡ Selesaikan Bab Ini"**: Menutup bab aktif lebih awal dengan 1 tap dan langsung lanjut ke bab berikutnya pada KBM selanjutnya.
- **Penggeseran & Izin Schedule**: Fitur postponed jadwal, early dismissal, libur mapel, dan smart rescheduler (izin/sakit).
- **Jurnal Harian**: Otomatis menyusun jurnal format WhatsApp untuk laporan pengajaran harian.

### B. Monitoring Progres & Pengaturan Tempo (`ProgressView`)
- **Indikator Progres Kelas & Mapel**: Mengkalkulasi status `on-track` (🟢), `tight` (🟡), atau `behind` (🔴) berdasarkan target ujian dan hari libur.
- **Actionable Auto-Pacing (AI Suggestion)**:
  - `add_sessions`: Menambahkan jadwal pengganti / extra session ke daftar tugas.
  - `merge_sessions`: Memadatkan sesi materi secara otomatis jika target mepet (`applyMergeSuggestion`).
  - `trim_materials`: Memangkas materi menjadi 1 pertemuan untuk mengejar ujian (`applyTrimSuggestion`).
- **Inline Material Session Editor**: Mengubah estimasi pertemuan untuk materi manapun secara langsung di daftar materi (`✏️`).
- **Koreksi Progres**: Tombol `↩ Mundur 1 Sesi` untuk mengoreksi kesalahan pencatatan KBM.

### C. Persiapan Ujian & Koreksi (`ExamView`)
- **Ujian Hari Ini & Upcoming**: Menampilkan jadwal ujian UTS/UAS terdekat dan countdown hari.
- **Antrean Koreksi**: Mengelola status koreksi per kelas (Belum, Sedang, Selesai) untuk briefing harian.

### D. Manajemen Data & Silabus (`SetupView`)
- **Kelola Kelas, Mapel, & Jadwal**: Mengatur rombel, tingkat kelas, mata pelajaran, dan jadwal mingguan (dengan deteksi overlap).
- **Silabus & Sesi Materi**: Mengatur daftar bab, jumlah estimasi pertemuan per bab (`sessions`), rentang halaman, tag UTS/UAS, dan drag-and-drop reordering.
- **Progress Badges Real-time**: Indikator status `✓ Selesai` dan `▶ Sesi X/Y` langsung pada list kelola materi.
- **Backup & Portabilitas Data**: Export/Import JSON backup dan Export CSV riwayat KBM.

---

## 3. Alur Pengguna (User Flows)

1. **Alur KBM Harian**:
   - Pengajar membuka Tab *Hari Ini* -> melihat materi hari ini & nomor hal lanjutan -> mengeklik *Selesai* / *⚡ Selesaikan Bab* -> mencatat halaman -> menyalin jurnal harian.

2. **Alur Penyesuaian Tempo (Pacing Adjustment)**:
   - Pengajar membuka Tab *Progres* -> melihat rekomendasi *Pengaturan Tempo Otomatis* -> mengeklik *Terapkan* -> jumlah pertemuan materi otomatis disesuaikan & status progres ter-update.

3. **Alur Edit Silabus On-the-Fly**:
   - Pengajar dapat mengubah estimasi pertemuan bab kapan saja dari *TodayView*, *ProgressView*, maupun *SetupView* tanpa merusak riwayat KBM yang sudah berjalan.

---

## 4. Kriteria Kualitas & Keamanan (Quality Assurance)

- **Offline First**: Semua data wajib tersimpan aman di `localStorage` (`pengajar_v4`).
- **Zero Regression**: Semua perubahan fungsi bisnis wajib lulus unit testing `npm run test`.
- **Fast Build**: Aplikasi wajib dapat di-build secara bersih via `npm run build`.
