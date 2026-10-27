# Privacy Mode — Real Data Test Plan & Technical Audit

Tanggal: 27 Oktober 2026, Asia/Makassar. Review kode/configuration, bukan sertifikasi keamanan atau hasil browser Network QA.

**Keputusan: preview lokal hanya layak diuji secara bertahap setelah prasyarat lingkungan dipenuhi; impor PDF asli belum mendapat sign-off keamanan. Gate 3.5 tetap BLOCKED.** Tidak ada enam PDF asli dibuka, tidak ada data pribadi disalin, dan tidak ada migration/provisioning/import pada database utama maupun database pribadi dilakukan dalam review ini.

## 1. Bukti dan batas pemeriksaan

Diperiksa: React Document Center, seluruh enam parser yang diregistrasikan, PDF.js extractor/layout/normalizer, pembentukan JSON, axios/auth, source/legacy API, validators/writer/audit/persistence, migrations, logging/session/filesystem/configuration, manifest, serta laporan Gate 1–3.5. Lima konteks root lama tidak dibaca.

Konfigurasi backend dibaca melalui bootstrap Laravel tanpa koneksi/query database dan tanpa mencetak secrets. Pemeriksaan port hanya membaca metadata listener; percobaan sandbox mengalami CimException, lalu inspeksi read-only yang diizinkan berhasil. Tidak membaca isi log/row finansial/database dump, tidak membuka browser berisi dokumen pribadi, tidak menjalankan capture privat.

Uji sintetis terarah yang benar-benar dijalankan:

```text
npm.cmd test -- src/lib/document-processing/__tests__/DocumentImport.test.jsx src/lib/document-processing/__tests__/SourceIntegrity.test.js src/lib/document-processing/__tests__/PdfPipeline.test.js
21 tests / 3 files PASS
```

Tests memeriksa explicit import click, allowlist JSON, marker raw/file-name yang tidak diteruskan, serta PDF.js dengan PDF bytes sintetis di memori. Component mocks dan synthetic PDF bukan bukti browser nyata bebas semua kebocoran. Angka regresi penuh pada laporan Gate 3.5 adalah bukti gate sebelumnya, tidak diklaim dijalankan ulang pada review dokumentasi ini.

## 2. Apakah PDF bytes tetap di browser?

**Pada jalur Document Center yang diperiksa: ya menurut kode.** [PdfExtractor.js](../frontend/src/lib/document-processing/PdfExtractor.js) membaca File.arrayBuffer(), menghitung SHA-256 dengan Web Crypto, lalu memanggil PDF.js getDocument({data: arrayBuffer}). Worker diimpor sebagai asset Vite lokal, bukan CDN. Worker menerima data dalam lingkungan browser; perpindahan ke worker bukan upload HTTP.

Tidak ditemukan File/FormData/base64 PDF dikirim oleh handler pemrosesan, tidak ada endpoint raw-PDF upload atau parser server PDF pada routes aplikasi yang diperiksa. [DocumentProcessing.jsx](../frontend/src/pages/DocumentProcessing.jsx) memanggil POST hanya pada handleImport setelah klik Import Selected. Pemilihan file dan Process Document tidak memanggil POST. Ada request auth/accounts saat halaman dimuat; jangan menyimpulkan semua jaringan harus nol.

File tetap direferensikan React state selama komponen hidup; text hasil ekstraksi adalah variabel lokal, normalized preview disimpan di state. Loading task PDF.js di-destroy pada finally, tetapi tidak ada jaminan secure memory erasure. Menutup tab/unmount melepaskan referensi untuk garbage collection, bukan penghapusan forensik RAM/pagefile. File asli di disk tidak diubah/dihapus aplikasi.

## 3. Apakah PDF password tetap di browser?

**Belum ada workflow input password PDF.** Extractor tidak memberikan password/onPassword ke PDF.js; PasswordException ditampilkan sebagai PasswordProtected. Ini fitur belum didukung, bukan bukti sebuah password flow sudah aman diuji. Password login adalah hal berbeda: dikirim ke Laravel lokal untuk autentikasi, dan model User memakai hashed cast.

