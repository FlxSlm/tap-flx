# Gate 3.6 — Implementation Report

Tanggal: 27 Oktober 2026, Asia/Makassar. Basis `main`, HEAD `5f6371d` (Portfolio Reconciliation Engine). Perubahan Gate 3.5 dan review privacy/research yang sudah lokal dipertahankan.

**Implementasi dan integration sintetis Gate 3.6 selesai; browser GUI E2E belum selesai.** Readiness source diperiksa terpisah pada bagian penutup. Gate 3.5/private real-data sign-off tetap **BLOCKED**, bukan READY FOR DEPLOYMENT.

## 1. Root cause sebenarnya dan reproduksi

Prioritas pemilik adalah dropdown Choose Account yang benar-benar kosong. Penyebab database yang terkonfirmasi melalui aggregate SELECT pada `myportfolio`: **users=2, investment_accounts=0, platforms=0, orphan accounts=0**. Tidak ada akun milik user lain yang salah terhubung: tabel akun seluruhnya kosong. Tidak membaca nama/email/login cookie atau financial rows.

Alur sebelumnya hanya GET daftar owned accounts; belum ada POST create account atau UI onboarding. Dengan akun kosong, `selectedAccountId=''`. Disabled expression Import Selected mencakup `!selectedAccountId`, sehingga selected rows empat tidak cukup untuk mengaktifkannya. Ini berbeda dari parser gagal, provider mismatch, atau seluruh rows invalid.

Reproduksi otomatis sintetis sebelum perubahan:

- User tanpa akun GET `/api/investment-accounts` → 200 `{data:[]}`.
- Test onboarding yang mengharapkan POST 201 gagal dengan **405 Method Not Allowed**.
- Existing component test dengan akun yang disediakan tetap dapat memilih dan mengirim source import; tidak menemukan bukti renderer dropdown menghilangkan akun yang sebenarnya ada.

Tidak menangkap respons HTTP browser utama yang sedang login; main aggregate data dan source path membuktikan kondisi nol akun, lalu actual API behavior direproduksi pada isolated tests. Kemungkinan auth/load error di lingkungan lain tetap dipisahkan oleh UI baru, tidak diasumsikan selalu empty.

## 2. Perubahan yang dibuat

### Account API dan onboarding

POST authenticated `/api/investment-accounts` menerima provider stockbit/bions/pluang + account_name saja. Owner berasal dari sesi. Reference platform dibuat jika belum ada saat user menekan Create, tanpa seeder/migration/account dummy. Label divalidasi, dinormalisasi, dan tidak membutuhkan RDN/SID/rekening/email broker.

Duplicate normalized/case-insensitive label pada owner+provider sama mengembalikan akun existing (200/already_exists), bukan baris baru; create baru 201. User row lock serialize jalur create ini. Ownership injection/extra financial identifier fields ditolak. GET/POST no-store.

Document Center sekarang mempunyai loading/error/retry/empty state dan form Create Investment Account. Respons create langsung menambah akun pada dropdown, memilih akun tersebut, serta menyegarkan resource accounts workspace. Tidak perlu refresh. Tombol disabled mempunyai alasan eksplisit, termasuk provider PDF yang tidak sesuai akun.

### Import dan My Portfolio

Guard provider berlaku frontend dan backend. Key retry disimpan pada ref dan state; in-flight ref mencegah double click sebelum state render. Source importer tetap memakai transaksi/account locks, source identity dan batch idempotency.

Snapshot receipt kini menyatakan review_status; CREATED tidak ditampilkan seolah confirmed. Sesudah SOA import ada View in My Portfolio dengan account/as_of URL. Portfolio menerapkan account intent hanya jika ada pada owned list; URL tetap ada untuk full refresh, tanpa memilih baseline atau coverage otomatis.

SOA tidak membuat ledger trades. UNKNOWN/PARTIAL, null dan exact source strings tetap dipertahankan. Trade baru dengan unit UNKNOWN tetap REQUIRED pada canonical record dan source observation; tidak dipaksa accepted. Stock provider dengan unit COIN ditolak. Known SHARE/LOT tidak dikonversi. Existing UNKNOWN rows tidak dimutasi/backfill. TC/CA source formats tidak ditambah; cash dividend quantity/price event tetap null.

