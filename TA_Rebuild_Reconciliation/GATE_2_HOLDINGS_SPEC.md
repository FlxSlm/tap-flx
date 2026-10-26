# Gate 2 — Holdings Projection & Snapshot Baseline

Tanggal: 26 Oktober 2026, Asia/Makassar. Implementasi: `holdings-v1`.

## 1. Tujuan, batas, dan keputusan pemilik

Gate ini menghitung ledger-derived quantity dari opening snapshot dan canonical ledger, serta menyediakan reported holdings untuk pengguna monthly-only. Reported dan calculated adalah dua basis berbeda. Tidak ada pembandingan delta terhadap closing statement, MATCHED/MISMATCH, harga pasar, cost basis, P/L, OAuth, n8n, parser email, atau laporan akhir.

Keputusan pemilik pada sesi Gate 2:

1. SHARE, LOT, COIN dihitung terpisah tanpa konversi. UNKNOWN tidak dihitung. Quantity tetap maksimal delapan desimal sesuai schema; presisi lebih tinggi ditolak tanpa pembulatan.
2. Workflow konfirmasi snapshot dengan pemeriksaan unit/coverage serta audit trail disetujui. Quantity sumber tidak diubah. Baseline dipilih secara eksplisit per permintaan.
3. DATE menggunakan interval `(tanggal baseline, tanggal tujuan]`. TIMESTAMP memerlukan timezone/cutoff eksplisit. Ambiguitas ditahan sebagai INCOMPLETE; timezone sumber tidak ditebak.

Aturan Git pemilik mengatasi instruksi commit lama dalam paket. Tidak ada mutasi Git oleh Agent.

## 2. Prasyarat yang diverifikasi

- Branch `main`, HEAD `206de2b` — Gate 1 tercatat dalam Git. UI Gate masih merupakan perubahan lokal sejak awal sesi; tidak dihapus atau dianggap sudah committed.
- Database yang dikonfigurasi cocok dengan `myportfolio`; koneksi berhasil. Server aktual MariaDB `10.4.32`, melalui driver Laravel `mysql`.
- Migration `2026_10_20_000001_add_source_integrity_foundation` sudah tercatat pada tabel migrations sebelum implementasi Gate 2. Empat tabel integrity tersedia.
- Metadata aktual memuat quantity `decimal(24,8)`, unit, review/validation/date precision/import/revision, serta coverage/source fields snapshot. Empat tabel integrity memiliki empat primary key, lima unique constraint, sebelas FK, dan lima CHECK pada server yang diperiksa.
- Pemeriksaan database aplikasi hanya melalui SELECT metadata dalam `START TRANSACTION READ ONLY`, lalu rollback. Tidak membaca/mencetak baris finansial dan tidak menjalankan migration.

Ini memperbarui fakta runtime yang berbeda dari laporan 20 Oktober. Laporan historis tidak diubah. Bukti ini menunjukkan migration terpasang pada MariaDB saat ini; bukan klaim bahwa fresh-upgrade, concurrency, atau semua versi MySQL telah diuji ulang.

Gate 2 tidak memerlukan migration baru. Cast `parsed_item_count` menjadi integer ditambahkan pada model supaya perbandingan count konsisten.

## 3. Service layer

Lokasi: `backend/app/Services/Holdings/`.

- `QuantityDecimal`: validasi decimal string nonnegatif maksimal 16 integer digit + 8 fractional digit, subtraction presisi dengan digit integer. Addition memakai `Integrity/Decimal`. Tidak memakai binary floating point untuk quantity arithmetic; intermediate sum tidak dibatasi lebar kolom karena tidak dipersist.
- `EffectiveDateWindow`: membership tanggal efektif, dengan batas DATE dan UTC timestamp yang eksplisit.
- `SnapshotBaselineSelector`: metadata/evidence aman, reported snapshot terbaru pada/sebelum target, pemilihan baseline eksplisit, dan alasan tidak eligible.
- `HoldingsCoverageEvaluator`: membedakan coverage posisi dengan aktivitas. Tidak menaikkan UNKNOWN activity menjadi FULL.
- `HoldingsProjectionService`: input account-scoped, seleksi event diterima, pemeriksaan kandidat duplikat, penjumlahan quantity, reason codes, dan versi input.
- `HoldingsCalculationResult`: DTO status, items, baseline, interval, input version, excluded events, dan `reconciliation_status=NOT_RUN`.
- `SnapshotConfirmationService`: transaksi atomik untuk attestation metadata snapshot dan append audit event.

