# Automatic Mode — Local Setup Guide

Tanggal: 29 Oktober 2026. Semua langkah konfigurasi/consent/migration di panduan ini dilakukan **pemilik secara manual**, bukan telah dijalankan Agent. Jangan menempelkan secret/token/password/isi email/PDF asli ke chat atau Git. Awali demonstrasi dengan dokumen sintetis.

**Status saat disusun: live Gmail+n8n dan browser QA BLOCKED.** Google OAuth/n8n belum dikonfigurasi. Gate 3.5/main migration tetap BLOCKED karena backup/restore utama dan browser QA belum terverifikasi.

## 1. Pilih environment yang benar

Ada dua jalur berbeda:

- **Demo sintetis offline**: tools/gate15-runtime.php memaksa database disposable dan mengganti HTTP Google dengan fake. Cocok mengulang pengujian internal, tidak boleh dipakai untuk membuktikan koneksi Gmail nyata atau menerima data pribadi.
- **Demo Gmail nyata**: Laravel normal pada database demo baru dengan konfigurasi Google sendiri; tanpa router/fake Gate 1.5. Gmail uji hanya diberi dokumen sintetis berlabel. Ini jalur yang belum dijalankan.

Gunakan browser InPrivate/profile terpisah dari myportfolio. Cookie XSRF pada hostname sama dapat bertabrakan antar port walaupun session cookie berbeda. Jangan menjalankan kedua UI dalam profil browser yang sama saat membuktikan isolasi. Gunakan localhost secara konsisten; server komputer ini tersedia pada ::1, bukan port IPv4 yang sama.

## 2. Mengulang demo internal yang sudah diuji

Database final tersedia: tap_flx_gate15_20261029_e8ac12fa. Dari root:

```powershell
$env:GATE15_DATABASE = 'tap_flx_gate15_20261029_e8ac12fa'
php tools/gate15-runtime.php inspect
php -S localhost:8035 tools/gate15-runtime.php
```

Terminal lain, dari frontend:

```powershell
$env:VITE_API_URL = 'http://localhost:8035'
npm.cmd run dev -- --host localhost --port 5195 --strictPort
```

Buka http://localhost:5195. Akun demo sintetis gate15-http@example.test / Gate15-local-only! hanya berlaku pada database disposable tersebut. Jangan mengekspos harness/akun ini ke LAN/internet. Pada akhir validasi koneksi fake sudah disconnected dan akun kembali Privacy Mode; buat koneksi melalui UI hanya jika ingin mengulang simulasi. Browser GUI belum diverifikasi.

Untuk verifikasi persistence setelah restart, root terminal terpisah:

```powershell
$env:GATE15_DATABASE = 'tap_flx_gate15_20261029_e8ac12fa'
$env:GATE15_VERIFY_PERSISTENCE = '1'
node tools/gate15-http-smoke.mjs
php tools/gate15-runtime.php constraints
```

Full smoke adalah skenario sekali pada database baru; tidak rerun full register pada database existing. Untuk ulangan penuh, pilih suffix hex baru sesuai guard tap_flx_gate15_20261029_<8 lowercase hex>, jalankan prepare, jalankan server dengan nama sama, kemudian smoke tanpa GATE15_VERIFY_PERSISTENCE. Prepare menolak database existing dan tidak memakai Artisan migrate. Tidak menghapus database lama otomatis. Mailbox PDF sintetis yang dibuat smoke ada di .local-backups ignored.

## 3. Persiapan Laravel normal untuk live Gmail

