# EduTrack — Product Requirements Document (PRD)

> Versi kerja: 17 Agustus 2026

## 1. Ringkasan produk

EduTrack adalah aplikasi web/PWA mobile-first untuk membantu guru menjalankan pekerjaan mengajar sehari-hari tanpa harus mengelola spreadsheet atau catatan terpisah. Fokusnya bukan administrasi sekolah skala besar, tetapi **kendali pribadi guru atas jadwal, materi, progres kelas, ujian, dan catatan mengajar**.

Pertanyaan utama yang harus bisa dijawab EduTrack dengan cepat:
- Hari ini saya mengajar apa?
- Kelas ini sekarang sampai bab dan pertemuan berapa?
- Pertemuan berikutnya harus mengajar apa dan apa catatan saya?
- Apakah materi akan selesai tepat waktu sebelum ujian?
- Apa yang sudah terjadi sebelumnya jika progres perlu dikoreksi?

## 2. Prinsip produk

### Readable
Informasi utama harus dapat dipahami tanpa membuka banyak panel. Bahasa UI harus operasional dan familiar untuk guru, bukan istilah teknis/AI yang tidak perlu.

### Editable
Data yang sering berubah di lapangan harus mudah dikoreksi dari konteksnya: jumlah pertemuan bab, catatan pertemuan berikutnya, realisasi mengajar, dan status penyelesaian.

### Tidak memusingkan
EduTrack boleh memiliki kalkulasi dan tracker yang kuat, tetapi analisis detail menggunakan progressive disclosure. Layar utama menampilkan keputusan yang dibutuhkan guru; detail tersedia saat dibuka.

### Local-first dan responsif
Perubahan harus langsung terasa di UI dan tersimpan lokal. Pengguna **tidak boleh perlu refresh browser** setelah edit. Cloud sync bersifat pendukung.

### Guru tetap memegang keputusan
Saran pace/reschedule adalah bantuan. Aplikasi tidak boleh mengubah rencana mengajar penting secara diam-diam tanpa tindakan eksplisit pengguna.

## 3. Target pengguna

Pengguna utama adalah guru/pengajar yang:
- mengajar beberapa kelas dan mata pelajaran;
- memiliki silabus/bab dengan jumlah pertemuan yang dapat berubah;
- perlu mencatat realisasi pembelajaran;
- ingin mengetahui apakah progres aman terhadap UTS/UAS;
- membutuhkan aplikasi yang nyaman dipakai cepat dari HP.

## 4. Navigasi utama

EduTrack memiliki lima area utama:

1. **Hari Ini** — agenda mengajar dan aksi realisasi.
2. **Progres** — posisi materi, tracker sesi, kalender, dan riwayat.
3. **Ujian** — jadwal ujian dan pekerjaan koreksi/persiapan.
4. **Kelola** — kelas, mapel, materi, jadwal, semester, libur, izin, data/backup.
5. **Info** — informasi aplikasi.

Navigasi harus tetap mobile-first dan tidak menutupi modal/dialog penting.

## 5. Hari Ini

Tujuan: guru membuka aplikasi dan langsung mengetahui agenda mengajar hari tersebut.

Kebutuhan inti:
- tampilkan kelas, mapel, waktu, dan materi yang relevan;
- catat sesi mengajar tanpa flow panjang;
- dukung selesai, terlewat/skip, perubahan jadwal, dan catatan realisasi sesuai kemampuan aplikasi;
- simpan halaman terakhir/catatan bila tersedia;
- perubahan realisasi langsung memengaruhi Progress;
- briefing/reminder membantu, tetapi tidak boleh mengalahkan agenda utama.

## 6. Progress — requirement utama

Progress memakai pendekatan **hybrid**: kekuatan tracker versi lama dipertahankan, tetapi UI utama tetap sederhana dan editable.

### 6.1 Pemilihan kelas
- pengguna dapat memilih jenjang dan kelas;
- pilihan terakhir boleh diingat lokal;
- mapel yang tampil relevan dengan jadwal kelas tersebut.

### 6.2 Card mapel
Card harus memprioritaskan:
- nama mapel;
- sesi selesai / total sesi dan persentase;
- status sederhana: sesi cukup, jadwal mepet, atau kurang sesi;
- bab aktif;
- `Pertemuan X dari Y`;
- halaman materi bila tersedia;
- catatan untuk pertemuan berikutnya.

### 6.3 Catatan pertemuan berikutnya
Guru dapat menulis instruksi praktis seperti:
- “bab ini cukup 2 pertemuan”;
- “rangkum isi”;
- “tulis poin ini di papan tulis”;
- “lanjut halaman 24”.

Catatan:
- editable inline;
- save langsung terlihat tanpa reload;
- tidak dipaksa menjadi output AI atau format khusus.

### 6.4 Estimasi jumlah pertemuan
Setiap bab mempunyai estimasi `sessions`, minimum 1.

Requirement input:
- nilai yang sedang diedit harus dapat dikosongkan sementara saat mengetik;
- validasi minimum 1 dilakukan saat penyimpanan;
- perubahan estimasi langsung menghitung ulang posisi/tracker yang relevan.

### 6.5 Selesaikan bab sekarang
Guru dapat menutup bab aktif lebih cepat dari estimasi awal.