Controller baru `HoldingsController` hanya melakukan ownership, request validation, read transaction/response, dan delegasi ke services. API read tidak menulis hasil holdings sebagai source of truth baru.

## 4. Baseline dan reported holdings

Reported holdings:

- Memakai tanggal snapshot terbaru yang tidak melewati `as_of`.
- Seluruh snapshot pada tanggal yang sama ditampilkan sebagai versi terpisah. Tidak digabung, dijumlahkan, atau dipilih berdasarkan ID terbesar.
- Snapshot belum dikonfirmasi tetap dapat dibaca sebagai observasi, dengan label review. Ini memungkinkan monthly-only users melihat posisi tanpa TC.
- `authoritative_reported=true` hanya setelah pemeriksaan snapshot terpenuhi; konfirmasi adalah attestation pengguna, bukan bukti backend membaca PDF atau membuktikan source authenticity.
- Source info hanya diserialisasi jika account/provider/document type sesuai. Invalid cross-account source link tidak membocorkan UUID/parser metadata pengguna lain.

Baseline:

- `baseline_snapshot_id` wajib dipilih jika ingin proyeksi. Tidak ada fallback otomatis ke snapshot paling baru.
- Snapshot harus berada pada akun yang sama, provider sesuai platform, dokumen SOA, dan tanggal tidak melewati target.
- Snapshot dan linked source observations harus confirmed; source validation PASSED dan status observation accepted. Legacy/manual snapshot tanpa source document boleh dikonfirmasi oleh pengguna, tetapi provenance tetap dilabeli LEGACY_OR_MANUAL.
- Simbol valid/tidak berulang; semua quantity/unit baseline harus dapat dipakai. Unit tidak diketahui atau satu item baseline invalid menahan keseluruhan proyeksi baseline tersebut secara konservatif.
- Same-date snapshot conflict menahan baseline dan konfirmasi; resolusi/supersession belum dibuat.
- FULL memerlukan `coverage_confirmed=true` dan `parsed_item_count` sama dengan jumlah items. Empty FULL memerlukan count nol yang diketahui serta konfirmasi eksplisit.
- PARTIAL/UNKNOWN yang confirmed dapat menjadi dasar quantity untuk aset yang memang tercantum, tetapi hasil tetap INCOMPLETE. Aset yang tidak tercantum tidak diasumsikan memiliki opening nol.
- Opening nol untuk aset baru hanya dapat diinferensi dari baseline FULL terkonfirmasi, dengan unit yang comparable. Jika simbol yang sama memiliki unit berbeda, seluruh kelompok simbol ditahan tanpa konversi.
- Baseline dan target pada hari sama menghasilkan interval kosong; ini adalah pembacaan posisi awal, bukan rekonsiliasi terhadap snapshot itu sendiri.

## 5. Konfirmasi snapshot

Konfirmasi menerima `confirmed`, `expected_fingerprint`, coverage FULL/PARTIAL/UNKNOWN, dan daftar tepat seluruh item IDs beserta unit. Tidak menerima quantity, harga, nilai, arbitrary metadata, raw PDF, password, atau extracted text.

