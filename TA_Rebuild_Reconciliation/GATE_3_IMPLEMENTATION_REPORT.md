# Gate 3 — Portfolio Reconciliation Engine: Implementation Report

Tanggal: 26 Oktober 2026, Asia/Makassar. Implementasi quantity reconciliation selesai. Status: **READY FOR MANUAL COMMIT**; migration histori pada database utama tetap pending/manual.

## 1. Kondisi awal yang diverifikasi

Seluruh paket konteks arsitektur, Phase 0, Gate 1, Gate 2 dan UI Gate dalam `TA_Rebuild_Reconciliation/` diperiksa bersama kode/routes/models/migrations/tests aktual. Root context lama tidak dipakai. Gate numbering historis tidak mengatasi scope instruksi Gate 3 terbaru.

- Branch main, HEAD `206de2b`: Gate 1 committed, UI Gate dan Gate 2 masih lokal. Semua perubahan existing dipertahankan; tidak membuat checkout/branch baru.
- Baseline pengujian ulang: backend **79 tests/496 assertions**, frontend **58 tests** PASS.
- Koneksi `myportfolio` berhasil pada MariaDB 10.4.32; migration Gate 1 applied; tabel reconciliation_runs/items belum ada pada inspeksi awal. Pemeriksaan hanya metadata melalui SELECT dalam read-only transaction, tanpa dump/PII/financial row output.
- Source provenance, coverage snapshot, exact decimal arithmetic, owner-scoped snapshot confirmation dan HoldingsProjectionService tersedia. Gate 2 sengaja belum menyediakan period activity attestation dan persisted results.

Dua keputusan kritis dimintakan sebelum implementasi terkait: pemilik menyetujui activity-quantity coverage attestation yang terikat interval/input_version/source references, serta histori immutable melalui additive migration dengan penerapan database utama tetap manual. Aturan unit/timezone/precision/conflict Gate 2 tetap berlaku.

## 2. Implementasi yang berfungsi

- Opening dan closing snapshot dipilih eksplisit pada akun/provider yang sama; closing harus lebih baru. Self-comparison/reverse period ditolak.
- Projection quantity menggunakan HoldingsProjectionService Gate 2, bukan perhitungan ledger baru. No conversion LOT/SHARE/COIN; unknown critical data dan unsupported events tetap ditahan.
- Difference exact: reported minus calculated. Numerical EQUAL/DIFFERENT/NOT_COMPARABLE dipisah dari MATCHED/MISMATCH/INCOMPLETE/PENDING_REVIEW.
- Angka sama dengan coverage UNKNOWN menghasilkan INCOMPLETE + NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED. Angka berbeda tanpa evidence memadai tetap provisional, bukan klaim missing trade tertentu.
- MATCHED/MISMATCH memerlukan FULL confirmed opening/closing, sumber valid, unit comparable, tidak ada blocking reason, serta attestation pengguna untuk raw input version dan semua source references relevan.
- Evidence mencakup account/provider, snapshot IDs/dates/source, accepted BUY/SELL, calculated/reported/difference, effective window, transaction IDs/revisions, observation/batch/source references, reason codes dan input/rule version.
- Late import dan edit/delete/source changes menghasilkan versi input baru. Recalculation deterministik; stale attestation tidak diperbarui otomatis.
- Histori append-only, identical-save idempotent, old result tidak ditimpa. List/detail menghitung freshness CURRENT/STALE pada read. Stale saved MATCHED tetap hasil historis, bukan hasil terkini.
- Halaman Reconciliation memakai API nyata, snapshot pagination, optional timestamp boundaries, summary counts, quantity table/evidence, coverage confirmation, recalculate dan save/history states. Tidak ada financial dummy data pada route user.
- Monthly-only tetap dapat melihat reported positions dan observed position change tanpa membuat BUY/SELL dari selisih snapshot.

Tidak ada adjustment transaction, market price, valuation, P/L, OAuth, n8n, email parser atau export akhir yang ditambahkan.

## 3. Model status dan evidence

Definisi lengkap, DTO, algorithm dan daftar diagnostic tersedia pada [GATE_3_RECONCILIATION_SPEC.md](GATE_3_RECONCILIATION_SPEC.md).

Summary precedence: PENDING_REVIEW → INCOMPLETE → MISMATCH → MATCHED, dengan counts masing-masing tetap ditampilkan. NOT_RUN hanya state sebelum evaluasi pada scope halaman.

