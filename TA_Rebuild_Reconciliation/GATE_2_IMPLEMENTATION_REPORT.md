# Gate 2 — Implementation Report

Tanggal: 26 Oktober 2026 (Asia/Makassar). Holdings projection & snapshot baseline telah diimplementasikan. Status akhir: **READY FOR MANUAL COMMIT**.

## 1. Audit awal dan keputusan

Konteks yang diperiksa: paket arsitektur di `TA_Rebuild_Reconciliation/docs/`, README/prompt paket, laporan Phase 0, empat laporan/kontrak Gate 1, UI specification/report, serta actual routes, models, migrations, integrity services, parser/import contract dan tests. Penomoran lama pada roadmap adalah rencana historis; scope Gate 2 mengikuti instruksi terbaru pemilik.

- Branch awal `main`, HEAD `206de2b` (`Dasar Fondasi Privacy Mode`). Gate 1 sudah committed; UI Gate masih memiliki tracked modifications dan file untracked. Perubahan UI existing dipertahankan dan menjadi bagian workspace akhir untuk manual staging pemilik.
- Database `myportfolio` dapat terhubung melalui mysql driver pada MariaDB 10.4.32. Migration Gate 1 sudah applied sebelum pengerjaan. Empat tabel integrity dan kolom/casts yang diperlukan ditemukan pada metadata server.
- Quantity aktual decimal(24,8). Hasil metadata empat tabel integrity: empat PK, lima unique constraint, sebelas FK, lima CHECK. Pemeriksaan main DB hanya SELECT metadata dalam read-only transaction; tidak membaca nilai investasi atau menampilkan credentials.
- Laporan terdahulu menyatakan database belum dimigrasikan pada 20 Oktober. Gate 2 memverifikasi kondisi terbaru dan tidak menganggap laporan historis sebagai state runtime.

Tiga keputusan kritis dimintakan dan dijawab pemilik sebelum implementasi yang bergantung padanya: tidak mengonversi SHARE/LOT/COIN dan mempertahankan delapan desimal; menambah konfirmasi snapshot teraudit; DATE memakai interval kalender dan TIMESTAMP memakai explicit timezone/cutoff. UNKNOWN/ambiguity tidak dipaksa menjadi hasil pasti. Tidak ada keputusan kritis yang ditebak.

## 2. Fitur yang berfungsi

- Reported holdings dari snapshot terbaru pada/sebelum target, terpisah dari calculated holdings. Monthly-only user tetap dapat melihat observasi posisi, source/date dan review/coverage tanpa TC.
- Paginated snapshot read API, dengan status/metadata/source aman dan fingerprint untuk optimistic confirmation.
- Konfirmasi snapshot milik pengguna: unit UNKNOWN dipetakan hanya melalui pemeriksaan eksplisit, coverage ditetapkan, before/after audit dicatat; quantity dan original observation payload tidak berubah.
- Explicit opening baseline yang owner/account/provider/date scoped. Latest snapshot tidak otomatis dijadikan baseline historis. Same-date conflict ditahan; seluruh versi reported ditampilkan.
- Quantity projection opening + accepted BUY - accepted SELL melalui exact decimal arithmetic. Unit tidak dikonversi; invalid/unknown/review/duplicate candidates dikeluarkan dan quantity terdampak ditahan jika tidak pasti.
- Cash dividend/reference balance netral terhadap quantity. Asset transfer/corporate action unsupported ditandai, bukan dibuat menjadi BUY/SELL.
- Late transaction memakai tanggal efektif. Perhitungan on demand memakai current state, deterministic input fingerprint, dan account shared read lock. Import/edit/delete/source change tercermin pada request berikutnya tanpa persisted cache stale.
- My Portfolio menampilkan reported quantity, calculated quantity/input basis, unit, account/provider, tanggal, completeness, source dan alasan exclusion. Empty, loading, error/retry dan unavailable dibedakan.
- Preview BUY/SELL Document Center memberi pilihan unit sebelum import; default UNKNOWN, tidak ada POST sebelum Import Selected, quantity tidak dikonversi. Privacy Mode dan batch contract Gate 1 tetap dipertahankan.

Status calculation COMPLETE/INCOMPLETE terpisah dari rekonsiliasi. `reconciliation_status` tetap NOT_RUN. Semua interval setelah baseline tetap memuat ACTIVITY_COVERAGE_UNKNOWN karena belum tersedia authoritative activity coverage interval. Quantity yang dapat dihitung hanya proyeksi dari input diterima, bukan jaminan kelengkapan posisi aktual.

## 3. API dan database

API baru dalam auth:sanctum:

- `GET /api/investment-accounts/{account}/portfolio-snapshots?as_of=YYYY-MM-DD&page=1`
- `GET /api/investment-accounts/{account}/holdings?as_of=YYYY-MM-DD&baseline_snapshot_id=...`
- `POST /api/investment-accounts/{account}/portfolio-snapshots/{snapshot}/confirm`

