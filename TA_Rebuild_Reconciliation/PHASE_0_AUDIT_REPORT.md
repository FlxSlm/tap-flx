# PHASE 0 — CONTROLLED REBUILD AUDIT REPORT

Tanggal audit: 20 Oktober 2026 (Asia/Makassar). Workspace: `C:\TAP\tap-flx`.

**Keputusan audit: pertahankan proyek; lakukan refactor bertahap. Belum siap untuk menyatakan hasil Portfolio Reconciliation Engine sebagai hasil penelitian.** Fondasi autentikasi, akun, penyimpanan transaksi, snapshot, dan Privacy Mode tersedia. Mesin proyeksi posisi, coverage, provenance terstruktur, semantic deduplication, rekonsiliasi, dan audit trail belum tersedia.

Dokumen pendamping: [PHASE_0_IMPLEMENTATION_PLAN.md](PHASE_0_IMPLEMENTATION_PLAN.md). Semua perubahan di bawah merupakan usulan, bukan implementasi.

## 1. Mandat, sumber, dan batas bukti

Seluruh 12 dokumen target sudah dibaca: `README.md`, `AGENT_START_PROMPT.md`, serta `docs/AGENT_RULES.md`, `ARCHITECTURE.md`, `DATA_CONTRACTS.md`, `DECISION_LOG.md`, `IMPLEMENTATION_ROADMAP.md`, `PROJECT_CONTEXT.md`, `RECONCILIATION_SPEC.md`, `SECURITY_AND_GIT.md`, `SOURCE_MATRIX.md`, dan `TEST_PLAN.md` dalam folder paket ini.

Instruksi terbaru pemilik mengungguli instruksi lama dalam paket: tidak membaca lima dokumen lama di root; hanya membuat dua laporan Phase 0; semua operasi mutasi Git hanya dilakukan pemilik. Arahan commit dan pembaruan dokumen progres lama pada paket tidak dilaksanakan. Path workspace lama dan nama output `REBUILD_*` pada prompt paket juga digantikan instruksi terbaru.

Metode: inspeksi source, migrations, models, routes, konfigurasi, manifests, lockfile presence, dan deklarasi tests; inventaris PDF hanya menghitung keberadaan. Tidak membuka `.env`, database pengguna, PDF asli, atau backup Git; tidak menjalankan aplikasi, migrasi, seeder, dependency install/update, atau suite test/build yang dapat menulis artefak. Tidak mengakses layanan eksternal.

Klasifikasi bukti:

- **TERKONFIRMASI-KODE**: perilaku yang terlihat pada source; belum setara verifikasi runtime.
- **BELUM DIVERIFIKASI**: field aktual PDF, sanitasi, database terpasang, jaringan browser, dan hasil test pada Phase 0.
- **USULAN**: rancangan, migration, API, algoritma, dan gate berikutnya.

Tidak ada klaim test PASS baru pada Phase 0. Suite backend memakai `RefreshDatabase`, sehingga menjalankannya akan menjalankan migrasi pada database test; ini sengaja tidak dilakukan. Hasil test pada sesi sebelum Phase 0 tidak dianggap bukti pengujian ulang saat ini. Tidak ada proposal akademik yang dapat diverifikasi dari daftar dokumen non-PDF yang diinspeksi; judul resmi dan novelty tetap perlu konfirmasi pembimbing.

## 2. Kondisi repository dan keamanan awal

- Branch aktif `main`; HEAD yang dibaca `7642ad4`. Remote lokal menunjuk `https://github.com/FlxSlm/tap-flx.git`; status server/visibilitas repository tidak diperiksa.
- Working tree sejak awal sudah memiliki penghapusan enam file konteks/handoff lama dan folder paket ini belum tracked. Penghapusan tersebut milik pemilik dan tidak diubah. File lama lain yang masih ada tidak dipakai sebagai sumber konteks baru.
- Ada 133 path tracked saat pemeriksaan awal. Pemeriksaan path tracked untuk PDF, `.env` asli, private key, database/dump umum, dan `auth.json` menemukan 0 kandidat. Pencarian pola token GitHub/AWS dan private key umum pada teks tracked di backend/frontend menemukan 0 file; ini bukan audit secret lengkap.
- Riwayat branch HEAD yang diperiksa tidak mencatat path PDF. Ini tidak membuktikan seluruh ref tersembunyi, reflog, backup lokal, maupun riwayat remote bebas data sensitif. Backup lokal dari persiapan Git sebelumnya tidak dibuka dan tidak boleh dipublikasikan.
- Enam PDF tersedia lokal pada `docs/aset_parser/`; nama file, identitas, nomor akun, dan nilai portofolio tidak disalin ke laporan. `.gitignore` mengecualikan PDF dan `.local-backups/`.
- **Sanitasi keenam PDF belum diverifikasi.** `docs/SECURITY_AND_GIT.md` mewajibkan menganggapnya sensitif. Audit tidak membuka atau mengekstrak PDF. Nama file yang menyerupai data samaran atau tulisan “sanitized” dalam spesifikasi lama bukan bukti redaksi aman.

