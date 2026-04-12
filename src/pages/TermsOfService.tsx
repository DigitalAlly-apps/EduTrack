import React from 'react';

export default function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-foreground">
      <h1 className="text-3xl font-black mb-8">Terms of Service</h1>
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">1. Perjanjian Langganan</h2>
          <p>Dengan berlangganan EduTrack Pro, Anda menyetujui biaya langganan bulanan yang berulang. Penagihan ditangani melalui prosesor pembayaran resmi kami (Midtrans).</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">2. Hak Penggunaan</h2>
          <p>EduTrack memberikan lisensi non-eksklusif untuk manajemen akademik dan kurikulum. Ekstraksi data tanpa izin atau rekayasa balik dilarang keras.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">3. Kebijakan Pengembalian Dana</h2>
          <p>Pengembalian dana diproses sesuai kebijakan penyedia pembayaran. Permintaan harus diajukan dalam 7 hari setelah transaksi awal untuk dievaluasi.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-foreground mb-2">4. Perubahan Layanan</h2>
          <p>DigitalAlly berhak untuk memodifikasi atau menghentikan fitur guna meningkatkan pengalaman analitik strategis. Pengguna akan diberitahu melalui email terdaftar.</p>
        </section>
      </div>
    </div>
  );
}