TIMEZONE/cutoff pada holdings GET opsional berpasangan; tanpa batas eksplisit timestamp ambigu ditahan. Ownership menghasilkan 404 untuk akun/snapshot lain; field invalid 422; stale/conflicting confirmation 409. Read responses no-store. Source link invalid tidak membocorkan metadata akun lain.

**Tidak ada migration baru, migration aplikasi, DDL, backfill, seed atau perubahan data finansial database utama yang dijalankan.** Confirmation write hanya diuji pada SQLite :memory: sintetis. Pemilik dapat menggunakannya melalui UI setelah review, sesuai scope yang telah disetujui. Model snapshot hanya mendapat integer cast untuk parsed_item_count.

MariaDB schema yang sudah applied dapat dibaca. Tidak dibuat salinan/dump database pribadi dan tidak dilakukan fresh upgrade atau race test pada MariaDB/MySQL dalam sesi ini. Prosedur validasi salinan untuk target yang pending dijelaskan dalam spesifikasi; database utama tidak dijadikan lokasi percobaan migration.

## 4. Hasil pengujian aktual

Baseline sebelum perubahan:

- Backend: 48 tests, 248 assertions PASS.
- Frontend: 49 tests dalam 7 files PASS.
- Lint exit 0, enam warning existing; build PASS dengan warning chunk >500 kB.

Setelah implementasi:

- Backend: **79 tests, 496 assertions PASS**, mencakup 31 tests Gate 2 baru dan seluruh regresi existing.
- Frontend: **58 tests dalam 8 files PASS**, mencakup sembilan tests tambahan dan seluruh tests existing.
- Laravel Pint pada file PHP yang disentuh: PASS.
- Frontend lint: **exit 0**, enam warning existing pada interface parser/AuthContext/effect Transactions, tanpa error atau warning baru pada holdings UI.
- Frontend production build: **PASS**, main JS 843,02 kB (gzip 256,97 kB), CSS 34,96 kB, PDF worker 2.228,48 kB. Warning chunk >500 kB tetap ada; konfigurasi warning tidak diubah.
- `git diff --check`: PASS. Diff migration/dependency manifests/lockfiles kosong. Scan production JS tidak menemukan marker fixture finansial sintetis yang diperiksa.

Perintah backend: `php vendor/bin/phpunit --do-not-cache-result`, setelah guard memastikan cached app config tidak ada, dengan APP_ENV=testing, DB_CONNECTION=sqlite, DB_DATABASE=:memory:, DB_URL kosong, serta cache/session array. Tidak memakai composer setup, migrate:fresh, atau migration terhadap database aplikasi.

Frontend: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. PHP formatting scoped: services Holdings, controller, model snapshot, routes, dua file tests baru. Dependency manifests/lockfiles tidak diubah.

Skenario yang diuji:

- Explicit baseline, historical target, baseline setelah target, dan latest reported yang berbeda dari opening.
- BUY/SELL, cash dividend/reference neutrality, cash-only events, unsupported asset transfer dan corporate action.
- Owner/account/provider isolation termasuk invalid cross-account source pointer yang tidak membocorkan UUID/parser metadata.
- SHARE/LOT tidak digabung; COIN delapan digit; exact arithmetic di atas batas binary-float; null dan excess precision ditolak.
- DATE interval, explicit timestamp UTC/cutoff, missing timezone pair, dan late import pada tanggal efektif.
- Pending/rejected/legacy-unverified, null/invalid legacy quantity, duplicate canonical identity, distinct references dan pending unlinked source candidate.
- PARTIAL/UNKNOWN openings, missing asset tetap null, FULL new-asset zero opening, negative final result dan empty FULL yang sah.
- Monthly-only source versus ledger tanpa membuat transaksi, same-date snapshot conflict, dan invalidation baseline yang sebelumnya valid.
- Konfirmasi stale/invalid/missing item/unit conversion/quantity replacement ditolak; source observations tetap immutable; audit ditulis atomik.
- Frontend account selection, separated reported/calculated, explicit baseline reset, attestation sebelum POST, metadata-only confirmation, conflict/error/null states, account-specific timestamp boundaries, dan unit preview sebelum explicit import.

Test baru sempat menemukan perbedaan serialisasi DATE SQLite (MAX(date) membawa midnight) yang membuat latest reported tidak muncul; selector diperbaiki menormalkan calendar date sebelum query. Uji unit preview juga menegaskan exact source quantity `100.00` dipertahankan, bukan dipaksa format lain. Existing assertions tidak dilemahkan atau dihapus.

## 5. Known limitations dan fitur yang belum tersedia