Jika statement terenkripsi, berhenti pada error. Jangan memasukkan password PDF ke form login, URL, JSON, console, chat atau layanan unlock online. Pemilik dapat menyiapkan salinan tanpa password dengan alat lokal yang dipercaya, di folder privat di luar repo, dengan menyadari salinan kehilangan perlindungan password. Dukungan password dalam aplikasi harus melalui tugas/approval terpisah.

## 4. Apakah raw extracted text dikirim?

**Tidak pada flow UI yang diperiksa.** Text dipakai oleh ProviderDetection/parser/normalizer/ValidationAndConfidence secara lokal. Builder [SourceContract.js](../frontend/src/lib/document-processing/SourceContract.js) memilih field eksplisit, bukan menyebarkan seluruh hasil parser. [SourceImportController.php](../backend/app/Http/Controllers/SourceImportController.php) menolak root/nested source fields di luar kontrak.

Boundary ini tidak sama dengan data-loss prevention universal. Nilai text di field yang diizinkan tetap perlu ditinjau, parser dapat salah mengenali field, dan client lain dapat mengirim request berbeda. Unknown root pada legacy CRUD/bulk umumnya disaring validator, bukan selalu ditolak sebelum body mencapai server. Jangan memakai legacy API sebagai cara mengunggah raw data. Tidak ada janji semua request arbitrer ke localhost akan ditolak sebelum diterima HTTP server.

## 5. JSON yang dikirim setelah konfirmasi

POST `/api/source-imports`, Content-Type application/json, dengan cookie session/XSRF dan auth terkait. Nama/header token juga sensitif; sanitasi capture tidak cukup memeriksa body saja.

Root yang dibuat UI:

- schema_version=`integrity-v1`, investment_account_id berupa ID internal, idempotency_key UUID retry, confirmed=true.
- source: provider, source_type=`PDF`, document_type, document_hash SHA-256 seluruh bytes, parser_version.
- transactions: array, kosong untuk statement snapshot; snapshot hanya untuk SOA.

Snapshot saat ini: as_of_date; coverage UNKNOWN bila semua parsed rows dipilih atau PARTIAL bila subset; coverage_confirmed=false; parsed_item_count jumlah parsed preview; items[] berisi symbol, quantity, average_price, market_price, market_value, currency, unit (default UNKNOWN). Angka dikirim sebagai string exact_values bila tersedia; null tetap null. Backend juga menerima optional period_start/period_end, tetapi builder UI saat ini tidak mengirimnya.

TC/CA transaction items: transaction_date, date_precision, type, symbol, unit, quantity, reference_quantity, price, total_amount, currency, fee_amount, tax_amount, gross_amount, net_amount, settlement_amount, amount_semantics, external_identifier; ditambah row_key dan confidence client. Builder tidak mengirim asset_name. API mendukung match_transaction_id pada workflow link, tetapi builder UI ini tidak mengirimnya.

Tidak dikirim oleh builder: PDF bytes/ArrayBuffer/base64, password PDF, file.name/path, raw text, seluruh exact_values object, header customer/address/RDN/SID, arbitrary source_metadata. Document hash tidak bisa memulihkan PDF secara langsung, namun merupakan identifier stabil untuk korelasi file dan ikut dipersist; jangan menyebutnya anonimisasi.

Preview table tidak memperlihatkan semua field payload (misalnya market_price/hash). Sebelum private import, pemilik harus memahami allowlist lengkap; gunakan breakpoint lokal sebelum axios.post bila perlu memeriksa payload di memori. Jangan menyalin object tersebut ke laporan/chat. Tidak menganggap label AUTO ACCEPT atau score 100 sebagai bukti coverage penuh maupun izin otomatis mengirim data.

## 6. Identitas dan database persistence

Pada tiga parser monthly statement yang diperiksa, tidak ada ekstraksi eksplisit nama pemilik, nomor rekening/RDN/SID, alamat, email, atau telepon ke snapshot output. Snapshot UI memakai symbol/quantity/prices/value/as-of/currency; header identitas tidak dimasukkan builder. Account API hanya mengembalikan ID, label akun dan provider.

**Tetap ada data pribadi/finansial yang dipersist setelah impor:**

