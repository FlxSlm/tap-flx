# Gate 3.5 — Runtime Validation & Reconciliation History

Tanggal: 27 Oktober 2026, Asia/Makassar. Basis repository: `main`, HEAD `5f6371d` (`Portfolio Reconciliation Engine`).

**Status keseluruhan: BLOCKED untuk sign-off Gate 3.5 dan penerapan pada database utama.** Kompatibilitas migration dan API Laravel pada MariaDB 10.4.32 berhasil diuji dengan data sintetis terisolasi. Backup/restore database utama belum tersedia/terverifikasi menurut pemilik; functional/visual browser QA desktop dan mobile belum selesai. Hasil ini bukan READY FOR DEPLOYMENT.

## 1. Scope dan referensi

Referensi yang diperiksa: paket arsitektur dan aturan dalam folder ini, laporan Phase 0, kontrak/laporan Gate 1, UI specification/report, terutama `GATE_2_HOLDINGS_SPEC.md`, `GATE_2_IMPLEMENTATION_REPORT.md`, `GATE_3_RECONCILIATION_SPEC.md`, dan `GATE_3_IMPLEMENTATION_REPORT.md`. Dokumen historis bukan bukti state database saat ini. Lima konteks root lama tidak dibaca.

Source aplikasi, migration Gate 3, controller/services, konfigurasi auth/CORS/session, dan tests aktual diperiksa. Tidak ada perubahan pada domain source Laravel/React, migration existing, dependency, parser, atau database utama. Dua harness validasi ditambahkan agar pengujian dan demo dapat diulang secara lokal; readiness allowlist diperluas hanya untuk satu path PHP harness yang direview.

Tidak ada Artisan `migrate`, `migrate:fresh`, `migrate:refresh`, reset, db:wipe, rollback migration, default demo seeder, atau perintah Git pengubah state dijalankan. Pada database disposable saja, metode `up()` migration dipanggil langsung setelah guard identitas koneksi. `ROLLBACK` transaksi digunakan untuk membatalkan probe constraint sintetis; ini bukan rollback migration/destructive recovery.

## 2. Database isolation evidence

Database utama `myportfolio` hanya diperiksa melalui SELECT metadata dalam `START TRANSACTION READ ONLY`, kemudian transaksi diakhiri dengan rollback. Tidak membaca baris investasi, melakukan dump data utama, atau mencetak credentials.

Hasil awal dan penutup:

- Server `10.4.32-MariaDB`, driver Laravel `mysql`, PHP 8.2.12.
- Main memiliki 20 base tables, semuanya InnoDB.
- Satu migration pending: `2026_10_26_000001_add_reconciliation_history`.
- Main memiliki **0** tabel `reconciliation_runs`/`reconciliation_items`; migration histori belum tercatat applied.
- Tidak ada DDL, synthetic transaction, snapshot, account, user, atau session test yang dibuat pada main oleh pekerjaan ini.

Validasi disposable dilakukan pada dua database baru dengan fixture sintetis:

- `tap_flx_gate35_20261027_a7f4c209`: percobaan awal migration/API/constraint berhasil.
- `tap_flx_gate35_20261027_d8bca531`: validasi ulang dengan identity header HTTP, comparison sebelum histori tersedia, Gate 2/source rows sebelum upgrade, dan workflow API lengkap. Database ini dipertahankan untuk demo lokal.

Ini database terpisah pada server MariaDB lokal yang sama, bukan server/container terpisah dan bukan salinan data pribadi. Kredensial koneksi lokal existing dipakai di memori; tidak dibuat user/grant database baru. Pembatasan dilakukan melalui konfigurasi/guard harness, bukan least-privilege DB user baru.

Guard `tools/gate35-runtime.php`:

1. Menolak cached application configuration, nama database yang tidak cocok dengan pola disposable eksplisit, konfigurasi URL DB, dan host selain localhost/127.0.0.1.
2. `prepare` menggunakan koneksi admin tanpa selected database, memeriksa schema belum ada, lalu membuat nama baru. Database existing tidak ditimpa, dikosongkan, atau dihapus.
3. Mengganti seluruh configured connection dengan satu koneksi `gate35`; memverifikasi konfigurasi dan `SELECT DATABASE()` tepat sama dengan nama disposable sebelum migration/query test.
4. HTTP memakai kernel/middleware Laravel nyata, session database disposable, cookie sesi berbeda, CORS dan Sanctum localhost:5185; CSRF tetap aktif.
5. Smoke client memerlukan `GATE35_DATABASE` dan mencocokkan header `X-Gate35-Database` pada respons sebelum melanjutkan request tulis. Server utama tidak dijadikan fallback.