Tidak ada perintah Git pengubah state yang dijalankan. Pemeriksaan Git terbatas pada status, branch aktif, log/history/path listing, remote listing, dan pencarian teks tracked yang bersifat read-only.

## 3. Current implementation inventory

| Komponen | Status berdasarkan kode | Evidence dan batas |
|---|---|---|
| Laravel API | Ada, controller-centric | `backend/routes/api.php`, `bootstrap/app.php`; belum ada domain service rekonsiliasi |
| React SPA | Ada | `frontend/src/App.jsx`: login, register, dashboard, transaksi, document processing |
| Authentication | Fondasi ada | Sanctum stateful API, CSRF-cookie flow, session regeneration, hashed password |
| Account isolation | Sebagian terlindungi | query list akun/transaksi berdasarkan user; write/show/update/delete transaksi memeriksa ownership |
| Account onboarding | Belum lengkap | API akun hanya GET; akun/platform demonstrasi tersedia lewat seeder, bukan onboarding pengguna |
| Transaction ledger | CRUD dan bulk ada | decimal storage, hash unique, metadata JSON; belum punya accepted/duplicate/revision lifecycle |
| Portfolio snapshots | Write path ada | header + items, bulk insert dan transaksi DB per snapshot; tidak ada read API atau baseline workflow |
| PDF processing | Ada, lokal | `PdfExtractor.js` menggunakan ArrayBuffer dan PDF.js worker lokal dari bundle |
| Source classification | Ada, terbatas | `ProviderDetection.js`: keyword provider/type; medium dan parser version belum bagian kontrak |
| Parser | Enam class ada | BIONS TC/SOA/CA, Stockbit TC/SOA, Pluang SOA; belum bukti coverage semua bagian dokumen |
| Validation/confidence | Client profile ada | transaction/snapshot; authoritative backend validation masih generik |
| Import review | Pemilihan baris ada | `DocumentProcessing.jsx`; tidak ada persisted review queue atau revision/import receipt |
| Monthly activity summary | Belum ada | Tidak ada schema, model, service, atau endpoint |
| Holdings projection/reconciliation | Belum ada | Tidak ditemukan modul terkait pada app/database/frontend |
| Audit trail | Belum ada | timestamps bukan event history; transaksi dapat diedit/dihapus langsung |
| Analytics dashboard | Placeholder navigasi | `Dashboard.jsx` hanya menyambut user dan menyediakan link transaksi/logout |
| Automatic Mode/market data | Belum diimplementasikan | model email bukan bukti OAuth/ingestion aktif; keduanya di luar Phase 0 |

### 3.1 Database dan models existing

Migrations mendefinisikan `users`, password reset/session, cache/jobs/token infrastructure, `platforms`, `email_connections`, `investment_accounts`, `transactions`, `portfolio_snapshots`, dan `portfolio_snapshot_items`. Yang diperiksa adalah definisi schema di file, bukan tabel aktual atau riwayat migration yang sudah terpasang.

- `investment_accounts`: user/platform FK, email connection nullable, identifier/name nullable. Mendukung akun Privacy tanpa email secara schema. Belum ada pemeriksaan identitas provider dokumen terhadap platform akun pada import.
- `transactions`: datetime transaksi, type string bebas, symbol/quantity/price nullable pada schema; `total_amount` wajib, currency default IDR, fee nullable, external identifier, metadata JSON, hash unique. Quantity/price `decimal(24,8)`, nominal/fee `decimal(24,4)`. Tidak ada asset type/unit, effective-date precision, gross/net/tax terpisah, acceptance/coverage, revision, provenance relation, atau imported-at eksplisit. Model melakukan decimal casts tetapi controller masih memakai float untuk hash.
- `portfolio_snapshots`: account, date, provider string, document type, metadata JSON, hash unique. Belum ada periode laporan, coverage per dimensi, review/version/baseline, atau supersession.
- `portfolio_snapshot_items`: symbol, quantity `decimal(24,8)`, avg/market price, market value/currency. Belum unique per snapshot + normalized asset/unit, status missing-field, original unit, atau relation instrumen yang stabil.
- Model snapshot/item memakai `$guarded = []`; header belum punya relation `investmentAccount`. Controller saat ini membangun payload eksplisit, sehingga ini bukan bukti mass assignment exploit aktif, tetapi perlu diperketat sebelum kontrak diperluas.
- `EmailConnection.credentials` memakai encrypted cast; belum `$hidden` untuk credentials. Pertahankan model tetapi jangan serialize ke API/log dan jangan aktifkan OAuth pada fase ini.

