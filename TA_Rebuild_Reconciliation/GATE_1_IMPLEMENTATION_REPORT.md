# Gate 1 — Implementation and Test Report

Tanggal: 20 Oktober 2026. Scope: Source Contract & Data Integrity Foundation sesuai instruksi terbaru pemilik. Ini penyempurnaan proyek existing, bukan rebuild aplikasi dari nol.

Referensi: [source contract](GATE_1_SOURCE_CONTRACT.md), [PDF field evidence](GATE_1_PDF_FIELD_MATRIX.md), [pre-commit readiness](GATE_1_PRECOMMIT_READINESS.md). Laporan Phase 0 tetap historis.

## 1. Perubahan utama

1. Memisahkan document hash, source transaction reference, canonical fingerprint/record ID, dan import batch/idempotency identity.
2. Menambahkan import JSON berkonfirmasi dan receipt owner-scoped, provenance source/batch/observation, candidate matching konservatif, serta explicit compatible user-confirmed linking.
3. Memisahkan gross/net/fee/tax/settlement, menjaga legacy total dengan basis UNKNOWN bila belum diketahui. Arithmetic validation memakai decimal string tanpa dependency baru.
4. Memperbaiki hash recalculation dan duplicate revalidation pada edit; audit menyimpan before/after/revision. Delete API lama menyimpan audit/evidence dan tidak membolehkan reimport menghidupkan data otomatis.
5. Menambahkan FULL/PARTIAL/UNKNOWN position coverage; activity coverage tidak dinaikkan otomatis. Snapshot baru bukan synthetic BUY/SELL.
6. Memperbaiki PDF text reading order dan row boundaries, preserve exact source decimals, nullable Stockbit row fees, serta cash-dividend reference quantity/date.
7. UI mengirim allowlisted structured data setelah konfirmasi. Manual form juga berhenti mengubah field angka kosong menjadi 0.
8. Menambahkan pemeriksaan otomatis seluruh kandidat manual staging, termasuk file untracked dan penghapusan milik pemilik, tanpa menjalankan staging.

## 2. File/modul yang berubah

### Backend source

- `backend/app/Services/Integrity/Decimal.php`: exact decimal normalize/add/multiply.
- `TransactionIdentity.php`: canonical SHA-256 identity, potential candidates versus strict compatibility.
- `TransactionContract.php`, `SnapshotContract.php`: typed validation, amount/date/coverage semantics, safe field handling.
- `TransactionWriter.php`: shared create/update/delete, locking, identity collision check, audit/link revalidation.
- `SourceImporter.php`: account-scoped idempotency, source/batch/observation linkage, review statuses, snapshot observations.
- `IntegrityAudit.php`: safe actor/account/source/batch-linked audit events.
- `backend/app/Http/Controllers/SourceImportController.php`: structured import dan owner-scoped provenance receipt API.
- Existing `TransactionController.php`, `PortfolioSnapshotController.php`: delegasi shared validation/services, bounded bulk, safe failures, provider/ownership checks.
- `backend/app/Http/Resources/TransactionResource.php`: field integrity/amount/revision tambahan.
- Models `Transaction.php`, `PortfolioSnapshot.php`, `PortfolioSnapshotItem.php`: field/cast/relation tambahan.
- `backend/routes/api.php`: POST/GET source-imports, existing routes dipertahankan.

### Frontend source

- Baru: `SourceContract.js`, `SourceNumbers.js`, `PdfLayout.js` pada `frontend/src/lib/document-processing/`.
- `PdfExtractor.js`: file hash lokal, limits 20 MB/100 halaman, koordinat baris, cleanup loading task.
- Keenam parser PDF existing: exact source values, preserved reference/amount semantics; CA date-only normalization dan nullable event fields.
- `ValidationAndConfidence.js`: cash dividend nullable fields, gross arithmetic bukan net-as-gross, invalid snapshot quantities ditolak.
- `frontend/src/pages/DocumentProcessing.jsx`: registry parser, versioned structured import, explicit click, idempotency retry, partial/unknown coverage, no raw error logging.
- `frontend/src/pages/Transactions.jsx`: missing numeric fields tetap null/string; validation errors dirangkum agar kesalahan amount source tidak tersembunyi.

