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
      { t: 'Catat sesi selesai', d: 'Tekan <strong>Selesai & pilih materi</strong>, periksa materi yang diajarkan, lalu pilih apakah materinya masih lanjut atau sudah selesai.' },
      { t: 'Lewati sesi', d: 'Tombol ⏭ di samping untuk melewati sesi tanpa mencatat materi — berguna jika kelas kosong atau ada agenda lain.' },
      { t: 'Timeline jadwal', d: 'Gulir ke bawah untuk melihat semua jadwal hari ini. Tekan tombol ✓ di kanan tiap item untuk menandai selesai dari timeline.' },
    ], tip: 'Sesi aktif ditentukan otomatis berdasarkan jam dan jadwal yang sudah diatur. Tidak perlu buka-tutup manual.'
  },
  {
    id: 'g6', icon: '📚', title: 'Tracker Materi & Estimasi Pertemuan', steps: [
      { t: 'Materi masih berlanjut', d: 'Saat menyimpan pertemuan, biarkan pilihan <strong>Materi selesai hari ini</strong> tidak dicentang. Pertemuan berikutnya tetap menggunakan materi yang sama.' },
      { t: 'Selesai lebih cepat', d: 'Jika estimasi awal 3 pertemuan tetapi selesai pada pertemuan ke-2, centang <strong>Materi selesai hari ini</strong>. Sesi berikutnya langsung berpindah ke materi selanjutnya.' },
      { t: 'Butuh waktu lebih banyak', d: 'Ubah estimasi pertemuan dari Hari Ini atau <strong>Kendali</strong>, lalu naikkan jumlahnya. Riwayat yang sudah tersimpan tidak berubah.' },
      { t: 'Kemarin belum dicatat', d: 'Jika ada jadwal <strong>kemarin</strong> yang belum tercatat, gunakan panel <strong>Kemarin belum dicatat</strong>. Catat dengan tanggal asli, atau lewati jika kelas tidak berlangsung.' },
      { t: 'Perbaiki salah input', d: 'Buka <strong>Kendali → Riwayat</strong> untuk menelusuri dan memperbaiki catatan sesi.' },
    ], tip: 'Estimasi adalah rencana, bukan aturan wajib. Progres mengikuti materi yang benar-benar diajarkan di kelas.'
  },
  {
    id: 'g2', icon: '📈', title: 'Cara Membaca Kendali', steps: [
      { t: 'Pilih kelas', d: 'Pilih jenjang dan kelas untuk melihat kondisi pengajaran kelas tersebut.' },
      { t: 'Baca kondisi mapel', d: 'Mapel berstatus <strong>Aman</strong>, <strong>Mepet</strong>, atau <strong>Kurang sesi</strong> ditampilkan agar prioritas tindakan jelas.' },
      { t: 'Lihat posisi materi', d: 'Setiap kartu menampilkan bab saat ini, <strong>Pertemuan X dari Y</strong>, dan catatan untuk pertemuan berikutnya.' },
      { t: 'Buka detail bila perlu', d: 'Rencana bab, estimasi sesi, dan koreksi progres tetap tersedia melalui detail kartu.' },
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
      { t: 'Export JSON (backup utama)', d: 'Di Kelola → Backup & Data → <strong>💾 Backup Full</strong>. Lakukan secara berkala sesuai kebutuhan.' },
      { t: 'Export CSV', d: 'Untuk melihat riwayat sesi mengajar di spreadsheet. Bisa dibuka di Excel atau Google Sheets.' },
      { t: 'Restore / Import JSON', d: 'Pilih <strong>📂 Upload JSON</strong> dan pilih file backup Anda. Semua data akan dikembalikan seperti semula.' },
    ], tip: 'Data tersimpan di localStorage browser. Jika ganti browser atau hapus cache, data bisa hilang. Selalu backup JSON!'
  },
    {
      id: 'g5', icon: '✨', title: 'Fitur Unggulan EduTrack', steps: [
        { t: 'Materi Drag-and-Drop', d: 'Anda sekarang bisa menekan ✏️ untuk mengubah nama, atau menahan ≡ untuk mengurutkan daftar materi.' },
        { t: 'Sistem Multijenjang', d: 'Dapat membedakan materi dan tanggal ujian secara massal untuk berbagai tingkat (SD, MTs, MA).' },
        { t: 'Riwayat Sesi Bulanan', d: 'Buka <strong>Kendali → Riwayat</strong> untuk menelusuri kegiatan mengajar di waktu lampau.' },
        { t: 'Notifikasi Background (Web Push)', d: 'Aktifkan notifikasi, EduTrack akan mengingatkan Anda 5 menit sebelum sesi mengajar meskipun app ditutup.' },
      ], tip: 'PWA Shortcut HP juga tersedia! Tahan icon EduTrack di layar lalu tap "Jadwal Hari Ini".'
    },
  ];