### 3.2 Authentication

`AuthController.php` meregenerasi session saat login/register; logout membatalkan session dan CSRF token. `User.php` memiliki hashed cast dan menyembunyikan password. `AuthContext.jsx`, axios credentials/XSRF, dan protected routes dapat dipertahankan.

Gap: tidak ada explicit throttle pada `/login` dan `/register` dalam routes yang dibaca; belum ada test auth/session/CSRF end-to-end. Tests API memakai `actingAs`, jadi tidak membuktikan alur browser cookie/CSRF. Konfigurasi cookie secure/same-site deployment tidak diuji. Ini tidak menjadi alasan mengganti Sanctum.

## 4. Gap analysis prioritas

| ID | Prioritas | Temuan dan dampak | Evidence |
|---|---|---|---|
| F01 | Tinggi | `total_amount` berarti net di BIONS TC, gross di Stockbit TC, net dividend di CA. Penjumlahan lintas provider belum bermakna konsisten | masing-masing parser `normalize()` |
| F02 | Tinggi | Fee Stockbit yang tidak tersedia per baris dijadikan 0; CA memakai price 0 dan tax sebagai fee. UNKNOWN hilang dan P/L berisiko salah | `StockbitTradeConfirmationParser.js:69`, `BionsCorporateActionParser.js:54` |
| F03 | Tinggi | Hash membuang waktu, memakai float, tidak memakai currency/reference; dua trade sah identik bisa tertolak, SOA/TC dengan semantik nominal berbeda bisa lolos dua kali | `TransactionController.php:61`, `:124` |
| F04 | Tinggi | Update tidak memperbarui hash; identity lama tetap melekat pada payload baru. Edit/delete juga tidak meninggalkan histori atau invalidasi hasil turunan | `TransactionController.php:176–212` |
| F05 | Tinggi | Snapshot row selection dapat mengirim sebagian aset sebagai satu snapshot; hash account/date/provider menolak koreksi hari yang sama tanpa versi | `DocumentProcessing.jsx:158–183`, `PortfolioSnapshotController.php:48–53` |
| F06 | Tinggi | PDF extractor meratakan item halaman dengan spasi, parser memakai regex anchored awal baris. Fixture test memakai newline manual; pipeline asli belum terbukti | `PdfExtractor.js:39–46`; keenam rowRegex; frontend test |
| F07 | Tinggi | Backend hanya memvalidasi tipe dasar: type/provider bebas, numeric tanpa batas/sign/unit/coverage. Confidence client bukan acceptance authoritative | kedua bulk controller dan `ValidationAndConfidence.js` |
| F08 | Tinggi | Tidak ada opening baseline, projection, coverage, run/items, recompute atau audit trail | schema/app/routes yang diinspeksi |
| F09 | Sedang | Snapshot hanya write API; dashboard tidak membaca posisi. Monthly-only menyimpan observasi tetapi belum menjadi workflow portofolio | `routes/api.php`, `Dashboard.jsx` |
| F10 | Sedang | Bulk transaction memakai raw `$request->transactions` setelah validasi, bukan allowlist hasil validasi per row; metadata bebas dan raw SQL error dikembalikan | `TransactionController.php:112–147`; snapshot `:92` |
| F11 | Sedang | SQLite error code 19 diperlakukan duplicate secara luas, padahal juga dapat mewakili constraint lain | kedua bulk controller |
| F12 | Sedang | No-match parser dianggap error; belum membedakan statement kosong yang sah vs format tidak dikenali. Nullable numeric di form diubah menjadi 0 | `DocumentProcessing.jsx:103`; `Transactions.jsx:113–115` |
| F13 | Sedang | Date parsing campuran `new Date`, local interpretation, UTC `toISOString`, dan datetime tanpa offset. Batas tanggal/payment date bisa bergeser | parser CA/Stockbit dan API date hash |
| F14 | Sedang | Provenance terbatas JSON, tanpa parser version/source line identity. TC reference yang terbaca regex tidak dibawa ke normalized output | BIONS/Stockbit TC parser; transaction schema |

Temuan di atas merupakan penilaian source, bukan hasil eksploitasi atau reproduksi runtime. Risiko dedup terutama berasal dari identitas/normalisasi yang tidak cukup, bukan sekadar pilihan MD5.

