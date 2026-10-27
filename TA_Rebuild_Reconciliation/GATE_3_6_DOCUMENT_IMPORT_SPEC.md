# Gate 3.6 — Document Import Completion & Encrypted PDF Support

Tanggal: 27 Oktober 2026, Asia/Makassar. Scope: onboarding investment account, penyelesaian alur impor, local PDF password handling, dan privacy hardening terkait. Tidak membuka news, DQ Index, explainable expansion, Gmail/n8n, market data atau P/L.

## 1. Masalah yang dibuktikan

Pemeriksaan agregat read-only pada konfigurasi `myportfolio`: dua users, **nol investment_accounts, nol platforms**, nol orphan account. Tidak ada identitas/nilai investasi yang dibaca atau dicetak. Dengan tabel akun kosong, tidak ada akun yang dapat dimiliki/dikembalikan untuk user mana pun. Ini menolak hipotesis akun existing hanya salah terhubung ke user untuk state database yang diperiksa.

Reproduksi sintetis sebelum perbaikan: GET `/api/investment-accounts` untuk user tanpa akun menghasilkan 200 `{data:[]}`; POST pembuatan akun menghasilkan **405** karena route belum ada. UI awal hanya memuat daftar akun dan tidak menyediakan onboarding. Disabled condition `!selectedAccountId` membuat Import Selected tidak aktif walaupun empat baris parsing dipilih. Parser/selected rows bukan akar dropdown kosong.

Tidak mengklaim telah merekam response browser sesi utama: bukti main berupa aggregate SELECT, lalu behavior API/UI direproduksi pada synthetic tests. Error load/auth tetap kemungkinan umum bagi lingkungan lain dan kini diberi state/retry terpisah.

## 2. Kontrak pembuatan akun

POST `/api/investment-accounts`, auth:sanctum, cookie/session/CSRF existing. Body hanya:

```json
{"provider":"stockbit","account_name":"Portofolio pribadi"}
```

- Provider whitelist lowercase: stockbit, bions, pluang.
- Label maksimal 80 karakter, minimal satu huruf; Unicode letters/marks/numbers, spasi dan punctuation terbatas. Control/newline/HTML tidak diterima; trim dan multiple spaces dinormalisasi.
- Tidak menerima user_id, platform_id, account_identifier, RDN/SID, email connection atau metadata bebas. Actor/owner selalu dari authenticated user.
- Saat user secara eksplisit membuat akun, server mencari/membuat reference platform resmi yang dipilih; tidak memerlukan seeder, akun demo atau migration. Tidak ada akun dibuat pada login/GET/preview PDF.
- User row dikunci dalam transaksi untuk serialize onboarding pada API ini. Same owner + same provider + label setelah normalisasi/lowercase → existing account, HTTP 200/already_exists=true. Akun baru → 201/already_exists=false. Label sama pada owner/provider berbeda boleh menjadi akun berbeda.
- Respons data sama dengan list: id, account_name, platform_code, platform_name; private/no-store. Bad fields/provider/label → 422; unauthenticated → 401.

Duplicate protection di level service/user lock, bukan constraint schema baru. Tidak menjamin seluruh jalur manual SQL/seeder lain memakai aturan yang sama; tidak mengklaim multi-worker race sudah dibenchmark.

## 3. UX Document Center

Urutan: Select/Create Investment Account → pilih PDF → Unlock bila perlu → Process → Review → Import Selected → receipt → View in My Portfolio.

