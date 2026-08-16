# EduTrack — Codebase Reference

> Status: diperbarui 17 Agustus 2026. Dokumen ini mengikuti codebase pada branch `agent/progress-hybrid-readable` dan ditujukan sebagai peta teknis cepat untuk developer/agent.

## 1. Arsitektur singkat

EduTrack adalah React SPA/PWA mobile-first untuk operasional mengajar guru. Data tetap **local-first** di browser, dengan **Supabase sebagai auth + sinkronisasi cloud opsional**. UI tidak boleh bergantung pada reload halaman setelah mutation.

Stack utama:
- React 18 + TypeScript + Vite 5.
- Tailwind CSS + shadcn/Radix UI + Lucide.
- `@dnd-kit` untuk drag-and-drop materi.
- Supabase JS untuk Google auth, cloud sync, dan realtime.
- Vitest + Testing Library; Playwright tersedia untuk E2E.
- `vite-plugin-pwa` dengan auto update.

Script utama: `npm run dev`, `npm run build`, `npm run lint`, `npm run test`, `npm run preview`.

## 2. Struktur penting

```text
src/
├── main.tsx
├── App.tsx
├── pages/
│   └── Index.tsx              # shell/tab utama
├── components/
│   ├── TodayView.tsx          # jadwal & realisasi hari ini
│   ├── ProgressView.tsx       # progres hybrid, kalender, riwayat
│   ├── ExamView.tsx           # ujian/koreksi
│   ├── SetupView.tsx          # data akademik & pengaturan
│   ├── InfoView.tsx
│   └── ui/                    # primitive reusable
└── lib/
    ├── types.ts               # model domain
    ├── data.ts                # persistence + business logic utama
    ├── examData.ts
    ├── briefing.ts
    ├── notifications.ts
    ├── sessionDraft.ts
    ├── supabase.ts
    └── supabaseSync.ts        # auth/sync/realtime cloud
```

`data.ts` saat ini besar dan memegang banyak domain sekaligus. Jangan menambah business logic baru ke komponen UI bila logikanya reusable; letakkan di `lib` dan pertimbangkan pemecahan `data.ts` saat refactor besar.

## 3. Persistence & sinkronisasi

### Local-first
Key data utama: `pengajar_v4`. `getData()` masih membaca `pengajar_v3`/`pengajar_v2` sebagai fallback migrasi. Setiap save menyimpan snapshot sebelumnya ke `edutrack_last_known_good` untuk recovery.

- `getData()` → baca + normalisasi data.
- `saveData()` → simpan lokal dan trigger callback cloud bila aktif.
- `saveDataLocalOnly()` → simpan tanpa push cloud; dipakai untuk menerima remote update agar tidak loop.
- `updateData(fn)` → pola mutation domain utama.

### Cloud opsional
`supabaseSync.ts` memakai tabel `app_sync` per user.
- Google OAuth.
- local save dapat dipush ke cloud melalui `setOnDataSaved`.
- realtime update perangkat lain disimpan dengan `saveDataLocalOnly()`.
- remote update memancarkan `edutrack-remote-sync`.
- sync gagal disimpan sementara pada `edutrack_pending_cloud_sync`.

Prinsip: **localStorage adalah working state; cloud adalah sinkronisasi, bukan alasan UI menunggu jaringan untuk terasa responsif.**

## 4. Model domain utama

`AppData` memuat `classes`, `subjects`, `materials`, `schedules`, `progress`, `sessions`, `tasks`, `notes`, `holidays`, `scheduleOverrides`, `examSchedules`, `semesters`, tahun ajaran, dan metadata backup.

### Material
Materi/bab memiliki `sessions` sebagai estimasi jumlah pertemuan, rentang halaman, catatan, serta periode ujian (`UTS`/`UAS`). Materi dapat shared per level atau override khusus rombel.

Resolusi materi untuk kelas:
1. override `classId`;
2. shared `level`;
3. legacy tanpa `level/classId`.

Materi milik kelas lain tidak boleh menjadi fallback.

### Progress
`materialsDone` adalah **jumlah sesi yang telah ditempuh**, bukan sekadar jumlah bab. `completedMaterialIds` menyimpan bab yang sengaja ditutup lebih cepat dari estimasi sesi awal.

### Session
Realisasi KBM menyimpan tanggal, kelas, mapel, material, note, halaman terakhir, dan `materialCompleted` bila bab benar-benar selesai pada sesi itu.

### Semester/Ujian
`Semester` memegang batas UTS/UAS. `Subject.examDate` bersifat deprecated; implementasi baru sebaiknya menggunakan semester/exam schedule.

## 5. Progress: desain hybrid saat ini

`ProgressView.tsx` memiliki tiga subtab: **Progres**, **Kalender**, **Riwayat**.

Tujuan UX Progress: tracker tetap kuat tetapi layar utama tidak terasa seperti dashboard analitik yang memusingkan. Informasi operasional harus terbaca dulu; detail baru dibuka bila diperlukan.

