# Gate 1 — PDF Structure and Field Evidence

20 Oktober 2026. Pemilik menyatakan keenam PDF lokal sudah aman untuk diperiksa. Pemeriksaan dilakukan secara lokal melalui PDF.js; tidak menyimpan salinan, raw extracted text, password, nama file sensitif, atau nilai investasi ke laporan/test fixtures/Git.

Status ini memperbarui keterbatasan PDF pada laporan Phase 0 sebagai catatan baru, tanpa mengubah laporan historis. Hasil berikut terbatas pada enam sampel yang tersedia dan tidak membuktikan semua format provider atau semua section sudah didukung.

## 1. Metode dan batas evidence

- Pemeriksaan header memakai whitelist label field. Diagnostic keluaran dibatasi pada tipe dokumen, struktur kolom, boolean hasil validasi, dan keberhasilan parsing; isi identitas/angka sumber tidak dicetak.
- Ditemukan masalah urutan text objects PDF: source order tidak selalu sama dengan urutan baca tabel. Ekstraksi diperbaiki untuk mengelompokkan Y-coordinate dan mengurutkan X-coordinate.
- Setelah perbaikan, keenam dokumen menghasilkan normalized rows nonempty dan tanggal yang terbaca. Aritmetika gross quantity × price pada baris TC yang diparsing konsisten dalam pemeriksaan lokal.
- Keberhasilan parsing tidak membuktikan recall seluruh baris/posisi atau coverage seluruh periode. Source row reference juga belum dibuktikan unique lintas jenis dokumen.
- Automated regression fixtures adalah angka/identifier sintetis dalam source test; PDF byte sintetis dibentuk di memori. Tidak ada PDF pribadi yang ditambahkan sebagai fixture tracked.

## 2. Evidence per sumber

| Provider/type | Field/section yang terlihat | Implementasi dan batas |
|---|---|---|
| BIONS TC | Trade date, B/S, code, price, quantity, gross Amount, commission/levy, tax components, Net Amount | Normalize transaksi, preserve reference, gross/net/fee/tax terpisah; settlement_amount tidak ditebak |
| BIONS SOA | Posisi stock balance, average/market price, stock/market value; beginning balance dan bagian cash/transactions | Parse snapshot. Beginning cash balance tidak diasumsikan opening holdings per saham. Cash description tidak otomatis dianggap trade lengkap |
| BIONS CA cash dividend | Payment date, stock, reference balance, gross, tax, net | Dividend event; quantity/price event null, reference_quantity terpisah |
| Stockbit TC | Transaction date, settlement date, reference, lot/quantity, price, BUY/SELL; fees/taxes pada bagian total dokumen | Normalize row gross. Settlement date bukan settlement amount. Biaya dokumen belum dialokasikan ke tiap trade |
| Stockbit SOA | Posisi quantity, buying/close price, buying/market value; cash date/description/amount/ending balance, beginning balance | Parse snapshot. Cash ledger bukan otomatis canonical BUY/SELL; activity completeness belum diverifikasi |
| Pluang monthly | Code, quantity, average buy price, closing price, market value/unrealized; label transactions pada ringkasan | Parse snapshot crypto; label ringkasan bukan bukti transaksi individual lengkap |

## 3. SOA field availability dan pemisahan konteks

Keterangan: **Posisi** = field terlihat dalam tabel posisi; **Cash** = terlihat dalam konteks kas dan belum dipetakan sebagai individual asset trade; **Belum dibuktikan** = tidak ada mapping individual lengkap yang disahkan pada Gate 1, bukan klaim field pasti tidak pernah tersedia pada provider.

| Field yang dicari | BIONS SOA | Stockbit SOA | Pluang monthly |
|---|---|---|---|
| Transaction date individual aset | Belum dibuktikan | Cash date terlihat; trade mapping belum dibuktikan | Belum dibuktikan |
| Transaction type individual aset | Belum dibuktikan | Belum dibuktikan | Belum dibuktikan |
| Symbol | Posisi | Posisi | Posisi |
| Quantity | Posisi | Posisi | Posisi |
| Price transaksi individual | Belum dibuktikan; price posisi terpisah | Belum dibuktikan; price posisi terpisah | Belum dibuktikan; avg/closing bukan trade price |
| Gross trade individual | Belum dibuktikan | Cash amount bukan otomatis gross trade | Belum dibuktikan |
| Net trade individual | Belum dibuktikan | Belum dibuktikan | Belum dibuktikan |
| Fee per trade | Belum dibuktikan | Belum dibuktikan | Belum dibuktikan |
| Dividend individual | Belum dibuktikan | Belum dibuktikan | Belum dibuktikan |
| Opening holdings per aset | Belum dibuktikan; beginning cash berbeda | Belum dibuktikan; beginning cash berbeda | Belum dibuktikan |
| Holdings as-of/closing | Posisi | Posisi | Posisi |
| Average cost/price | Average price posisi; cost-basis method belum dipastikan | Buying price/value; histori cost belum dipastikan | Average buy price; biaya historis belum dipastikan |
| Cash balance | Cash section terlihat; belum dipersist parser | Ending/beginning cash context terlihat; belum dipersist parser | Belum dibuktikan |

Tidak ada transaksi individual/agregat bulanan baru yang dibuat dari section yang belum tervalidasi. Nilai unavailable tetap null/UNKNOWN. Average cost snapshot tidak dijadikan bukti realized P/L historis. Pembuktian full position universe, trade-date/settlement boundary, unit lot/share, dan field-level ground truth masih memerlukan review teknis berikutnya.

Stockbit dividend email dan Pluang transaction email tetap belum mempunyai fixture nyata yang diproses. Tidak ada parser email yang dibuat.
