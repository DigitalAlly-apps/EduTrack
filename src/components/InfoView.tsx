import { useState, type ElementType } from 'react';
import { BookOpen, ChevronDown, DatabaseBackup, HelpCircle, Lightbulb, Rocket, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react';

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
      id: 'g7', icon: '🧠', title: 'AI Auto-Pacing & Smart Rescheduler', steps: [
        { t: 'Saran Cerdas Target Ujian', d: 'Sistem menganalisis target ujian, sisa materi, dan hari libur untuk memberikan saran: "Perlu tambah jadwal", "Mepet target", atau "Gabungkan sesi". Klik <strong>Terapkan</strong> untuk otomatis buat task pengganti.' },
        { t: 'Smart Rescheduler (Izin/Cuti)', d: 'Ketika unable mengajar, tekan tombol <strong>🏥 Izin/Cuti</strong> di timeline Hari Ini. Sistem akan sarankan: keep (jangan ubah), postpone (tunda ke minggu depan), skip (dilewati + auto task kejar), atau deliver (tandai selesai).' },
        { t: 'Re-plan 1-Klik', d: 'Validasi pilihan, tekan "Terapkan Semua" — semua jadwal hari ini disesuaikan otomatis beserta task pengganti.' },
      ], tip: 'AI tidak mengganti keputusan Anda. Setiap saran bisa diubah sebelum diterapkan.'
    },
    {
      id: 'g8', icon: '🗺️', title: 'Heatmap Mingguan', steps: [
        { t: 'Visualisasi Grid', d: 'Heatmap di tab <strong>Progres</strong> menampilkan grid Minggu x Mapel. Setiap cell berwarna: hijau (on track), amber (mepet), merah (behind).' },
        { t: 'Baca Sel', d: 'Tekan dan tahan cell untuk melihat detail: jumlah sesi selesai vs total yang dijadwalkan pada minggu itu.' },
        { t: 'Deteksi Pola', d: 'Gunakan heatmap untuk melihat apakah ada minggu yang Rogers (berlebihan) atau kurang padat.' },
      ], tip: 'Heatmap cakup 8 minggu ke depan. Weekly review menjadi visual dan instant.'
    },
    {
      id: 'g9', icon: '📅', title: 'Prediksi Tanggal Selesai', steps: [
        { t: 'Prediksi Otomatis', d: 'Untuk setiap mapel, sistem menghitung prediksi tanggal selesai berdasarkan aktualitas akhir-akhir (4 minggu terakhir).' },
        { t: 'Bandingkan dengan Ujian', d: 'Prediksi dibandingkan dengan tanggal ujian. Jika prediksi setelah ujian → status <strong>behind</strong>, jika sebelum → <strong>on-track</strong>.' },
        { t: 'Tindak Lanjut', d: 'Gunakan saran "Percepatan" dari AI Auto-Pacing jika prediksi tidak memuaskan.' },
      ], tip: 'Prediksi akurat jika Anda konsisten menginput sesi. Pasokan data real-time untuk hasil yang reliable.'
    },
    {
      id: 'g10', icon: '🎯', title: 'Exam Prep Mode (H-14)', steps: [
        { t: 'Auto-Activation', d: '14 hari sebelum ujian, sistem otomatis masuk mode exam prep. Muncul di tab <strong>Progres</strong> sebagai kartu teratas.' },
        { t: 'Checklist Review', d: 'Sistem membersihkan materi yang sudah siap, menyoroti yang belum, dan memberikan action items: tambah sesi, fokus inti, mulai review.' },
        { t: 'Prioritas', d: 'Urutkan berdasarkan urgency: critical (terlambat), warning (mepet), ok (aman). Fokus ke critical dulu.' },
      ], tip: 'Exam Prep Mode menggantikan Daily Briefing selama H-14. Fokus penuh pada persiapan ujian.'
    },
  ];