export default function InfoView({ onBackToSetup }: { onBackToSetup: () => void }) {
  const [activeSubTab, setActiveSubTab] = useState<'guides' | 'updates'>('guides');
  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>({});

  const toggleGuide = (id: string) => {
    setOpenGuides(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const featureGroups: { title: string; icon: ElementType; items: { icon: ElementType; t: string; d: string }[] }[] = [
    {
      title: 'Fitur Utama', icon: Sparkles,
      items: [
        { icon: Lightbulb, t: 'Kendali Pengajaran', d: 'Pantau materi, pertemuan, catatan berikutnya, dan kondisi sesi setiap kelas.' },
        { icon: TrendingUp, t: 'Laporan Mingguan', d: 'Ringkasan aktivitas mengajar mingguan yang siap disalin untuk laporan.' },
        { icon: BookOpen, t: 'Riwayat Sesi', d: 'Telusuri jejak mengajar berdasarkan bulan, kelas, dan materi.' },
      ]
    },
    {
      title: 'Fitur yang tersedia', icon: Rocket,
      items: [
        { icon: Zap, t: 'Kondisi Sesi', d: 'Tampilkan kebutuhan dan ketersediaan sesi sebelum batas ujian.' },
        { icon: ShieldCheck, t: 'Riwayat yang Dapat Dikoreksi', d: 'Telusuri pencatatan sesi saat perlu memperbaiki progres.' },
        { icon: TrendingUp, t: 'Audit Kalender', d: 'Periksa status KBM per tanggal: selesai, sebagian, terlewat, atau libur.' },
      ]
    },
  ];
  const quickHelp = [
    { icon: BookOpen, t: 'Kelola Data', d: 'Atur kelas, mapel, materi, jadwal, dan semester.' },
    { icon: TrendingUp, t: 'Pantau Kendali', d: 'Cek status mapel yang aman, mepet, atau kurang sesi.' },
    { icon: DatabaseBackup, t: 'Backup Data', d: 'Export JSON berkala agar data lokal tetap aman.' },
  ];
  const guideIcons: Record<string, ElementType> = {
    g1: Zap,
    g2: TrendingUp,
    g3: BookOpen,
    g4: DatabaseBackup,
    g5: Sparkles,
    g6: BookOpen,
  };

  return (
    <div className="pt-2">
      <button onClick={onBackToSetup} className="mb-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-[12px] font-bold text-primary hover:bg-primary/15">
        <span className="text-lg leading-none">‹</span> Kembali ke Kelola
      </button>
      <div className="app-card p-5 mb-4 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary grid place-items-center flex-shrink-0">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-2xl font-black tracking-tight leading-none">Tentang EduTrack</div>
            <div className="text-[13px] text-text2 leading-relaxed mt-2">Bagian dari Kelola. Panduan operasional untuk mengatur data, memantau Kendali, dan menjaga backup tetap aman.</div>
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
              if (g.id === 'g3') proTitle = "Langkah Awal di Kelola";
              if (g.id === 'g4') proTitle = "Keamanan & Pencadangan Data";
              if (g.id === 'g5') proTitle = "Fitur yang Tersedia";
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
                    ].map((u, i) => {
                      const Icon = u.icon;
                      return (
                        <div key={i} className="flex items-start gap-3 p-3 bg-background/60 rounded-lg border border-border/30">
                          <div className="w-8 h-8 bg-primary-dim rounded-lg flex items-center justify-center text-primary flex-shrink-0"><Icon className="h-4 w-4" /></div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-foreground mb-0.5">{u.t}</div>
                            <div className="text-xs text-text2 leading-relaxed">{u.d}</div>
                          </div>
                        </div>
                      );
                    })}
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
                {group.items.map((u, i) => {
                  const Icon = u.icon;
                  return (
                    <div key={i} className="app-list-item flex items-start gap-3">
                      <div className="w-9 h-9 bg-primary-dim rounded-2xl flex items-center justify-center text-primary flex-shrink-0"><Icon className="h-4 w-4" /></div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-foreground mb-1">{u.t}</div>
                        <div className="text-xs text-text2 leading-relaxed">{u.d}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );})}

          {/* Capabilities Section */}
          <div className="px-1">
            <div className="text-xs font-bold tracking-wide uppercase text-text3 mb-3">Fitur yang tersedia</div>
            <div className="grid grid-cols-1 gap-3">
              {[
                { icon: BookOpen, t: 'Jadwal Otomatis', d: 'Input jadwal sekali, sistem mendeteksi sesi berjalan otomatis.' },
                { icon: Rocket, t: 'Input Massal', d: 'Copy-paste banyak bab materi sekaligus.' },
                { icon: DatabaseBackup, t: 'Backup & Restore', d: 'Export JSON dan import ulang kapan saja.' },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="app-list-item flex items-center gap-3">
                    <div className="flex-shrink-0 w-9 h-9 bg-surface2 rounded-2xl flex items-center justify-center text-text2"><Icon className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">{f.t}</div>
                      <div className="text-xs text-text2 leading-relaxed mt-0.5">{f.d}</div>
                    </div>
                  </div>
                );
              })}
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
