# Gate 1 — Source Contract & Data Integrity Foundation

Tanggal: 20 Oktober 2026. Versi implementasi: `integrity-v1`.

Persetujuan pemilik pada sesi Gate 1: PDF lokal dinyatakan sudah diverifikasi aman untuk diperiksa; pendekatan konservatif disetujui, yaitu gross/net/fee/tax terpisah, nilai tidak diketahui tetap null/UNKNOWN, dan ambiguous cross-source matching ditahan untuk review. Persetujuan membaca bukan izin memasukkan PDF ke Git.

Dokumen ini menjelaskan kontrak yang diimplementasikan, bukan janji bahwa seluruh data historis sudah lengkap. Laporan Phase 0 tetap menjadi catatan kondisi sebelum perubahan. Instruksi terbaru pemilik tetap berlaku: semua operasi Git pengubah state hanya dilakukan pemilik.

## 1. Batas Gate 1

Fondasi ini mencakup source identity, structured import, provenance, exact identity normalization, edit revalidation, snapshot coverage, dan audit perubahan. Permintaan terbaru memasukkan subset fondasi persistence/dedup yang sebelumnya direncanakan pada Gate 2. Ini tidak mengaktifkan Final Reconciliation Engine, opening-position computation, monthly analytics, valuation, market data, Gmail, n8n, atau parser email.

## 2. Kontrak sumber

| Field | Arti dan otoritas |
|---|---|
| `schema_version` | `integrity-v1`; kontrak JSON, bukan parser version |
| `investment_account_id` | ID internal akun aplikasi yang dimiliki user; bukan nomor akun yang disalin dari PDF |
| `source.provider` | BIONS / STOCKBIT / PLUANG; wajib sesuai platform akun |
| `source.source_type` | PDF pada implementasi ini; EMAIL belum diterima |
| `source.document_type` | SOA / TC / CA sesuai source matrix; CA hanya BIONS, Pluang hanya SOA |
| `source.document_hash` | SHA-256 byte PDF di browser; bukan hash teks, identitas trade, atau ID publik dokumen |
| `source.parser_version` | Registry browser memakai `<provider>-<type>@integrity-1`; server mencatat asal versi, tidak mengklaim dapat membuktikan parser client dari hash |
| `source_document_id` | UUID publik yang diterbitkan server setelah import; source terlingkup account + document hash |
| `idempotency_key` | Key client untuk satu confirmed request; UUID lazim dipakai |
| `batch_id` | UUID publik import batch yang diterbitkan server; berbeda dari idempotency key |
| `confirmed` | Konfirmasi pengguna wajib sebelum structured data dikirim/disimpan sebagai import |
| `transactions[]` | Baris individual, bukan selisih snapshot atau agregat bulanan |
| `snapshot` | Observasi posisi opsional; hanya dari SOA |

Raw PDF, password, raw text/email body, nama file pribadi, dan metadata bebas tidak termasuk kontrak. Root/envelope dan source object memakai allowlist. Metadata legacy tidak dipersist oleh write API yang diperbarui. Tidak ada raw PDF upload endpoint baru.

Source matrix: BIONS PDF SOA/TC/CA cash dividend; Stockbit PDF SOA/TC, email dividend belum diimplementasikan; Pluang crypto PDF monthly statement, transaction email belum diimplementasikan. Tidak ada parser tambahan untuk dokumen yang tidak tersedia.

## 3. Tanggal, angka, dan canonical transaction

Field canonical: transaction_date, date_precision, type, symbol, unit, quantity, reference_quantity, price, currency, total_amount, amount_semantics, gross_amount, net_amount, fee_amount, tax_amount, settlement_amount, external_identifier.

- `transaction_date` adalah tanggal efektif peristiwa, bukan waktu import. Parser PDF menggunakan `DATE`: calendar date disimpan pada midnight tanpa pergeseran timezone. `TIMESTAMP` dinormalisasi UTC; timestamp tanpa offset diperlakukan dalam konfigurasi UTC aplikasi, bukan tebakan timezone broker.
- `imported_at` ditetapkan server. Legacy rows tidak di-backfill dengan created_at sebagai tanggal import yang seolah sudah diketahui.
- Numeric source import memakai string decimal plain. Grouping sumber yang ditangani saat ini: koma ribuan, titik desimal; format ambigu ditolak, bukan ditebak. Exact numeric strings dari source dipertahankan terpisah dari numeric preview lama.
- Scale existing dipertahankan: quantity/price/reference quantity 8 desimal, amount 4 desimal. Presisi lebih besar ditolak untuk review, tidak dibulatkan diam-diam. Pelebaran precision crypto menunggu keputusan berbasis sumber.
- Unit SHARE/LOT/COIN/UNKNOWN. Parser tetap menggunakan UNKNOWN sampai aturan unit per sumber disetujui secara eksplisit; tidak mengalikan semua quantity dengan 100.
- BUY/SELL wajib quantity positif, symbol, dan price. Cash dividend tidak mempunyai quantity delta atau harga buatan; holding balance sumber masuk reference_quantity. Event lain menggunakan typed contract tanpa mengubahnya menjadi trade fiktif.
- `validation_status=PASSED` berarti lolos validasi struktur/constraint/aritmetika yang dapat diperiksa server. Ini bukan bukti coverage lengkap atau original document authenticity. Legacy rows tetap LEGACY_UNVERIFIED.