- Loading/error/empty accounts dibedakan; gagal memuat menyediakan Muat ulang akun, bukan terlihat seperti tidak ada akun tanpa penjelasan.
- Create Investment Account menggunakan provider + label tanpa informasi rekening. Setelah API sukses, local list langsung ditambah/dedup, akun dipilih, dan resource accounts workspace dimuat ulang. Tidak perlu refresh halaman.
- Disabled reason menjelaskan akun belum tersedia/belum dipilih, daftar gagal dimuat, document belum diproses, row belum dipilih, dan provider mismatch.
- Provider detection tidak diubah untuk menyesuaikan akun. Mismatch Stockbit/BIONS/Pluang menahan tombol dan handler; backend memvalidasi provider akun lagi.
- Synchronous in-flight refs menahan double click create/import; retry import mempertahankan key selama selection/account/unit/document tidak berubah. Source idempotency/account lock tetap authoritative.
- SOA receipt menampilkan View in My Portfolio dengan account/as_of query. Portfolio menerima hanya account dari list milik user; account/date dipulihkan melalui URL ketika refresh. Tidak mengonfirmasi snapshot/baseline otomatis.

Tidak melakukan redesign total, tidak membuat broker/email account otomatis, dan tidak menambahkan provider baru.

## 4. Snapshot, transaksi dan review semantics

SOA tetap: local PDF → parser/normalizer → snapshot preview → allowlisted JSON → source import → snapshot/items → reported holdings. Empat selected valid positions membuat empat items; tidak ada BUY/SELL dari Monthly Statement.

Exact source decimal strings dipertahankan oleh builder existing, null tetap null, quantity/unit/currency/as-of/average price/market price/value tidak diubah untuk menutup gap. LOT/SHARE/COIN tidak dikonversi. Semua parsed rows dipilih tetap UNKNOWN; subset PARTIAL; review REQUIRED sampai konfirmasi terpisah Gate 2. Source hash/batch/account tetap terpisah.

TC Stockbit/BIONS dan CA BIONS tetap canonical event paths yang didukung. Provider mismatch ditolak server. Stock trade unit COIN ditolak; unit UNKNOWN pada trade baru dapat disimpan sebagai canonical record **REQUIRED review**, bukan accepted/CONFIRMED event. Observation juga REQUIRED; tidak dihitung oleh holdings. Ini menjaga data ambigu untuk review tanpa memalsukan unit. Tidak memperbaiki historical UNKNOWN rows otomatis.

Receipt baru menyertakan review_status untuk memperjelas CREATED tidak sama dengan CONFIRMED. Source replay tidak membuat snapshot/ledger ganda. Cash dividend menyimpan reference_quantity, dengan quantity/price event null dan tidak menambah saham. Total/reference ambigu tetap mengikuti validation/duplicate review Gate 1.

## 5. Password workflow dan resource lifecycle

PDF.js terpasang digunakan dengan API resmi `getDocument({data, password})` pada setiap percobaan. Ini alternatif yang didukung terhadap onPassword callback. [PDF.js DocumentInitParameters](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), [loading task/destroy](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentLoadingTask.html).

- Percobaan awal tanpa password → typed PASSWORD_REQUIRED jika diminta library; input lokal type=password ditampilkan.
- Show/Hide mengubah tipe input; Unlock & Process memakai password pada PDF.js browser saja. Tidak trim password, tidak mengubah spasi yang sah.
- Password salah → INCORRECT_PASSWORD dan input kosong; file tetap tersedia untuk retry. Tidak ada fallback online/server unlock.
- Unsupported encryption, corrupt PDF dan general extraction failure dibedakan dengan safe codes/messages. Raw library exception message/cause tidak diteruskan ke UI/log.
- Password bukan React persisted state: uncontrolled input/ref, local extraction options, lalu input/ref dikosongkan ketika attempt dimulai, cancel, file diganti, selesai/gagal, atau unmount. Referensi task tidak disimpan pada backend/storage/browser persistent storage.
- AbortController + request sequence membatalkan task dan menolak hasil scope lama. Loading task di-destroy melalui satu shared promise pada success/failure/abort; onPassword callback dilepas.
- File arrayBuffer dan SHA-256 tetap lokal; byte buffer dibaca ulang untuk retry karena PDF.js dapat mengambil ownership buffer worker. File asli tidak diubah.
- Tidak mengklaim secure zeroization RAM JavaScript, pagefile atau browser tooling.