- Unit UNKNOWN hanya dapat diisi dengan unit yang diverifikasi pengguna. Stockbit/BIONS: SHARE atau LOT; Pluang: COIN.
- Unit yang sudah diketahui tidak dapat diganti untuk melakukan konversi melalui endpoint ini.
- Semua item harus milik snapshot; item hilang/tambahan/berulang ditolak.
- Same-date/source conflict, source validation invalid, simbol/quantity invalid, dan precondition fingerprint usang ditolak.
- Account row dikunci sebelum snapshot agar serialized dengan jalur import/write existing.
- Yang berubah hanya unit metadata, review status, dan position coverage; activity_coverage tidak dinaikkan.
- Original `source_observations.structured_data`, payload hash, quantity dan canonical ledger tidak diubah.
- `integrity_audit_events` menerima `SNAPSHOT_CONFIRMED`, actor/account/source/batch, serta safe before/after snapshot state. Alasan tetap `USER_VERIFIED_SOURCE`; tidak ada free-text PII.

UI menuntut pemeriksaan sumber dan checkbox attestation sebelum POST. FULL tetap pernyataan pengguna tentang seluruh posisi dalam dokumen, bukan jaminan recall parser. Konfirmasi ini bukan persetujuan menjalankan operasi pada database aplikasi oleh Agent; Agent hanya menjalankan alur tulis dalam tests sintetis in-memory.

## 6. Quantity projection

Untuk setiap account + symbol + unit:

`calculated quantity = opening quantity + accepted BUY quantity - accepted SELL quantity`

Eligible BUY/SELL memerlukan validation PASSED, review CONFIRMED, quantity positif valid, unit sesuai provider, tanggal efektif yang dapat ditempatkan dalam interval, dan tidak terlibat ambiguity duplicate/source yang belum selesai.

- DATE menggunakan calendar date tanpa pergeseran timezone.
- TIMESTAMP pada ledger sudah dinormalisasi UTC oleh kontrak Gate 1. Parameter timezone/cutoff menentukan batas periode lokal, bukan reinterpretasi waktu event. Tanpa pasangan parameter eksplisit, timestamp yang mungkin berada pada interval/batas ditahan sebagai ambiguous.
- Timestamp yang tidak mempunyai offset saat masuk kontrak lama diperlakukan UTC oleh Gate 1. Gate 2 tidak dapat memulihkan timezone asli yang sudah hilang. Pengguna harus meninjau data yang semantiknya belum pasti; jangan memakai timezone parameter untuk mengoreksi event secara diam-diam.
- Stable ordering: tanggal efektif, lalu ID. `imported_at` bukan tanggal membership.
- Cash DIVIDEND dan reference_quantity tidak mengubah saham/coin.
- FEE/DEPOSIT/WITHDRAWAL yang benar-benar cash-only tanpa simbol/quantity bersifat netral. Jika terkait simbol atau quantity aset, ditahan sebagai unsupported quantity event, termasuk ketika quantity hilang. Corporate action/transfer tidak diubah menjadi trade.
- Rejected/legacy-unverified/review-required/invalid quantity/unknown unit tidak ditambahkan.
- Identitas canonical identik yang masih muncul pada beberapa legacy rows ditahan sebagai duplicate candidate; reference berbeda tidak dianggap duplikat otomatis.
- Unlinked source observation pending turut diperiksa berdasarkan tanggal efektif payload. Candidate transaction IDs dan aset terkait ditahan; tidak menghitung kandidat accepted seolah ambiguity sudah selesai.
- Unknown critical event pada satu simbol menahan quantity simbol tersebut. Unknown asset yang berpotensi memengaruhi quantity menahan seluruh proyeksi yang terdampak secara konservatif.
- Hasil akhir negatif ditahan sebagai review, bukan diasumsikan posisi short yang didukung.

`buy_quantity` dan `sell_quantity` pada DTO adalah jumlah input diterima saja, bukan seluruh aktivitas aktual. UI menuliskannya sebagai BUY diterima / SELL diterima. Nol pada kolom ini berarti tidak ada quantity input yang diterima untuk kelompok tersebut; actual closing quantity tetap null jika input kritis tidak memadai. `quantity_basis=ACCEPTED_INPUTS_ONLY` memperjelas basis.

## 7. Completeness dan invalidation

Status calculation COMPLETE atau INCOMPLETE, terpisah dari status rekonsiliasi. Null tidak menjadi nol.

