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
  const [activeSubTab, setActiveSubTab] = useState<'guides' | 'updates'>('guides');
  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>({});

  const toggleGuide = (id: string) => {
    setOpenGuides(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updates = [
    { icon: '🏥', t: 'Manajemen Izin & Sakit', d: 'Sistem cerdas untuk menangani ketidakhadiran pengajar. Anda dapat memilih untuk memberikan Tugas Mandiri (progres tetap jalan) atau Skip Sesi (jadwal dibatalkan) dengan pencatatan otomatis di jurnal.' },
    { icon: '📅', t: 'Penataan Jadwal Mingguan', d: 'Kini jadwal mingguan di halaman Kelola dikelompokkan berdasarkan hari (Senin-Minggu) dan diurutkan berdasarkan waktu, membuat manajemen jadwal jauh lebih teratur.' },
    { icon: '🎯', t: 'Timeline Beranda Presisi', d: 'Desain ulang timeline harian dengan kartu yang lebih bersih, indikator status "DONE" yang elegan, dan visualisasi alur yang lebih profesional.' },
    { icon: '✨', t: 'Minimalist Header v5.0', d: 'Header baru yang lebih lega dengan penghapusan sapaan yang mengganggu dan ikon berlebih, memberikan fokus penuh pada identitas pengajar dan efisiensi akses.' },
    { icon: '📱', t: 'Optimalisasi PWA', d: 'Peningkatan performa aplikasi web saat diinstal ke layar beranda (Home Screen) perangkat Anda.' },
  ];

  return (
    <div className="pt-2">
      {/* Sub-tab Switcher */}
      <div className="flex bg-surface2/50 p-1.5 rounded-[18px] mb-6 border border-border/40">
        <button
          onClick={() => setActiveSubTab('guides')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-[14px] transition-all ${
            activeSubTab === 'guides' ? 'bg-background text-primary shadow-sm' : 'text-text3 hover:text-text2'
          }`}
        >
          📖 Panduan
        </button>
        <button
          onClick={() => setActiveSubTab('updates')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-[14px] transition-all ${
            activeSubTab === 'updates' ? 'bg-background text-primary shadow-sm' : 'text-text3 hover:text-text2'
          }`}
        >
          💡 Fitur & Keunggulan
        </button>
      </div>

      {activeSubTab === 'guides' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Backup Banner */}
          <div className="bg-amber/5 border border-amber/20 rounded-xl p-[14px_16px] flex items-start gap-3 mb-6">
            <div className="text-[22px] flex-shrink-0 mt-[1px]">💾</div>
            <div>
              <div className="text-[11px] font-bold text-amber-700 mb-1 uppercase tracking-wider">Penting: Pencadangan Data</div>
              <div className="text-xs text-text2 leading-relaxed">
                Mohon lakukan <strong>Backup JSON</strong> secara berkala. Seluruh data disimpan lokal, pencadangan manual diperlukan untuk mencegah kehilangan data.
              </div>
            </div>
          </div>

          <div className="mb-6 px-1">
            <div className="text-[11px] font-bold tracking-[0.7px] uppercase text-text3 mb-3">Panduan Penggunaan</div>
            {guides.map(g => {
              let proTitle = g.title;
              if (g.id === 'g1') proTitle = "Mengelola Tab 'Hari Ini'";
              if (g.id === 'g2') proTitle = "Memantau Kemajuan Pembelajaran";
              if (g.id === 'g3') proTitle = "Langkah Awal Konfigurasi (Setup)";
              if (g.id === 'g4') proTitle = "Keamanan & Pencadangan Data";
              if (g.id === 'g5') proTitle = "Pembaruan & Fitur Unggulan";
              if (g.id === 'g6') proTitle = "Personalisasi & Setelan Lanjutan";

              return (
                <div key={g.id} className={`acc-item ${openGuides[g.id] ? 'open' : ''} bg-surface border border-border rounded-xl mb-2 overflow-hidden transition-all shadow-sm`}>
                  <button className="w-full flex items-center justify-between p-4 text-left gap-3 active:bg-surface2 transition-colors" onClick={() => toggleGuide(g.id)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl border grid place-items-center text-base flex-shrink-0 transition-colors ${openGuides[g.id] ? 'bg-primary-dim border-primary-border text-primary' : 'bg-surface2 border-border'}`}>{g.icon}</div>
                      <div className="text-[13px] font-bold">{proTitle}</div>
                    </div>
                    <span className={`text-[10px] text-text3 flex-shrink-0 transition-transform ${openGuides[g.id] ? 'rotate-180 text-primary' : ''}`}>▼</span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openGuides[g.id] ? 'max-h-[800px]' : 'max-h-0'}`}>
                    <div className="p-[0_16px_16px] border-t border-border/40 pt-4">
                      {g.steps.map((s, i) => (
                        <div key={i} className="flex items-start gap-3 mb-3 last:mb-0">
                          <div className="w-5 h-5 rounded-full bg-surface2 border border-border text-text3 text-[10px] font-bold grid place-items-center flex-shrink-0 mt-0.5">{i + 1}</div>
                          <div className="text-[13px] text-text2 leading-relaxed font-medium">
                            <span className="font-bold text-foreground">{s.t}:</span> <span dangerouslySetInnerHTML={{ __html: s.d }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
          {/* Keunggulan Section */}
          <div className="bg-primary/5 rounded-[24px] p-6 border border-primary/10 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
               <span className="text-8xl">💎</span>
             </div>
             <div className="relative z-10">
                <div className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-2 text-center">Keunggulan</div>
                <h3 className="text-xl font-display font-black tracking-tight text-center mb-6">Kenapa EduTrack?</h3>
                <div className="grid gap-5">
                  {[
                    { icon: '🔒', t: 'Privasi 100%', d: 'Data Anda tidak dikirim ke server mana pun. Semuanya tersimpan aman di browser Anda.' },
                    { icon: '🚀', t: 'Super Ringan', d: 'Aplikasi berjalan sangat cepat bahkan di ponsel dengan spesifikasi rendah.' },
                    { icon: '🎯', t: 'Estimasi Presisi', d: 'Satu-satunya asisten yang menghitung sisa materi vs sisa hari efektif secara akurat.' },
                  ].map((u, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-10 h-10 bg-background rounded-xl border border-border flex items-center justify-center text-lg flex-shrink-0 shadow-sm">{u.icon}</div>
                      <div>
                        <div className="text-[13px] font-bold text-foreground mb-0.5 leading-none">{u.t}</div>
                        <div className="text-[12px] text-text2 leading-relaxed font-medium opacity-80">{u.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          {/* Capabilities Section */}
          <div className="px-1">
            <div className="text-[11px] font-bold tracking-[0.7px] uppercase text-text3 mb-4">Apa saja yang bisa dilakukan?</div>
            <div className="space-y-3">
              {[
                { icon: '📅', t: 'Manajemen Jadwal Otomatis', d: 'Input jadwal sekali, asisten akan mendeteksi kelas mana yang harus Anda ajar setiap saat.' },
                { icon: '📝', t: 'Input Materi Massal', d: 'Punya 20 bab materi? Copy-paste semua barisnya sekaligus. EduTrack akan memecahnya otomatis.' },
                { icon: '🏥', t: 'Kelola Izin & Tugas', d: 'Guru tidak hadir? Tandai sebagai izin dan berikan Tugas Mandiri agar progres materi tidak terhenti.' },
                { icon: '📊', t: 'Dashboard Progres Real-time', d: 'Lihat status semua kelas dalam satu pandangan. Mana yang "Behind" dan mana yang "On Track".' },
                { icon: '💾', t: 'Cetak Laporan (CSV)', d: 'Butuh laporan fisik? Export semua riwayat sesi mengajar Anda ke format file Excel/CSV.' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-4 bg-surface2/30 border border-border/50 p-4 rounded-2xl hover:bg-surface2/50 transition-colors">
                  <div className="text-2xl">{f.icon}</div>
                  <div>
                    <div className="text-[13px] font-bold text-foreground">{f.t}</div>
                    <div className="text-[11px] text-text2 leading-relaxed mt-0.5">{f.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center py-4">
            <div className="text-[10px] text-text3 font-bold uppercase tracking-widest opacity-40 italic">
              "Terus Berinovasi untuk Guru Indonesia"
            </div>
          </div>
        </div>
      )}

      <div className="text-center text-[10px] text-text3 py-8 opacity-60">
        EduTrack • 2026 • v5.0.0
      </div>
    </div>
  );
}