Fixture enkripsi sungguhan dibuat deterministik dengan Standard Security Handler R2/RC4 di test helper. Ini cipher lama **khusus fixture interoperability**, bukan rekomendasi perlindungan PDF asli. Uji ini tidak membuktikan semua variasi AES/certificate encryption, malformed PDF, scanned PDF atau layout provider didukung. Fitur OCR tidak ditambahkan.

## 6. Privacy/error hardening

Builder dan endpoint source tetap tidak menerima PDF bytes/password/raw extracted text/file name sebagai payload. API/json persistence finansial setelah konfirmasi tetap berlaku seperti Gate 1, bukan anonymous/local-memory-only portfolio.

Scope error protection: `/api/*`, login, register, logout. Unexpected exceptions dirender sebagai JSON generik sesuai status; SQL bindings/messages/traces tidak dikirim. Reporting callback mencatat fixed message + exception class saja lalu menghentikan default exception report, tanpa request body/exception instance/SQL. Validation field errors tetap dipertahankan; duplicate transaction public message lama dipertahankan melalui exact-text allowlist. Tested dengan synthetic QueryException/private markers bahkan ketika app.debug=true.

Axios menolak tujuan non-HTTP, URL credentials, serta non-loopback API dari frontend loopback sebelum adapter dipanggil. Ini mencegah kesalahan konfigurasi VITE_API_URL pada workflow localhost. Bukan egress firewall, DNS/security audit, atau izin mengirim private portfolio ke remote service. Deployment non-loopback masih membutuhkan origin policy tersendiri. Tidak ada API key/third-party service baru.

Environment sintetis Gate 3.6 memaksa app.debug=false dan database/session/CORS terisolasi. Konfigurasi main `.env`, Apache listeners, remote logging/server plugins dan backup/recovery tidak diubah. Perlindungan aplikasi tidak menyelesaikan seluruh syarat private real-data test. Gate 3.5 tetap BLOCKED.

## 7. Database dan runtime isolation

Tidak ada migration aplikasi baru atau dependency baru. Onboarding memakai tabel existing. Main hanya aggregate SELECT dalam transaksi read-only, tidak ada seed/account/demo import/DDL oleh Agent.

`tools/gate36-runtime.php` memerlukan nama `tap_flx_gate36_20261027_<8 hex>`, host DB lokal, DB_URL kosong dan uncached config. prepare menolak database existing; membuat schema baru lalu menjalankan existing migration `up()` pada disposable saja, tanpa seeder/users/accounts/platforms. Sesudah guard SELECT DATABASE(), seluruh configured connection diganti satu koneksi gate36; tidak ada fallback main. HTTP memakai kernel/session/CSRF nyata, cookie khusus, CORS localhost:5186 dan server localhost:8026. Header X-Gate36-Database diverifikasi client sebelum flow tulis.

Harness ini hanya untuk data sintetis. Tidak digunakan untuk PDF asli atau untuk mengatasi guard database demo Gate 3.5. Tidak ada database dihapus/reset/drop.

## 8. Exit criteria dan batas sign-off

Automated coverage: empty list/create ownership/provider/label replay; blocked selection/mismatch; multiple snapshot items, null/precision, receipt/replay; My Portfolio URL/remount; actual encrypted correct/wrong/retry/plain/corrupt/unsupported; cancel/replace/unmount/task destroy; no secret/raw JSON; API origin/error redaction; Gate 1–3 regression. Hasil aktual tersedia pada [implementation report](GATE_3_6_IMPLEMENTATION_REPORT.md).

Actual HTTP + PDF.js + MariaDB dan restart persistence berbeda dari browser UI E2E. Computer Use tidak menyelesaikan browser interaction; manual login/create/select/parse/password/import/portfolio/reload masih perlu dilakukan pada environment sintetis oleh pemilik. Tidak menandai desktop/mobile/network capture selesai.

Source dapat READY FOR MANUAL COMMIT ketika readiness lulus, tetapi bukan READY FOR DEPLOYMENT/private import. Backup/restore utama, browser functional/network QA dan persyaratan migration manual Gate 3.5 tetap harus dipenuhi. Tidak memulai gate berikutnya otomatis.