## 4. Financial amount semantics

| Field | Definisi yang dipakai |
|---|---|
| Gross | Nominal sebelum biaya/pajak; jika tersedia pada BUY/SELL harus cocok dengan quantity × price |
| Fee | Biaya yang diidentifikasi sumber, dipisahkan dari pajak; unknown = null |
| Tax | Pajak yang diidentifikasi sumber; bukan otomatis bagian fee |
| Net | Nominal setelah biaya/pajak sesuai arah event; tidak otomatis disamakan dengan gross |
| Settlement amount | Nominal penyelesaian yang dinyatakan secara eksplisit; tidak disalin dari net tanpa bukti |
| Transaction total | Field kompatibilitas total_amount dengan amount_semantics UNKNOWN/GROSS/NET/SETTLEMENT |

Jika gross/net/fee/tax semuanya diketahui, BUY net harus sama dengan gross + fee + tax; SELL/dividend gross harus sama dengan net + fee + tax. Perhitungan dilakukan dengan decimal string, bukan float. Jika ada komponen unknown, server tidak membuat nilai sisanya. Tidak ada toleransi uang 10% untuk melewatkan hard arithmetic failure. Perbedaan rounding sumber yang belum dipahami ditolak untuk review; Gate 1 tidak menetapkan rounding rule baru.

Mapping yang diterapkan:

- BIONS TC: gross dari Amount, net dari Net Amount; fee dari commission + levy; pajak dari PPH/VAT/sell tax/VAT levy. Total legacy-compatible memakai net dengan basis NET. Reference TC dipertahankan. Settlement tetap null bila tidak dinyatakan pada field yang diparsing.
- Stockbit TC: nominal kolom BUY/SELL menjadi gross; total basis GROSS. Fee/tax/net/settlement per baris tetap null karena biaya dokumen belum dialokasikan ke tiap baris. Reference dipertahankan.
- BIONS CA cash dividend: gross/tax/net terpisah; reference balance bukan quantity event. Price dan fee unknown tetap null. Total basis NET.
- SOA: snapshot quantity/avg price/market price/value bukan transaksi individual. Tidak ada nominal BUY/SELL atau dividend yang dibuat dari perbedaan snapshot.

Legacy total dan fee yang sudah tersimpan tidak diinterpretasikan ulang atau diperbaiki massal. Basis default UNKNOWN, sehingga angka legacy tidak boleh langsung menjadi dasar analytics lintas provider. Kekurangan biaya tidak ditutup dengan weighted allocation buatan.

## 5. Empat identitas yang berbeda

1. Document hash: mendeteksi byte dokumen yang sama pada akun yang sama. Perubahan byte PDF dapat mengubah hash walaupun peristiwa finansial sama.
2. Source transaction identifier: reference yang dicetak sumber bila tersedia. Namespace/keunikannya lintas SOA/TC belum diasumsikan terverifikasi.
3. Canonical transaction identity: ID record canonical + SHA-256 versioned fingerprint dari account, effective date/precision, event, symbol/unit/currency, quantity/price, amount fields/basis, dan external reference.
4. Batch identity: server batch UUID + account-scoped idempotency key + canonical payload digest.

Decimal normalization menghilangkan leading/trailing zero yang tidak mengubah nilai. Timestamp, currency dan reference tidak dibuang. Fingerprint bukan bukti dua transaksi sah identik merupakan satu event.

## 6. Matching, duplicate handling, dan edit

- Same idempotency key + same canonical payload -> immutable receipt yang sama, replayed=true, tanpa write ulang. Key sama + payload berbeda -> 409.
- Source/row yang sama + payload sama -> reuse observation, bukan transaksi baru. Source/row berbeda isi -> SOURCE_CONFLICT tanpa overwrite.
- Candidate search terlingkup account, effective day, event, symbol, currency, unit yang comparable, quantity/price yang diketahui, dan reference bila tersedia. Gross/net/fee/tax yang berbeda tidak menjadi alasan menganggap trade pasti berbeda: kandidat tetap ditahan untuk review.
- Candidate tanpa bukti identitas bersama -> PENDING_REVIEW, tidak ada insert canonical kedua. Ini mendukung SOA + TC tanpa mengklaim automatic matching yang belum terbukti.
- Pengguna dapat mengonfirmasi `match_transaction_id` melalui API dengan key batch baru. Ownership dan known financial fields diperiksa ulang. Compatible explicit confirmation menautkan evidence; konflik finansial tidak dapat dipaksa merge. Pending observation dapat ditautkan tanpa dibuat ulang.
- Dua trade sah yang identik dan tanpa reference tidak otomatis digabung atau diterima keduanya. UI resolution untuk menyatakan “distinct trade” dan pelonggaran unique hash lama belum diimplementasikan; kasus ini tetap memerlukan review.
- Edit menghitung ulang hash dari merged current fields, memeriksa collision, meningkatkan revision, menyimpan before/after audit, dan menandai existing source links REQUIRED untuk review ulang.
- API delete lama dipertahankan untuk kompatibilitas, tetapi audit financial state dan observation evidence tetap ada; link menjadi TARGET_DELETED. Reimport tidak menghidupkan event yang dihapus. Sistem revision/void penuh dan invalidasi reconciliation ditunda karena engine belum tersedia.