- Quantity dapat tersedia secara aritmetis walaupun status INCOMPLETE karena activity coverage belum terbukti. UI memberi penjelasan bahwa angka tersebut proyeksi dari input diterima, bukan jaminan posisi aktual lengkap.
- Tidak ada authoritative activity-coverage interval pada Gate 1. Karena itu setiap interval setelah baseline membawa `ACTIVITY_COVERAGE_UNKNOWN`. Snapshot FULL tidak menghilangkan alasan ini.
- Aset dengan unknown critical input/unit conflict memiliki quantity null, beserta reason, bukan partial sum yang tampak final.
- Missing baseline atau invalid baseline menghasilkan items kosong dan alasan yang eksplisit; bukan portofolio nol.

Perhitungan selalu on demand tanpa persisted projection/cache. Setiap GET membaca state terkini; main holdings read berada dalam transaksi dengan shared account lock yang konsisten dengan writer account lock existing. Import terlambat, edit/revision, delete, source review/link, dan konflik baseline memicu perhitungan baru pada request berikutnya.

`input_version` adalah SHA-256 deterministic dari rule/account, baseline descriptor, interval settings, canonical transaction state dan source observation state akun. Account-wide fingerprint ini sengaja konservatif: perubahan di luar periode dapat turut mengubah versi. Ini state fingerprint, bukan revision counter, import date, atau historical run ID.

Tidak ada rekonsiliasi tersimpan yang perlu diinvalidasi pada gate ini. Run history, persisted cache invalidation, event-driven refresh, historical point-in-time ledger revision dan replay worker tetap gate berikutnya. Frontend mengabaikan respons scope lama; pengguna dapat memakai Muat ulang posisi setelah impor dari tab lain.

## 8. API

Semua route auth:sanctum, numeric account/snapshot IDs, owner-scoped; respons memakai `Cache-Control: private, no-store`.

### GET /api/investment-accounts/{account}/portfolio-snapshots

Query: `as_of=YYYY-MM-DD`, `page` opsional. Pagination 20 snapshot per halaman, descending as-of lalu ID. Respons `{data: descriptors[], meta: {current_page,last_page}}`. Descriptor menyertakan items untuk review, safe source, position/activity coverage, review status, baseline issues, dan optimistic fingerprint. Read tidak melakukan konfirmasi.

### GET /api/investment-accounts/{account}/holdings

Query wajib `as_of`; opsional `baseline_snapshot_id`, `timezone`, `cutoff=HH:mm:ss`. Timezone dan cutoff harus diberikan berpasangan serta lolos validasi. Tidak ada default broker timezone.

Respons:

```text
account: {id, account_name, provider}
as_of: YYYY-MM-DD
reported: {status, as_of_date, snapshots[]}
calculated:
  status, reasons[], baseline, items[]
  input_version, rule_version, quantity_basis, window
  excluded_events[], recalculation
  reconciliation_status: NOT_RUN
```

Item calculated: symbol/unit, opening_quantity, buy_quantity, sell_quantity, quantity nullable, transaction_ids diterima, status/reasons. Tidak ada valuation, P/L, delta statement, raw source data atau document hash.

Snapshot akun lain menghasilkan 404; account pengguna lain juga 404. Query format invalid 422. Unknown/invalid baseline milik akun tetap dapat dijelaskan sebagai INCOMPLETE jika record ada, tanpa memilih alternatif secara diam-diam.

### POST /api/investment-accounts/{account}/portfolio-snapshots/{snapshot}/confirm

Body:

```json
{
  "confirmed": true,
  "expected_fingerprint": "<fingerprint descriptor terbaru>",
  "coverage": "PARTIAL",
  "items": [{"id": 1, "unit": "SHARE"}]
}
```

Respons `{data: updatedDescriptor}`. Conflict/precondition usang 409; field/coverage/unit invalid 422; ownership 404. Contoh ID adalah ilustrasi sintetis, bukan data akun. Retry dengan fingerprint lama dapat menghasilkan 409; muat ulang dahulu. Ini tidak menggantikan batch idempotency kontrak impor.