## 5. Source matrix dan field availability

### 5.1 Sumber yang diizinkan

| Provider | Medium/type | Inventaris lokal | Status implementasi |
|---|---|---|---|
| BIONS | PDF SOA | Ada satu sampel; isi tidak dibuka | Parser snapshot ada |
| BIONS | PDF TC | Ada satu sampel; isi tidak dibuka | Parser transaksi ada |
| BIONS | PDF CA cash dividend | Ada satu sampel; isi tidak dibuka | Parser dividend ada, mapping perlu diperbaiki |
| Stockbit | PDF SOA | Ada satu sampel; isi tidak dibuka | Parser snapshot ada |
| Stockbit | PDF TC | Ada satu sampel; isi tidak dibuka | Parser transaksi ada |
| Stockbit | Email dividend | Fixture sanitized belum ditemukan pada inventaris | DEFER parser; jangan mengarang format |
| Pluang crypto | PDF monthly statement | Ada satu sampel; isi tidak dibuka | Parser snapshot ada |
| Pluang crypto | Email transaksi | Fixture sanitized belum ditemukan pada inventaris | DEFER parser; jangan membuat TC PDF fiktif |

Spesifikasi parser lama menyebut sumber email Stockbit tambahan. Itu bukan izin memperluas source matrix terbaru. Tidak diusulkan parser untuk sumber tambahan tersebut.

### 5.2 SOA field matrix: kemampuan kode, bukan fakta isi PDF

Legenda: **K** = field ditangani parser existing; **—** = tidak diekstrak parser existing; **U** = ketersediaan aktual PDF belum diverifikasi. Setiap sel menunjukkan `kode / PDF aktual`. Tidak diekstrak tidak berarti tidak ada pada sumber.

| Field | BIONS SOA | Stockbit SOA | Pluang monthly |
|---|---|---|---|
| Transaction date | — / U | — / U | — / U |
| Transaction type | — / U | — / U | — / U |
| Symbol pada posisi | K / U | K / U | K / U |
| Quantity pada posisi | K / U | K / U | K / U |
| Harga transaksi individual | — / U | — / U | — / U |
| Gross transaksi | — / U | — / U | — / U |
| Net transaksi | — / U | — / U | — / U |
| Fee | — / U | — / U | — / U |
| Dividend | — / U | — / U | — / U |
| Opening holdings eksplisit | — / U | — / U | — / U |
| Holdings as-of/closing yang dimaksud parser | K / U | K / U | K / U |
| Average cost/price | K / U | K / U | K / U |
| Cash balance | — / U | — / U | — / U |
| As-of date, market price/value | K / U | K / U | K / U |

Kode TC BIONS mencoba membaca date/type/symbol/qty/price/gross/net/komponen fee, tetapi reference dan gross tidak dipertahankan seluruhnya pada output canonical. TC Stockbit mencoba membaca date/type/symbol/qty/price/buy/sell; reference/lot tidak dipertahankan dan fee dinolkan. CA BIONS mencoba membaca payment date, symbol, balance acuan, gross/tax/net; output membuang gross dan menggabungkan tax dengan fee. Semuanya masih memerlukan pembuktian terhadap fixture aman, termasuk unit dan semantik angka.

**Gate sumber:** pembacaan field aktual hanya dilanjutkan setelah pemilik menyediakan/menegaskan fixture yang benar-benar disanitasi, termasuk text layer, metadata, attachment, anotasi, dan filename. Jika tidak tersedia, audit coverage dokumen tetap terbuka; implementasi tidak boleh menyatakan field yang hilang sebagai 0.

## 6. KEEP / REFACTOR / REPLACE / NEW / DEFER matrix

REPLACE di sini berarti mengganti logika tertentu setelah persetujuan, bukan menghapus aplikasi atau data.

