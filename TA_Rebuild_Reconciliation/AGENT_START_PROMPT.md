# PROMPT UTAMA UNTUK AI AGENT — PHASE 0: AUDIT + REBUILD PLAN

Anda melanjutkan proyek TA di repository lokal `C:\TAP\TA_Agent_Context_Antigravity`. Kita melakukan **CONTROLLED REBUILD**, bukan menghapus proyek dan membuat proyek baru secara buta.

## Tujuan akademis
Fokus terbaru: **Integrasi dan Rekonsiliasi Data Portofolio Aset Finansial Berbasis Web**. Diferensiasi yang akan diuji adalah Portfolio Reconciliation Engine: membandingkan ledger dengan snapshot SOA, mendeteksi mismatch/duplicate/missing/late-arriving transaction, memberikan audit trail, dan tidak menciptakan transaksi fiktif. Judul akademis resmi tetap sampai dosen menyetujui perubahan.

## BACA SEMUA DOKUMEN
- `README.md` paket ini dan `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_CONTRACTS.md`, `docs/RECONCILIATION_SPEC.md`, `docs/SOURCE_MATRIX.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/TEST_PLAN.md`, `docs/SECURITY_AND_GIT.md`, `docs/AGENT_RULES.md`, `docs/DECISION_LOG.md` (sesuaikan lokasi bila paket diekstrak dalam subfolder).
- Existing project: `PROJECT_CONTEXT.md`, `DEVELOPMENT_RULES.md`, `CURRENT_STATUS.md`, `TASK.md`, `CHANGELOG.md`, migrations, frontend/backend code, test suite.
- Dokumen proposal jika tersedia; tandai konflik antara proposal dan rencana baru.

## TAHAP 0 SAJA — JANGAN CODING DULU
1. Periksa branch, `git status`, `git log -5`, `git remote -v`, file tracked, risiko PDF/PII dan secret exposure; jangan tampilkan isi sensitif.
2. Audit modul yang ada: auth, ledger, account, parser PDF, privacy mode, snapshot, bulk API, confidence, dedup, dashboard, tests.
3. Verifikasi keberadaan dan sanitasi enam PDF dalam `docs/aset_parser/` tanpa menyalin isi PII ke output. Jika belum aman, hentikan pembacaan fixture dan minta versi sanitized.
4. Buat matriks REUSE / REFACTOR / ADD / REMOVE untuk tiap modul, dengan alasan dan dampak migrasi.
5. Audit schema existing dan usulkan additive migrations untuk provenance, snapshot items, monthly summaries, reconciliation runs/items. Jangan drop tabel/data.
6. Usulkan alur data untuk dua mode Privacy (transaction-based dan monthly-only), Automatic Mode di fase berikutnya, serta cara mencegah double counting SOA vs TC/email.
7. Definisikan contract output parser berdasarkan provider + medium + document type, termasuk field availability; jangan membuat format dummy menjadi fakta.
8. Tetapkan MVP reconciliation: opening snapshot + transaksi valid bertanggal efektif -> expected holdings -> compare SOA -> MATCHED/MISMATCH/INCOMPLETE/PENDING_REVIEW. Jelaskan unit lot/saham/crypto, corporate actions dan coverage gaps.
9. Usulkan roadmap implementasi per gate, risiko, test cases, serta urutan yang paling sedikit merusak kode lama.
10. Buat file rencana `REBUILD_AUDIT_REPORT.md` dan `REBUILD_IMPLEMENTATION_PLAN.md`, serta daftar pertanyaan yang memerlukan keputusan user/dosen.

## KETENTUAN WAJIB
- Jangan menjalankan migrations, mengubah source code, menghapus file, mengganti branch, reset Git, commit, push, atau menambah dependency pada tahap audit ini.
- Jangan mengirim raw PDF/password/email/account ID ke server, log, Git atau respons.
- Jangan mengklaim SOA mengandung detail transaksi jika belum diperiksa.
- Jangan mencatat UNKNOWN sebagai 0. Untuk periode lengkap yang diverifikasi tanpa aktivitas, gunakan 0; win rate tanpa penjualan = N/A.
- Jangan membuat BUY/SELL fiktif dari selisih dua snapshot.
- Jangan mengubah git user.name/user.email atau menambah AI co-author.
- Pisahkan fitur yang sudah berjalan, yang belum, dan yang hanya direncanakan.

## FORMAT LAPORAN AKHIR TAHAP 0
1. Ringkasan kondisi repository dan keamanan.
2. Status setiap modul (ada/berfungsi/parsial/belum ada) dengan evidence.
3. Matriks reuse/refactor/add/remove.
4. Usulan ERD/migration (tanpa mengeksekusi).
5. Pipeline terbaru dan boundary transaksi/snapshot/summary.
6. Spesifikasi MVP Portfolio Reconciliation Engine.
7. Roadmap gates, pengujian, risiko dan effort relatif.
8. Pertanyaan yang harus dijawab pemilik proyek.
9. Pernyataan jelas: **STOP — menunggu persetujuan untuk implementasi Gate 1**.

Mulai dengan audit read-only sekarang. Jangan melanjutkan implementasi tanpa persetujuan saya.
