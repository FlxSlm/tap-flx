# Gate 3 — Portfolio Reconciliation Engine

Tanggal: 26 Oktober 2026, Asia/Makassar. Rule: `reconciliation-v1`. Quantity reconciliation saja.

## 1. Scope dan keputusan yang disetujui

Engine memakai HoldingsProjectionService Gate 2 untuk membandingkan ledger-derived closing quantity dengan reported Monthly Statement. Tidak membangun ulang ledger/parser/projection, tidak mengubah quantity sumber, dan tidak membuat adjustment BUY/SELL.

Pemilik menyetujui sebelum bagian terkait diimplementasikan:

1. Konfirmasi kelengkapan aktivitas oleh pengguna untuk interval, referensi bukti, dan input_version tertentu. Ini **attestation pengguna**, bukan verifikasi otomatis isi atau keaslian PDF. Validitas, unit, provenance, duplicate handling dan FULL positions tetap wajib.
2. Histori immutable melalui additive migration, sementara perbandingan on-demand tetap berfungsi tanpa migration baru. Penerapan migration pada `myportfolio` utama tetap dilakukan pemilik setelah review; Agent tidak menjalankannya.

Keputusan Gate 2 tetap berlaku: SHARE/LOT/COIN tidak dikonversi; quantity source maksimal delapan desimal; DATE calendar interval dan TIMESTAMP explicit timezone/cutoff; same-date conflicts ditahan, bukan dipilih diam-diam.

Di luar scope: Gmail OAuth, n8n, email parser, market API, valuation, P/L, export/reporting akhir, auto resolution trade/snapshot, dan backfill transaksi historis.

## 2. Audit prasyarat

Pada awal sesi branch `main`, HEAD `206de2b` masih commit Gate 1. UI Gate dan Gate 2 merupakan perubahan lokal; tidak dihapus/diganti branch. Regression baseline: backend 79 tests/496 assertions, frontend 58 tests, lulus.

Database `myportfolio` dapat dihubungi pada MariaDB 10.4.32 melalui mysql driver. Metadata read-only menunjukkan migration Gate 1 applied; reconciliation_runs/items belum ada. Tidak membaca/mencetak baris investasi atau credentials. Keadaan runtime diperiksa, bukan diasumsikan dari laporan lama.

Dokumen arsitektur, Phase 0, Gate 1, Gate 2 dan UI Gate tetap referensi/historis. Instruksi terbaru pemilik mengatasi arahan commit dan nama gate lama dalam paket.

## 3. Service boundaries

Lokasi `backend/app/Services/Reconciliation/`:

- `QuantityComparison`: union account-scoped symbol/unit; perbandingan numerik tanpa status finansial. Memakai QuantityDecimal Gate 2 untuk subtraction.
- `ReconciliationEvidence`: referensi snapshot, source UUID/parser, observation/batch, accepted transaction IDs/revisions/effective dates, dan evidence gaps. Tidak mengeluarkan original structured payload atau document hash.
- `ReconciliationCoverage`: validasi attestation untuk exact input version dan seluruh referensi sumber relevan.
- `ReconciliationService`: selection/chronology, delegasi projection Gate 2, numerical versus completeness classification, counts, diagnostics dan version.
- `ReconciliationHistory`: append-only result storage, idempotent identical-save, serta freshness calculation pada read.

`ReconciliationController` menangani auth/ownership, request allowlist, transaction locks dan respons. Tidak ada arithmetic authoritative di React.

## 4. Algoritma

1. Owner-scoped account, opening snapshot ID dan closing snapshot ID dipilih eksplisit. Closing harus bertanggal lebih baru; self-comparison dan reverse interval ditolak 422.
2. Describe snapshot dengan Gate 2 selector. Provider/document/account/source serta review/unit/coverage issues tetap dihormati.
3. Panggil HoldingsProjectionService dengan opening ID dan target tanggal closing. DATE memakai `(opening_date, closing_date]`; TIMESTAMP hanya memakai batas lokal yang eksplisit, pada UTC event yang disimpan Gate 1.
4. Collect accepted ledger evidence dan safe source references. Identitas akun/provider tetap terpisah.
5. Hitung input_version dari reconciliation rule, account, Gate 2 projection input version, closing fingerprint dan evidence. Waktu evaluasi/attestation tidak masuk raw input version.
6. Evaluasi coverage confirmation jika diberikan. Tidak menaikkan activity coverage hanya karena snapshot FULL.
7. Bandingkan union symbol/unit opening, calculated, closing secara deterministik.
8. `difference = reported_closing_quantity - calculated_closing_quantity`, memakai exact decimal digit arithmetic, toleransi nol. Tidak memakai binary float, rounding quantity, sign cash flow, atau nominal fee sebagai quantity.
9. Beri numerical comparison EQUAL/DIFFERENT/NOT_COMPARABLE terpisah dari reconciliation status.
10. Sertakan reason/diagnostic, evidence, input version, window, timestamp dan counts. POST evaluasi tidak menyimpan hasil secara otomatis.