Locks per account mengurutkan jalur import/CRUD pada engine yang mendukung row locking; uniqueness DB menjadi guard tambahan. SQLite test lulus tetapi bukan bukti MySQL concurrent-import correctness. Parallel production tests tetap pekerjaan gate berikutnya.

## 7. Provenance dan audit

Entitas baru: source_documents -> import_batches -> source_observations. Observation menghubungkan source dengan transaction atau snapshot; beberapa observation dapat mendukung satu transaksi. Data structured source tetap terpisah dari current transaction setelah edit.

Provenance mencatat provider/type, source/batch/row identity, parser version, server import time, financial effective date pada canonical payload, client confidence, authoritative validation status, review status, dan candidate IDs. Confidence yang disimpan adalah **client advisory**, bukan probabilitas kebenaran yang terkalibrasi. Server tetap memvalidasi semua financial fields yang diketahui.

integrity_audit_events mencatat actor/account/action, source/batch links, original transaction record ID, revision, serta safe before/after financial fields. Tidak ada raw text/password. Service tidak menyediakan update/delete audit events. Ini application audit foundation, bukan klaim tamper-proof terhadap administrator database. Retention/account deletion masih perlu keputusan; FK evidence membatasi destructive parent deletion.

## 8. Snapshot coverage

| Coverage | Makna |
|---|---|
| FULL | Pengguna menyatakan seluruh posisi pada scope dokumen sudah terwakili; butuh coverage_confirmed dan parsed_item_count sama dengan jumlah items |
| PARTIAL | Hanya sebagian posisi dipilih/diketahui |
| UNKNOWN | Belum ada bukti cakupan menyeluruh; default untuk legacy dan selecting-all parser rows |

FULL adalah attestation pengguna, bukan bukti backend dapat membaca PDF atau membuktikan tidak ada baris yang terlewat. FULL positions tidak berarti full monthly activity: activity_coverage tetap UNKNOWN pada Gate 1. Item currency wajib eksplisit pada source API baru; legacy snapshot API mempertahankan default IDR dengan coverage UNKNOWN. Missing quantity ditolak, missing optional money tetap null; tidak membuat holding 0 sebagai pengganti field hilang.

Monthly Statement bisa menjadi initial observation, monthly-only update, atau checkpoint untuk engine berikutnya. Belum ada perhitungan opening holdings atau pemilihan baseline otomatis. Source berbeda pada tanggal sama disimpan sebagai observation yang memerlukan review, tanpa overwrite snapshot lama atau menyatakan mana yang authoritative. Empty position snapshot dapat direpresentasikan API dengan FULL confirmation dan parsed_item_count=0; UI parser tetap tidak menyimpulkan empty/full hanya karena no rows matched.

## 9. API dan migration

- Baru: POST `/api/source-imports`, GET `/api/source-imports/{batch UUID}` dengan auth Sanctum/ownership. GET mengembalikan receipt historis dan status observation terkini tanpa raw source payload/hash.
- Lama: transaksi CRUD/bulk tetap ada; memakai shared validation/identity/writer dan audit. Snapshot bulk memakai typed coverage/provider validation. Metadata legacy tidak diteruskan ke penyimpanan baru, array/decimal dibatasi, dan error duplicate tidak memakai semua SQLite code 19 sebagai satu kategori.
- UI Privacy Mode memakai API baru setelah klik Import Selected, menahan pemilihan file/akun saat proses, memakai allowlist JSON, dan mempertahankan batch key untuk retry yang sama.
- Migration: `backend/database/migrations/2026_10_20_000001_add_source_integrity_foundation.php`. Menambah tabel/kolom/index tanpa menghapus/menulis ulang data lama. Users/platforms/email/accounts/transactions/snapshots/items tetap dipertahankan.
- `down()` sengaja menolak rollback otomatis agar evidence baru tidak terhapus. Untuk rollback operasional diperlukan rencana restore/forward fix yang direview pemilik; tidak ada destructive migration dijalankan.

Database aplikasi belum dimigrasikan. Sebelum menjalankan source API pada database nyata, pemilik perlu backup, meninjau migration, lalu mengizinkan penerapannya secara terpisah. Gate 1 tests hanya memakai database in-memory/disposable.
