# Gate 1.5 — Stabilization Report

Tanggal: 29 Oktober 2026, Asia/Makassar. Basis main `6b7a5cf`. Instruksi terbaru pemilik mengganti prioritas dengan stabilisasi impor dan Automatic Mode; implementasi Gate 2–3 yang sudah ada dipertahankan.

**Status gate: BLOCKED — DO NOT COMMIT untuk sign-off keseluruhan.** Pengujian source/internal runtime lulus; demonstrasi Gmail+n8n nyata, browser functional/network QA, dan backup/restore utama belum selesai. Hasil pemeriksaan kandidat commit otomatis dibedakan dari penerimaan gate ini. Tidak ada klaim READY FOR DEPLOYMENT.

## 1. Temuan account loading: fakta dan batas diagnosis

Pemilik mengonfirmasi browser menggunakan `localhost:5173`. Audit koneksi utama hanya memakai aggregate/metadata SELECT dalam transaksi READ ONLY yang ditutup dengan ROLLBACK SQL; tidak membaca session payload, nama/email pengguna, financial rows, atau cookie browser.

- Database efektif `myportfolio`, MariaDB 10.4.32; config tidak cached.
- Investment accounts **3**, platforms **3**, orphan account/platform **0**. Kondisi nol akun pada Gate 3.6 sudah berubah. Tidak membuat akun pengganti pada utama.
- Migration Gate 1 tercatat applied; migration histori Gate 3 belum applied. Schema Automatic baru belum ada pada utama.
- Session lifetime 120 menit; **0 sesi terautentikasi yang masih aktif** pada dua pemeriksaan gate ini.
- Sanctum stateful mencakup localhost:5173 dan 127.0.0.1:5173; CORS mengizinkan keduanya, session domain localhost. Vite menggunakan default API localhost:8000; tidak menemukan override ke port uji lama.
- Server utama tersedia melalui loopback IPv6 `::1`; sambungan ke IPv4 127.0.0.1 pada port yang sama ditolak. Mengganti URL localhost menjadi 127.0.0.1 bukan perbaikan yang terbukti untuk lingkungan ini.

Bug yang terbukti pada kode: React hanya memeriksa auth saat awal mount. Sesudah session server berakhir, protected API dapat mengembalikan 401 tetapi user React tetap terisi dan Document Center tetap terlihat. Error account loading lalu ditampilkan sebagai pesan koneksi umum.

Perbaikan: interceptor 401 untuk protected API menerbitkan event session-expired; AuthProvider mengosongkan user sehingga route kembali ke login. Account loading membedakan sesi berakhir, token 419, origin terlarang, dan kegagalan koneksi; tersedia retry dan tautan login. Tidak mengubah konfigurasi cookie/CORS secara spekulatif, mematikan CSRF, atau hardcode akun.

**Batas root-cause:** tidak berhasil menangkap request browser utama yang sebelumnya gagal. Session kadaluarsa merupakan penjelasan paling kuat berdasarkan keadaan runtime dan bug React, tetapi status HTTP request asli tidak diketahui. Reproduksi 401 dan pemulihan auth dibuktikan pada environment sintetis. Tidak menyebut seluruh kemungkinan jaringan/CORS utama sudah dieliminasi melalui browser.

## 2. Audit alur impor dan persistence

Alur yang dipertahankan: file → browser PDF.js → detection → provider parser → exact numeric normalization → validation/preview → pilihan baris dan akun → konfirmasi → source-import API → source document/batch/observation → canonical transaction atau snapshot → receipt → query ulang.

DocumentPipeline kini dipakai bersama oleh browser dan worker server Automatic agar detection/parser mapping tidak terduplikasi. Relative imports diberi ekstensi .js agar modul yang sama dapat dijalankan Node; registry/parser version integrity-1 tidak berubah karena regex/mapping tidak berubah.

SourceImportController memberikan 503 `SOURCE_SCHEMA_PENDING` yang aman jika fondasi Gate 1 tidak tersedia. Pada utama fondasi tersebut sudah applied; tidak menjalankan migration ulang. SourceImporter, decimal validator, row locks, hash/idempotency, matching ambigu, provenance, dan audit Gate 1 tetap dipakai. Tidak mengubah ledger dari selisih snapshot.

Pengujian HTTP nyata membuktikan source valid tersimpan dan dibaca kembali pada request baru serta setelah restart backend. SOA menghasilkan snapshot; TC/CA menghasilkan event sesuai kontrak. UNKNOWN unit dan coverage tetap memerlukan review. Import berhasil tidak berarti rekonsiliasi lengkap atau data sudah confirmed seluruhnya.

## 3. BIONS: pemeriksaan sampel dan field

