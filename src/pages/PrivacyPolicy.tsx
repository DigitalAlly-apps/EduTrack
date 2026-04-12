import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-foreground">
      <h1 className="text-3xl font-black mb-8">Privacy Policy</h1>
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">1. Data yang Dikumpulkan</h2>
          <p>EduTrack Intelligence hanya mengumpulkan data minimal yang diperlukan untuk operasional layanan, termasuk alamat email melalui Google Auth untuk identitas akun, dan data kurikulum/jadwal mengajar yang Anda input secara mandiri.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">2. Keamanan Data</h2>
          <p>Data akademik Anda dienkripsi menggunakan protokol AES-256 dan disimpan di cloud instance yang aman. Kami tidak menjual atau memperdagangkan data Anda kepada pihak ketiga.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">3. Langganan Pro</h2>
          <p>Status keanggotaan dan data transaksi diproses melalui gateway pembayaran aman pihak ketiga (Midtrans). Tidak ada informasi kartu kredit yang disimpan di server kami.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">4. Kontak</h2>
          <p>Untuk pertanyaan terkait data, hubungi: <a href="mailto:support@digitalally.com" className="underline text-primary">support@digitalally.com</a></p>
        </section>
      </div>
    </div>
  );
}