- users menyimpan nama/email pengguna aplikasi dan password hash dari registrasi; sessions database menyimpan informasi sesi, termasuk metadata IP/user-agent menurut schema. Ini bukan hasil pembacaan PDF.
- investment_accounts mempunyai account_name/account_identifier existing; tidak diisi otomatis dari header PDF oleh flow ini. Gunakan label pseudonim pada environment pengujian.
- source_documents menyimpan hash dokumen, akun/provider/type/parser, waktu; import_batches menyimpan idempotency/payload hash/receipt.
- source_observations.structured_data menyimpan snapshot atau transaction terstruktur penuh yang diizinkan; bukan raw extracted text, tetapi tetap quantity/nilai finansial sensitif.
- snapshots/items dan canonical transactions menyimpan data finansial; TC external_identifier adalah referensi transaksi sumber yang juga dapat sensitif.
- integrity_audit_events menyimpan actor/account/action dan before/after field finansial yang diizinkan. Konfirmasi snapshot menambah audit metadata. History reconciliation bila tersedia menyimpan hasil/evidence quantity dan actor/source refs immutable secara aplikasi.

Tidak ditemukan encryption-at-rest pada kolom finansial tersebut. Hash/idempotency bukan enkripsi. Menghapus ledger row bukan jaminan menghapus observation/audit/history/backups; FK retention memang dapat menahan penghapusan.

API menerima beberapa field text seperti asset_name/external_identifier, dan database legacy mempunyai source_metadata yang TransactionResource masih dapat mengembalikan. Validator allowlist membatasi struktur, bukan membuktikan sebuah string bebas PII. Tidak mengaudit isi legacy rows, sehingga tidak dapat menyatakan seluruh database bebas nomor rekening/identitas. Jangan memasukkan identitas ke label akun/free text dan periksa salah mapping saat preview.

## 7. Logging dan error exposure

Tidak ditemukan console.log/console.error aplikasi pada jalur PDF, request-body logger khusus, pemanggilan outbound Http pada services, atau integrasi telemetry/Sentry pada manifest/source yang diperiksa. Error UI impor memakai safeError; processing error generik tidak menampilkan text PDF. Tidak membaca log nyata untuk membuktikan isinya.

**Konfigurasi efektif backend normal saat audit:** APP_ENV=local, APP_DEBUG=true, logging stack→single, level debug, session=database, queue=database, mail=log, filesystem=local; default database masih myportfolio. Ini berbeda dari beberapa override harness sintetis dan bukan konfigurasi private test yang sudah disetujui.