`.env` backend/frontend tidak diedit. Artifact lokal di `.local-backups/gate35/` ignored, bukan backup main. Dua database sintetis tidak di-drop setelah pengujian. Tidak ada PDF pribadi dibaca, dikirim, atau dijadikan fixture.

## 3. Migration compatibility result

Migration yang diuji: `backend/database/migrations/2026_10_26_000001_add_reconciliation_history.php`, tanpa modifikasi.

**PASS pada MariaDB 10.4.32 yang diuji.** Migration hanya membuat dua tabel dan index/constraints; tidak menjalankan UPDATE/backfill terhadap ledger/snapshot/source lama.

- Kedua tabel memakai InnoDB; parent/child ID kompatibel dengan FK.
- Metadata menunjukkan 2 primary key, 5 foreign key, 3 unique constraint, 3 CHECK. Account+created_at index ditetapkan migration; unique public UUID, account+result fingerprint, dan run+symbol+unit tersedia.
- `parameters`, `summary`, dan `result` menjadi LONGTEXT dengan collation `utf8mb4_bin` dan JSON validation CHECK pada server ini. Bentuk storage ini berhasil dipakai oleh Laravel JSON encode/decode dan history API.
- Tidak ada DDL rollback atomik yang diklaim: bila penerapan nyata gagal di tengah dua CREATE TABLE, jangan retry/drop otomatis; review schema parsial dan lakukan forward recovery oleh pemilik.
- `down()` menolak rollback destructive. Immutability adalah boundary service/API; administrator DB tetap dapat mengubah baris.

Probe constraint aktual pada disposable, seluruh probe DML dibatalkan dengan transaction rollback:

- Duplikasi account+result fingerprint: ditolak, MariaDB error 1062.
- Duplikasi run+symbol+unit: ditolak, error 1062.
- Actor FK tidak ada: ditolak, error 1452.
- Penghapusan opening snapshot yang dirujuk run: ditolak, error 1451.
- Penghapusan run yang memiliki item: ditolak, error 1451.
- JSON invalid pada masing-masing tiga kolom: ditolak, error 4025.
- Roundtrip JSON mempertahankan string `9999999999999999.12345678`, `0.00000001`, dan null secara tepat. SQL JSON_TYPE memastikan quantity bertipe STRING, bukan numeric float.

Constraint lain diperiksa melalui metadata dan workflow normal; tidak semua kombinasi FK/index/race disimulasikan secara negatif.

## 4. Data preservation

Schema sebelum histori dibuat dari migration existing pada database baru; legacy rows sintetis disiapkan lebih dahulu, termasuk quantity decimal(24,8) dan nominal decimal(24,4). Pada validasi ulang, source imports, accepted BUY/SELL, snapshot confirmation, observations, dan audit Gate 2 juga sudah ada sebelum upgrade.

Tepat sebelum dan sesudah `up()` Gate 3, harness membandingkan full ordered rows dengan SHA-256 dan count untuk **10 tabel**: users, platforms, investment_accounts, transactions, portfolio_snapshots, portfolio_snapshot_items, source_documents, import_batches, source_observations, integrity_audit_events. Semua identik. Sessions bukan financial baseline dan dikecualikan karena aktivitas login HTTP.

Ini membuktikan preservation dataset sintetis yang diuji, bukan membuktikan semua legacy data privat atau restore backup main. Bukti fingerprint/constraint tersimpan lokal pada `.local-backups/gate35/<nama-database>/validation.json`.

## 5. Runtime/API verification

HTTP dilakukan terhadap `http://localhost:8015`, bukan `actingAs`, SQLite, atau middleware test bypass. Database disposable dipakai sepanjang request. Client mengirim Origin/Referer localhost:5185, cookie session, XSRF token dan JSON sebagaimana alur SPA. CORS origin dan allow-credentials diperiksa pada setiap respons API/auth yang diuji.

Hasil:

- GET user tanpa sesi → 401; CSRF cookie → 204; login tanpa token CSRF → 419; password salah → 401; login benar → 200; user/account read → 200.
- Registration sintetis → 201, session aktif; logout → 200; user setelah logout → 401. User baru tanpa kepemilikan akun tidak dapat membaca history akun investor (404).
- Structured source import SOA/TC → 200; snapshot list dan confirmation → 200. Snapshot quantity tidak diubah untuk menyamakan hasil.
- Sebelum histori tersedia, calculation valid → 200/INCOMPLETE dengan equality diagnostic; history list → available:false/HISTORY_SCHEMA_PENDING; save → 503. Comparison tetap bekerja tanpa migration histori.
- Sesudah upgrade, holdings Gate 2 → 200 dengan quantity 120 dan status INCOMPLETE untuk activity coverage unknown.
- Opening 100 + BUY 30 − SELL 10 = closing 120 SHARE: numerical EQUAL tetapi INCOMPLETE sebelum attestation, dengan NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED.
- Attestation terhadap exact input_version dan empat sumber relevan → MATCHED, difference string `0`, basis USER_ATTESTED_PERIOD.
- Save → 201; replay identik → 200, run UUID sama dan tidak ada duplikasi. Detail awal CURRENT.
- Impor SELL sintetis 5 yang efektif sebelum closing namun datang belakangan: ledger bertambah tepat satu event yang memang disuplai fixture. Histori lama menjadi STALE; hash seluruh stored result sama, status historis MATCHED tidak ditimpa.
- Recalculate dengan proof lama → INCOMPLETE dan coverage tidak dikonfirmasi; stale save → 409. Proof baru → MISMATCH, calculated 115 versus reported 120, difference `5`. Engine tidak membuat transaksi adjustment.
- Save hasil baru → 201; list memiliki dua run: MATCHED/STALE dan MISMATCH/CURRENT.
- Self comparison/raw_pdf payload → 422; snapshot dari akun/provider lain → 404; history milik akun lain → 404.

Log ringkas sintetis lokal: `.local-backups/gate35/pending-http.json` (18 request pada validasi ulang) dan `runtime-http.json` (37 request). Uji React entry delivery dijalankan terpisah setelahnya. Harness versi akhir juga mengecek entry delivery ketika pending/exercise dijalankan ulang; jumlah request pada log historis tersebut tidak diubah.

## 6. React/browser verification status

**Functional/visual browser QA: BLOCKED, belum selesai.**

Inventory desktop menunjukkan Edge/Chrome tersedia. Konektor browser langsung tidak menyediakan browser dan melaporkan native pipe unavailable. Skill `computer-use` digunakan untuk inspeksi desktop dan upaya membuka tab terpisah, tetapi tool menghentikan Computer Use karena URL Windows browser tidak dapat ditentukan dengan keyakinan yang memadai untuk enforcement kebijakan. Tidak ada upaya meneruskan input UI atau menghindari penghentian ini.

Tidak ada alur user pada frontend terisolasi yang berhasil dijalankan melalui GUI. Tidak ada screenshot hasil Gate 3.5, desktop/mobile layout sign-off, browser E2E, console/network inspection, screen reader, atau touch QA yang diklaim.

Yang benar-benar terverifikasi:

- Vite 8.3.0 berjalan terpisah pada localhost:5185 dengan VITE_API_URL localhost:8015 melalui environment process, tanpa mengubah `.env`.
- GET React entry untuk `/login`, `/register`, `/`, `/portfolio`, `/documents`, `/transactions`, `/reconciliation` → 200 dan memiliki React root. Ini hanya delivery SPA; tidak membuktikan React render/auth/navigation/layout.
- 68 component/unit tests frontend lulus, termasuk account/snapshot selection, explicit calculation, evidence/reasons, coverage confirmation, recalculation/stale reset, pending history, save conflict, dan historical labels menggunakan API mocks.
- API/auth nyata dan komponen React yang dimock diuji sebagai lapisan terpisah; belum dibuktikan sebagai satu browser end-to-end.

## 7. Regression dan tooling

- Backend: `php vendor/bin/phpunit --do-not-cache-result` → **108 tests, 887 assertions PASS**. Guard cached config; APP_ENV=testing, DB_CONNECTION=sqlite, DB_DATABASE=:memory:, DB_URL kosong, cache/session array. Tidak mengalihkan PHPUnit ke main/MariaDB.
- Frontend: `npm.cmd test` → **68 tests, 9 files PASS**.
- `npm.cmd run lint` → exit 0, enam warning existing pada parser interface/AuthContext/Transactions, tanpa error.
- `npm.cmd run build` → PASS, main JS 864,90 kB (gzip 262,37 kB), CSS 36,57 kB, PDF worker 2.228,48 kB. Existing warning chunk >500 kB tetap ada.
- Pint pada harness PHP baru → PASS setelah formatting scoped. PHP syntax dan Node syntax checks → PASS.
- `git diff --check` → PASS. Dependency manifests/lockfiles dan migration existing tidak berubah.