Folder PDF ternyata mempunyai subfolder provider; inventaris awal nonrekursif dikoreksi. Inventaris rekursif menemukan enam PDF ignored: BIONS 3, Pluang 1, Stockbit 2. Hanya pemeriksaan yang relevan dilakukan; tidak menyalin PDF/nama file/isi/tanggal/nominal/identitas ke laporan atau fixture baru.

Ketiga sampel BIONS diperiksa dengan PDF.js aktual, text layout per halaman, detection, parser, normalized contract dan validation dalam memori:

- SOA: 1 halaman, 4 baris posisi; date dan exact decimal strings valid.
- TC: 2 halaman, 1 baris transaksi; date dan exact decimal strings valid. Reading order per halaman tidak menghilangkan baris sampel ini.
- CA cash dividend: 1 halaman, 1 event; reference balance terpisah dari quantity delta; date/decimal valid.
- Seluruh baris lolos hard validation preview; unit tidak diinferensikan menjadi LOT/SHARE. Tidak mengklaim confidence sebagai probabilitas terkalibrasi.

Kegagalan parsing sampel yang tersedia **tidak berhasil direproduksi**. Karena itu tidak menulis ulang regex tanpa bukti. Diagnosis UI kini membedakan UNKNOWN_PROVIDER, UNSUPPORTED_DOCUMENT, NO_MATCHING_ROWS, SOURCE_FORMAT_INVALID, password/encryption, dan error penyimpanan.

Tambahan regression sintetis memeriksa field yang diharapkan, bukan hanya output nonempty: symbol, effective/as-of date, quantity, average/market price/value, reference TC, BUY, gross/net, fee/tax terpisah, CA reference_quantity dan null event quantity/price. Actual HTTP/MariaDB menguji ketiga tipe BIONS serta provider mismatch/replay. Nilai fixture baru seluruhnya diciptakan, bukan salinan sampel.

Batas: belum ada penilaian manual independen terhadap seluruh field PDF dalam browser, corpus variasi format, OCR scan, atau benchmark generalisasi. Pemeriksaan sampel in-memory bukan gold dataset akademis yang sudah dianotasi. Aturan tanggal/decimal format lain tetap memerlukan sampel dan review.

## 4. Masalah runtime baru yang ditemukan dan diperbaiki

Worker server menggunakan PDF.js/parsers yang sama melalui Symfony Process, stdin JSON dan output terstruktur; tidak memakai file PDF sementara. Pada PHP CLI-server Windows, percobaan HTTP awal menghasilkan PARSER_UNAVAILABLE sementara CLI PHPUnit lulus. Probe sintetis menemukan Node gagal menginisialisasi CSPRNG karena SystemRoot hilang pada environment subprocess.

AttachmentParser sekarang meneruskan allowlist variabel OS termasuk SystemRoot, PATH dan direktori profil/temp yang diperlukan runtime. Environment aplikasi, OAuth tokens, APP_KEY, database credentials dan request context tidak diwariskan. Node dibatasi heap 256 MiB dan timeout 60 detik; library errors/stdin tidak diteruskan ke log/respons. Ini bukan OS sandbox atau batas total RSS.

Alur HTTP diulang pada database disposable baru setelah perbaikan dan lulus. Probe diagnostik sementara dihapus; tidak ada endpoint debug pada kode final.

## 5. Evidence pengujian

- Backend: **133 tests / 1161 assertions lulus** pada SQLite :memory:, termasuk source integrity, holdings, reconciliation, onboarding, pending schema, OAuth state/expiry/PKCE, token refresh, mode pause, in-flight mode change, ownership, financial revalidation, bounded attachment pagination dan replay.
- Frontend: **94 tests lulus, 1 opt-in Gate 3.6 runtime test skipped**, 16 file lulus dan 1 skipped. Tambahan actual Node PDF.js worker, BIONS field assertions, encrypted password states, session expiry dan Connections consent/mode/reconnect UI. Test opt-in lama tidak diklaim dijalankan ulang; harness Gate 1.5 menggantikan validasi HTTP yang relevan pada gate ini.
- Lint: exit 0, **6 warnings existing** (AuthContext, Transactions, parser interface). Production build lulus: JS 883.86 kB/gzip 267.76 kB, CSS 37.74 kB, PDF worker 2228.48 kB; peringatan chunk >500 kB masih ada.
- Pint untuk perubahan backend lulus. Tidak mengubah dependency manifests/lockfiles.
- Actual HTTP Laravel + MariaDB 10.4.32: register, login salah/benar, owned account list/create/duplicate-label, CSRF 419, SOA/TC/CA, review/confirmation, encrypted PDF wrong/correct password, import receipts, duplicate replay lintas Privacy/Automatic, cross-user isolation, logout/401 dan query ulang lulus.
- Fake Google boundary + actual Node/PHP/DB dipakai untuk pengujian Automatic; tidak mengirim email atau mengakses Gmail nyata.
- Restart backend kemudian login/query ulang: empat item snapshot Stockbit dan dua event milik user uji masih terbaca.
- Pengiriman entry React pada route Overview/Portfolio/Documents/Transactions/Reconciliation/Connections menghasilkan HTTP 200. Ini bukan pengujian render/E2E browser.