### PDF password

`PdfExtractor` memakai parameter password resmi PDF.js dan typed safe error codes. Form type=password menyediakan Show/Hide dan Unlock & Process; wrong password bisa retry file yang sama. Password tidak ditrim, tidak masuk JSON, log aplikasi atau persistent browser storage.

Uncontrolled input/callback ref dibersihkan saat attempt, cancel, replace, selesai/gagal dan unmount. AbortController/request sequence membuang hasil lama; task destroy dipanggil satu kali melalui shared destruction promise pada success/error/cancel. Tidak mengklaim secure zeroization JavaScript memory.

### Error/origin hardening

API/auth unexpected errors kini menjadi JSON generic dengan fixed messages; reporting callback hanya log fixed text + exception class, tidak exception object/message/SQL/bindings/request body/trace. Validation errors masih actionable. Satu duplicate transaction literal dipertahankan sebagai public API contract melalui exact allowlist; existing regression tidak dilemahkan.

Axios menahan remote API saat frontend loopback, non-HTTP targets, URL credentials dan invalid origin sebelum adapter. Backend `.env` utama tidak diedit. Dedicated runtime sintetis memaksa debug=false; debug/redaction unit test juga dijalankan dengan debug=true untuk memastikan QueryException tidak bocor lewat API response/log callback.

Spesifikasi detail: [GATE_3_6_DOCUMENT_IMPORT_SPEC.md](GATE_3_6_DOCUMENT_IMPORT_SPEC.md). Laporan privacy sebelumnya tetap catatan historis sebelum dukungan password/error hardening ini; ketentuan isolasi/private-data/browser QA tetap berlaku.

## 3. Database isolation dan persistence

Tidak ada migration baru, perubahan dependency atau main migration. Main hanya dibaca dengan SELECT agregat/metadata dalam START TRANSACTION READ ONLY lalu rollback. Pemeriksaan penutup kembali menunjukkan users=2, accounts=0, platforms=0, migration histori Gate 3 applied=0. Tidak ada user/account/synthetic financial row/DDL dibuat di main oleh Agent.

Runtime Gate 3.6 memakai database baru pada MariaDB **10.4.32**:

- `tap_flx_gate36_20261027_b4d81e70`: percobaan awal; test assertion mengharapkan fixed-scale quantity padahal DTO Gate 2 menormalisasi `1.00000000` menjadi string `1`. Data tetap tersimpan; tidak dihapus/reset.
- `tap_flx_gate36_20261027_b4d81e71`: fresh complete run yang berhasil dan environment demo sintetis akhir.

`tools/gate36-runtime.php` hanya menerima nama berprefix Gate 3.6, DB lokal tanpa URL, uncached config; menolak database existing pada prepare. Koneksi admin awal tidak memilih schema. Setelah membuat schema baru, seluruh koneksi diganti satu target gate36 dan diverifikasi SELECT DATABASE(). Existing migrations dipanggil up() hanya pada disposable, tanpa Artisan migrate/fresh/reset/rollback/seed dan tanpa copy data pribadi.

Prepare dimulai dengan **nol users/platforms/accounts/transactions/snapshots**. API register/login/create yang eksplisit mengisi data sintetis. PHP localhost:8026, React/Vite localhost:5186, cookie session khusus, session database disposable, CORS/CSRF nyata. Client memeriksa X-Gate36-Database sebelum melakukan workflow tulis.

Verifikasi akhir database berhasil: satu synthetic user, tiga platform, tiga investment accounts, tiga canonical transactions (dua BUY + satu DIVIDEND), satu portfolio snapshot, empat snapshot items, empat source observations. Schema histori ada di disposable karena schema test lengkap; tidak berarti histori main diterapkan.

PHP server kemudian dihentikan dan dijalankan ulang terhadap **database yang sama**, tanpa prepare ulang. Test mode persistence melakukan login baru, GET accounts, lalu reported holdings; empat items/UNKNOWN coverage tetap ada. Ini persistence nyata lintas request dan restart process, bukan React state atau fixture API mock.