Negative guard tests menolak nama `myportfolio` dan prepare ulang database disposable existing. Pemeriksaan ini menemukan renderer exception CLI Laravel di luar Artisan dapat mengembalikan exit zero; harness diberi failure handler dengan exit nonzero dan pesan tanpa DB details, kemudian kedua guard diuji ulang PASS. Smoke client juga diubah keluar secara normal melalui return, setelah explicit process.exit memicu assertion libuv Windows pada satu percobaan entry check; pengulangan entry check exit 0. Tidak ada guard yang mengizinkan query finansial main atau overwrite schema.

MariaDB HTTP/DDL/probe tests menambah evidence di luar SQLite regression, tetapi tidak menggantikan concurrency/load/recovery testing. PHP built-in server yang dipakai melayani request secara serial; concurrent-save/write locking lintas worker belum diuji.

## 8. Backup dan recovery prerequisite

Pemilik menjawab **belum ada / belum diuji restore**. Lokasi backup lokal proyek yang diperiksa berisi Git bundle/PDF, bukan dump database yang dapat diverifikasi. Tidak menyimpulkan isi lokasi privat lain. Tidak membuat backup main otomatis.

Sebelum mempertimbangkan migration main, pemilik perlu membuat backup di luar repository, melindungi akses folder, lalu menguji restore ke database terpisah. Contoh PowerShell berikut adalah **rekomendasi manual, belum dijalankan Agent**. Jalankan saat aplikasi/worker tidak menulis dan tidak ada DDL lain; metadata saat audit menunjukkan seluruh tabel main InnoDB.

```powershell
$backupDir = 'C:\TAP-Backups\tap-flx'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backupPath = Join-Path $backupDir ('myportfolio-before-gate35-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
$dbUser = Read-Host 'User database lokal'
& 'C:\XAMPP\mysql\bin\mysqldump.exe' --host=127.0.0.1 --port=3306 --user=$dbUser --password --single-transaction --quick --routines --triggers --events --hex-blob --default-character-set=utf8mb4 --skip-add-drop-table --result-file=$backupPath myportfolio
if ($LASTEXITCODE -ne 0) { throw 'Backup gagal; jangan lanjut migration' }
if ((Get-Item -LiteralPath $backupPath).Length -eq 0) { throw 'Backup kosong' }
Get-FileHash -LiteralPath $backupPath -Algorithm SHA256
```

Gunakan password prompt; jangan meletakkan password dalam argumen/riwayat atau laporan. Tidak memakai redirect PowerShell `>` untuk binary-sensitive dump text; mysqldump menulis file sendiri. Jangan menambahkan `--databases` yang dapat membawa CREATE/USE database utama ke dump restore.

Uji restore dilakukan pemilik ke schema baru, misalnya `tap_flx_restorecheck_20261027_<suffix>`, menggunakan koneksi/nama yang diverifikasi eksplisit. Import dump hanya ke schema kosong itu, bukan main. Periksa exit status, schema/index/FK, counts serta IDs/quantity/nominal secara privat. Jangan mengirim isi dump ke Agent/Git. Backup baru dianggap terverifikasi setelah restore dan pemeriksaan data berhasil; file nonempty/hash saja belum membuktikan recovery. Penjadwalan event/routines pada salinan perlu direview agar tidak memicu efek samping.

Backup restore data utama belum diuji dalam gate ini. Bila upgrade main gagal, hentikan writers dan review schema parsial; gunakan forward fix atau reviewed restore plan pemilik. Jangan menjalankan migrate:rollback/reset/fresh/wipe atau drop tabel evidence.

## 9. Manual migration instructions — main

**Jangan jalankan sekarang sebelum backup/restore berhasil dan blocker browser ditinjau.** Perintah di bawah hanya rekomendasi untuk pemilik; Agent tidak mengeksekusinya.

1. Hentikan proses tulis/import, simpan backup terverifikasi, review migration dan hasil gate ini. Pastikan menggunakan backend normal, bukan router/harness Gate 3.5, dan konfigurasi koneksi mysql memang `myportfolio`. Jika config cache aktif, review konfigurasi efektif; jangan menebak dari `.env`.
2. Dari `C:\TAP\tap-flx\backend`, periksa `php artisan migrate:status --database=mysql` dan identitas server/database secara read-only. Audit saat ini hanya menemukan Gate 3 pending; ulangi saat akan menerapkan.
3. Setelah prasyarat terpenuhi, preview hanya path migration yang disetujui lalu jalankan path yang sama:

```powershell
php artisan migrate --database=mysql --path=database/migrations/2026_10_26_000001_add_reconciliation_history.php --pretend
php artisan migrate --database=mysql --path=database/migrations/2026_10_26_000001_add_reconciliation_history.php
php artisan migrate:status --database=mysql
```

4. Periksa kedua tabel/constraints, migration applied, dan preservation main counts/data dengan baseline backup secara privat. Jangan memakai seeder/dummy trade pada main untuk smoke testing.
5. Login aplikasi normal, pilih akun/snapshot nyata yang telah ditinjau, hitung hasil dan simpan hanya jika memang dikehendaki pemilik. History list harus available:true; comparison tidak boleh berubah karena tabel histori baru. Penerapan migration sendiri tidak membuat reconciliation run atau menaikkan coverage.

Belum menjalankan migrator repository bookkeeping pada MariaDB disposable: harness menjalankan metode `up()` langsung dan mencatat evidence lokal. Owner perlu memeriksa migration repository setelah perintah manual. Keberhasilan `up()` sintetis tidak menjamin hak akses/deployment/cache/legacy state semua instalasi.

## 10. Demo lokal dan checklist browser manual

Environment sintetis tersedia tanpa mengaktifkan histori main. Gunakan jendela browser terpisah/InPrivate agar cookie XSRF/sesi aplikasi normal tidak bercampur. Jangan memakai akun/berkas pribadi pada demo ini.

Jika server telah berhenti, dari root repository jalankan pada terminal pertama:

```powershell
$env:GATE35_DATABASE = 'tap_flx_gate35_20261027_d8bca531'
php tools/gate35-runtime.php inspect
php -S localhost:8015 tools/gate35-runtime.php
```

Terminal kedua, dari `frontend`:

```powershell
$env:VITE_API_URL = 'http://localhost:8015'
npm.cmd run dev -- --host localhost --port 5185 --strictPort
```

Buka `http://localhost:5185/login`. Akun sintetis lokal: `gate35@example.test`, password `Gate35-demo-only!`. Ini akun demo pada disposable saja, bukan credentials utama. Jangan deploy/expose harness atau demo account ke jaringan publik. Proses validasi hanya bind localhost.

Checklist yang harus dikerjakan dan dicatat pemilik:

1. Login salah/benar, logout, refresh route terproteksi; register dengan email sintetis baru. Akun baru wajar belum memiliki investment account karena onboarding akun belum tersedia.
2. Overview: set periode Februari 2020 untuk melihat transaksi sintetis. Valuation/P&L/analytics tetap unavailable sesuai scope, bukan bug atau nilai nol.
3. My Portfolio: pilih SYNTHETIC STOCKBIT, target setelah Februari 2020 dan opening #2 (31 Januari). Reported 120 terpisah dari calculated 115 setelah late SELL; coverage calculation tetap INCOMPLETE.
4. Document Center: periksa kedua pola Privacy Mode, account/file controls, error/empty states. Bila menguji PDF, gunakan PDF sintetis/sanitized milik penguji; jangan gunakan private PDF. Network request tidak boleh membawa bytes/password/extracted text. Actual browser PDF upload/parse/import belum dilakukan Agent.
5. Transactions: pilih akun Stockbit sintetis; tiga trades diterima (BUY 30, SELL 10, late SELL 5), tanggal efektif Februari. Jangan memilih akun legacy preservation sebagai fixture rekonsiliasi.
6. Reconciliation: pilih akun Stockbit; opening #2 31 Januari 2020, closing #3 29 Februari 2020; Bandingkan posisi. Quantity 115/120, delta +5, status INCOMPLETE tanpa coverage. Buka evidence/reasons. Konfirmasi coverage sintetis → MISMATCH; Hitung ulang → hasil konsisten jika input tidak berubah.
7. Simpan hasil identik → replay tanpa run ganda. History lama MATCHED harus STALE dan tetap menyimpan angka lama; history MISMATCH terbaru CURRENT. Detail historical tidak boleh disajikan sebagai hasil live.
8. Ganti akun/provider ke BIONS/Pluang sintetis: tidak ada snapshot, jangan mewarisi pilihan/batas akun lain. Uji loading/error/retry melalui DevTools offline/request blocking; pulihkan lalu coba ulang. Pastikan save pending/disabled states dapat dipahami.
9. Ulangi pada desktop 1440×1000/1280×800, mobile 390×844 dan lebar 320px: drawer, Escape/focus, label, kontrol selection, evidence, overflow tabel, tombol save/recalculate, zoom 200%. Periksa console dan Network untuk auth/CORS/CSRF dan error respons.