Cash dividend/reference balance tetap netral. Unsupported quantity transfer/corporate action, rejected, legacy-unverified, review-required, unresolved duplicate/source, invalid quantity/unit dan tanggal ambigu tetap mengikuti exclusion Gate 2. Attestation tidak memperbaiki data tersebut.

## 5. Null, unit dan posisi yang tidak tercantum

- Null/UNKNOWN tidak menjadi nol.
- Absent symbol pada PARTIAL/UNKNOWN opening atau closing tidak membuktikan quantity nol.
- Absence boleh diinferensi nol hanya dari universe posisi FULL terkonfirmasi yang valid dan unit comparable. Flags `opening_absence_inferred_zero` / `closing_absence_inferred_zero` dicatat.
- Jika simbol muncul dalam unit berbeda di salah satu input, unit tidak dikonversi. Tidak menginferensi absence nol lintas unit yang konflik. Difference dan observed change ditahan.
- Closing-only asset dapat dibandingkan terhadap opening nol hanya jika baseline FULL valid dan projection tidak mempunyai critical gap yang menghalangi inferensi.
- Same-date snapshot conflict tidak di-auto-merge/supersede; perbandingan ditahan untuk review.
- Semua posisi kosong bukan otomatis MATCHED. Empty FULL pair memerlukan sumber valid dan explicit period attestation, termasuk bahwa memang tidak ada quantity activity.

`observed_position_change = closing_reported - opening_reported` disajikan bila kedua posisi comparable. Basis selalu `POSITION_CHANGE_NOT_TRADE_ACTIVITY`. Ini bukan jumlah BUY/SELL atau deteksi trade tertentu.

## 6. Status semantics

- **NOT_RUN**: belum ada evaluasi pada halaman/scope pilihan. Tidak sama dengan portofolio kosong atau nol.
- **PENDING_REVIEW**: konflik snapshot/source, transaksi review-required, duplicate ambiguity, negative position anomaly atau source link yang perlu pemeriksaan manusia.
- **INCOMPLETE**: cakupan, unit, quantity, evidence atau batas efektif belum cukup. Numerical difference yang sah tetap dapat ditampilkan sebagai diagnostik.
- **MATCHED**: difference tepat nol, input comparable/valid, opening dan closing FULL terkonfirmasi, provenance relevan tersedia/valid, tidak ada blocking reason, serta activity-quantity coverage dikonfirmasi pengguna untuk versi input ini.
- **MISMATCH**: prasyarat yang sama terpenuhi, tetapi difference bukan nol. Ini tidak membuktikan suatu trade tertentu hilang.

Summary precedence: PENDING_REVIEW, INCOMPLETE, MISMATCH, MATCHED. Counts per status tetap tersedia agar item lain tidak tersembunyi. Status coverage dan numerical comparison tetap terpisah.

Jika quantity sama tetapi kelengkapan belum memadai: INCOMPLETE dengan `NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED`. Jika angka berbeda dan evidence belum cukup: `PROVISIONAL_QUANTITY_DIFFERENCE` serta INCOMPLETE, atau PENDING_REVIEW jika ada konflik.

Diagnostics selisih: QUANTITY_DIFFERENCE_OBSERVED, POSSIBLE_MISSING_OR_UNSUPPORTED_ACTIVITY, dan QUANTITY_MISMATCH bila prasyarat terpenuhi. Possible causes mencakup IMPORT_GAP, UNIT_MAPPING, ASSET_TRANSFER, CORPORATE_ACTION, PARSER_ERROR, COVERAGE_GAP. Tidak ada tanggal/harga/jenis/jumlah missing trade yang dikarang dari delta.

## 7. Coverage attestation

Coverage dimension server adalah `ASSET_QUANTITY_ACTIVITY`, bukan kelengkapan cash/dividend/fees/cost basis untuk analytics.

Request opsional:

```json
{
  "coverage": {
    "confirmed": true,
    "input_version": "<versi dari evaluasi yang ditinjau>",
    "source_ids": ["<UUID sumber relevan milik akun>"]
  }
}
```

Seluruh sumber relevan pada response evidence harus tercakup. UUID dari akun lain atau sumber yang tidak terkait input saat ini ditolak. Tidak ada free-text, raw PDF atau bukti sintetis yang ditambahkan server.