### Card mapel
Urutan informasi:
1. nama mapel + jumlah sesi selesai + persen;
2. indikator kondisi (`Sesi cukup`, `Jadwal mepet`, atau kekurangan sesi);
3. progress bar;
4. **Bab sekarang** + `Pertemuan X dari Y`;
5. **Pertemuan berikutnya** — catatan editable inline;
6. **Tracker sesi** — collapsed secara default, menampilkan `butuh / tersedia / kurang`;
7. **Rencana bab & edit** — collapsed untuk detail silabus dan estimasi sesi.

### Editing
- Estimasi pertemuan minimal `1`; input tidak boleh terjebak karena nilai awal `1` tidak bisa dikosongkan saat mengetik. UI menggunakan draft string lalu validasi saat simpan.
- Catatan pertemuan berikutnya disimpan pada materi aktif dan dapat diedit inline.
- Setelah mutation, UI memancarkan `edutrack-data-changed`; `ProgressView` menaikkan revision dan membaca data baru. **Tidak boleh mewajibkan refresh browser.**

### Selesaikan bab
`markMaterialCompleted(classId, subjectId, materialId)` menutup bab lebih cepat dan memajukan posisi mengajar. Konfirmasi harus memberi feedback nyata (toast + UI berubah). Dialog konfirmasi di Progress dirender melalui `createPortal(..., document.body)` agar tidak tertutup floating/bottom navigation.

### Tracker sesi
Tracker membandingkan kebutuhan sesi tersisa dengan sesi efektif yang tersedia sampai batas akademik/ujian, termasuk pengaruh hari libur. Detail rekomendasi tetap tersedia tetapi tidak mendominasi card utama.

## 6. Kalender & riwayat

Kalender Progress harus selalu mempunyai legend yang dapat dibaca. Status visual yang dipertahankan:
- **Selesai**
- **Sebagian**
- **Terlewat**
- **Libur**

Riwayat menggunakan session records sebagai audit trail realisasi mengajar. Koreksi progres dilakukan melalui operasi domain seperti `undoLastSession`, bukan mengedit angka agregat secara sembarang.

## 7. Refresh/event contract

Mutation yang memengaruhi tampilan lintas komponen harus menghasilkan refresh state tanpa reload browser.

Event penting:
- `edutrack-data-changed` → perubahan data lokal/domain.
- `edutrack-remote-sync` → data baru dari Supabase realtime.
- event navigasi seperti `edutrack-nav` / `set-tab` dipakai shell untuk perpindahan view.

Saat menambah fitur, jangan membuat komponen membaca `getData()` sekali lalu menjadi stale. Gunakan state/revision/callback/event yang sesuai.

## 8. Guardrails untuk perubahan code

1. **Readable + editable**: layar utama menjawab “sekarang mengajar apa dan berikutnya apa”; editing dekat dengan informasi yang diedit.
2. **Progressive disclosure**: analisis/tracker/detail panjang collapse secara default.
3. **Local-first**: mutation lokal harus terasa instan; cloud sync berjalan setelahnya.
4. **No manual refresh**: save/edit/complete/undo harus langsung terlihat.
5. **Backward compatible**: data lama `pengajar_v2/v3/v4` dan material legacy jangan rusak.
6. **Jangan ubah `materialsDone` menjadi jumlah bab** tanpa migrasi; saat ini semantiknya jumlah sesi.
7. **Portal untuk modal kritis** bila ancestor/floating nav berpotensi membuat stacking context bermasalah.
8. Jalankan minimal `npm run build` dan test relevan sebelum merge perubahan behavior.

## 9. Technical debt yang perlu diingat

- `src/lib/data.ts` sudah sangat besar (~95 KB) dan menggabungkan persistence, kalender, progress, scheduling, material, backup, dan smart features. Refactor ideal dilakukan bertahap, bukan rewrite sekaligus.
- `dokumen.md` adalah product/agent reference lama yang lebih panjang; `PRD.md` sekarang menjadi sumber tujuan produk, sedangkan file ini menjadi sumber teknis.
- Ada generated/dependency content seperti `dist/` dan `node_modules/` yang terlihat tracked di repository. Jangan menyentuh atau memperluas scope itu saat mengerjakan fitur kecil kecuali memang sedang melakukan repo hygiene terpisah.
- Cloud sync memakai model last-write-ish/snapshot per user; konflik multi-device belum merupakan merge domain granular.

## 10. Checklist sebelum merge

- Build berhasil pada source yang akan digabung.
- Tidak ada file sementara/debug.
- Edit Progress langsung terlihat tanpa reload.
- “Selesaikan bab” benar-benar mengubah posisi bab.
- Modal tidak tertutup bottom/floating nav.
- Legend kalender tetap ada.
- Tracker sesi tetap tersedia tetapi tidak membuat card utama penuh.
- Dokumentasi diperbarui bila model data/alur utama berubah.