- Final Reconciliation Engine, statement delta/classification MATCHED/MISMATCH, persisted runs dan resolution workflow belum dibuat. UI rekonsiliasi tetap NOT_RUN.
- Tidak ada authoritative activity interval evidence. COMPLETE hanya dapat berlaku pada scope yang benar-benar terpenuhi, misalnya snapshot FULL terkonfirmasi pada tanggal baseline yang sama; tidak diklaim untuk interval aktivitas UNKNOWN.
- Same-date snapshot supersession/resolution belum tersedia. Konfirmasi menolak konflik tersebut, bukan memilih versi secara diam-diam.
- Unit parser tetap UNKNOWN sampai ditinjau; existing UNKNOWN transactions tidak di-backfill. Manual ledger rows REQUIRED atau edited rows perlu workflow review transaksi terpisah. Mengubah unit payload pada source yang sudah tersimpan dapat menjadi SOURCE_CONFLICT; Gate 2 tidak memaksakan overwrite.
- Unit yang diketahui tidak dapat dikonversi melalui confirmation endpoint. Pelebaran crypto di atas delapan desimal tetap di luar scope yang disetujui.
- Timestamp tanpa offset pada kontrak Gate 1 pernah diperlakukan UTC; original timezone yang tidak tersimpan tidak dapat dipulihkan. Parameter cutoff tidak mengoreksi event date secara diam-diam.
- Negative positions, asset transfers, splits dan event quantity yang belum punya rule tetap review/incomplete.
- Perhitungan current state dilakukan on demand, bukan historical ingestion-time reconstruction. Fingerprint account-wide dapat berubah walaupun input yang berubah berada di luar periode. Audit projection runs/cache/automatic live refresh belum tersedia.
- Read service memuat ledger/observations akun untuk correctness MVP. Optimasi query/pagination/manifest untuk skala besar belum dibenchmark.
- Overview belum memakai adapter read holdings Gate 2; integrasi aktual ada di My Portfolio. Valuation/P&L/analytics, market APIs, Gmail/n8n/email parsing tetap belum ditambahkan.
- Browser visual/E2E, screen-reader, packet capture dan real MariaDB concurrent-write tests tidak dijalankan. Component tests/jsdom dan SQLite tidak membuktikan seluruh perilaku browser atau concurrency MariaDB. Tidak ada screenshot hasil baru yang diklaim.

## 6. File Gate 2

Backend baru:

- `backend/app/Http/Controllers/HoldingsController.php`
- `backend/app/Services/Holdings/QuantityDecimal.php`
- `backend/app/Services/Holdings/EffectiveDateWindow.php`
- `backend/app/Services/Holdings/SnapshotBaselineSelector.php`
- `backend/app/Services/Holdings/HoldingsCoverageEvaluator.php`
- `backend/app/Services/Holdings/HoldingsCalculationResult.php`
- `backend/app/Services/Holdings/HoldingsProjectionService.php`
- `backend/app/Services/Holdings/SnapshotConfirmationService.php`
- `backend/tests/Feature/HoldingsTest.php`
- `backend/tests/Unit/QuantityDecimalTest.php`

Backend existing: `backend/app/Models/PortfolioSnapshot.php`, `backend/routes/api.php`.

Frontend baru:

- `frontend/src/pages/PortfolioHoldings.jsx`
- `frontend/src/ui/useApiData.js`
- `frontend/src/ui/holdingsReasons.js`
- `frontend/src/ui/__tests__/Holdings.test.jsx`

Frontend existing/UI Gate lokal yang diperbarui:

- `frontend/src/pages/WorkspacePages.jsx`
- `frontend/src/pages/DocumentProcessing.jsx`
- `frontend/src/lib/document-processing/__tests__/DocumentImport.test.jsx`
- `frontend/src/ui/format.js`
- `frontend/src/ui/workspace.css`

Dokumen baru: `GATE_2_HOLDINGS_SPEC.md` dan laporan ini. File UI Gate lain yang sudah berubah sebelum sesi tetap ada; daftar historisnya ada pada UI_IMPLEMENTATION_REPORT. Tidak ada file dihapus. Manual `git add .` akan mencakup UI Gate yang belum committed beserta Gate 2, bukan Gate 2 saja.

## 7. Readiness dan handoff

Pemeriksaan akhir memakai `node tools/check-commit-readiness.mjs` read-only. Percobaan sandbox hanya terhalang verifikasi jaringan remote. Setelah akses read-only diizinkan, hasil **READY FOR MANUAL COMMIT**, exit 0, problems kosong: 200 kandidat file (165 tracked, 35 untracked), 197 file teks diperiksa, enam PDF lokal ignored, nol penghapusan, nol commit lokal yang belum ada pada remote main. Branch/origin sesuai; remote main `206de2be0c4d8b8a7b21c781cf34ba98d9aa5c87`.

Tidak ada git add/commit/push/fetch/merge/reset/rebase/switch/checkout/stash/tag atau perubahan identity/remote/history. PDF pribadi tidak dibaca/disalin, tetap diabaikan Git; tidak dibuat dump database tracked. Pattern scan bukan jaminan absolut bebas semua secret/PII. Readiness ini bukan klaim final reconciliation, visual sign-off, atau izin migration/deployment otomatis.

Rekomendasi commit message untuk scope workspace gabungan UI Gate + Gate 2: `feat: add portfolio workspace and holdings projection with reviewed snapshot baselines`.

Langkah berikutnya: review pemilik pada UI/source attestation dan hasil proyeksi → uji disposable MariaDB/runtime bila akan dirilis → approval Gate 3 reconciliation engine. Tidak ada fitur gate berikutnya yang diaktifkan otomatis.