Coverage dimension adalah ASSET_QUANTITY_ACTIVITY. Konfirmasi period completeness merupakan attestation pengguna, bukan backend membaca/membuktikan keaslian PDF atau audit independen semua aktivitas. Label ini muncul pada API dan UI. Source missing/invalid, review, unit conflict dan duplicate ambiguity tetap menghalangi verified result walaupun pengguna mengonfirmasi coverage.

Position coverage FULL tidak menaikkan activity coverage secara otomatis. Missing symbol pada PARTIAL/UNKNOWN tetap null. Absence nol hanya diinferensi dari FULL position universe yang valid dan unit comparable. Unknown/different units tidak dikurangkan.

Observed change disajikan sebagai POSITION_CHANGE_NOT_TRADE_ACTIVITY. Possible causes selisih adalah import gap, mapping unit, transfer, corporate action, parser error atau coverage gap. Tidak mengarang jenis/tanggal/harga/jumlah transaksi hilang dari delta.

Evidence API tidak membawa raw PDF/password/extracted text/filename/document_hash/original structured_data. Historis menyimpan quantity strings dan referensi yang diperlukan untuk merekonstruksi hasil, bukan seluruh source payload atau financial amount yang tidak digunakan. Transaction reference metadata disimpan sekali per item dan direkonstruksi untuk detail header.

## 4. Database dan API changes

Migration baru: `backend/database/migrations/2026_10_26_000001_add_reconciliation_history.php`.

- Additive: hanya membuat reconciliation_runs dan reconciliation_items, index/unique/FK restrict; tidak mengubah baris/kolom ledger/snapshot lama.
- Quantity hasil disimpan sebagai decimal strings dalam JSON agar tidak melewati float saat persistence, termasuk SQLite tests.
- FK restrict menjaga history references. Down menolak destructive automatic rollback. Immutability berlaku pada application service/API, bukan terhadap administrator database.

**Migration baru tidak diterapkan pada database myportfolio utama oleh Agent.** Hanya diuji pada SQLite :memory: dan koneksi upgrade in-memory terpisah. Tidak ada DDL, backfill, seeder atau financial mutation pada database utama selama Gate 3.

Pemeriksaan metadata penutup kembali menunjukkan `new_migration_applied=false` dan nol history tables di myportfolio. Ini sesuai mode compatibility yang disetujui: comparison aktif, history saving menunggu migration manual.

API baru auth:sanctum:

- POST `/api/investment-accounts/{account}/reconciliation` — evaluasi tanpa menyimpan run; tetap bekerja sebelum migration histori.
- POST `/api/investment-accounts/{account}/reconciliation-runs` — recompute + expected_input_version, lalu simpan immutable result; replay identik tidak menggandakan row.
- GET `/api/investment-accounts/{account}/reconciliation-runs` — paginated summaries dengan freshness check.
- GET `/api/investment-accounts/{account}/reconciliation-runs/{run UUID}` — owner-scoped immutable detail dan freshness.

Wrong account/owner/nested snapshot/run → 404. Invalid selection/coverage/raw fields → 422. Save dari preview usang → 409. Histori schema pending → safe 503 pada save, available:false pada list; UI save disabled dan tidak menjalankan migration. Coherent comparison memakai account shared lock; history store memakai account write lock, selaras writer Gate 1/2.

## 5. Frontend changes

ReconciliationWorkspace adalah route user aktual. Presenter lama dipertahankan sebagai isolated development/test preview; tidak menjadi fallback fake hasil produksi.

Fitur UI: account/provider, opening/closing selectors, batas daftar snapshot/date interval, pagination yang mempertahankan pilihan, timestamp boundaries tanpa inheritance ke akun lain, summary/counts, table numeric, observed change, evidence/reasons, recalculate, coverage checkbox, history save/list/detail dan penggunaan parameter histori untuk hitung ulang.

Coverage checkbox melakukan evaluasi baru dengan versi yang ditinjau dan semua source IDs relevan. Input berubah membatalkan konfirmasi lama. Save 409 menyembunyikan live result yang usang dan menuntut recalculation. Stored STALE MATCHED mempunyai banner historical; tidak diperlakukan sebagai live evaluation. Loading/error/null/zero/pending schema ditampilkan terpisah.