Harness tidak membuat least-privilege DB user baru; memakai koneksi lokal existing dengan target/guard terpisah. Tidak digunakan untuk data pribadi. Tidak ada database test di-drop.

## 4. Hasil pengujian aktual

### Regression

- Backend: **118 tests, 984 assertions PASS**. Semua Gate 1–3 regression dipertahankan; sepuluh tambahan mencakup onboarding, account-source-holdings flow, privacy errors dan unit-review/provider validation.
- Frontend default suite: **85 tests PASS, 1 runtime test sengaja SKIPPED**, 13 passed files + 1 skipped file. Runtime test hanya aktif bila GATE36_DATABASE cocok guard; skip bukan runtime failure yang disembunyikan.
- Real HTTP/MariaDB/PDF.js runtime: **1 opt-in test PASS** pada fresh database; **1 test PASS** pada mode read setelah restart backend. Ini test yang sama dijalankan dalam dua mode, tidak dijumlahkan sebagai dua kasus unik.
- Lint: exit 0, enam warning existing (parser interface/AuthContext/Transactions), tanpa warning baru pada implementasi Gate 3.6.
- Production build: PASS; JS 873,87 kB (gzip 264,97 kB), CSS 36,81 kB (gzip 8,31 kB), PDF worker 2.228,48 kB. Existing chunk >500 kB warning tetap ada.
- Pint scoped PHP: PASS. `git diff --check`: PASS. Dependency manifests/lockfiles dan migration files unchanged.
- Scan production JS tidak menemukan marker synthetic PDF password/private payload/generator yang diperiksa. Test helper tidak menjadi import jalur aplikasi produksi.

PHPUnit memakai guard tidak ada cached config, APP_ENV=testing, DB_CONNECTION=sqlite, DB_DATABASE=:memory:, DB_URL kosong, cache/session array. Tidak menjalankan seluruh backend tests terhadap main/MariaDB. Frontend menggunakan npm.cmd test/lint/build; tidak menginstal dependency.

### Coverage penting

- No account/empty response, account API 405 sebelum fix, create all providers, owner isolation, duplicate retry, label/provider/extra-field rejection.
- Failed account load/retry, no selection, selected valid account, wrong provider, immediate dropdown update, double click prevention.
- Four selected SOA rows → empat items, unchanged semantics/nullable numbers, no synthetic transaction, receipt/replay, repeated holdings GET, URL/remount dan actual backend restart persistence.
- Stockbit TC, BIONS TC dan BIONS CA melalui actual PDF.js text extraction + parser + JSON + HTTP; dividend quantity null/reference quantity terpisah.
- Plain PDF, truly encrypted deterministic PDF, required/wrong/correct password/retry; unsupported encryption dan corrupt PDF safe diagnostics.
- Cancel/replace/unmount clears DOM input; abort discards late result; pending/failed PDF.js task destroyed once.
- Password/private bytes/text markers absent from API JSON; no browser storage writes; API remote target blocked before adapter.
- Synthetic QueryException dengan private bindings/body: response dan log callback tidak memuat marker, termasuk debug=true.

R2/RC4 fixture dibuat di JS test helper secara deterministik. PDF.js nyata membuktikan file encrypted meminta password dan hanya terurai dengan password benar; tidak memakai mock decryption, online unlocker, library tambahan atau private PDF.

Satu regression awal menahan perubahan pesan duplicate transaction 409. Implementasi diperbaiki dengan safe literal allowlist agar kontrak lama tetap tepat; assertion existing tidak dihapus/dilemahkan. Assertion runtime baru diperbaiki mengikuti normalized decimal DTO, bukan mengubah source quantity agar test lulus.

## 5. Runtime integration versus browser E2E

Actual HTTP integration yang berhasil:

Register synthetic user → logout/login → GET empty accounts → Create stockbit/bions/pluang → duplicate account replay → read encrypted PDF with real PDF.js (required/wrong/correct password) → parse four SOA items → reject wrong provider → source import → identical replay → receipt → repeated reported holdings → TC/CA regression → logout. Setelah backend restart, login dan holdings read tetap berhasil.