| Komponen | Keputusan | Arah dan alasan |
|---|---|---|
| Laravel, React/Vite, Sanctum | KEEP | Stack memadai; tidak perlu rebuild proyek kosong |
| users/platforms/accounts/FK ownership | KEEP + REFACTOR | Pertahankan ID; tambah onboarding dan provider/account validation |
| Session/CSRF/password hashing | KEEP | Tambahkan throttle dan test autentikasi |
| Transaksi/snapshot existing | KEEP + REFACTOR | Migrasi additive dan legacy flags; jangan reset data |
| List/CRUD API dan UI transaksi | REFACTOR | Typed validation, nullable semantics, revision/audit, kompatibilitas |
| Hash/dedup dan update identity | REPLACE | Service identitas, source observations, ambiguity review, concurrency safety |
| Snapshot date/provider hash sebagai satu-satunya identitas | REPLACE | Revision/supersession dan idempotensi sumber terpisah |
| PDF.js lokal dan preview/import confirmation | KEEP + REFACTOR | Boundary tetap; perbaiki layout extraction, limits, lifecycle, minimisasi metadata |
| Enam parser dan classification | REFACTOR | Registry dan versioned multi-output contract; hanya sumber yang tersedia |
| Global confidence/aritmetika 10% | REPLACE | Validasi per event/field/semantik; score tidak membatalkan hard failure |
| Provenance, monthly summary, coverage | NEW | Bedakan evidence individual, observasi posisi, dan agregat |
| Projection/reconciliation/audit/review | NEW | Kontribusi penelitian utama |
| Dashboard placeholder | REPLACE bertahap | Gunakan API hasil nyata dan status kualitas; jangan angka mock |
| Existing tests | KEEP + EXTEND | Pertahankan guard ownership/CRUD, tambah kasus lintas sumber |
| Backend Vite scaffold, aset/template lama | DEFER cleanup | React SPA terpisah; tidak perlu menghapus untuk MVP |
| OAuth/n8n/email ingestion/market data | DEFER | Di luar pekerjaan sekarang; email parser menunggu fixture |
| Perubahan judul resmi/claim novelty | DEFER keputusan | Memerlukan pembimbing, bukan keputusan implementasi |

## 7. Target architecture

```text
Privacy browser: PDF.js -> layout-aware extraction -> source registry
 -> parser versioned -> normalisasi -> validasi -> preview dan konfirmasi
 -> structured import envelope saja
Laravel: ownership + authoritative validation -> source/import observations
 -> semantic matching + accepted canonical ledger
 -> snapshots/revisions dan monthly summaries (entitas terpisah)
 -> opening baseline + deterministic holdings projection
 -> reconciliation runs/items + review/audit + recomputation
 -> API dashboard posisi observed vs ledger-derived, kualitas per metrik
```

Market value/pricing adalah lapisan terpisah dari integritas quantity. Monthly aggregate tidak boleh ditambahkan lagi di atas transaksi yang membentuk agregat itu. Satu source dapat menghasilkan ketiga jenis output, tetapi SOA tidak diwajibkan menghasilkan ledger event jika bukti individual tidak tersedia.

## 8. Database changes required

Rincian urutan migrasi ada dalam rencana pendamping. Tidak ada migration dibuat/dijalankan pada Phase 0.

1. Tambah `source_documents`, `import_batches`, dan `source_observations`: provider/medium/type, account, periode/as-of, parser/schema version, fingerprint sumber, import time/status, field availability dan row locator aman. Jangan simpan raw text/PDF/password atau filename sensitif.
2. Tambah relasi observation ke transaksi (`transaction_sources`), review/duplicate candidates, canonical identity version, accepted/rejected/superseded lifecycle. Beberapa source observation boleh mendukung satu event.
3. Perluas transaksi secara additive: effective date/time precision, imported_at, asset type/unit, source ref terlingkup akun, gross/net/fee/tax nullable, amount semantics, original unit/quantity, revision/supersession. Pisahkan dividend cash dari reference holding quantity. Jangan reinterpret `total_amount` legacy secara diam-diam.
4. Perluas snapshot: source/period, coverage per posisi/aktivitas/biaya, version/supersession, approval. Items: unit/asset type, field availability, decimal casts, uniqueness terlingkup snapshot/instrumen; partial import tetap PARTIAL.
5. Tambah `account_opening_positions` atau baseline-selection entity yang mereferensikan snapshot terverifikasi; bukan synthetic ledger entry.
6. Tambah `monthly_activity_summaries` dan coverage intervals. Nilai null + status/reason; complete verified no-activity saja menjadi 0. Source aggregate dan derived ledger summary harus dibedakan.
7. Tambah `reconciliation_runs`, `reconciliation_items`, evidence links/input manifest, revision watermarks, review cases, dan append-only application audit events. Stale/superseded terpisah dari hasil finansial.
8. Tambah index account/effective date/asset/status, constraint relasi ownership dan idempotency, versioned rules/tolerances. Evaluasi precision crypto di atas 8 desimal dari fixture aman; data yang sudah dibulatkan tidak bisa dipulihkan hanya dengan memperlebar kolom.

Backfill legacy harus UNKNOWN/UNVERIFIED bila bukti tidak cukup. Kesetaraan jumlah row/saldo legacy harus dicek pada database disposable setelah izin; tidak ada row historis dihapus atau auto-merge ambigu.