1. Hentikan server uji pada 8035/5195 sebelum memakai port sama untuk jalur live. Jangan memakai router Gate 1.5. Buka terminal baru agar variabel GATE15/GATE36 tidak terbawa.
2. Pemilik membuat database baru, misalnya tap_flx_automatic_demo, dengan user DB yang hanya mempunyai akses database demo. Jangan menyalin data finansial utama. Siapkan konfigurasi lokal ignored backend/.env.automatic-demo dari template .env.example dan resources/automatic/laravel.env.example. Jangan menimpa backend/.env utama.
3. Isi APP_ENV=automatic-demo, APP_DEBUG=false, APP_URL=http://localhost:8035, FRONTEND_URL=http://localhost:5195, SANCTUM_STATEFUL_DOMAINS=localhost:5195,localhost:8035. SESSION_COOKIE=tap_flx_automatic_demo_session, SESSION_DOMAIN=localhost, SESSION_SECURE_COOKIE=false, SESSION_SAME_SITE=lax, DB_CONNECTION=mysql, DB_DATABASE=tap_flx_automatic_demo serta host/port/user/password demo. Gunakan SESSION_DRIVER=database, CACHE_STORE=array dan MAIL_MAILER=array untuk demo lokal. Jangan memakai DB_URL yang mengalahkan DB_DATABASE.
4. Pastikan config cache tidak ada; jika cache aktif, berhenti dan review konfigurasi efektif sebelum mengirim SQL. Jangan menebak koneksi dari nama file env. Environment variables terminal dapat mengalahkan file; periksa DB_DATABASE/DB_URL yang diwariskan.
5. Set APP_ENV di proses terminal backend agar child server juga memilih file yang sama. Pemilik dapat membuat APP_KEY khusus file demo, kemudian memverifikasi koneksi sebelum migration:

```powershell
$env:APP_ENV = 'automatic-demo'
php artisan key:generate --env=automatic-demo
php artisan tinker --env=automatic-demo
```

Di tinker, periksa hanya config database default dan SELECT DATABASE()/VERSION(); hasil wajib database demo, bukan myportfolio. Keluar. Simpan APP_KEY demo secara privat untuk restart; key hilang berarti tokens/draft tidak dapat didekripsi. Jangan mencetak key ke laporan.

6. **Hanya setelah pemilik memverifikasi database demo baru**, jalankan migration normal seluruh fondasi pada demo dan start Laravel:

```powershell
php artisan migrate --env=automatic-demo --database=mysql
php artisan serve --env=automatic-demo --host=localhost --port=8035
```

Perintah ini bukan instruksi menerapkan migration utama. Agent tidak menjalankannya. Jangan menjalankan migrate:fresh/reset/rollback/wipe. Gunakan identity database dan cookie demo sebagai syarat sebelum setiap smoke.

7. Frontend terminal baru: set VITE_API_URL=http://localhost:8035 lalu start Vite localhost:5195 --strictPort. Register user sintetis, create Investment Account melalui Document Center, tanpa nomor rekening/RDN/SID. Belum menggunakan PDF nyata.

## 4. Konfigurasi Google milik pemilik

