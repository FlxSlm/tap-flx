# Project Context — Controlled Rebuild

## Latar belakang
Portofolio saham dan crypto pengguna tersebar di Stockbit, BIONS, dan Pluang. Format data berbeda (PDF laporan, trade confirmation, email). Sistem prototipe bertujuan mengintegrasikan transaksi, posisi, dan aktivitas investasi tanpa menggandakan data.

## Fokus kontribusi
**Portfolio Reconciliation Engine:** menghitung posisi berdasarkan opening snapshot + ledger transaksi yang memiliki tanggal efektif, membandingkannya dengan snapshot periode, mendeteksi mismatch, dan memberikan jejak audit serta rekomendasi pemeriksaan. Tidak membuat transaksi penyesuaian fiktif.

## Studi kasus
- Stockbit: saham; SOA PDF, TC PDF, informasi dividen melalui email/inbox (sesuai penjelasan pengguna).
- BIONS: saham; SOA PDF, TC PDF, CA cash dividend PDF.
- Pluang: crypto saja; monthly statement PDF, rincian BUY/SELL melalui email/inbox.
- Ada enam PDF sampel dalam repository lokal `docs/aset_parser/` menurut pengguna; **belum diverifikasi oleh paket ini**.

## Dua jalur akuisisi
- Privacy Mode: ekstraksi PDF lokal via PDF.js; tidak mengirim PDF/password asli; mengirim JSON terstruktur setelah review.
- Automatic Mode: Gmail OAuth 2.0 multi-akun + n8n; mengambil email/attachment sesuai izin, server-side processing; harus menjaga minimisasi data.

## Dua pola pembaruan Privacy Mode
- Transaction-based: snapshot awal lalu TC/CA/transaksi.
- Monthly-only: unggah SOA setiap bulan; posisi dapat diperbarui dari snapshot. Aktivitas individual hanya diimpor jika rincian benar-benar tersedia; agregat disimpan sebagai summary, bukan transaksi rekaan.

## Teknologi dasar
Laravel 12, React/Vite, MySQL/MariaDB, Sanctum; PDF.js (client); Python PDF processing dapat digunakan pada jalur server; Regex/rules inti parser; n8n pada Automatic Mode; Yahoo Finance dengan fallback GOAPI untuk saham, Indodax untuk crypto. Provider market data harus diverifikasi akses dan ketentuan penggunaan sebelum implementasi.

## Batasan
- Satu peran pengguna investor.
- Tidak melakukan perdagangan/broker order.
- Tidak mengklaim AI Agent atau OCR sebagai metode inti.
- Tidak mengklaim real-time untuk provider yang hanya menyediakan delayed/latest prices.
- Dashboard bukan bukti novelty; kontribusi utama harus diuji pada konsistensi, late import, dedup, dan rekonsiliasi.