Frontend account form, password interactions, selection, import dan portfolio navigation/remount diuji component tests. React route delivery juga 200 pada Vite. Ini bukti layer terpisah; **bukan satu browser UI end-to-end run**.

Browser GUI: direct browser connector tidak menyediakan surface; native pipe unavailable. Skill computer-use digunakan untuk inventory/inspeksi dan upaya membuka tab terpisah. Alat menghentikan Computer Use karena current Windows browser URL tidak dapat ditentukan dengan keyakinan cukup untuk enforcement kebijakan. Tidak meneruskan input UI atau menghindari penghentian tersebut.

**Browser functional/visual/network E2E Gate 3.6 belum selesai.** Tidak ada screenshot hasil, packet capture browser, desktop/mobile sign-off atau pengujian PDF asli yang diklaim.

## 6. Panduan review manual sintetis

Environment yang telah terisi dapat dijalankan ulang tanpa prepare/seed. Dari root, terminal backend:

```powershell
$env:GATE36_DATABASE = 'tap_flx_gate36_20261027_b4d81e71'
php tools/gate36-runtime.php inspect
php -S localhost:8026 tools/gate36-runtime.php
```

Dari frontend, terminal lain:

```powershell
$env:VITE_API_URL = 'http://localhost:8026'
npm.cmd run dev -- --host localhost --port 5186 --strictPort
```

Pakai profile browser terpisah, buka localhost:5186/login. Akun sintetis: `gate36-http@example.test` / `Gate36-local-only!`. Ini bukan credentials utama. Untuk memulai dari nol akun di UI, register user sintetis lain di environment ini; tidak ada account otomatis pada register.

File yang dihasilkan lokal, ignored dan tidak diunggah: `.local-backups/gate36/synthetic-statement.pdf` serta `synthetic-statement-encrypted.pdf`. Password fixture: `Local-PDF-only!`. Enkripsi lemah di generator hanya untuk test, bukan rekomendasi keamanan dokumen asli.

Checklist pemilik:

1. Login/new synthetic registration → Document Center, pastikan empty state bila user baru.
2. Create Investment Account, pilih Stockbit dan label sintetis; dropdown langsung memilih akun baru tanpa refresh. Coba duplicate label dan provider lain.
3. Pilih encrypted synthetic statement, Process → password required; coba salah, lalu benar tanpa memilih ulang file; Show/Hide/Cancel/replace juga dicoba.
4. Review empat rows, pilih akun provider salah untuk melihat blokir, lalu kembalikan akun Stockbit. Periksa disabled reasons dan unit/coverage UNKNOWN.
5. Network: sebelum Import Selected tidak ada financial POST. Sesudah klik hanya structured JSON, tanpa PDF bytes/password/raw text/file name; seluruh destination/worker lokal yang diketahui. Jangan memakai PDF pribadi pada tahap ini.
6. Klik Import Selected, periksa receipt/review status, lalu View in My Portfolio. Account/date harus tepat, reported positions empat, bukan ledger trades. Refresh halaman dan pastikan account/date/data terbaca lagi.
7. Reimport identik/retry tidak menambah snapshot/items; periksa source receipt. Tinjau TC/CA sintetis, error/empty/loading states, keyboard/mobile layout dan console/network.

Untuk mereproduksi HTTP test dari database baru: pilih suffix baru yang cocok guard, jalankan prepare pada nama baru saja, jalankan backend dengan nama sama, kemudian dari frontend `$env:GATE36_DATABASE='<nama yang sama>'; npm.cmd test -- src/lib/document-processing/__tests__/Gate36Runtime.test.js`. Jangan menjalankan initial-mode test ulang pada database terisi karena register/empty expectations sengaja menuntut awal baru. Untuk database akhir gunakan GATE36_VERIFY_PERSISTENCE=1 untuk mode read/login, bukan register/import ulang. Semua environment variable tersebut process-local; tidak perlu mengubah `.env` utama.

## 7. Remaining limitations dan security implications