Actor berasal dari auth, bukan body. Basis response `USER_ATTESTED_PERIOD`; validasi sistem hanya membuktikan struktur, consistency, ownership, referensi dan status yang diketahui. Sistem tidak dapat membuktikan semua isi PDF asli atau seluruh dunia transaksi sudah tercakup. UI menjelaskan batas ini.

Tanpa attestation: activity coverage UNKNOWN. Jika versi tidak cocok: coverage tidak diterapkan, reason COVERAGE_CONFIRMATION_STALE dan ACTIVITY_COVERAGE_UNKNOWN; pengguna harus meninjau input baru. Konfirmasi lama tidak diperbarui otomatis. UI checkbox memicu evaluasi baru, bukan mengubah canonical ledger atau menyimpan histori otomatis.

Gate 2 holdings status tidak diubah: layanan tersebut tetap menandai ACTIVITY_COVERAGE_UNKNOWN pada interval setelah baseline. Gate 3 hanya mengatasi reason tersebut pada penilaian reconciliation setelah attestation sah; tidak menghilangkan reason input lain.

Legacy/manual snapshot atau accepted canonical row tanpa source reference yang memadai tetap INCOMPLETE walaupun quantity sama dan pengguna mencentang coverage.

## 8. Evidence dan result contract

Setiap result menyertakan account/provider, parameters opening/closing IDs, interval/timezone/cutoff, status/counts/reasons, coverage dimension/basis/actor, input_version, projection_input_version, rule_version, calculated_at dan exact tolerance.

Per item: symbol/unit, opening_quantity, accepted BUY/SELL, calculated_quantity, reported_quantity, difference, numerical comparison, completeness/status, observed position change, transaction IDs dan revisions, source observation/batch references, reasons/diagnostics dan possible causes.

Header evidence menyertakan safe snapshot descriptor tanpa mengulang seluruh items, sumber UUID/provider/type/parser/import time dan excluded event IDs/reasons. Transaction effective DATE diekspor sebagai calendar date; TIMESTAMP sebagai UTC ISO. Server timestamp hasil/histori memakai UTC ISO.

Tidak ada original PDF/password/extracted text/source filename/document_hash/structured_data pada response atau history. Financial quantity strings yang diperlukan untuk merekonstruksi hasil lama disimpan; source payload penuh tidak disalin. Detail evidence hanya tersedia melalui owner-scoped API.

## 9. API

Semua dalam auth:sanctum, account ID numeric, run ID UUID, dan private/no-store read responses. Inputs tidak menerima quantity/difference/status hasil dari client.

### POST /api/investment-accounts/{account}/reconciliation

Read-only evaluation (meskipun metode POST untuk structured selection). Body wajib `opening_snapshot_id`, `closing_snapshot_id`; opsional timezone/cutoff berpasangan, coverage confirmation, previous_input_version. Respons `{data: result, history_available: boolean}`.

`previous_input_stale` memberi tahu bahwa preview sebelumnya memakai versi berbeda. Tidak ada automatic run save, migration atau financial write. Account shared lock memberi coherent read terhadap writer account lock Gate 1/2.

### POST /api/investment-accounts/{account}/reconciliation-runs

Body selection/coverage yang sama, ditambah wajib expected_input_version. Server mengunci account untuk write, menghitung ulang lalu memeriksa versi sebelum append history. Input berubah → 409; tidak menerbitkan hasil lama sebagai current. Identical result replay mengembalikan run UUID yang sama tanpa row ganda.

Jika schema histori belum tersedia → 503 dengan code HISTORY_SCHEMA_PENDING; evaluasi tetap tersedia. Client tidak mengeksekusi migration.

### GET /api/investment-accounts/{account}/reconciliation-runs

Pagination 10, saved result summaries, fresh/current input version check. Tanpa schema: `{available:false, code:HISTORY_SCHEMA_PENDING, data:[]}`. List kosong tidak dianggap belum ada perbandingan yang pernah dilakukan tanpa penyimpanan.

### GET /api/investment-accounts/{account}/reconciliation-runs/{run UUID}

Historical summary + items, saved_at, freshness CURRENT/STALE, is_current, current_input_version dan freshness_checked_at. Salah owner/account → 404. Status hasil historis tidak diubah saat stale; freshness field dan UI mencegah status lama diperlakukan sebagai hasil baru.

## 10. Persistence, idempotency dan late-arriving inputs

Additive migration: `2026_10_26_000001_add_reconciliation_history.php`.