### Tests dan readiness

- Backend baru: `tests/Feature/SourceIntegrityTest.php`, `tests/Feature/IntegrityMigrationTest.php`, `tests/Unit/TransactionIdentityTest.php`.
- Frontend baru: `__tests__/SourceIntegrity.test.js`, `PdfPipeline.test.js`, `DocumentImport.test.jsx`, `ManualTransaction.test.jsx` dalam document-processing.
- `tools/check-commit-readiness.mjs`: pemeriksaan Git read-only dan kandidat filesystem, tidak pernah melakukan staging/Git mutation.
- `.gitignore`: tambahan pengecualian PDF dengan variasi kapitalisasi ekstensi.
- `README.md`: tautan konteks diarahkan ke paket controlled rebuild karena dokumen lama root sudah dihapus pemilik.
- Empat dokumen Gate 1 pada folder ini. Dokumentasi lama di root tidak dibuat kembali.

Existing tests tidak dihapus atau diubah ekspektasinya untuk membuat angka PASS. Tidak ada package manifest/lockfile/dependency yang diubah. Penghapusan dokumen root yang sudah ada sebelum Gate 1 tetap milik pemilik; Agent tidak menghapus file.

## 3. Database migration

Satu migration baru: `backend/database/migrations/2026_10_20_000001_add_source_integrity_foundation.php`.

- Tabel baru: source_documents, import_batches, source_observations, integrity_audit_events.
- Tambahan transaksi: typed financial amounts/basis, unit/date precision/reference quantity, imported_at, validation/review status, revision, account/date index.
- Tambahan snapshot: source link, position coverage/confirmation, activity coverage UNKNOWN, review status, parsed count, period; item unit.
- Existing financial values dan IDs dipertahankan; tidak ada auto backfill amount semantics/provenance yang belum diketahui.
- `down()` menolak rollback destructive otomatis. Evidence baru tidak boleh di-drop lewat rollback generik; recovery/forward migration perlu review pemilik.

**Tidak dijalankan pada database aplikasi.** Hanya diuji pada SQLite in-memory. Upgrade test membuat schema lama dan data sintetis pada koneksi in-memory terpisah, menjalankan migration baru, lalu memastikan nilai legacy tetap sama dan field baru memakai UNKNOWN/LEGACY_UNVERIFIED/null yang benar.

Sebelum pemakaian nyata: backup oleh pemilik, review migration dan retention constraints, uji salinan MySQL/MariaDB, lalu keputusan terpisah untuk penerapan. Source API baru memerlukan schema tersebut; jangan menganggap database lokal sudah dimutakhirkan.

## 4. Hasil pengujian yang benar-benar dijalankan

| Pemeriksaan | Hasil |
|---|---|
| Baseline PHPUnit sebelum perubahan | 14 tests, 34 assertions PASS |
| Baseline frontend sebelum perubahan | 11 tests PASS |
| Final backend PHPUnit | 48 tests, 248 assertions PASS |
| Frontend Vitest | 32 tests dalam 5 files PASS |
| Frontend production build | PASS; warning existing bundle lebih dari 500 kB |
| Frontend lint (oxlint) | Exit 0; 9 warning pada interface/auth/transaksi existing, tidak ada error |
| Laravel Pint pada file PHP yang disentuh | PASS setelah formatting scoped |
| PDF lokal | Keenam sumber menghasilkan normalized rows nonempty dan tanggal valid setelah perbaikan reading order; output diagnostic anonim |

Perintah backend dijalankan dengan APP_ENV=testing, DB_CONNECTION=sqlite, DB_DATABASE=:memory:, DB_URL kosong, CACHE_STORE/SESSION_DRIVER=array; tidak ada cached config aplikasi saat pengujian awal. Entry point: `php vendor/bin/phpunit --do-not-cache-result`, bukan composer setup/migrate terhadap database aplikasi.