Overview belum memuat run summary API. Widget diubah menjadi hasil belum dimuat, agar tidak menyatakan engine belum pernah dijalankan setelah fitur tersedia. Desain shell, auth, CRUD transaksi, PDF processing dan My Portfolio Gate 2 tetap dipertahankan.

## 6. Testing aktual

- **Backend: 108 tests, 887 assertions PASS**, termasuk 29 tests Gate 3 baru dan seluruh regresi Gate 1/2.
- **Frontend: 68 tests dalam 9 files PASS**, termasuk 10 tests interaksi Gate 3 baru.
- Laravel Pint pada file PHP yang disentuh: PASS.
- Frontend lint: exit 0, enam warning existing pada parser interface/AuthContext/effect Transactions, tanpa error atau warning baru pada modul rekonsiliasi.
- Production build: PASS. Main JS 864,90 kB (gzip 262,37 kB), CSS 36,57 kB, PDF worker 2.228,48 kB. Warning chunk >500 kB tetap ada; tidak disembunyikan lewat konfigurasi.
- `git diff --check`: PASS. Dependency manifests/lockfiles tidak berubah.
- Scan production JS tidak menemukan marker fixture finansial sintetis yang diperiksa; demo/tests tidak dipakai sebagai hasil user.

Backend dijalankan dengan guard cached app config, APP_ENV=testing, DB_CONNECTION=sqlite, DB_DATABASE=:memory:, DB_URL kosong, cache/session array; entry point `php vendor/bin/phpunit --do-not-cache-result`. Tidak memakai composer setup/migration pada database utama.