1. Di Google Cloud project pengujian, aktifkan Gmail API. Buat OAuth consent konfigurasi Testing dan tambahkan akun Gmail uji sebagai test user. Isi informasi aplikasi/privacy yang diwajibkan Google. Semua tindakan persetujuan/credential dilakukan pemilik.
2. Buat OAuth client tipe Web application. Authorized redirect URI harus tepat: http://localhost:8035/automatic/gmail/callback. Authorized JavaScript origin, bila diminta, http://localhost:5195; pertukaran token tetap di backend.
3. Simpan GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET hanya pada env demo backend. GOOGLE_REDIRECT_URI memakai callback di atas, AUTOMATIC_FRONTEND_URL=http://localhost:5195/connections, AUTOMATIC_ENABLED=true. Restart proses backend setelah mengubah konfigurasi. Tidak ada secret dalam VITE_*.
4. Scope hanya https://www.googleapis.com/auth/gmail.readonly. Scope tersebut restricted; testing pribadi bukan persetujuan rilis publik. Review persyaratan verification/security assessment sebelum distribusi. [Google Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes).
5. External app dengan status Testing dan Gmail scope umumnya memperoleh refresh token yang berakhir setelah tujuh hari; reconnect dapat diperlukan. Revocation, perubahan password atau kebijakan akun juga dapat mengakhiri grant. [Google refresh-token expiration](https://developers.google.com/identity/protocols/oauth2).
6. Buat label Gmail TAP_FLX_IMPORT. Pilih email berlampiran PDF sintetis yang sudah tersedia di mailbox uji dan beri label secara manual. Agent tidak mengirim email. Jangan memberi label seluruh inbox atau menggunakan email finansial asli pada acceptance pertama.
7. Isi exact sender address untuk provider yang akan diuji pada AUTOMATIC_BIONS_SENDERS / AUTOMATIC_STOCKBIT_SENDERS / AUTOMATIC_PLUANG_SENDERS. Comma-separated, tanpa display name atau wildcard; kosong menahan ingestion. Untuk demo sintetis, alamat pengirim uji dapat dimasukkan secara sadar, tanpa menyatakan ia pengirim broker autentik.
8. Login app demo, buka Connections → Connect Gmail → pemilik menyelesaikan consent Google → kembali dengan status CONNECTED. Pastikan email koneksi sesuai. Hubungkan Gmail lain bila dibutuhkan; pilih koneksi per investment account, set consent pemrosesan server, aktifkan Automatic. Jangan memasukkan password Gmail ke aplikasi.

Jika callback gagal, periksa exact URI, session hostname/profile yang sama, batas expiry state, test-user consent dan izin scope. Jangan menonaktifkan state/PKCE/CSRF. Jangan merekam query callback/code di screenshot publik atau access logs yang dibagikan. Konfigurasi webserver/proxy untuk menghilangkan query string dan request bodies dari access/diagnostic logging, lalu audit sebelum private-data testing.

## 5. n8n lokal

Belum ada n8n berjalan saat audit. Pasang versi resmi yang ditinjau pemilik, catat/pin versinya, dan simpan data/config n8n di luar repository. Panduan ini tidak mengklaim workflow lintas semua versi n8n sudah diuji. Gunakan instalasi native lokal untuk MVP; Docker/proxy membutuhkan review alamat asal dan routing tersendiri.

1. Terapkan resources/automatic/n8n.env.example ke environment proses n8n. File .env saja belum tentu otomatis dibaca oleh cara start yang dipilih; periksa dokumentasi instalasi. Set N8N_LISTEN_ADDRESS=127.0.0.1, gunakan UI lokal port5678 dan owner authentication. Jangan membuka tunnel/LAN.
2. Generate secret acak berbeda untuk N8N_ENCRYPTION_KEY dan AUTOMATIC_ORCHESTRATOR_SECRET di komputer sendiri, misalnya output lokal php -r 'echo bin2hex(random_bytes(32));'. Jangan memasukkan nilai itu ke Git/chat. Simpan encryption key n8n bersama backup privat agar credentials dapat dipulihkan. Orchestrator secret yang sama hanya dipasang pada backend demo dan n8n Header Auth credential.
3. Import backend/resources/automatic/n8n-workflow.json. Workflow inactive, tidak mempunyai credentials/pinned data. Pada kedua HTTP Request nodes pilih Generic Credential → Header Auth; name Authorization, value Bearer diikuti secret backend. Jangan menaruh secret sebagai literal node parameter/expression.
4. Periksa URL kedua nodes hanya localhost:8035. Workflow: schedule lima menit → list job UUID → normalize items → POST sync. n8n tidak memegang OAuth Gmail; Google credentials node tidak diperlukan.
5. Pastikan setting Save successful/failed executions = none, save progress=false dan save manual executions=false. Template env juga mematikan retensi data success/error/progress/manual dan menyalakan pruning. Verifikasi setting efektif UI/versi n8n; jangan mengandalkan nama env semata. Hapus pinned/test data bila dibuat sendiri. [n8n execution settings](https://docs.n8n.io/hosting/configuration/environment-variables/executions/), [n8n manual-execution guidance](https://support.n8n.io/article/optimizing-and-debugging-large-workflows-in-n8n-s4a4a93ogxsxtyta34z3br80).
6. Uji workflow secara manual sebelum mengaktifkan schedule. Output hanya UUID/status/count/coverage; tidak boleh ada email/PDF/password/tokens/financial JSON. 403 berarti secret/source IP tidak sesuai; jangan membuka allowlist ke semua IP sebagai solusi. Privacy Mode/connection disconnect memang menghasilkan sync paused.

Bearer secret adalah credential ingestion lintas akun aktif, bukan sekadar label demo. Rotasi jika pernah bocor. Tidak perlu menambahkan Gmail body/PDF nodes ke n8n. Retensi none tidak menjamin editor RAM, reverse-proxy log atau backup lama tidak memegang data; audit lingkungan sebelum menggunakan data asli.

## 6. Checklist acceptance live + browser

- Login/register/logout, refresh protected page; setelah session tidak valid, kembali ke login. Network GET accounts harus 200 owned list setelah login; jangan mengartikan 401/419/500 sebagai array kosong.
- Create Stockbit/BIONS/Pluang dengan label biasa; akun langsung terpilih di Document Center tanpa refresh. Uji provider mismatch ditahan. Preview Privacy Mode: tidak ada PDF/password/raw text dalam request; structured JSON baru dikirim setelah Import Selected.
- Jalankan satu workflow n8n untuk email PDF sintetis berlabel → review queue muncul pada akun/provider tepat. READY_FOR_REVIEW belum menulis ledger/snapshot. Preview seluruh field, lalu confirm/import → receipt. Buka My Portfolio/Transactions, full refresh, logout/login; data tetap ada.
- PDF terenkripsi: PASSWORD_REQUIRED → salah → WRONG_PASSWORD → benar → preview. Network Automatic password hanya direct POST unlock ke backend lokal, bukan URL/n8n/analytics; jangan menyimpan HAR yang mengandung password. Privacy Mode password tetap lokal tanpa unlock POST.
- Ulangi sync dan confirm; receipt/replayed konsisten, jumlah canonical tidak bertambah. Import byte PDF yang sama melalui Privacy Mode tidak menambah posisi/trade baru. Data ambigu tetap pending, bukan diakali dengan unit/nominal fiktif.
- Toggle Privacy saat sync/pending review: tidak ada import baru, riwayat tetap; review lama perlu reprocess setelah epoch berubah. Disconnect → akses lokal berhenti; jika revocation_confirmed=false, pemilik mencabut izin di Google Account. Test reconnect dan Gmail kedua milik user yang sama.
- User kedua tidak melihat accounts/connections/queue/receipt user pertama. Query route dan IDs berbeda tidak membuka payload.
- Desktop 1440×1000/1280×800, mobile 390×844/320px, zoom200%: navigasi, consent, select Gmail/account, password field, overflow table, focus keyboard, retry/error/loading/disabled state. Periksa console dan request origin/CORS/CSRF. Entry HTTP200 dan component tests tidak menggantikan checklist ini.
- Catat versi n8n/browser/Node/PHP/MariaDB, nama database demo, skenario, pass/fail, receipt UUID sintetis dan counts sebelum/sesudah. Screenshot/Network evidence harus disanitasi; jangan menyertakan email nyata, token, cookie, password atau financial rows pribadi.

Jika syarat ini belum terpenuhi, status live demo tetap BLOCKED. Jangan mengganti fakta ini dengan label E2E passed dari PHPUnit.

## 7. Backup/restore dan migration utama: hold

Sebelum pertimbangan main: hentikan writers secara terencana, periksa engine tabel, buat logical backup ke direktori privat di luar repository dengan tool dump MariaDB yang sesuai, password melalui prompt/credential file privat dan --result-file (hindari redirection encoding PowerShell). Catat checksum serta keberhasilan dump. Restore ke instance/database terisolasi dengan hak akses terbatasi; jangan menguji restore di myportfolio. Untuk dump routines/events, pastikan target restore tidak dapat menjalankan event atau referensi terkwalifikasi yang menulis ke utama. Bandingkan schema/counts/constraints dan lakukan read-only application verification pada salinan. File dump saja bukan bukti restore.

Ikuti pula prosedur backup/restore dan manual history migration pada GATE_3_5_RUNTIME_VALIDATION_REPORT.md. Backup utama belum dibuat/diuji oleh Agent. Jangan menjalankan main migration sebelum prasyarat dan review pemilik selesai.

Rekomendasi **nanti, pemilik saja**, setelah memastikan koneksi efektif mysql memang myportfolio, backup restore lulus dan review UI/security selesai:

```powershell
php artisan migrate --database=mysql --path=database/migrations/2026_10_29_000001_add_automatic_ingestion.php --pretend
php artisan migrate --database=mysql --path=database/migrations/2026_10_29_000001_add_automatic_ingestion.php
php artisan migrate:status --database=mysql
```

Migration Gate 3 history masih pending dan ditinjau/dijalankan terpisah menurut laporannya; jangan memakai perintah migrate tanpa path pada utama untuk mengaplikasikan semua pending secara tak sengaja. MariaDB DDL tidak diasumsikan transactional; partial failure memerlukan reviewed forward fix/restore, bukan destructive down/reset.

Tidak ada git add/commit/push yang dijalankan Agent. Gunakan read-only readiness setelah review; commit/push hanya oleh pemilik setelah menerima seluruh batas hasil pengujian.