Tabel histori pending sudah diuji HTTP sebelum upgrade dan component tests; demo database sekarang memiliki tabel histori. Jangan menjatuhkan tabel untuk membuat UI pending. Untuk demo pending yang baru, gunakan database baru dengan `prepare` dan belum `upgrade`.

Untuk mengulang seluruh validasi dari awal: pilih suffix hex baru, `prepare`, jalankan server 8015 terhadap nama itu, `node tools/gate35-http-smoke.mjs pending`, hentikan aktivitas UI, `php tools/gate35-runtime.php upgrade`, `node tools/gate35-http-smoke.mjs exercise`, lalu `constraints`/`inspect`. Semua terminal harness harus memakai GATE35_DATABASE sama. Jangan menjalankan prepare/upgrade ulang pada database existing; exercise adalah skenario satu kali yang menambah late event/register sintetis. Database demo yang sudah terisi cukup memakai inspect/entries/UI.

## 11. Remaining limitations dan penutupan blocker

- Backup main dan restore test belum selesai; ini blocker penerapan main.
- Browser functional/visual desktop/mobile belum selesai karena penghentian Computer Use. HTTP entry delivery dan jsdom bukan pengganti; ini blocker sign-off UI/runtime terpadu.
- Belum ada concurrent multi-worker saves/imports, load benchmark, fault injection DDL, atau restore recovery test MariaDB. Jangan mengklaim contention/race terbukti hanya dari sequential idempotent replay.
- Dataset sintetis tidak mengukur generalisasi parser/coverage dokumen nyata. Attestation pengguna tetap bukan bukti independen aktivitas dunia nyata; transfer/corporate action, unit ambigu, same-date conflicts dan review Gate 1–3 tetap berlaku.
- Main history masih pending; Overview tetap tidak memuat history summary. Tidak membuka Gate 4 analytics, market data, P/L, Gmail, atau n8n.

Urutan berikutnya: pemilik backup + restore terisolasi → browser checklist/synthetic demo dan review pembimbing → tinjau keterbatasan concurrency/recovery sesuai target penggunaan → keputusan penerapan migration manual. Setelah laporan ini Agent berhenti; tidak menjalankan main migration atau Gate 4.

## 12. Pre-commit readiness dan file changes

Pemeriksaan awal sandbox terhalang verifikasi jaringan remote dan path PHP harness baru yang perlu direview. Pemeriksaan read-only dengan akses jaringan yang diizinkan dan exact-path allowlist yang diaudit berhasil: **READY FOR MANUAL COMMIT**, problems kosong. Hasil final: 219 kandidat (216 tracked + 3 untracked), 216 file teks dipindai, enam PDF ignored, nol penghapusan, nol unpushed commits; remote main `5f6371d01c92c2d6731946ed8b72c288162ab90d`. Readiness source bukan sign-off Gate 3.5/deployment. Pemeriksaan final diulang setelah laporan selesai.

Readiness allowlist awal menahan path PHP harness baru. Setelah audit, hanya `tools/gate35-runtime.php` ditambahkan pada exact-path allowlist; arbitrary tools/*.php dan seluruh aturan secret/PDF/history tetap diblokir/dipindai sebagaimana sebelumnya.

File baru:

- `TA_Rebuild_Reconciliation/GATE_3_5_RUNTIME_VALIDATION_REPORT.md`.
- `tools/gate35-runtime.php` — isolated schema/upgrade/constraint/router harness.
- `tools/gate35-http-smoke.mjs` — real cookie/CSRF HTTP smoke dan React entry delivery.

File diubah: `tools/check-commit-readiness.mjs` — exact-path allowlist di atas. Tidak ada file dihapus. Artifact/dump/log lokal ignored tidak masuk kandidat commit; tidak ada dump main dibuat.

Tidak ada git add/commit/push/fetch/merge/reset/rebase/switch/checkout/clean/stash/tag, perubahan identity/remote, atau AI co-author oleh Agent.

Rekomendasi commit message: `test: validate reconciliation history on isolated MariaDB runtime`.