Frontend memakai `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. Tidak mengubah dependency manifests atau lockfiles. Formatting PHP dibatasi pada services/controller/migration/tests Gate 3 dan routes.

Coverage tests mencakup:

- Exact matched dengan source evidence/attestation; equal-but-unknown; verified dan provisional mismatch; candidate gap tanpa synthetic trade.
- Pending duplicate tidak dihitung/di-override; late effective transaction; stale proof dan optimistic save; deterministic recomputation dan idempotent identical-save.
- PARTIAL/UNKNOWN closing absence null; missing symbol FULL inferensi nol; unknown/LOT versus SHARE; same-date conflict; dividend neutrality; monthly-only observed change; empty FULL pair dengan attestation no-activity.
- Exact crypto decimal difference; null versus zero; rejected/ambiguous timestamp; incomplete source evidence yang tidak dapat di-override.
- Owner/account/provider/nested source/run isolation; self-match/reverse period/invalid timezone/raw payload; authenticated access.
- History immutable setelah input berubah, stale list/detail, serta comparison tetap bekerja saat availability schema pending (guard branch disimulasikan, tanpa menjatuhkan tabel aplikasi).
- Additive upgrade test pada koneksi SQLite in-memory terpisah dengan Gate 2 financial rows; existing rows/IDs/quantities tidak berubah setelah dua tabel baru dibuat.
- UI explicit request, coverage versi/sumber, stale-checkbox reset, pending schema disabled save, safe errors, null formatting, conflict save, stale historical labeling, serta tidak mewariskan cutoff antar-akun.

Satu validator awal memakai accepted pada nested optional field sehingga request tanpa coverage tertolak. Rule dibuat conditional terhadap keberadaan coverage; empty/false/partial attestation tetap ditolak dan diuji. Uji frontend baru juga diperbaiki scope selector-nya untuk dua label penjelasan attestation. Existing assertions tidak dihapus/dilemahkan; satu assertion Overview diperbarui agar memeriksa hasil belum dimuat sesuai perilaku Gate 3.

## 7. Known limitations dan recommended next gate

- Keaslian/kelengkapan seluruh PDF tidak dibuktikan backend. USER_ATTESTED_PERIOD adalah persetujuan manusia yang dapat salah, dengan input version dan bukti yang dapat ditinjau; bukan sertifikasi independen.
- Activity quantity coverage tidak boleh dipakai otomatis sebagai full income/fees/cost-basis coverage untuk analytics/P&L.
- Same-date snapshot supersession dan duplicate/distinct-event resolution belum ditambahkan; ambiguity tetap review. Historical unit/provenance repair dan legacy transaction review tidak di-backfill.
- Gate 1 timestamp tanpa offset pernah diperlakukan UTC. Gate 3 tidak memulihkan timezone asli yang hilang atau melakukan konversi unit diam-diam.
- Input fingerprint account-wide bersifat konservatif, sehingga perubahan di luar interval dapat menandai history stale. Freshness dicek ketika read/recalculate, bukan push/background update.
- History bukan ledger ingestion-time reconstruction; run lama menyimpan hasil/evidence saat dihitung. Menghapus konfirmasi pada evaluasi live baru tidak mengubah atau menghapus attestation historis yang pernah disimpan.
- Main DB history belum aktif sebelum migration manual. Comparison tetap dapat digunakan. Tidak ada migrasi otomatis dari UI/API/readiness tool.
- SQLite tests dan metadata MariaDB bukan pengujian fresh-upgrade/lock race pada MariaDB/MySQL. Production-sized performance, recovery dan concurrency tetap perlu uji salinan disposable sebelum release.
- Browser visual/E2E, screen reader, packet capture dan generalisasi parser seluruh layout tidak diuji dalam gate ini. Tidak ada screenshot hasil baru yang diklaim.
- Tampilan Overview tidak memuat summary hasil tersimpan; hasil aktual ada pada halaman Reconciliation. Tidak ada market data, valuation, P/L atau final export.

Rekomendasi urutan berikutnya: review pemilik/pembimbing atas coverage/evidence → validasi migration pada salinan MariaDB dan review UI/runtime → penerapan migration manual jika disetujui → dataset evaluasi penelitian serta review resolution. Gate 4 analytics baru dimulai setelah metrik dan metode cost basis disahkan; quantity reconciliation tidak membenarkan P/L yang belum didukung data.

## 8. File Gate 3

Backend baru:

- `backend/app/Http/Controllers/ReconciliationController.php`
- `backend/app/Services/Reconciliation/QuantityComparison.php`
- `backend/app/Services/Reconciliation/ReconciliationCoverage.php`
- `backend/app/Services/Reconciliation/ReconciliationEvidence.php`
- `backend/app/Services/Reconciliation/ReconciliationHistory.php`
- `backend/app/Services/Reconciliation/ReconciliationService.php`
- `backend/database/migrations/2026_10_26_000001_add_reconciliation_history.php`
- `backend/tests/Feature/ReconciliationTest.php`
- `backend/tests/Feature/ReconciliationMigrationTest.php`
- `backend/tests/Unit/QuantityComparisonTest.php`

Frontend baru:

- `frontend/src/pages/ReconciliationWorkspace.jsx`
- `frontend/src/ui/ReconciliationResult.jsx`
- `frontend/src/ui/reconciliationReasons.js`
- `frontend/src/ui/__tests__/Reconciliation.test.jsx`

File existing/UI Gate lokal yang diperbarui: `backend/routes/api.php`, `frontend/src/pages/Reconciliation.jsx`, `frontend/src/ui/FinancialViews.jsx`, `frontend/src/ui/__tests__/Workspace.test.jsx`, `frontend/src/ui/workspace.css`.

Dokumen baru: spesifikasi Gate 3 dan laporan ini. Tidak ada file dihapus. Perubahan UI Gate/Gate 2 yang belum committed tetap ikut dalam workspace; manual `git add .` akan mencakup ketiganya. Daftar historis masing-masing scope tetap tersedia pada laporan gate terkait.

## 9. Readiness dan handoff Git

Pemeriksaan penutup: `node tools/check-commit-readiness.mjs`, read-only. Percobaan sandbox terhalang verifikasi jaringan remote; setelah akses read-only diizinkan, hasil **READY FOR MANUAL COMMIT**, exit 0, problems kosong.

Hasil: branch main/origin sesuai repository pemilik, 216 kandidat (165 tracked + 51 untracked), 213 file teks diperiksa, enam PDF ignored, nol penghapusan dan nol unpushed commits. Remote main `206de2be0c4d8b8a7b21c781cf34ba98d9aa5c87`. Readiness bukan izin migration/deployment atau klaim browser/concurrency tests selesai. Pattern scan bukan jaminan absolut bebas seluruh secret/PII.

Tidak ada git add/commit/push/fetch/merge/reset/rebase/switch/checkout/clean/stash/tag, perubahan identity/remote/history atau AI co-author oleh Agent. PDF lokal tidak dibaca/disalin pada Gate 3, tetap ignored; tidak membuat dump database tracked.

Rekomendasi commit message untuk workspace gabungan UI Gate + Gate 2 + Gate 3: `feat: add portfolio workspace and reconciliation engine with immutable history`.