Database evidence final: `tap_flx_gate15_20261029_e8ac12fa`. Seluruh SQL/HTTP sintetis dijaga nama database dan response header X-Gate15-Database; tidak pernah fallback ke myportfolio. Satu user/account/trade sintetis legacy dibuat sebelum migration tambahan, fingerprint field lama tetap sama setelah up(). Foreign key, account/message unique constraint dan JSON_VALID terpasang; tiga write invalid ditolak MariaDB dan transaction probe di-rollback. Terdapat 3 users/4 accounts/3 transactions/2 snapshots/5 snapshot items/4 source documents/1 ingestion setelah smoke, termasuk satu trade preservation milik user terpisah. Artifact evidence dan mailbox sintetis ada di .local-backups ignored, tidak masuk Git.

Database disposable percobaan sebelumnya dibiarkan untuk evidence; tidak menjatuhkan atau membersihkan database. Tidak ada migration Artisan, seed, dummy account/trade, atau schema change pada utama oleh Agent.

## 6. Browser dan sign-off Gate 3.5

Browser connector tidak tersedia. Fallback native Windows dihentikan otomatis karena URL browser tidak dapat diverifikasi cukup pasti untuk enforcement kebijakan. Seluruh input GUI dihentikan; tidak mencoba jalur GUI lain. Browser functional/network/desktop/mobile QA **BELUM SELESAI**. Checklist manual terdapat pada setup guide, dan laporan Gate 3.5 tetap berlaku.

Backup myportfolio yang sudah diuji restore belum tersedia menurut jawaban pemilik. Tidak membuat backup main atau menjalankan migration utama. Gate 3.5/private-data sign-off tetap **BLOCKED** sampai backup/restore diverifikasi, browser QA selesai, serta keputusan/manual migration dipenuhi. Keberhasilan integration sintetis tidak menghapus blocker ini.

## 7. Read-only pre-commit dan perubahan

`node tools/check-commit-readiness.mjs` dijalankan. Sandbox awal tidak dapat memverifikasi remote; pemeriksaan final read-only berizin berhasil: 261 kandidat (235 tracked + 26 untracked), 258 file teks diperiksa, problems kosong, enam PDF ignored, nol unpushed commits, remote main 6b7a5cf1868f1bc5538077d99bf1f6c580fee079. Tool menghasilkan **READY FOR MANUAL COMMIT** untuk kandidat source. Status penerimaan gate keseluruhan tetap BLOCKED sebagaimana bagian awal, karena syarat pengujian live/UI belum terpenuhi. Pattern scan bukan jaminan seluruh PII/secret terdeteksi. Server disposable 8035 dan Vite uji 5195 dihentikan setelah validasi; database/evidence uji tetap tersedia untuk restart manual.

Readiness allowlist hanya menambahkan dua exact paths yang diaudit: tools/gate15-runtime.php dan frontend/scripts/parse-mail-pdf.mjs. Aturan PDF/secret/history tidak diperlonggar. Tidak ada staging/commit/push/fetch atau operasi Git pengubah state.

File baru: empat laporan Gate 1.5/Automatic/roadmap; AutomaticController, AutomaticIngestion, empat services Automatic, config automatic, migration additive 2026_10_29_000001; tiga assets setup n8n/environment; AutomaticModeTest dan ImportSchemaReadinessTest; shared DocumentPipeline, worker parse-mail-pdf, AutomaticConnections JSX/CSS, tiga frontend test files; gate15-runtime.php dan gate15-http-smoke.mjs.

File diubah: SourceImportController, EmailConnection, InvestmentAccount, bootstrap/app, routes api/web; App, axios, AuthContext, SourceContract dan enam parser import paths, DocumentProcessing, WorkspacePages, AppShell, ui/format; check-commit-readiness. Daftar path lengkap dapat diperiksa dengan git status --short yang read-only. Tidak ada file dihapus.

Rekomendasi commit message setelah review pemilik: `feat: stabilize document imports and add reviewed Gmail ingestion foundation`.

Tugas terdekat: pemilik menyiapkan konfigurasi Google/n8n pada database demo terisolasi, menjalankan checklist live+browser dalam setup guide, lalu meninjau hasil bersama pembimbing. Jangan menerapkan migration utama untuk sekadar membuat demo bekerja.