- Browser UI/network QA terblokir; pemilik masih perlu menuntaskan checklist. HTTP/Vitest tidak menggantikan browser render, DevTools, screen reader atau touch.
- Tidak membuka enam PDF asli. Coverage/layout/encryption seluruh provider belum terbukti oleh satu synthetic encryption fixture. PDF scanned/OCR dan certificate encryption tidak ditambahkan.
- Source ambiguity/historical unit repair/same-date snapshot resolution tetap Gate 1–3 limitations. UNKNOWN trade baru REQUIRED; historical records tidak diperbaiki otomatis.
- Audit/observation/history mengandung financial JSON setelah confirmed import; password support tidak membuat persistence anonim/encrypted-at-rest atau menjamin memory erasure.
- Protection API error log diuji pada application handler, bukan seluruh PHP/webserver/DB logs, extensions, OS ataupun third-party logging yang mungkin ditambahkan nanti. API origin guard localhost bukan pengganti network isolation.
- Main debug config/Apache exposure, backup/restore terverifikasi, private DB least privilege/storage/retention dan browser network proof masih perlu ditinjau sebelum real-data import. Jangan memakai database demo Gate 3.5/3.6 untuk dokumen asli.
- Tidak ada multi-worker concurrent-create/import benchmark atau production load/recovery testing. Account duplicate serialization dijaga API user lock dan source import existing locks; tidak mengklaim seluruh external writers taat aturan tersebut.
- Gate 3.5 tetap BLOCKED. Migration histori utama tetap manual/pending; Gate 3.6 tidak membutuhkan migration baru dan tidak menjadi izin mengeksekusi migration main atau Gate 4.

## 8. File perubahan Gate 3.6

Backend existing: InvestmentAccountController, SourceImportController, SourceImporter, bootstrap/app.php, routes/api.php, SourceIntegrityTest. Backend baru: `tests/Feature/InvestmentAccountOnboardingTest.php`, `DocumentOnboardingFlowTest.php`, `PrivateApiErrorsTest.php`.

Frontend existing: api/axios.js, PdfExtractor.js, DocumentProcessing.jsx, PortfolioHoldings.jsx, WorkspaceContext.jsx, workspace.css dan Holdings.test.jsx. Frontend baru: api/privacyOrigin.js, ui/InvestmentAccountForm.jsx, serta document-processing tests `DocumentCompletion.test.jsx`, `EncryptedPdf.test.js`, `PdfLifecycle.test.js`, `PrivacyOrigin.test.js`, `Gate36Runtime.test.js`, helper `syntheticPdf.js`.

Tools: baru `tools/gate36-runtime.php`; readiness exact-path allowlist menambahkan harness ini, tanpa mengizinkan arbitrary PHP tools atau melemahkan secret/PDF/history scans. Dokumentasi baru: spesifikasi Gate 3.6 dan laporan ini.

Tidak ada file dihapus, dependency/migration baru, config .env atau remote/identity Git diubah. Perubahan Gate 3.5 dan review terdahulu yang belum committed masih termasuk kandidat manual staging workspace.

## 9. Readiness dan handoff

Read-only `node tools/check-commit-readiness.mjs` setelah dokumentasi menghasilkan **READY FOR MANUAL COMMIT**, exit 0/problems kosong: 235 kandidat (216 tracked + 19 untracked), 232 text files dipindai, enam PDF asli tetap ignored, nol penghapusan/nol unpushed commits; remote main `5f6371d01c92c2d6731946ed8b72c288162ab90d`. Dua PDF sintetis lokal di folder ignored juga tidak termasuk kandidat. Verifikasi jaringan sandbox awal terhalang remote, pengulangan read-only yang diizinkan berhasil. Pemeriksaan penutup diulang setelah pencatatan hasil ini. READY FOR MANUAL COMMIT hanya menyatakan source/candidate checks lulus, bukan browser E2E, private-data sign-off atau deployment.

Tidak ada git add, commit, push, fetch, merge/reset/rebase/switch/checkout/stash/clean/tag, perubahan remote/identity/history atau AI co-author oleh Agent.

Rekomendasi commit message: `feat: complete investment account onboarding and local encrypted PDF imports`.