Perintah frontend: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. Production build/dependency runtime tetap diabaikan Git.

Coverage tests: gross/net/fee/tax dan unknown fields, identity currency/time/reference/decimal serta account-ID string/integer, edit/hash/collision/atomic failure, same-source replay/conflict, cross-source SOA/TC candidate, financial disagreement review, explicit linkage, batch idempotency, provenance read ownership, full/partial/unknown/empty snapshots, dividend reference quantity, precision rejection, multi-user/multi-account isolation, legacy API regression termasuk data numeric lama yang invalid, delete/reimport audit preservation, dan additive legacy-data preservation.

Browser-component test membuktikan tidak ada POST sebelum klik Import Selected dan request JSON tidak berisi raw bytes/nama file/extracted text marker. PDF pipeline tests memakai PDF.js sebenarnya pada byte PDF sintetis di memori. Ini bukan packet capture browser produksi, bukan test MySQL concurrency, dan bukan pengukuran generalisasi parser semua layout.

## 5. Keterbatasan dan keputusan berikutnya

- Full field-level ground truth dan recall setiap section PDF belum diukur. Known parsed rows bukan full coverage; pemilihan semua baris tetap UNKNOWN.
- Monthly summaries, baseline selection, holdings projection, reconciliation/recompute, valuation dan final dashboard belum dibuat.
- Unit parser masih UNKNOWN; konversi lot/share dan pelebaran crypto precision perlu keputusan berbasis source evidence. Lebih dari 8 desimal ditolak, bukan dibulatkan.
- Stockbit row fee/tax/net/settlement tidak diisi dari biaya agregat; alokasi memerlukan aturan tersendiri yang disetujui.
- Reference namespace lintas dokumen belum diverifikasi, sehingga matching ambigu tetap review. Unique hash existing belum dilonggarkan untuk dua trade sah identik tanpa reference. API compatible linking tersedia; full distinct-event/snapshot resolution UI ditunda.
- Total wajib untuk canonical accepted row pada schema lama. Total yang tidak diketahui tidak diganti 0: row gagal validasi dan perlu review, bukan dipaksakan masuk ledger.
- Financial rounding tolerance dan provider date/settlement cutoffs belum disahkan; inconsistency exact arithmetic ditolak dengan pesan review.
- Confidence masih client advisory; authoritative server validation bukan probabilistic confidence model atau bukti source authenticity.
- Audit basis aplikasi bukan immutable ledger tahan perubahan administrator; revision/void dan retention penuh, termasuk account deletion, perlu keputusan lebih lanjut.
- MySQL migration/runtime/race tests serta browser network inspection deployment belum dijalankan. Tidak ada klaim bahwa database produksi siap migrasi otomatis.
- PDF terenkripsi belum mempunyai UI password; failure tetap lokal, tanpa fallback upload.

Keputusan pemilik berikutnya: review contract dan migration; unit/tolerance/reference namespace; workflow review untuk distinct events dan same-date snapshot conflicts; retention/deletion; actual-data migration test pada salinan database. Tidak perlu keputusan cost-basis/P&L untuk menutup fondasi Gate 1, karena kalkulasi tersebut belum diimplementasikan.

## 6. Git dan handoff

Tidak ada git add/commit/push/merge/reset/rebase/switch/checkout/stash/tag atau perubahan remote/identity yang dijalankan. Tidak ada AI co-author. Branch/origin diperiksa read-only; pemilik tetap melakukan staging, commit dan push.

Gunakan hasil [pre-commit readiness](GATE_1_PRECOMMIT_READINESS.md) untuk melihat cakupan kandidat manual staging. Status kesiapan commit bukan izin migrasi database atau klaim seluruh gate penelitian berikutnya sudah selesai.

Rekomendasi commit message: `feat: add source integrity contracts and privacy import foundation`.