- reconciliation_runs: public UUID, account/actor/opening/closing references, input/result fingerprints, rule/status, parameters, summary JSON, created_at.
- reconciliation_items: run reference, symbol/unit/status, minimal result JSON. Decimal tetap string di dalam JSON agar SQLite dan MariaDB tidak mengubah precision pada penyimpanan hasil.
- FK restrict melindungi evidence history; tidak ada cascade deletion dari service. `down()` menolak destructive rollback otomatis.
- Tidak ada perubahan schema/row ledger, source observations atau snapshot existing. Migration hanya membuat dua tabel/index baru.
- Summary tidak menggandakan transaction-link metadata yang sudah tersimpan per item. Detail read merekonstruksi daftar referensi header dari item evidence.
- Immutable di application boundary: tidak ada API update/delete run/item; bukan klaim tamper-proof terhadap administrator DB.

Run result_fingerprint berasal dari isi deterministic tanpa evaluated time atau transient previous_input_stale. Unique account + fingerprint mencegah duplicate identical-save. Coverage confirmed versus unconfirmed menghasilkan hasil berbeda walaupun raw input_version sama.

Late import/edit/delete/source review/snapshot change tercermin melalui Gate 2 projection version dan closing/evidence fingerprint. Membership memakai tanggal efektif, bukan imported_at. Tidak ada peristiwa digandakan atau dipindahkan ke bulan impor.

Histori dicek terhadap input terkini saat list/detail dibaca, tanpa menimpa hasil lama. Freshness berubah menjadi STALE jika versi berbeda atau input tidak tersedia. Recalculate menghasilkan evaluasi baru; coverage lama kedaluwarsa. Saved old run tetap dapat diaudit. Tidak ada background worker, push invalidation atau bitemporal reconstruction; pengguna refresh/hitung ulang setelah perubahan.

## 11. UI dan compatibility

Halaman Reconciliation menggunakan shell/design tokens existing, account/provider, paginated snapshot choices, explicit opening/closing, period label, optional timestamp boundaries, summary counts, asset table dengan horizontal overflow, evidence/reasons, coverage checkbox, recalculate dan history actions.

Snapshot choices yang dipilih dipertahankan saat pindah halaman daftar. Batas timestamp tidak diwariskan otomatis ke akun lain. Loading/error/retry, NOT_RUN, null versus zero, partial/unverified dan stale history dibedakan. Save 409 menyembunyikan hasil live yang usang dan meminta perhitungan ulang.

Hasil historis ditandai eksplisit sebagai historical; stale MATCHED tidak ditampilkan sebagai live evaluation. Memakai pilihan histori untuk menghitung ulang tidak membawa attestation lama. Tidak ada data demo sebagai hasil user; isolated development presentation/tests tetap terpisah.

Overview belum memuat run summary; widget sekarang menyatakan hasil belum dimuat, bukan mengklaim engine belum pernah dijalankan. Source of truth untuk hasil Gate 3 ada pada halaman Reconciliation/API.

Monthly-only user tetap melihat reported holdings di My Portfolio, serta observed change pada comparison. Tanpa bukti aktivitas dan konfirmasi yang memadai, tidak diberi verified MATCHED atau synthetic trades.

## 12. Validation dan langkah berikutnya

Pengujian sintetis mencakup exact match dengan bukti/attestation, unknown equal, verified/provisional mismatch, gap candidate, duplicate pending, late import/stale proof/history, partial/unknown closing, unit/conflicts, dividend neutrality, multi-owner/provider, monthly-only, deterministic replay, null/zero, exact decimals dan Gate 1/2 regression.

Tambahan upgrade test memakai koneksi SQLite :memory: terpisah dengan Gate 2 rows sebelum additive migration, lalu memastikan row lama tetap sama. Ini bukan fresh-upgrade/concurrency evidence MariaDB/MySQL. Tidak ada browser visual/E2E atau klaim generalisasi semua layout PDF.

Migration utama belum dijalankan Agent. Sebelum menerapkan: pemilik backup di luar Git, validasi salinan disposable dengan nama/koneksi berbeda, cek row/ID/value preservation, JSON/FK/unique constraints, locking dan replay, lalu review recovery. Jangan memakai migrate:fresh/reset pada myportfolio. Penerapan hanya sesudah persetujuan terpisah pemilik.

Prioritas berikutnya: validasi runtime/visual dan salinan MariaDB, review resolution/coverage evidence yang masih terbuka, dataset evaluasi penelitian berlabel; baru Gate 4 analytics dengan definisi cost basis/metric yang disetujui. Tidak membuka OAuth/market data/valuation secara otomatis.