export default function InfoView() {
  const [activeSubTab, setActiveSubTab] = useState<'guides' | 'updates'>('guides');
  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>({});

  const toggleGuide = (id: string) => {
    setOpenGuides(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const featureGroups: { title: string; icon: ElementType; items: { icon: ElementType; t: string; d: string }[] }[] = [
    {
      title: 'Fitur Utama', icon: Sparkles,
      items: [
        { icon: Lightbulb, t: 'AI Assistant', d: 'Menganalisis progres dan memberi rekomendasi kelas yang perlu difokuskan.' },
        { icon: TrendingUp, t: 'Laporan Mingguan', d: 'Ringkasan aktivitas mengajar mingguan yang siap disalin untuk laporan.' },
        { icon: BookOpen, t: 'Riwayat Sesi', d: 'Telusuri jejak mengajar berdasarkan bulan, kelas, dan materi.' },
      ]
    },
    {
      title: 'Terbaru di v5.2', icon: Rocket,
      items: [
        { icon: Zap, t: 'AI Auto-Pacing', d: 'Menyarankan tambah jadwal saat target ujian mulai berisiko.' },
        { icon: ShieldCheck, t: 'Smart Rescheduler', d: 'Bantu atur sesi saat izin/cuti tanpa menata jadwal satu per satu.' },
        { icon: TrendingUp, t: 'Prediksi Selesai', d: 'Bandingkan laju materi aktual dengan tanggal ujian.' },
      ]
    },
  ];
  const quickHelp = [
    { icon: BookOpen, t: 'Mulai Setup', d: 'Ikuti urutan Kelas, Mapel, Materi, lalu Jadwal.' },
    { icon: TrendingUp, t: 'Pantau Progres', d: 'Cek status mapel yang aman, mepet, atau perlu percepatan.' },
    { icon: DatabaseBackup, t: 'Backup Data', d: 'Export JSON berkala agar data lokal tetap aman.' },
  ];
  const guideIcons: Record<string, ElementType> = {
    g1: Zap,
    g2: TrendingUp,
    g3: BookOpen,
    g4: DatabaseBackup,
    g5: Sparkles,
    g7: Lightbulb,
    g8: TrendingUp,
    g9: TrendingUp,
    g10: ShieldCheck,
  };

  return (
    <div className="pt-2">
      <div className="app-card p-5 mb-4 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary grid place-items-center flex-shrink-0">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-2xl font-black tracking-tight leading-none">Pusat Bantuan</div>
            <div className="text-[13px] text-text2 leading-relaxed mt-2">Panduan singkat untuk setup, pantau progres, dan menjaga data EduTrack tetap aman.</div>
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-2 mt-5">
          {quickHelp.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.t} className="bg-surface2/60 border border-border/60 rounded-2xl p-3 text-center">
                <Icon className="h-4 w-4 text-primary mx-auto mb-1.5" />
                <div className="text-[11px] font-black text-foreground leading-tight">{item.t}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex bg-surface2/50 p-1 rounded-2xl mb-5 border border-border/30">
        <button
          onClick={() => setActiveSubTab('guides')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-black rounded-xl transition-all ${
            activeSubTab === 'guides' ? 'bg-background text-primary shadow-sm' : 'text-text3 hover:text-text2'
          }`}
        >
          <BookOpen className="h-4 w-4" /> Panduan
        </button>
        <button
          onClick={() => setActiveSubTab('updates')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-black rounded-xl transition-all ${
            activeSubTab === 'updates' ? 'bg-background text-primary shadow-sm' : 'text-text3 hover:text-text2'
          }`}
        >
          <Sparkles className="h-4 w-4" /> Fitur
        </button>
      </div>

      {activeSubTab === 'guides' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Backup Banner */}
          <div className="bg-amber/10 border border-amber/20 rounded-2xl p-4 flex items-start gap-3 mb-5">
            <DatabaseBackup className="h-5 w-5 text-amber flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-black text-amber mb-1 uppercase tracking-wider">Penting: Pencadangan Data</div>
              <div className="text-[12px] text-text2 leading-relaxed">
                Mohon lakukan <strong>Backup JSON</strong> secara berkala. Seluruh data disimpan lokal, pencadangan manual diperlukan untuk mencegah kehilangan data.
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="app-section-title mb-3">Panduan Penggunaan</div>
            {guides.map(g => {
              let proTitle = g.title;
              if (g.id === 'g1') proTitle = "Mengelola Tab 'Hari Ini'";
              if (g.id === 'g2') proTitle = "Memantau Kemajuan Pembelajaran";
              if (g.id === 'g3') proTitle = "Langkah Awal Konfigurasi (Setup)";
              if (g.id === 'g4') proTitle = "Keamanan & Pencadangan Data";
              if (g.id === 'g5') proTitle = "Pembaruan & Fitur Unggulan";
              if (g.id === 'g6') proTitle = "Personalisasi & Setelan Lanjutan";

              const GuideIcon = guideIcons[g.id] || HelpCircle;
              return (
                <div key={g.id} className={`acc-item ${openGuides[g.id] ? 'open' : ''} app-card-soft mb-2 overflow-hidden transition-all`}>
                  <button className="w-full flex items-center justify-between p-4 text-left gap-3 active:bg-surface2 transition-colors" onClick={() => toggleGuide(g.id)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-2xl grid place-items-center flex-shrink-0 transition-colors ${openGuides[g.id] ? 'bg-primary-dim text-primary' : 'bg-surface border border-border'}`}><GuideIcon className="h-4 w-4" /></div>
                      <div className="text-sm font-bold">{proTitle}</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-text3 flex-shrink-0 transition-transform ${openGuides[g.id] ? 'rotate-180 text-primary' : ''}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openGuides[g.id] ? 'max-h-[800px]' : 'max-h-0'}`}>
                    <div className="p-4 border-t border-border/40">
                      {g.steps.map((s, i) => (
                        <div key={i} className="flex items-start gap-3 mb-3 last:mb-0">
                          <div className="w-6 h-6 rounded-full bg-surface2 text-text3 text-[10px] font-bold grid place-items-center flex-shrink-0 mt-0.5">{i + 1}</div>
                          <div className="text-sm text-text2 leading-relaxed">
                            <span className="font-semibold text-foreground">{s.t}:</span> <span dangerouslySetInnerHTML={{ __html: s.d }} />
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
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-3xl p-5 border border-primary/20 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-1 h-1 rounded-full bg-primary"></div>
                    <div className="text-xs font-bold text-primary uppercase tracking-widest">Keunggulan</div>
                    <div className="w-1 h-1 rounded-full bg-primary"></div>
                  </div>
                  <h3 className="text-lg font-bold text-center mb-4">Mengapa EduTrack?</h3>
                  <div className="grid gap-3">
                    {[
                       { icon: ShieldCheck, t: 'Data Pribadi 100%', d: 'Semua data tersimpan lokal di browser dan tidak dikirim ke server.' },
                       { icon: Zap, t: 'Ringan & Cepat', d: 'Dioptimalkan untuk pengalaman mobile yang responsif.' },
                       { icon: TrendingUp, t: 'Estimasi Akurat', d: 'Hitung sisa materi vs sisa hari efektif secara presisi.' },
                    ].map((u, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-background/60 rounded-lg border border-border/30">
                        <div className="w-8 h-8 bg-primary-dim rounded-lg flex items-center justify-center text-primary flex-shrink-0"><u.icon className="h-4 w-4" /></div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-foreground mb-0.5">{u.t}</div>
                          <div className="text-xs text-text2 leading-relaxed">{u.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
          </div>

          {/* Feature Groups */}
          {featureGroups.map((group, gIdx) => {
            const GroupIcon = group.icon;
            return (
            <div key={gIdx}>
              <div className="app-section-title mb-3 flex items-center gap-2"><GroupIcon className="h-3.5 w-3.5" /> {group.title}</div>
              <div className="space-y-2.5">
                {group.items.map((u, i) => (
                  <div key={i} className="app-list-item flex items-start gap-3">
                    <div className="w-9 h-9 bg-primary-dim rounded-2xl flex items-center justify-center text-primary flex-shrink-0"><u.icon className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground mb-1">{u.t}</div>
                      <div className="text-xs text-text2 leading-relaxed">{u.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );})}

          {/* Capabilities Section */}
          <div className="px-1">
            <div className="text-xs font-bold tracking-wide uppercase text-text3 mb-3">Semua Kemampuan</div>
            <div className="grid grid-cols-1 gap-3">
              {[
                { icon: BookOpen, t: 'Jadwal Otomatis', d: 'Input jadwal sekali, sistem mendeteksi sesi berjalan otomatis.' },
                { icon: Rocket, t: 'Input Massal', d: 'Copy-paste banyak bab materi sekaligus.' },
                { icon: DatabaseBackup, t: 'Backup & Restore', d: 'Export JSON dan import ulang kapan saja.' },
              ].map((f, i) => (
                <div key={i} className="app-list-item flex items-center gap-3">
                  <div className="flex-shrink-0 w-9 h-9 bg-surface2 rounded-2xl flex items-center justify-center text-text2"><f.icon className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{f.t}</div>
                    <div className="text-xs text-text2 leading-relaxed mt-0.5">{f.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center py-4 mt-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-full">
              <span className="text-xs text-text3 font-medium uppercase tracking-widest">Terus Berinovasi untuk Guru Indonesia</span>
            </div>
          </div>
        </div>
      )}

      <div className="text-center text-xs text-text3 py-6 opacity-60">
        EduTrack • 2026 • v5.2.0
      </div>
    </div>
  );
}