## 9. Frontend dan dua pola Privacy Mode

My Portfolio memakai design system UI Gate, pemilihan satu akun/provider, target date, daftar snapshot berhalaman, explicit baseline, form konfirmasi unit/coverage, reported table per snapshot, calculated table dan evidence/reasons. Unit/quantity/as-of/source selalu dibedakan. Timezone/cutoff hanya diterapkan setelah tombol eksplisit dan tidak diwariskan otomatis ke akun lain.

Document Center tetap PDF.js lokal, preview dan Import Selected. BUY/SELL preview kini memiliki pilihan unit default UNKNOWN; pengguna dapat menyatakan SHARE/LOT setelah memeriksa sumber sebelum confirmed import. Pemilihan unit tidak mengirim POST atau mengalikan quantity. Parser tidak diubah agar menebak unit. Cash dividend tetap neutral.

- Transaction-Based Update: impor dan konfirmasi opening snapshot; impor TC dengan unit terverifikasi; pilih opening dan target pada My Portfolio. Accepted trades diproyeksikan, dengan coverage warning yang sesuai.
- Monthly Statement-Based Update: impor statement bulanan, lihat reported snapshot, lalu konfirmasi metadata sumber jika layak. Tanpa TC tidak dibuat ledger event dari selisih snapshot; calculated coverage tetap incomplete untuk interval yang tidak terbukti lengkap.

Existing transactions yang sudah UNKNOWN tidak dipetakan otomatis. Manual transaction API existing tetap menghasilkan REQUIRED; workflow review/repair transaksi historis tidak ditambahkan. Perubahan metadata melalui replay source yang sudah tersimpan dapat menjadi SOURCE_CONFLICT dan tetap membutuhkan review terpisah.

Reconciliation UI tetap NOT_RUN. Overview belum dipasangi read adapter holdings Gate 2; halaman My Portfolio merupakan integrasi gate ini. Development-only DEMO preview tidak memanggil API holdings atau menyediakan write path.

## 10. Verifikasi, batas rilis, dan langkah berikutnya

Pengujian menggunakan data sintetis; seluruh baseline test lama dipertahankan. Hasil aktual, file changes, status database, dan readiness ada pada [GATE_2_IMPLEMENTATION_REPORT.md](GATE_2_IMPLEMENTATION_REPORT.md).

Belum diuji: fresh upgrade/race pada salinan MariaDB/MySQL, packet capture browser, browser visual/E2E, serta correctness semua layout PDF. Tidak ada klaim final reconciliation atau data activity lengkap.

Jika deployment target lain masih mempunyai migration pending, lakukan prosedur aman berikut sebelum approval terpisah:

1. Pemilik membuat backup di luar Git dan menyiapkan salinan database disposable dengan nama/credentials terpisah. Jangan mencetak/menyalin PII ke laporan atau fixture tracked.
2. Verifikasi identitas koneksi salinan, versi server, migration repository, counts dan schema awal secara privat. Abort jika koneksi menunjuk `myportfolio` utama.
3. Jalankan additive upgrade hanya pada salinan yang disetujui, lalu bandingkan row counts, IDs, quantity/amount legacy dan relasi; field ambigu harus UNKNOWN/LEGACY_UNVERIFIED, bukan di-backfill dengan tebakan.
4. Uji decimal roundtrip delapan digit, source import/replay, snapshot confirmation, concurrent account locks, FK/unique constraints dan read API dengan fixture sintetis.
5. Review hasil dan backup/recovery. Migration `down()` Gate 1 sengaja menolak rollback destructive; gunakan reviewed restore/forward fix, bukan reset/drop.
6. Penerapan pada database utama tetap memerlukan persetujuan pemilik. Tidak dilakukan otomatis oleh tests, readiness script, atau Gate 2 ini.

Langkah berikutnya: review manual UI/runtime → perbaikan review/source coverage yang masih terbuka → desain/approval reconciliation runs dan quantity comparison dengan evidence → valuation/analytics setelah metode disahkan.