Risiko konkret: Laravel QueryException::formatMessage pada vendor terpasang menyisipkan bindings ke pesan SQL. Exception tak tertangani dapat menulis quantity/nilai/structured JSON ke `backend/storage/logs/laravel.log`, bahkan bila UI memberi pesan generik. APP_DEBUG=false mengurangi detail response, tetapi tidak otomatis meredaksi log. Laravel juga mendokumentasikan risiko detail konfigurasi pada debug responses. [Laravel error handling](https://laravel.com/framework/docs/12.x/errors).

Log channels Slack/Papertrail tersedia di config, tetapi stack aktif yang diperiksa hanya single. Tidak ditemukan pemanggilan email saat PDF diproses; mail=log tetap perlu diperhatikan untuk proses lain. Pail/terminal/log collector, webserver access logs, DB general/slow/binlog, backup dan OS/browser tooling berada di luar jaminan audit body aplikasi. Access logs biasa dapat merekam URL/IP; mode debug/custom logging dapat berbeda.

Syarat private import: debug response dimatikan pada instance privat, logging lokal diaudit/akses dibatasi, tidak ada remote log shipping, dan error-path sintetis memastikan tidak ada body/SQL bindings sensitif keluar. Bila membutuhkan jaminan log bebas financial fields, perlukan redaction/error-handling hardening tersendiri sebelum impor. Mengubah log level saja bukan bukti redaction. Tidak ada konfigurasi atau source logging diubah pada review ini.

## 8. Jaringan pihak ketiga dan exposure localhost

Pada kode pemrosesan tidak ditemukan OCR/cloud parser, Gmail/n8n, news/market API, remote font, CDN worker, analytics, atau outbound PDF fetch. getDocument memakai data, bukan url. PDF.js mempunyai kemampuan mengambil resource tambahan sesuai konfigurasi; installed implementation dan extractor tidak mengonfigurasi CMap/font/WASM URL eksternal. Kemampuan library bukan bukti request tertentu terjadi. [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html).

Request yang wajar: asset JS/CSS/worker dari origin frontend, auth/accounts/read APIs, WebSocket HMR Vite lokal, dan POST structured JSON hanya setelah konfirmasi. Config axios dapat diarahkan ke server lain lewat VITE_API_URL. Pembacaan env Vite development/production pada disk saat audit menghasilkan localhost:8000; env process server yang sudah berjalan dapat override dan tetap harus dilihat melalui Network. Tidak menjamin extension/browser background/OS bebas traffic atau data capture.

Snapshot listener aktual:

- PHP 8000 dan 8015, Node 5173 dan 5185, MariaDB 3306: LOOPBACK.
- Apache/httpd 80 dan 443: **ALL_INTERFACES** (IPv4/IPv6 yang ditemukan).

Tidak memeriksa seluruh vhost/alias/junction/firewall/tunnel/router mapping, sehingga belum terbukti proyek dapat diakses lewat Apache; sebaliknya tidak boleh menyatakan seluruh host hanya terbuka lokal. Pemilik harus meninjau apakah Apache melayani/menautkan repository, storage, DB admin atau folder privat, lalu membatasi/menonaktifkan layanan yang tidak diperlukan pada sesi uji. Tidak ada perubahan listener/firewall oleh Agent. CORS bukan network firewall dan bukan perlindungan terhadap semua local clients.

## 9. Isolasi private test dari demo dan main

Target usulan: database baru seperti `tap_flx_private_local_<suffix>` yang tidak berisi data demo/main. Gunakan schema aplikasi yang disetujui, bukan copy data pribadi main atau seeder demo. Provisioning/schema upgrade pada private database merupakan tugas berikutnya yang harus disetujui; tidak dilakukan di sini. Histori Gate 3 tidak diperlukan untuk preview PDF atau impor snapshot Gate 1, dan tidak boleh memicu main migration otomatis.

Prasyarat isolasi:

- Database/user lokal terpisah dengan hak hanya ke private schema; verifikasi SELECT DATABASE() dan konfigurasi koneksi efektif tepat private target. Jangan memakai root/admin untuk aplikasi private jika dapat dihindari.
- DB_URL tidak override target; DB/session/cache/queue connection tidak kembali ke main/demo. Dedicated backend/frontend port, app instance/config/storage/log/cache terpisah dan cookie/session berbeda. Perhatikan cookie localhost tidak terisolasi menurut port; browser profile terpisah membantu memisahkan XSRF/session.
- APP_DEBUG=false, origin API benar-benar loopback, credentials tidak berada di VITE_*; log/backup/screenshots/exports di folder privat di luar Git dan sinkronisasi publik. API key tidak aman disimpan di VITE_* karena dibundel ke client. [Vite env documentation](https://vite.dev/guide/env-and-mode).
- Raw PDF/password tetap di folder privat di luar repository/webroot; jangan gunakan docs/aset_parser, public, storage/app/public, atau folder yang dilayani Apache. Batasi akses OS dan cloud-sync/backup sesuai keputusan pemilik.
- Akun aplikasi private memakai pseudonim; label provider/akun tanpa rekening/SID. Buat ownership/nested-reference checks sintetis sebelum memakai data asli. Onboarding investment account UI belum ada; jangan mengarahkan private import ke akun demo karena lebih mudah tersedia.

**Jangan menggunakan `tools/gate35-runtime.php`/`gate35-http-smoke.mjs` sebagai environment data pribadi.** Harness itu sengaja mempunyai akun/password demo, koneksi privilege existing dan fixture yang berubah; isolation guard hanya mendukung nama database Gate 3.5 sintetis. Jangan melonggarkan guard atau menambahkan PDF asli ke database demo yang akan dipresentasikan/dipakai test replay.

## 10. Checklist manual berurutan

### Tahap P0 — Persiapan, sebelum memilih PDF asli

- [ ] Backup/restore main tetap ditangani sesuai laporan Gate 3.5; status sign-off tetap BLOCKED hingga semua prasyarat terpenuhi. Database main tidak digunakan untuk percobaan ini.
- [ ] Private instance/schema/user terpisah sudah disiapkan dan disetujui; pemilik memverifikasi database efektif, origin API, listener, Apache mapping, storage/log/session serta tidak ada koneksi main/demo.
- [ ] Browser profile khusus tanpa extension yang membaca halaman; DevTools hanya lokal, tanpa remote debugging/rekaman layar cloud. PDF asli berada di luar repo/webroot; pemilik sendiri memilihnya tanpa menyerahkannya kepada Agent.
- [ ] Ulangi workflow dengan PDF sintetis lebih dahulu: worker lokal, preview, reject/password error, API error, logging, auth, ownership, dan JSON allowlist. Hanya capture sintetis yang boleh disanitasi untuk dibagikan.
- [ ] Buka Network **sebelum** membuka halaman/memilih file, aktifkan Preserve log, tampilkan semua tipe request (termasuk WS/Other), Domain dan Initiator. Catat traffic baseline auth/assets agar tidak salah menganggap GET normal sebagai upload PDF.

### Tahap P1 — Preview asli tanpa impor

- [ ] Untuk sesi ini jangan klik Import Selected atau konfirmasi snapshot/coverage/history. Sebagai pengaman tambahan, blokir endpoint mutation di DevTools setelah login atau gunakan instance dengan akses write yang sengaja dibatasi. Blocking harus diuji dengan fixture sintetis sebelum dipercaya.
- [ ] Pemilik pilih file → Process Document. Periksa provider/type, as-of, jumlah baris, symbol, exact quantity/unit/currency/nilai terhadap statement secara lokal. Jangan memfoto/menyalin identitas/angka ke Git/laporan/chat.
- [ ] Network tidak boleh memuat request dengan PDF bytes/base64, multipart/form-data, password, full raw text atau nama file. Tidak boleh ada POST import akibat pemilihan file/processing. Periksa semua destinations, URL/query, headers, bodies dan WS messages, bukan hanya filter Fetch/XHR.
- [ ] Resource worker/font/WASM bila ada harus dari origin lokal yang diketahui; hentikan jika ada third-party request yang tidak terjelaskan. Setelah resources dimuat, offline preview boleh diuji tambahan; error resource offline tidak membenarkan fallback cloud.
- [ ] Password-protected/scanned/unsupported layout boleh gagal lokal; tidak memasukkan 0 untuk field hilang atau memakai layanan konversi online. Tidak memaksakan empty parser sebagai bukti portofolio kosong.
- [ ] Reload/tutup tab selesai preview. File input/preview state tidak persisten oleh aplikasi, tetapi DevTools/buffer/OS mungkin masih menahan data. Login/session bisa menulis metadata sesi; ini tidak berarti preview harus menghasilkan nol perubahan pada seluruh database. Yang tidak boleh ada adalah financial import/observation baru.

### Tahap P2 — Gerbang sebelum private import

- [ ] P0/P1 dan error-path sintetis lulus; seluruh destination lokal, logging/response policy sudah ditinjau, private schema terverifikasi, data retention disetujui pemilik. Bila belum, **STOP — jangan impor**.
- [ ] Pemilik menyetujui secara sadar bahwa financial JSON, document hash, provenance dan audit akan disimpan pada private database. Ini berbeda dari persetujuan preview saja.
- [ ] Tinjau seluruh field allowlist, termasuk yang tidak ditampilkan tabel. Bila perlu pause sebelum axios.post pada Sources, periksa payload hanya di mesin sendiri, lalu batalkan jika ada PII salah mapping. Jangan menyalin payload ke console/chat.
- [ ] Unblock mutation hanya pada target private yang terverifikasi. Gunakan satu statement/satu akun lebih dahulu; coverage tetap UNKNOWN/PARTIAL sampai pemeriksaan eksplisit sesuai Gate 2, bukan otomatis FULL.

### Tahap P3 — Impor terbatas, hanya setelah P2 lulus

- [ ] Klik Import Selected sekali. Network harus menunjukkan structured JSON pada `/api/source-imports`, endpoint/private origin yang benar, tanpa raw file/password/text/header identitas. Retry identik boleh mengembalikan replay; jangan membuat idempotency key baru hanya untuk memaksa duplikasi.
- [ ] Pemilik memeriksa rows/source observations/receipt/audit secara privat pada private schema dan memastikan main/demo tidak berubah. Periksa khusus PII yang salah masuk ke symbol/reference/name; tidak membagikan hasil SELECT/UUID/hashes yang terkait dokumen asli.
- [ ] Konfirmasi snapshot hanya setelah symbol/unit/count/coverage benar. Jangan membuat BUY/SELL dari selisih dua monthly statements; monthly-only activity tetap unknown jika belum ada bukti.
- [ ] Uji history/reconciliation hanya bila schema private dan syarat Gate 3 tersedia; ini tidak memberi izin migration main. Tinjau stale/version dan attestation tanpa memberi label MATCHED karena delta nol saja.

### Tahap P4 — Penutupan

- [ ] Simpan evidence audit hanya sebagai verdict/metode/tanggal/versi dan jumlah kasus agregat yang disetujui, tanpa nilai portofolio, nama file, document hash, account ID, screenshot identitas atau payload.
- [ ] Log/HAR/dump/exports privat memiliki retention/access policy; jangan Copy as cURL/fetch ke chat atau issue tracker. Penghapusan/retention private DB, evidence dan backups dilakukan pemilik sesuai keputusan terpisah; tidak mengasumsikan delete ledger menghapus semua bukti.
- [ ] Periksa read-only Git status/readiness sebelum commit; raw PDF tetap ignored. Jangan menyimpan capture dengan ekstensi lain hanya karena .pdf sudah diabaikan.

## 11. Apa yang dapat dibuktikan browser Network?

Network dapat memberi bukti empiris request yang terlihat pada versi browser/app, workflow, sumber dan interval pengujian tertentu: destination, timing, initiator, method, headers, payload dan respons. Gabungkan dengan source audit, pemeriksaan error/log dan private DB persistence. Network saja tidak membuktikan isi backend log, SQL binlog, OS process/extension, secure deletion, semua browser, atau semua format PDF.

HAR berlabel sanitized terutama menghapus header sensitif tertentu; jangan menganggap financial JSON/response body otomatis hilang. Dokumentasi Chrome menjelaskan sanitasi Cookie/Set-Cookie/Authorization, bukan redaksi otomatis seluruh data finansial. Jangan mengunggah HAR asli ke layanan analisis. [Chrome Network reference](https://developer.chrome.com/docs/devtools/network/reference/).

Untuk bukti yang dapat ditinjau pembimbing, ulangi kasus ekuivalen dengan fixture sintetis dan gunakan capture sintetis yang diperiksa. Private test cukup dicatat verdict lokal; data asli tidak diperlukan di Git/laporan publik untuk membuktikan mekanisme minimisasi.

## 12. Keputusan yang masih perlu disetujui

1. Provisioning private environment/schema/user/ports/storage terpisah dan siapa yang memverifikasi konfigurasi, Apache exposure, serta hak akses.
2. Kebijakan debug/logging/redaction/retention dan apakah hardening error-path perlu tugas kecil tersendiri sebelum private import.
3. Apakah pengujian awal hanya preview; private import memerlukan persetujuan terpisah atas financial persistence setelah seluruh gate P2 lulus.
4. Cara penanganan statement terenkripsi/unsupported, ground truth privat dan bukti sintetis untuk pembimbing.

Tidak ada persetujuan tersebut diasumsikan dari audit ini. Gate 3.5 tetap BLOCKED sampai backup/restore main diverifikasi, browser functional/network QA dilakukan, dan persyaratan migration manual dipenuhi. Tidak ada modul, konfigurasi, dependency, atau database diubah pada review ini; hanya dua dokumen permintaan pemilik dibuat.