Flow:
1. tekan aksi selesai bab;
2. tampil konfirmasi yang jelas;
3. konfirmasi menandai bab selesai;
4. posisi mengajar maju ke bab berikutnya;
5. toast/feedback tampil;
6. card langsung berubah tanpa refresh.

Dialog harus berada di layer di atas floating/bottom navigation.

### 6.6 Tracker sesi
Tracker tetap tersedia untuk menjawab apakah waktu mengajar mencukupi.

Ringkasan minimal:
- sesi dibutuhkan;
- sesi tersedia;
- kekurangan bila ada.

Tracker **collapsed secara default**. Rekomendasi/detail hanya muncul setelah dibuka agar layar utama tidak terasa seperti dashboard analitik.

### 6.7 Rencana bab & edit
Daftar bab lengkap dan kontrol edit ditempatkan pada panel yang dapat dibuka. Pengguna harus dapat melihat bab selesai, bab aktif, dan bab berikutnya tanpa memenuhi card utama.

### 6.8 Koreksi progres
Kesalahan pencatatan harus dapat dikoreksi berdasarkan riwayat/sesi, misalnya mundur satu sesi. Agregat progres tidak boleh menjadi angka yang diedit bebas tanpa jejak karena berisiko memutus konsistensi dengan session history.

## 7. Kalender Progress

Kalender memberi gambaran realisasi KBM per tanggal.

Legend warna/status **wajib terlihat**:
- Selesai
- Sebagian
- Terlewat
- Libur

Warna bukan satu-satunya informasi; label legend harus tersedia agar arti status tidak hilang.

## 8. Riwayat

Riwayat adalah audit trail ringan untuk guru:
- kapan mengajar;
- kelas/mapel;
- materi;
- status realisasi;
- catatan/halaman bila tersedia.

Riwayat mendukung koreksi bila pencatatan salah dan menjadi dasar untuk memahami progres, bukan sekadar dekorasi statistik.

## 9. Materi dan silabus

Guru dapat mengelola materi per mapel dan level/kelas.

Material mendukung:
- nama bab/materi;
- urutan;
- estimasi pertemuan;
- halaman awal/akhir;
- catatan;
- periode UTS/UAS;
- materi shared per level;
- override khusus rombel bila dibutuhkan.

Perubahan struktur materi tidak boleh membuat kelas lain memakai override rombel yang salah.

## 10. Semester, ujian, dan pace

EduTrack dapat memakai semester dan batas UTS/UAS untuk memperkirakan waktu efektif.

Tracker mempertimbangkan:
- jumlah sesi materi yang masih dibutuhkan;
- jadwal mengajar;
- hari libur;
- waktu efektif yang tersisa.

Saran pace dapat membantu ketika jadwal mepet/tertinggal, tetapi harus dapat dipahami dan tidak melakukan perubahan besar secara otomatis tanpa persetujuan pengguna.

## 11. Persistence, backup, dan cloud

### Local
Data kerja disimpan pada browser (`pengajar_v4`) dengan kompatibilitas data lama. Aplikasi menyimpan snapshot recovery terakhir saat data berubah.

### Cloud
Jika user login, Supabase dapat menyinkronkan snapshot data antar perangkat secara realtime. Aplikasi tetap harus usable ketika sync/network bermasalah.

### Backup
Backup/export tetap penting karena aplikasi menyimpan data operasional guru. UI harus mengingatkan secara wajar, bukan menghalangi pekerjaan utama.

## 12. Non-functional requirements

- Mobile-first; nyaman pada viewport sekitar lebar ponsel.
- Light/dark theme tetap terbaca.
- Mutation utama terasa instan.
- Tidak ada kebutuhan manual refresh setelah edit.
- Modal penting tidak tertutup floating navigation.
- Backward compatibility data dijaga.
- Build production harus berhasil sebelum merge.
- Fitur kritis Progress sebaiknya memiliki regression test bertahap.

## 13. Definition of Done untuk perubahan Progress

Perubahan dianggap selesai bila:
- bab aktif dan pertemuan X/Y benar;
- catatan pertemuan berikutnya dapat diedit dan langsung berubah;
- input estimasi sesi dapat diedit secara natural dan tervalidasi;
- selesai bab benar-benar memajukan progres;
- modal konfirmasi terlihat di atas nav;
- tracker sesi tetap tersedia tetapi tidak memenuhi layar;
- kalender memiliki legend lengkap;
- riwayat/koreksi tetap dapat digunakan;
- tidak ada refresh browser yang diperlukan;
- build berhasil.

## 14. Arah pengembangan berikutnya

Prioritas pengembangan sebaiknya mempertahankan kesederhanaan produk:
1. tambah regression test untuk mutation Progress dan kalkulasi sesi;
2. rapikan event refresh lokal/remote menjadi pola state yang konsisten;
3. pecah `data.ts` bertahap per domain tanpa rewrite besar;
4. perkuat strategi konflik cloud multi-device;
5. evaluasi repo hygiene (`dist`, `node_modules`, lockfile ganda) sebagai pekerjaan terpisah agar tidak mencampur perubahan fitur.

## 15. Out of scope saat ini

- LMS lengkap untuk siswa/orang tua;
- sistem administrasi sekolah multi-tenant penuh;
- AI yang mengambil alih keputusan pembelajaran;
- kewajiban backend agar aplikasi dapat dipakai;
- rewrite arsitektur besar hanya demi merapikan kode.
