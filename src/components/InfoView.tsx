import { useState } from 'react';

interface GuideStep {
  t: string;
  d: string;
}

interface Guide {
  id: string;
  icon: string;
  title: string;
  steps: GuideStep[];
  tip?: string;
}

const guides: Guide[] = [
  {
    id: 'g1', icon: '⚡', title: 'Cara Menggunakan Tab Hari Ini', steps: [
      { t: 'Lihat status kelas aktif', d: 'Sesi yang sedang berlangsung tampil di hero card besar dengan badge <strong>Sedang Berlangsung</strong> dan countdown sisa waktu.' },
      { t: 'Tandai sesi selesai', d: 'Tekan tombol <strong>✓ Tandai Selesai</strong> — materi otomatis maju ke bab berikutnya. Ada waktu 4 detik untuk membatalkan.' },
      { t: 'Lewati sesi', d: 'Tombol ⏭ di samping untuk melewati sesi tanpa mencatat materi — berguna jika kelas kosong atau ada agenda lain.' },
      { t: 'Timeline jadwal', d: 'Gulir ke bawah untuk melihat semua jadwal hari ini. Tekan tombol ✓ di kanan tiap item untuk menandai selesai dari timeline.' },
    ], tip: 'Sesi aktif ditentukan otomatis berdasarkan jam dan jadwal yang sudah diatur. Tidak perlu buka-tutup manual.'
  },
  {
    id: 'g2', icon: '📈', title: 'Cara Membaca Tab Progres', steps: [
      { t: 'Dikelompokkan Otomatis', d: 'Semua mata pelajaran sekarang dikelompokkan berdasarkan kelasnya masing-masing. Ketuk nama kelas untuk memperluas daftarnya.' },
      { t: 'Card progres per mapel', d: 'Status real-time: <strong>Sesuai jadwal</strong>, <strong>Mepet target</strong>, atau <strong>Perlu percepatan</strong>.' },
      { t: 'Angka statistik', d: 'Tiga angka di tengah: <strong>Selesai</strong> (bab yang sudah diajarkan), <strong>Tersisa</strong>, dan <strong>Total</strong> bab untuk mapel itu.' },
      { t: 'Saran asisten AI', d: 'Tekan tombol <strong>↻</strong> pada kartu AI (paling atas) agar asisten menganalisis hambatan secara holistik.' },
    ], tip: 'Status badge dihitung otomatis dari sisa materi dibagi estimasi sesi sebelum tanggal ujian.'
  },
  {
    id: 'g3', icon: '⚙️', title: 'Cara Setup di Tab Kelola', steps: [
      { t: 'Tambah Kelas dulu', d: 'Ikuti urutan: Kelas → Mapel → Materi → Jadwal. Tanpa urutan ini, jadwal tidak bisa dibuat.' },
      { t: 'Atur tanggal ujian massal', d: 'Di tab <strong>Mapel</strong>, atur tanggal ujian untuk langsung satu jenjang (SD/MTs) sekaligus melalui menu khusus untuk efisiensi.' },
      { t: 'Input materi massal', d: 'Gunakan fitur <strong>Bulk Input</strong> untuk menempelkan belasan nama bab/materi sekaligus dari Word/Excel.' },
      { t: 'Buat jadwal mingguan', d: 'Di tab <strong>Jadwal</strong>, pilih kelas, mapel, hari (bisa multiple), jam mulai, dan durasi.' },
    ], tip: 'Gunakan fitur Duplicate Materi antar-kelas agar tidak mengetik ulang.'
  },
  {
    id: 'g4', icon: '💾', title: 'Cara Backup & Restore Data', steps: [
      { t: 'Export JSON (backup utama)', d: 'Di tab Kelola → Data → <strong>💾 Backup Full</strong>. Lakukan setidaknya setelap 7 hari. Sistem akan mengingatkan otomatis.' },
      { t: 'Export CSV', d: 'Untuk melihat riwayat sesi mengajar di spreadsheet. Bisa dibuka di Excel atau Google Sheets.' },
      { t: 'Restore / Import JSON', d: 'Pilih <strong>📂 Upload JSON</strong> dan pilih file backup Anda. Semua data akan dikembalikan seperti semula.' },
    ], tip: 'Data tersimpan di localStorage browser. Jika ganti browser atau hapus cache, data bisa hilang. Selalu backup JSON!'
  },
  {
    id: 'g5', icon: '✨', title: 'Fitur Unggulan EduTrack', steps: [
      { t: 'Materi Drag-and-Drop', d: 'Anda sekarang bisa menekan ✏️ untuk mengubah nama, atau menahan ≡ untuk mengurutkan daftar materi.' },
      { t: 'Sistem Multijenjang', d: 'Dapat membedakan materi dan tanggal ujian secara massal untuk berbagai tingkat (SD, MTs, MA).' },
      { t: 'Riwayat Sesi Bulanan', d: 'Buka tab <strong>Progres</strong> lalu tekan <strong>Riwayat Sesi</strong> untuk menelusuri kegiatan mengajar di waktu lampau.' },
      { t: 'Notifikasi Background (Web Push)', d: 'Aktifkan notifikasi, EduTrack akan mengingatkan Anda 5 menit sebelum sesi mengajar meskipun app ditutup.' },
    ], tip: 'PWA Shortcut HP juga tersedia! Tahan icon EduTrack di layar lalu tap "Jadwal Hari Ini".'
  },
  {
    id: 'g6', icon: '🌙', title: 'Dark Mode & Pengaturan Lain', steps: [
      { t: 'Toggle tema', d: 'Tekan tombol 🌙/☀️ di pojok kanan header untuk beralih antara Dark dan Light mode. Pilihan tersimpan otomatis.' },
      { t: 'Edit nama guru', d: 'Di tab Kelola, tap tombol <strong>✏️ Edit</strong> di card profil untuk mengubah nama yang muncul di sapaan header.' },
      { t: 'Reset data', d: 'Di tab Kelola → Data → Zona Berbahaya. Ketik "RESET" untuk konfirmasi. Nama guru tidak akan terhapus.' },
    ], tip: 'Semua perubahan tersimpan otomatis di browser — tidak ada tombol Save yang perlu ditekan.'
  },
];

