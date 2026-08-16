# EduTrack — Dokumentasi Produk & Implementasi

> Diperbarui 17 Agustus 2026.
>
> Dokumen lama di file ini sudah tidak dijadikan satu-satunya sumber kebenaran karena codebase berkembang cukup jauh. Gunakan:
>
> - **`PRD.md`** untuk tujuan produk, prinsip UX, requirement fitur, dan definition of done.
> - **`codebase.md`** untuk arsitektur teknis, model data, persistence/sync, event contract, guardrails, dan technical debt.

## Ringkasan aplikasi

EduTrack adalah aplikasi web/PWA mobile-first untuk membantu guru mengelola kegiatan mengajar sehari-hari: jadwal, kelas, mapel, materi/silabus, progres, realisasi sesi, kalender, riwayat, ujian/koreksi, semester, libur, izin, backup, serta sinkronisasi cloud opsional.

Arsitektur saat ini bersifat **local-first**. Data kerja utama berada di `localStorage` (`pengajar_v4`) dan dapat disinkronkan ke Supabase ketika pengguna login. Perubahan lokal harus langsung terlihat di UI; cloud tidak boleh membuat workflow utama menunggu jaringan.

## Navigasi utama

- **Hari Ini** — agenda dan realisasi mengajar.
- **Progres** — progres hybrid per kelas/mapel, kalender, dan riwayat.
- **Ujian** — jadwal/persiapan/koreksi ujian.
- **Kelola** — data akademik, materi, jadwal, semester, libur, izin, backup.
- **Info** — informasi aplikasi.

## Progress hybrid

Progress saat ini sengaja menggabungkan dua kebutuhan:

1. **Readable** — guru langsung melihat bab sekarang, pertemuan ke berapa, dan catatan pertemuan berikutnya.
2. **Tracker tetap kuat** — kebutuhan vs ketersediaan sesi tetap ada, tetapi detailnya collapsed agar tidak memenuhi layar.
3. **Editable** — estimasi jumlah pertemuan dan catatan dapat diubah dari konteks card.
4. **Tanpa refresh manual** — mutation memicu event data berubah sehingga UI membaca state terbaru.

Card mapel menampilkan ringkasan progres, bab aktif, `Pertemuan X dari Y`, catatan pertemuan berikutnya, tracker sesi yang dapat dibuka, serta panel rencana bab/edit.

Aksi **Selesaikan bab** menutup bab lebih cepat dari estimasi dan memajukan posisi ke materi berikutnya. Konfirmasi dirender di layer `document.body` agar tidak tertutup floating/bottom navigation.

Kalender Progress mempertahankan legend **Selesai, Sebagian, Terlewat, Libur**. Riwayat menjadi audit trail dan dasar koreksi progres.

## Data penting

- `Material.sessions` = estimasi jumlah pertemuan untuk bab.
- `Progress.materialsDone` = jumlah **sesi** yang telah ditempuh, bukan jumlah bab.
- `Progress.completedMaterialIds` = bab yang sengaja ditutup lebih cepat.
- `Session.materialCompleted` = penanda bahwa bab benar-benar selesai pada sesi tersebut.
- `Semester` menyimpan batas UTS/UAS; `Subject.examDate` bersifat deprecated.

Materi diselesaikan dengan prioritas: override khusus rombel → shared level → legacy global. Override kelas lain tidak boleh bocor menjadi fallback.

## Persistence & sync

`src/lib/data.ts` menangani persistence/business logic utama. `saveData()` menyimpan lokal dan dapat memicu cloud sync. `saveDataLocalOnly()` dipakai untuk remote update agar tidak terjadi loop.

`src/lib/supabaseSync.ts` menyediakan Google auth, snapshot sync ke tabel `app_sync`, pending-sync recovery, dan realtime subscription. Remote update memancarkan `edutrack-remote-sync`.

## Prinsip perubahan selanjutnya

- Jangan membuat layar utama menjadi dashboard AI/analitik yang padat.
- Editing harus dekat dengan data yang diedit.
- Detail panjang gunakan progressive disclosure.
- Jangan meminta user refresh browser setelah save.
- Pertahankan backward compatibility data lama.
- Hindari rewrite besar `data.ts` dalam satu perubahan; pecah bertahap.
- Build dan test relevan sebelum merge.

Untuk detail lengkap, baca **`PRD.md` lalu `codebase.md`**. Kedua file tersebut menjadi referensi utama untuk agent/developer yang melanjutkan EduTrack.