## 9. API changes required

Existing endpoint dijaga kompatibel selama transisi: GET akun; CRUD transaksi; POST transaksi bulk dan snapshot bulk. Tambahkan service layer/typed requests/owner-scoped resources di belakangnya terlebih dahulu.

Usulan kontrak baru: import preview/confirm berbasis structured data; status/receipt import; GET snapshot/version/items; GET observed holdings dan ledger projection terpisah; monthly summaries/coverage; POST/GET reconciliation run/items; review resolution dan audit history. Server menghasilkan accepted state, identity, dan confidence authoritative; client score hanya informasi pendukung.

Bulk harus memiliki batas row/payload, idempotency key, alasan per row, transaksi DB per unit kerja yang jelas, penanganan concurrency, error code aman, serta larangan arbitrary metadata. Provider harus sesuai platform akun, semua nested reference harus owner-scoped. Replay identik menghasilkan receipt sama; perubahan input dengan key sama menghasilkan conflict. Tidak ada endpoint raw PDF/password pada Privacy Mode.

## 10. Reconciliation Engine design (MVP quantity)

1. Pilih akun/instrumen/unit dan closing snapshot terverifikasi pada `t`. Baseline harus snapshot yang tepat untuk periode dengan `t0 < t`; opening-only belum menjadi pembandingan terhadap dirinya sendiri.
2. Gunakan baseline quantity, accepted events dengan effective date `(t0, t]`, dan stable tie-breaker. Jangan gunakan tanggal import sebagai tanggal transaksi atau time buatan untuk ordering ekonomi yang belum diketahui.
3. BUY menambah quantity; SELL mengurangi; cash dividend/fee/deposit/withdrawal tidak mengubah quantity saham. Reference balance dividen bukan tambahan saham. Transfer/split/merger hanya diterapkan jika ada kontrak eksplisit; selain itu tandai incomplete/review.
4. Bandingkan union asset baseline, ledger, dan snapshot. Aset yang tidak tercantum hanya boleh diartikan nol jika scope holdings snapshot lengkap dan comparable; ketiadaan dari partial snapshot = UNKNOWN.
5. `expected = opening + sum(valid quantity deltas)`. `delta = observed - expected`. Gunakan decimal arithmetic dan toleransi per unit yang disetujui; tidak menggunakan float atau toleransi persentase uang 10% untuk quantity.
6. Simpan expected/observed/delta yang bisa dihitung, status per asset, reason codes, coverage, evidence, baseline/closing IDs, input revisions, rule version, dan timestamps. Tidak membuat transaksi untuk menutup delta.

| Status hasil | Makna |
|---|---|
| MATCHED | Selisih dalam toleransi dan baseline/unit/coverage transaksi/closing memadai |
| MISMATCH | Selisih melampaui toleransi dengan input comparable dan coverage memadai; mismatch tidak otomatis membuktikan transaksi tertentu hilang |
| INCOMPLETE | Baseline/coverage/unit/field tidak memadai; selisih numerik dapat ditampilkan sebagai indikasi, bukan vonis pasti |
| PENDING_REVIEW | Ambiguitas identitas, snapshot conflicting, mapping aset, atau event menunggu keputusan manusia |

`RECONCILIATION_MISMATCH` dapat menjadi reason/API code untuk item MISMATCH; jangan membuat enum hasil yang berbeda tanpa mapping. Status keseluruhan disertai counts keempat status dan alasan; jangan menyembunyikan item mismatch hanya karena ada item lain incomplete. Usulan prioritas ringkasan: PENDING_REVIEW, kemudian INCOMPLETE, kemudian MISMATCH, lalu MATCHED, dengan semua counts tetap terlihat.

Missing transaction detection pada MVP = kandidat gap/unsupported event berdasarkan selisih dan coverage. Mesin tidak dapat menyimpulkan tanggal/harga/jenis transaksi spesifik hanya dari dua snapshot. Duplicate detection menggunakan provenance dan aturan deterministik, bukan sekadar mencari angka selisih yang sama.

Late event/correction/duplicate resolution menandai run terkait stale dan membuat run baru; run sebelumnya tetap dapat diaudit. Event sebelum/tepat baseline tidak boleh ditambahkan setelah baseline: periksa baseline/sumber sebelumnya, tandai konflik/butuhkan rebaseline, atau replay dari baseline lebih awal yang sah. Snapshot baru memperbarui observed position tanpa menghapus sejarah ledger.

## 11. Privacy Mode compatibility dan keterbatasan analytics