export default function InfoView() {
  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>({});

  const toggleGuide = (id: string) => {
    setOpenGuides(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="pt-2">
      {/* Backup Banner */}
      <div className="bg-amber/5 border border-amber/20 rounded-xl p-[14px_16px] flex items-start gap-3 mb-[10px]">
        <div className="text-[22px] flex-shrink-0 mt-[1px]">💾</div>
        <div>
          <div className="text-[13px] font-bold text-amber-700 mb-1 uppercase tracking-wider text-[11px]">Penting: Pencadangan Data</div>
          <div className="text-xs text-text2 leading-relaxed">
            Mohon lakukan <strong>Backup JSON</strong> di menu Kelola secara berkala. Seluruh data disimpan secara lokal pada browser ini, sehingga pencadangan manual sangat diperlukan untuk mencegah kehilangan data jika browser di-reset.
          </div>
        </div>
      </div>

      {/* App Quick Intro */}
      <div className="bg-surface/40 backdrop-blur-xl border border-border/60 rounded-[24px] p-[24px] mb-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <span className="text-4xl block mb-3 drop-shadow-sm">🤝</span>
        <div className="font-display text-xl font-bold tracking-tight mb-2 text-foreground">Professional Teaching Assistant</div>
        <div className="text-[13px] text-text2 leading-relaxed font-medium">
          EduTrack adalah asisten pengajar digital yang membantu Anda mengelola jadwal dan memantau perkembangan materi pelajaran. Dengan aplikasi ini, Anda bisa melihat sisa pertemuan sebelum ujian, memastikan materi selesai sesuai target, serta mencatat jurnal harian dengan lebih praktis dan teratur.
        </div>
      </div>

      {/* Notif Card shortcut */}
      <div className="bg-teal-dim border border-teal-border rounded-[20px] p-[18px] mb-[10px]">
        <div className="text-[11px] font-bold tracking-[0.7px] uppercase text-teal mb-[10px]">Pengingat Jadwal Mengajar</div>
        <p className="text-[13px] text-text2 leading-relaxed mb-3">
          Izinkan EduTrack memberikan notifikasi langsung di perangkat Bapak/Ibu <strong>5 menit sebelum sesi kelas dimulai</strong> agar jadwal tetap terkendali.
        </p>
        <button
          onClick={async () => {
            const mod = await import('@/lib/notifications');
            const res = await mod.requestNotifPermission();
            alert(res ? 'Notifikasi berhasil diaktifkan.' : 'Gagal mengaktifkan notifikasi. Mohon periksa izin pada pengaturan browser Anda.');
          }}
          className="w-full py-[12px] bg-teal text-teal-950 text-sm font-bold rounded-lg shadow-teal transition-all active:scale-[0.98]"
        >
          🔔 Aktifkan Pengingat Kelas
        </button>
      </div>

      {/* Panduan Penggunaan with Professional Copy */}
      <div className="mb-[14px]">
        <div className="text-[11px] font-bold tracking-[0.7px] uppercase text-text3 mb-[10px] px-[2px]">Panduan Penggunaan Selengkapnya</div>
        {guides.map(g => {
          // Mapping formal guides
          let proTitle = g.title;
          if (g.id === 'g1') proTitle = "Mengelola Tab 'Hari Ini'";
          if (g.id === 'g2') proTitle = "Memantau Kemajuan Pembelajaran";
          if (g.id === 'g3') proTitle = "Langkah Awal Konfigurasi (Setup)";
          if (g.id === 'g4') proTitle = "Keamanan & Pencadangan Data";
          if (g.id === 'g5') proTitle = "Pembaruan & Fitur Unggulan";
          if (g.id === 'g6') proTitle = "Personalisasi & Setelan Lanjutan";

          return (
            <div
              key={g.id}
              className={`acc-item ${openGuides[g.id] ? 'open' : ''} bg-surface border border-border rounded-lg mb-[6px] overflow-hidden transition-colors`}
            >
              <button
                className="w-full flex items-center justify-between p-[14px_16px] text-left gap-3 active:bg-surface2 transition-colors"
                onClick={() => toggleGuide(g.id)}
              >
                <div className="flex items-center gap-[10px]">
                  <div className={`w-[34px] h-[34px] rounded-[10px] border grid place-items-center text-base flex-shrink-0 transition-colors ${openGuides[g.id] ? 'bg-primary-dim border-primary-border' : 'bg-surface2 border-border'
                    }`}>
                    {g.icon}
                  </div>
                  <div className="text-sm font-semibold">{proTitle}</div>
                </div>
                <span className={`text-[11px] text-text3 flex-shrink-0 transition-transform duration-300 ${openGuides[g.id] ? 'rotate-180 text-primary' : ''}`}>▼</span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${openGuides[g.id] ? 'max-h-[800px]' : 'max-h-0'}`}>
                <div className="p-[0_16px_16px] border-t border-border pt-[14px]">
                  {g.steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-[10px] mb-[12px] last:mb-0">
                      <div className="w-[20px] h-[20px] rounded-full bg-surface2 border border-border text-text3 text-[10px] font-bold grid place-items-center flex-shrink-0 mt-[1px]">
                        {i + 1}
                      </div>
                      <div className="text-[13px] text-text2 leading-relaxed">
                        <span className="font-bold text-foreground">{s.t}:</span> <span dangerouslySetInnerHTML={{ __html: s.d }} />
                      </div>
                    </div>
                  ))}
                  {g.tip && (
                    <div className="flex items-start gap-2 bg-primary-dim border border-primary-border rounded-lg p-[10px_12px] mt-[12px] text-xs text-text2 leading-relaxed">
                      <span className="text-sm flex-shrink-0">💡</span>
                      <span><strong>Tips:</strong> {g.tip}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface/40 backdrop-blur-xl border border-border/60 rounded-[24px] p-[20px] mb-[10px] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal/5 to-transparent pointer-events-none" />
        <div className="text-[11px] font-bold tracking-[0.8px] uppercase text-text3 mb-[16px] relative z-10">Fungsi Utama EduTrack</div>
        <div className="flex flex-col gap-5 relative z-10">
          {[
            { icon: '🎯', title: 'Pantau Progres Personal', desc: 'Catat progres bab demi bab untuk setiap kelas agar Anda selalu tahu sejauh mana langkah mengajar Anda.' },
            { icon: '🧠', title: 'Asisten Analisis Mandiri', desc: 'Dapatkan gambaran otomatis apakah sisa pertemuan cukup untuk menuntaskan materi sebelum ujian.' },
            { icon: '🏖️', title: 'Kelola Jadwal & Libur', desc: 'Atur jadwal mingguan dan tandai hari libur agar perhitungan target materi tetap akurat.' },
            { icon: '🔐', title: 'Data Milik Anda Sepenuhnya', desc: 'Aplikasi berjalan 100% lokal di browser. Data tidak dikirim ke server manapun, privasi Anda aman.' },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-[14px] bg-surface2/80 border border-border grid place-items-center text-xl flex-shrink-0 shadow-sm">{f.icon}</div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground mb-1">{f.title}</div>
                <div className="text-[11px] text-text2 leading-relaxed font-medium">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-[10px] text-text3 py-8 opacity-60">
        EduTrack • Asisten Terbaik Pengajar Andal • 2026
      </div>
    </div>
  );
}