**Transaction-Based Update:** opening snapshot diterima sebagai baseline; TC/CA valid menghasilkan ledger event; closing SOA menjadi pembanding. Sebelum closing SOA, projection adalah hasil hitungan, bukan observed position terkini. Coverage tetap harus dibuktikan.

**Monthly Statement-Based Update:** setiap SOA menjadi observasi as-of baru. Aktivitas individual hanya dari rincian tervalidasi; agregat masuk summary. Tanpa rincian aktivitas, observed holdings tetap berguna tetapi projection/reconciliation bisa INCOMPLETE. Selisih snapshot tidak menghasilkan trade buatan.

**Mixed:** source baru dicocokkan ke event yang sama atau review; summary bukan ledger tambahan. Tanggal efektif menentukan periode walaupun import terlambat. Snapshot dapat tetap memuat partial coverage tanpa klaim lengkap. Snapshot bulan dengan nol aset harus dapat direpresentasikan setelah format/coverage benar-benar diverifikasi.

Static network boundary sesuai tujuan: File -> ArrayBuffer/PDF.js lokal -> selected structured rows -> API, setelah klik import. Namun belum ada network-capture test; metadata/error logging perlu minimisasi. Kode saat ini tidak menyediakan input password dan hanya menangkap password error; dukungan PDF terenkripsi belum lengkap. Jangan menambahkan server upload sebagai jalan pintas.

Analytics yang aman harus membawa value, status, reason, basis, as-of, currency, dan coverage masing-masing:

- Transaction count = individual canonical accepted nonduplicate events; cakupan jenis yang dihitung harus eksplisit. Agregat SOA bukan transaksi individual.
- BUY/SELL amount: usulan jumlah gross yang terverifikasi per currency, sementara net/fees ditampilkan terpisah. Legacy mixed `total_amount` tidak bisa langsung dijumlah.
- Dividend: gross/tax/net terpisah; dividend received memakai net jika tersedia. Tax yang tidak diketahui tetap null, bukan 0.
- Portfolio value/allocation: hanya harga/value bertanggal dan universe aset/currency yang diketahui. Snapshot value adalah nilai pada tanggal laporan, bukan harga live. Cash tidak digabung jika cakupannya belum diketahui; jangan menjumlah mata uang berbeda tanpa FX yang sah.
- Cost basis: usulan moving weighted average per account/asset untuk Gate 4, perlu persetujuan. Average price snapshot tidak otomatis membuktikan biaya historis lengkap termasuk fee. Opening cost unknown -> realized/unrealized P/L unknown untuk bagian terkait.
- Win rate = jumlah SELL dengan realized P/L positif / jumlah SELL yang P/L-nya dapat dihitung; break-even masuk denominator. No sells = N/A; semua cost basis unknown = NOT_AVAILABLE; hanya sebagian sales dapat dihitung = INCOMPLETE dengan denominator jelas.
- Bulan kosong yang coverage-nya lengkap = 0 untuk metrik aktivitas terkait. Belum ada transaksi terimpor atau parser tidak menemukan baris tidak membuktikan bulan tanpa aktivitas.

## 12. Testing inventory dan strategi

Terdapat 14 metode test backend (termasuk dua example tests) dan 11 frontend test cases di source. Backend menguji CRUD/ownership transaksi, exact-repeat hash, list akun, satu happy-path snapshot, dan bulk transaksi. Frontend menguji beberapa deteksi, keenam parser dengan string tersusun, serta dua happy-path validation profiles.

Belum ada bukti tests untuk PDF.js extraction-to-parser, browser privacy boundary, password/layout drift, mixed SOA/TC identity, snapshot conflict/partial/empty, source contract, coverage, concurrency, auth CSRF, reconciliation, replay, atau analytics. Test CA hanya parse; belum membuktikan normalisasi dan tanggal benar di beberapa timezone. Test update belum memastikan identitas berubah dengan benar.

Usulan verifikasi: unit deterministik + integration disposable database MySQL dan SQLite + browser E2E dengan fixture sanitized. Wajib menguji semua skenario permintaan pemilik: initial snapshot, monthly-only, transaction-based, mixed, duplicate SOA/TC, late import, mismatch, missing fields, complete-empty versus unknown month, dividend, win rate/no-sell, dan multi-account isolation. Detail case IDs dan gate acceptance ada dalam rencana.

Metrik penelitian: field correctness, dedup precision/recall pada label ground truth, reconciliation confusion matrix, quantity error, late-replay correctness, dan processing time. Tidak ada nilai metrik diarang; target dan hasil pengukuran harus dipisah.

## 13. Arsitektur, dependencies, dan risiko

Frontend manifest: React 19, Router 7, Axios, PDF.js 6; dev Vite 8, Vitest, oxlint dan testing-library. Backend manifest: PHP ^8.2, Laravel ^12, Sanctum ^4, PHPUnit/Pint. `frontend/package-lock.json` dan `backend/composer.lock` ada. Versi tersebut adalah deklarasi repository, bukan verifikasi versi terpasang atau jaminan bebas vulnerability.

Ada toolchain Vite/Tailwind terpisah pada scaffold backend. Belum ada dependency grafik pada frontend. Tidak perlu menambahkan library grafik/decimal/queue pada Phase 0; kebutuhan dievaluasi pada gate terkait. Composer setup/test scripts dapat menjalankan instalasi, migrasi, build atau config-clear; jangan dipakai untuk audit read-only. CI workflow tidak ditemukan pada inventaris `.github`.

Risiko utama:

1. **Integritas angka:** mixed gross/net, unknown dipaksa nol, float identity, precision crypto, dan timezone dapat menghasilkan audit/P&L salah.
2. **Integritas sumber:** partial snapshot terlihat lengkap, source reference hilang, parser layout drift; false MATCHED dan false duplicate lebih berbahaya dari sekadar import error.
3. **Privasi:** fixture belum disanitasi, metadata/error/log bebas, raw SQL error response. Review harus memakai source locator aman, bukan full extracted text.
4. **Ownership:** existing guard berguna tetapi nested provenance/baseline/run/review perlu owner scoping; belum ada negative snapshot/bulk cross-user tests.
5. **Jejak perubahan:** mutable CRUD dan cascading deletion tidak cukup untuk audit trail. Kebijakan retention/account deletion harus diputuskan; append-only aplikasi tidak otomatis tamper-proof terhadap administrator database.
6. **Demo vs aktual:** default seeder membuat data/akun demonstrasi. Pisahkan seed platform referensi dari seed demo sebelum onboarding data pengguna; jangan tampilkan demo sebagai hasil pengguna.
7. **Risiko akademik:** belum ada verifikasi novelty, judul, scope evaluasi, atau aktual field coverage PDF. Dashboard bukan kontribusi rekonsiliasi itu sendiri.

## 14. Roadmap dan pertanyaan persetujuan

Urutan rekomendasi: Gate 1 kontrak sumber aman + characterization extraction/parser; Gate 2 additive schema/import/provenance/dedup; Gate 3 quantity projection/reconciliation/replay/audit; Gate 4 analytics kualitas data; Gate 5/6 Automatic Mode dan market data hanya bila diizinkan kemudian; Gate 7 evaluasi akhir.

Keputusan yang perlu pemilik/pembimbing:

1. Apakah Gate 1 boleh dimulai, dengan target kontrak/enam sumber PDF saja dan tanpa migrasi lebih dahulu?
2. Siapa yang memverifikasi sanitasi PDF dan menyiapkan fixture aman, termasuk metadata/filename? Email fixture Stockbit dividend dan Pluang transaksi belum tersedia.
3. Apakah judul resmi dipertahankan, novelty sudah dibandingkan, dan metrik/ground truth penelitian disetujui?
4. Setujui gross/net/tax semantics, date-only versus timestamp/timezone, lot/share normalization, precision/tolerance crypto setelah pemeriksaan sumber aman.
5. Setujui baseline selection/rebaseline, coverage declaration dengan provenance, snapshot supersession, ambiguity review, dan kebijakan correction/void/retention.
6. Apakah moving weighted average untuk cost basis disetujui? Jika tidak, pilih metode eksplisit sebelum P/L. Fee yang unknown tidak boleh dialokasikan tanpa aturan yang disetujui.
7. Setujui strategi migrasi legacy dan uji disposable database; siapa yang melakukan backup database dan operasi Git? Semua mutasi Git tetap pemilik.
8. Tentukan jenis transaksi yang masuk transaction-count, cakupan cash/asset type, report/export wajib, dan workflow account onboarding minimum.

**Recommended first implementation task:** G1-01, membekukan contract parser/import envelope dan evidence manifest untuk fixture yang aman; kemudian characterization test extraction-to-parser. Jangan memulai dashboard, Gmail, n8n, market data, atau migrasi sebelum gate relevan disetujui.

## 15. Batas akhir Phase 0

Hanya dua laporan Phase 0 dibuat. Tidak ada source code/dependency/database yang diubah, file dihapus, migrasi/test runtime dijalankan, atau Git state/history dimutasi. Perubahan pemilik yang sudah ada tetap dipertahankan.

**STOP — menunggu persetujuan pemilik untuk implementasi Gate 1.**
