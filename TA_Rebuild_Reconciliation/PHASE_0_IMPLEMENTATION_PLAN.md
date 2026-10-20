# PHASE 0 — CONTROLLED REBUILD IMPLEMENTATION PLAN

Tanggal: 20 Oktober 2026 (Asia/Makassar). Status: **USULAN UNTUK REVIEW; BELUM DIIMPLEMENTASIKAN**.

Dasar: [PHASE_0_AUDIT_REPORT.md](PHASE_0_AUDIT_REPORT.md) dan seluruh 12 dokumen target dalam paket ini. Aturan terbaru pemilik mengungguli instruksi commit/progres pada paket: AI tidak melakukan operasi Git pengubah state, termasuk staging, commit, push, branch, merge, reset, maupun remote changes. Implementasi hanya setelah persetujuan gate; tidak ada transaksi penyesuaian fiktif.

## 1. Sasaran dan batas

Sasaran utama adalah **Portfolio Reconciliation Engine** berbasis opening position + accepted canonical events + closing snapshot, dengan data completeness, duplicate/late-event handling, mismatch evidence, serta audit trail. Dua pola Privacy Mode tetap dipertahankan dan bisa dicampur.

Pertahankan Laravel, React, Sanctum, ID akun/transaksi, data lama, dan tests relevan. Gunakan additive migrations yang bisa diuji pada database disposable, bukan proyek baru/reset. Usulan endpoint/nama tabel berikut adalah rancangan konkret untuk review dan dapat disesuaikan sebelum implementasi. Phase 0 hanya menghasilkan dua laporan ini.

Non-goals sekarang: Gmail OAuth, n8n, ingest email otomatis, provider market data, trading, AI/OCR sebagai inti, perubahan judul akademik, atau parser sumber yang belum tersedia.

## 2. Persetujuan yang menjadi prasyarat

| Keputusan | Usulan default untuk review | Pengaruh bila belum disetujui |
|---|---|---|
| Fixture PDF | Verifikasi/redaksi independen sebelum Agent membuka isinya; originals tetap lokal dan diabaikan Git | Actual field mapping/extraction regression tertunda; jangan mengklaim coverage |
| Academic scope | Judul resmi tetap; quantity reconciliation sebagai MVP | Jangan mengubah klaim penelitian/novelty |
| Amount semantics | Gross/net/fee/tax nullable terpisah; total legacy tetap legacy | Jangan hitung nominal lintas sumber atau P/L dari total campuran |
| Time/unit | Effective date provider, explicit precision; stock share normalized, original lot retained bila terbukti | Unit/tanggal ambigu -> review, bukan auto-convert |
| Cost basis | Moving weighted average per account/asset, hanya pada biaya yang diketahui | P/L/win rate terkait tetap NOT_AVAILABLE |
| Coverage | Dimensi holdings/activity/dividend/fees terpisah, evidence dan reviewer tersimpan | Snapshot bulanan tidak otomatis membuktikan semua transaksi tercakup |
| Correction/retention | Revision/void dengan audit, snapshot supersession, tidak hard-delete evidence otomatis | Perlu keputusan privasi dan retention sebelum API koreksi |
| Compatibility | Legacy tetap bisa dibaca; import baru memakai versioned contract | Backfill ambigu tetap UNKNOWN/UNVERIFIED |

Persetujuan Gate 1 tidak otomatis menyetujui eksekusi migrasi atau seluruh gate berikutnya.

## 3. Target pipeline dan tanggung jawab

```text
Browser: PDF lokal -> extraction berstruktur -> registry parser berversi
 -> normalized transactions[] + snapshots[] + summaries[] + coverage[]
 -> validasi client -> preview per jenis output -> konfirmasi pengguna
Laravel: validate + ownership/provider checks -> persisted import batch
 -> observations + semantic matching/review -> canonical accepted data
 -> baseline/projection -> reconciliation runs/items -> audit/review/API
React: observed positions + derived positions + quality/reconciliation status
```

Source parser tidak boleh menyimpan/mengirim full PDF text. Browser memegang file/password sementara saja. Backend menjadi otoritas validasi, ownership, source-to-event matching, status accepted, dan perhitungan. Client confidence adalah advisory. DTO/allowlist harus menolak raw text, binary, password, arbitrary PII metadata, dan filename pribadi.

Usulan service Laravel: `ImportValidationService`, `TransactionIdentityService`, `ImportCommitService`, `CoverageService`, `HoldingsProjectionService`, `ReconciliationService`, dan `AuditService`. Ini batas tanggung jawab, bukan kewajiban membuat banyak abstraksi sekaligus. Controllers tetap tipis dan menggunakan FormRequest/owner-scoped Resources. Tidak perlu microservice untuk prototipe ini.

## 4. Gate 1 — Source contracts dan parser boundaries

### G1-01: tugas pertama yang direkomendasikan

Setelah persetujuan, bekukan versioned parser output/import envelope dan buat manifest evidence aman bagi enam sumber PDF yang benar-benar tersedia. Belum membuat migration pada task ini.

Kontrak minimum:

- `schema_version`, `parser_id`, `parser_version`, provider, medium, document_type.
- Account ID dipilih pengguna; account fingerprint aman hanya jika dibutuhkan untuk konsistensi, bukan raw account number.
- Period start/end, as_of_date, effective date/time precision, timezone policy.
- `transactions[]`, `snapshots[]`, `monthly_summaries[]`; ketiganya bisa kosong dengan status/alasannya masing-masing.
- Field-level availability: KNOWN/NOT_AVAILABLE/UNKNOWN/INVALID; coverage dimensi COMPLETE/PARTIAL/UNKNOWN dengan evidence dan verified_by bila disetujui.
- Warnings/hard errors, safe page/section/row locators, source observation IDs. Tidak ada teks mentah atau password di envelope.
- Angka decimal dalam string canonical tanpa pemisah ribuan; date-only tetap date-only. Unit/currency/type whitelist dan field optional sesuai event.

Manifest mencatat fixture ID sintetis, sanitasi, layout variant, kebutuhan password tanpa menyimpan nilainya, header/field aman, locale, unit, period semantics, output expected, dan parser version. Jangan menyalin nilai investasi asli.

### G1-02: characterization dan extraction

- Uji actual sanitized PDF melalui PDF.js, bukan hanya string multiline manual.
- Evaluasi item Y-coordinate/hasEOL dan pengelompokan baris/kolom; perbaiki mismatch extractor yang meratakan teks dengan regex berawalan baris.
- Multi-page, repeated headers, wrapping, empty section, zero holdings, number/date locale, invalid numeric, unsupported layout, dan file/password errors harus dibedakan.
- Verifikasi release resource loading task/document dan limits file/page/row; encrypted PDF tetap lokal, jangan fallback upload server.

### G1-03: enam parser existing

| Sumber | Arah perubahan setelah bukti fixture |
|---|---|
| BIONS TC | Simpan source reference, gross/net/fee/tax components, date/unit; jangan kehilangan informasi pada normalize |
| BIONS SOA | Posisi/as-of/period/coverage; aktivitas individual/agregat hanya jika nyata tersedia |
| BIONS CA cash dividend | Reference balance terpisah dari quantity delta; gross/tax/net, payment date; price unknown tetap null |
| Stockbit TC | Preserve reference dan lot/share semantics; fee per baris unknown tetap null, fee dokumen sebagai observation bila tersedia |
| Stockbit SOA | Posisi/as-of/period/coverage; jangan menyimpulkan transaksi dari perubahan quantity |
| Pluang monthly | Crypto precision/unit, posisi/as-of/coverage; aktivitas/agregat hanya jika benar-benar ada |

Stockbit dividend email dan Pluang transaction email: hanya interface/source registry entries yang ditandai unsupported sampai fixture sanitized tersedia. Jangan buat parser format khayalan, Pluang TC PDF, atau Stockbit dividend PDF.

Gate 1 exit: field matrix dari evidence aman disetujui, extraction-to-normalize tests tersedia untuk keenam sumber, contract tidak memaksa missing ke 0, tests lama tetap relevan. Jika fixture belum aman, laporkan item blocked khusus fixture dan minta keputusan; jangan menyebut actual PDF coverage sudah selesai.

## 5. Gate 2 — Additive database migration dan import integrity

### 5.1 Rencana schema

| Tahap | Entitas/perubahan | Constraint/backfill utama |
|---|---|---|
| M01 | `import_batches`: owner/account, key, payload_digest, schema/parser versions, status, counts, created/confirmed/completed_at | Unique account + idempotency_key; key sama payload berbeda -> conflict |
| M02 | `source_documents`: account, provider, medium/type, period/as-of, safe fingerprint/reference, parser version, status | Tidak menyimpan file/text/password/nama sensitif; replay fingerprint bukan pengganti semantic dedup |
| M03 | `source_observations`: source/batch, kind, stable locator/reference, structured allowlisted fields, availability/status | Unique source + stable observation identity; row ordinal saja tidak tahan layout drift |
| M04 | Extend `transactions`: nullable source-compatible amounts, effective date precision, imported_at, asset type/unit, reference qty, identity_version, acceptance/revision fields | Preserve ID dan kolom legacy; FK/ownership; index account/effective date/asset/status |
| M05 | `transaction_sources` dan `duplicate_candidates` | Observation mendukung satu accepted event; banyak evidence bisa mendukung event sama; ambiguity tidak auto-collapse |
| M06 | Extend snapshot/header/items; `account_opening_positions` | Revision/supersedes, coverage, source, baseline selection; item unique normalized asset/unit; no forced quantity zero |
| M07 | `monthly_activity_summaries` + coverage intervals | Account/period/currency/metric/basis/source/revision; null unknown, 0 verified complete only |
| M08 | `reconciliation_runs`, `reconciliation_items`, evidence/input manifest | Immutable completed result + input revisions/rule version; state stale/superseded terpisah |
| M09 | `review_cases`, `audit_events` | Account-owner scoping; actor/action/reason, safe before/after revision references; no secrets/raw payload |

Logical ownership chain: user -> account -> sources/batches -> observations -> transaction evidence; account -> snapshot -> items; account -> baseline -> projection -> reconciliation run -> items/evidence. Semua relasi lintas account ditolak server, bukan hanya berdasarkan client ID.

Kolom finansial baru: `gross_amount`, `net_amount`, `fee_amount` yang sudah ada dipertahankan, `tax_amount`, `amount_semantics`, currency; `quantity` untuk quantity event dan `reference_quantity` untuk balance dividen. Jangan mengartikan harga 0 legacy CA sebagai harga pasar 0. Cash flow sign dan quantity delta dipisahkan menurut type.

Precision quantity/price harus diuji terhadap fixture crypto. Usulan awal baru `decimal(36,18)` bila diperlukan, belum keputusan final; amount scale mengikuti bukti currency/provider. Simpan original precision dan warning rounding. Jangan melewati JSON/PHP/JS float untuk identitas/perhitungan authoritative. Pilih solusi decimal yang teruji setelah memeriksa ekstensi PHP terpasang dan kebutuhan library; tidak menambah dependency sebelum dijelaskan/disetujui pada gate terkait.

Unique `transaction_hash` lama tidak bisa menjadi satu-satunya guard karena menolak dua event sah identik. Setelah jalur baru dan race tests tersedia, rencanakan relax uniqueness lama sebagai migration terpisah yang disetujui; kolom/history tetap disimpan. Canonical surrogate ID unik, trusted source identity dan observation mapping memiliki constraint; semantic fingerprint menjadi index pencarian kandidat, bukan selalu unique event key.

### 5.2 Strategi deployment/backfill tanpa kehilangan data

1. Pemilik menyiapkan backup database dan baseline counts; audit schema/data aktual dengan izin, tanpa dump PII ke laporan. Catat versi MySQL/MariaDB, tabel terpasang, collision/overflow, data demo, precision, dan dependency runtime.
2. Buat migration additive nullable/side tables pada database disposable; jangan `migrate:fresh`, drop data, atau menjalankan seed demo pada database pengguna.
3. Tetapkan `LEGACY_UNVERIFIED`, provenance legacy, dan amount semantics UNKNOWN untuk row yang bukti mappingnya tidak cukup. Created_at dapat diberi label legacy-recorded-at, bukan diklaim tanggal impor asli yang terverifikasi.
4. Jangan recompute hash/merge seluruh transaksi lama otomatis. Buat candidate review; original IDs/values tetap tersimpan. Fee 0 dan total legacy tidak otomatis disimpulkan valid.
5. Pasang compatibility adapter dan dual-read terkontrol; uji old endpoints/tests dan API baru. Tulis data baru memakai contract baru saja; jangan dual-write dua ledger aktif.
6. Jalankan counts, relasi ownership, idempotency/race, decimal roundtrip, rollback simulation, dan diff projection pada salinan data; catat perubahan yang diharapkan.
7. Baru minta persetujuan migration database target dengan rencana downtime/lock/copy dan recovery. Rollback aplikasi ke read-only legacy harus mempertahankan tabel/evidence baru, bukan drop data baru. Recovery restore oleh pemilik sesuai rencana, bukan Agent menjalankan reset.

### 5.3 Semantic dedup dan reconciliation antar-source

Urutan deterministik:

1. Owner/account/provider/asset/type/unit/date/currency harus comparable; trusted transaction reference yang scope-nya telah diverifikasi diprioritaskan.
2. Reimport observation/source identity yang sama -> receipt/evidence existing, tanpa tambahan transaksi.
3. Reference cocok dan seluruh invariants comparable -> link evidence pada event existing; reference sama tetapi isi konflik -> review, jangan overwrite.
4. Tanpa reference, fingerprint canonical decimal memakai account/provider/effective date atau time precision/asset/type/quantity/price/gross atau net yang semantiknya sebanding. Missing amount/fee tidak diganti nol; toleransi hanya untuk rounding yang terbukti.
5. Satu kandidat compatible tanpa reference masih membutuhkan bukti cukup bahwa kedua observation adalah event sama. Bila dua trade sah identik mungkin terjadi, jangan auto-merge hanya dari fingerprint; PENDING_REVIEW.
6. Ambiguous/multiple candidates -> review case, tidak menambah kedua event sebagai accepted secara otomatis. Simpan keputusan same-event/distinct-event dan audit.
7. Gunakan locking/constraint retry agar dua import paralel tidak menghasilkan accepted duplicate. Atomic commit untuk satu confirmed source batch mencakup ketiga output dan evidence; partial success antardokumen boleh hanya jika receipt menjelaskannya.

UI selalu menampilkan hasil per observation: INSERTED, LINKED_EXISTING, PENDING_REVIEW, atau REJECTED, beserta safe reason. Update/void accepted event harus membuat revision, memperbarui matching state, mencatat audit, dan menginvalidasi proyeksi terdampak.

## 6. API migration plan

| Existing atau usulan | Perubahan dan acceptance |
|---|---|
| POST `/register`, `/login`, `/logout`; GET `/api/user` | Pertahankan Sanctum; throttle/auth/CSRF tests, error aman |
| GET `/api/investment-accounts` | Pertahankan; onboarding akun/platform minimal terpisah dari seed demo |
| CRUD `/api/transactions` | Compatible read; typed write, owner scoping, canonical semantics, audit/revision; legacy unknown diberi label |
| POST `/api/transactions/bulk` | Adapter ke import service; gunakan validated allowlist, bounds, error classification, idempotent receipt |
| POST `/api/portfolio-snapshots/bulk` | Adapter ke versioned snapshot service; provider cocok akun, coverage/partial/empty semantics, revision review |
| POST `/api/import-batches/preview` dan `/{id}/confirm` | Structured JSON saja; preview tidak menciptakan accepted ledger. Confirm merevalidasi revision/preconditions dalam DB transaction |
| GET `/api/import-batches/{id}` | Receipt/status owner-scoped; jangan mengembalikan raw payload/error SQL |
| GET `/api/portfolio-snapshots` dan `/{id}` | List/filter account/as-of/version; items/coverage/status |
| PUT `/api/investment-accounts/{id}/opening-position` | Pilih baseline snapshot milik akun; revision + reason + invalidation, bukan insert BUY |
| GET `/api/holdings` | `basis=observed` atau `ledger`, as_of/account; basis/coverage/as_of jelas |
| GET `/api/monthly-activity-summaries` | Source-reported versus ledger-derived basis, currency, completeness terpisah |
| POST `/api/reconciliation-runs`; GET list/detail/items | Input baseline/closing/rule version; run fingerprint/idempotency; exact input manifest dan statuses |
| POST `/api/review-cases/{id}/resolve` | Owner, reason, expected revision; same/distinct/approve/supersede; tidak auto-create adjustment trade |
| GET `/api/audit-events` | Owner scoped, pagination, redacted evidence references |
| GET `/api/analytics/monthly` | Gate 4; bulan/tahun/provider/asset type/account; setiap metrik value/status/reason/basis/currency/as-of |

Nama/versi final harus dibekukan pada Gate 2. Tidak ada endpoint ini dibuat dalam Phase 0. Pagination/filter validation dan batch size limit wajib; endpoint confirmation/review/recompute menggunakan concurrency preconditions untuk mencegah keputusan dari preview usang.

## 7. Gate 3 — Holdings projection dan Portfolio Reconciliation Engine

### 7.1 Pure quantity projection lebih dahulu

- Input immutable: account, verified baseline snapshot/revision pada `t0`, accepted ledger revisions, target date `t`, unit/asset map, coverage intervals, rule version.
- Interval `(t0, t]`: hindari double counting transaksi yang sudah termuat opening. Jika boundary intraday atau trade-date/settlement-date belum pasti, pending review; jangan memilih berdasarkan import time.
- Map quantity BUY = +q, SELL = -q, cash dividend = 0. Unknown corporate action/transfer menurunkan completeness; tidak dipaksa BUY/SELL. Negative holdings untuk akun tanpa short support menjadi review anomaly, bukan dibetulkan otomatis.
- Deterministic order dan exact decimal. Jika economics memerlukan urutan intraday yang tak tersedia, nyatakan incomplete; stable ID tie-breaker hanya determinisme replay, bukan bukti urutan nyata.
- Baseline dan closing harus berbeda observasi/waktu yang sah. Tanpa baseline, output observed-only dan INCOMPLETE; jangan baseline=closing untuk memperoleh MATCHED palsu.

### 7.2 Compare dan explain

Bandingkan union symbols/units; absence = 0 hanya untuk snapshot dengan complete asset universe. Simpan expected, observed, delta = observed - expected, tolerance, status/reason, source evidence. Baseline/reference cash dan asset quantities harus terpisah. Cash dividend tidak mengubah jumlah saham.

Result enum MATCHED/MISMATCH/INCOMPLETE/PENDING_REVIEW sesuai laporan audit. Lifecycle enum QUEUED/RUNNING/COMPLETED/FAILED ditambah stale/superseded metadata terpisah. Coverage lengkap bukan otomatis jumlah file lengkap; perlu bukti period coverage, gap/unsupported-event checks, dan verification record. Jumlah tepat sama tetapi coverage unknown tetap tidak boleh dianggap bukti MATCHED lengkap.

Missing/duplicate diagnosis bersifat evidence-backed candidate. Delta saja tidak cukup menentukan missing SELL/BUY tertentu. Reason examples: NO_BASELINE, PARTIAL_ACTIVITY_COVERAGE, SNAPSHOT_PARTIAL, UNIT_UNKNOWN, UNSUPPORTED_EVENT, DUPLICATE_AMBIGUOUS, SNAPSHOT_CONFLICT, QUANTITY_MISMATCH. UI dapat memakai RECONCILIATION_MISMATCH sebagai code pemetaan QUANTITY_MISMATCH/MISMATCH yang disepakati.

### 7.3 Late-arriving transaction dan replay

1. Commit accepted import/correction/void/duplicate resolution menghasilkan affected account/asset/effective-date range dan input version baru.
2. Mark run dengan target date >= affected effective date sebagai stale jika input/baseline-nya bergantung pada perubahan. Untuk perubahan tanggal, pertimbangkan tanggal lama dan baru; perubahan baseline memengaruhi seluruh run turunannya.
3. Replay dari baseline sah sebelum perubahan. Event <= t0 tidak ditambahkan lagi setelah t0; tandai baseline consistency review atau gunakan baseline lebih awal yang disetujui.
4. Simpan hasil baru, supersedes old run, evidence, rule version, dan input manifest. Hasil lama tidak dihapus. Repeated replay identik idempotent; stale results tidak tampil sebagai current verified.
5. Jika versi input berubah selama run, jangan publish sebagai current; retry/supersede dengan state jelas. Untuk MVP dapat mulai sinkron per account dengan locking dan bounded input; worker baru diperlukan jika pengukuran mendukung.

Gate 3 exit: semua skenario quantity/late/dedup/coverage dan isolation lulus pada data sintetis berlabel; run dapat direproduksi dari manifest tanpa raw PDF. Tidak ada adjustment trade yang ditulis oleh engine.

## 8. Dua pola Privacy Mode dan mixed import

| Jalur | Write output | Hasil UI yang jujur |
|---|---|---|
| Opening saja | Verified snapshot + baseline link | Opening position; reconciliation belum tersedia |
| Transaction-based | Ledger TC/CA + evidence, closing SOA bila ada | Projection sejak baseline; comparison hanya pada closing yang comparable |
| Monthly-only | Snapshot baru, optional evidenced events/summaries | Observed holdings update; activity/P&L unknown jika source tidak menyediakan rinciannya |
| Mixed SOA/TC/CA | Matching observations ke canonical event; snapshot/summary terpisah | Satu event dihitung sekali; ambiguous pending review |
| Empty complete month | Empty/zero activity observation dengan verified coverage | 0 untuk metrik aktivitas relevan; no-sell win rate N/A |
| Unknown month | Tidak ada bukti lengkap | UNKNOWN/NOT_AVAILABLE/INCOMPLETE; jangan 0 karena list kosong |

Test network harus membuktikan request hanya structured fields setelah user confirmation. Cegah file/password/full text di fetch/XHR, logs, telemetry, storage persisten, import errors, atau review evidence. Runtime limits dan cleanup memory tidak mengorbankan local-only boundary.

## 9. Gate 4 — Dashboard analytics setelah integrity MVP

Bangun API agregasi authoritative dahulu, baru React dashboard/filters. Pertahankan layout referensi sebagai visual saja; angka contoh tidak boleh menjadi hasil pengguna. Filter bulan/tahun/provider/asset type/account harus konsisten dan menyertakan currency/as-of/basis.

| Metrik | Definisi usulan dan syarat |
|---|---|
| Portfolio value/allocation | Observed value pada tanggal statement atau pricing tervalidasi; partial scope diberi label; jangan klaim live |
| Transaction count | Count canonical accepted individual events, nonduplicate, effective period; definisikan count all-events dan BUY/SELL subtotal agar jelas |
| BUY/SELL amount | Sum verified gross masing-masing currency; net terpisah, unknown tidak diisi 0 |
| Dividend received | Net penerimaan yang diketahui; gross dan tax terpisah; reference holdings bukan delta |
| Realized P/L | Usulan weighted-average carrying cost; proceeds net dikurangi carrying cost sold; fee/tax mapping tidak boleh dihitung dua kali |
| Unrealized P/L | Marked value minus known carrying cost pada as-of sama; price/cost missing -> NOT_AVAILABLE |
| Win rate | Profitable computable SELL / semua computable SELL; break-even bukan win; tanpa SELL -> N/A; partial computability -> INCOMPLETE |
| Monthly activity trend | Series value + status per bulan; gap unknown bukan bar 0; jangan menjumlah source aggregates dan ledger-derived amount dua kali |
| Reconciliation/completeness | Counts/status/reasons, observed vs expected, stale/coverage flags dan review link |

BUY carrying cost dapat mencakup biaya pembelian yang diketahui; SELL proceeds memakai net yang sudah termasuk tax/fee sehingga tidak dikurangi dua kali. Average cost snapshot hanya boleh menjadi opening cost setelah semantiknya tervalidasi dan disetujui; tidak memulihkan histori transaksi yang tidak ada. Snapshot-only value dapat tersedia sementara realized P/L belum tersedia.

Chart library belum ditentukan; evaluasi kebutuhan, bundle, dan maintenance ketika Gate 4 disetujui. Tidak mengubah dependencies sekarang. Tidak membangun Automatic Mode atau mengambil market data untuk “melengkapi” metrik yang source-nya belum cukup.

## 10. Testing strategy dan acceptance matrix

Phase 0: inventory saja, 14 backend methods dan 11 frontend cases ditemukan; tidak ada test runtime baru. Existing tests dijadikan regression guard setelah diizinkan. Backend `RefreshDatabase` hanya dijalankan nanti pada environment test disposable, dengan verifikasi koneksi/DB terlebih dahulu. Jangan jalankan composer setup/dev/test scripts tanpa memeriksa efek sampingnya.

| ID | Skenario | Expected acceptance | Layer/gate |
|---|---|---|---|
| T01 | Initial verified snapshot | Baseline reference, tidak ada synthetic BUY, no self-match | Unit/API G2–3 |
| T02 | Dua monthly-only SOA tanpa activity detail | Observed position berubah; ledger tidak dikarang; activity UNKNOWN | API/E2E G2–3 |
| T03 | Baseline + BUY/SELL + closing lengkap | Expected quantity benar, MATCHED dalam unit/tolerance benar | Unit/integration G3 |
| T04 | Mixed SOA + TC | Evidence digabung atau review; count/event tidak dobel | Integration G2–3 |
| T05 | SOA/TC representasi nominal berbeda | Match hanya normalized comparable semantics/reference; ambigu review | Unit/integration G2 |
| T06 | Dua trade sah identik tanpa reference | Tidak collapse secara pasti; distinct evidence/review decision disimpan | Unit/race G2 |
| T07 | Late SELL sebelum closing | Historical run stale -> new run, results deterministik | Unit/integration G3 |
| T08 | Late event sebelum/tepat baseline | Tidak ditambah dua kali; earlier replay/rebaseline review | Unit G3 |
| T09 | Snapshot dan projection berbeda, coverage lengkap | MISMATCH + delta/evidence; tidak ada write adjustment trade | Unit/API G3 |
| T10 | Missing field/unit/cost/activity coverage | INCOMPLETE atau REJECT/PENDING sesuai field; no fabricated 0 | Semua gate |
| T11 | Complete empty activity month | Count/BUY/SELL/dividend 0 bila semua scope terbukti; win rate N/A | Unit/API G2–4 |
| T12 | Unknown month/no imported rows | UNKNOWN/NOT_AVAILABLE, tidak 0 | Unit/API G2–4 |
| T13 | BIONS cash dividend | Gross/tax/net benar; reference quantity, quantity delta 0 | Parser/domain G1–4 |
| T14 | Win rate dengan profit/loss/break-even dan unknown basis | Numerator/denominator eksplisit; unknown dikecualikan + incomplete status | Unit G4 |
| T15 | No SELL atau seluruh cost basis unknown | N/A no-sell; NOT_AVAILABLE unknown basis | Unit/UI G4 |
| T16 | Multi-user dan multi-account | Tidak read/write source/snapshot/baseline/run/review akun lain; akun user sama tidak tercampur | API G2–3 |
| T17 | Repeated import/retry/concurrent confirm | Satu canonical event/evidence link, receipt konsisten | Integration/race G2 |
| T18 | Partial dan revised same-date snapshot | Coverage partial; revision review/supersedes; no silent overwrite | API/UI G2 |
| T19 | Valid complete zero-holdings statement | Empty positions valid hanya dengan source/coverage evidence | Parser/API G1–3 |
| T20 | PDF extraction -> normalization | Multi-page/headers/line wraps/locale benar, tidak hanya string manual | PDF unit/browser G1 |
| T21 | Password, corrupt/large PDF, unknown layout | Local error aman, bounded resource use, no network leak | Browser G1–2 |
| T22 | Negative/overflow/NaN, decimal precision dan timezones | Typed validation; exact roundtrip; date-only tidak bergeser | Unit/API G1–3 |
| T23 | Update date/qty/ref dan void accepted event | New revision/identity + invalidation old/new periods + audit | API G2–3 |
| T24 | Split/transfer unsupported | INCOMPLETE/PENDING_REVIEW; tidak dipaksa BUY/SELL | Unit G3 |
| T25 | Snapshot symbol tidak ada/partial universe | Missing != zero kecuali scope complete; union assets diperiksa | Unit G3 |
| T26 | Raw fields/password/filename metadata disisipkan client | Ditolak/diabaikan allowlist, tidak di-log atau dipersist | API/network G2 |
| T27 | Source aggregate + ledger-derived summary overlap | Tidak double count, basis/provenance jelas | Unit/API G2–4 |
| T28 | Auth login/register/logout dan CSRF/cookie | Session lifecycle/throttle/unauth errors benar, bukan hanya actingAs | API/browser G2 |

Synthetic unit examples harus jelas terlabel data uji dan tidak tampil pada dashboard pengguna. Contoh quantity 100 + BUY 30 - SELL 10 = 120 harus memakai satu unit konsisten; untuk lot -> share konversi harus eksplisit sehingga tidak tertukar 120 lot dengan 120 saham.

Evidence penelitian: fixture ID/version yang aman, expected labels, per-field correctness, dedup TP/FP/FN dan precision/recall, reconciliation confusion matrix, absolute quantity error, replay/idempotency correctness, latency dan kegagalan. Pisahkan target dari hasil ukur; test suite lulus bukan otomatis bukti generalisasi semua provider/layout.

## 11. Roadmap, dependency, dan review gates

| Gate | Deliverable | Dependency | Effort relatif | Exit/review |
|---|---|---|---|---|
| 0 | Dua laporan audit/rencana | 12 dokumen target + static inventory | Selesai sebagai dokumen | Review pemilik/pembimbing; tidak ada implementasi |
| 1 | Safe source contracts, actual field matrix, extraction/parser regression | Approval G1 + fixture sanitized | Menengah | Batas sumber dan field terbukti; tidak invent transaksi |
| 2 | Additive schema, provenance/import, ownership, dedup/review, coverage, snapshot revisions | G1 contracts + migration approval | Besar | Reimport/race/isolation dan legacy compatibility lulus |
| 3 | Opening/projection/reconciliation/late replay/audit | Accepted data dan coverage G2 | Besar | Quantity/status correctness, no fictitious adjustment |
| 4 | Analytics API + React dashboard filters/charts | G3 + cost-basis/metric decisions | Menengah–besar | Unknown/0/N/A benar; no demo masquerading |
| 5 | Automatic Mode | Izin eksplisit kemudian, email fixture + threat review | DEFER | Gmail/n8n tidak dimulai pada scope sekarang |
| 6 | Market data/valuation adapters | Izin eksplisit kemudian, provider verification | DEFER | Tidak diperlukan untuk quantity reconciliation MVP |
| 7 | Evaluasi akhir/report/demo | MVP dan dataset berlabel | Menengah | Metrik nyata, limitations, review pembimbing |

Effort relatif bukan janji durasi. Review setiap gate menghasilkan daftar file/perubahan, hasil checks aktual, risiko, dan rekomendasi commit message; staging/commit/push tetap dilakukan pemilik. Jangan menggabungkan Gate 1–4 sebagai satu rewrite besar.

## 12. Security, data integrity, dan mitigasi

- Sanitasi fixture adalah prasyarat pembacaan. PDF originals dan backup riwayat lama tidak dipublikasikan; tidak mencoba remedi history Git pada Phase 0 atau gate berikutnya oleh Agent.
- Metadata allowlist, size/row limits, safe API reason codes, dan log redaction diperlukan; jangan mengembalikan exception SQL/payload sensitif.
- Reference IDs dan source hashes harus discope per account; jangan mengekspos fingerprint lintas user sebagai oracle duplikasi.
- Throttle, ownership setiap nested ID, no credential serialization, dan test CSRF mengurangi gap auth. Token email tetap tidak digunakan sekarang.
- Partial/unknown coverage dan unsupported events harus terlihat pada status; jangan otomatis menaikkan status saat numbers kebetulan sama.
- Ledger accepted revisions dan snapshot versions tidak diubah diam-diam. Audit mencatat actor/reason/versions tanpa full source text. Tentukan akses/retention/deletion sebelum menjanjikan audit immutable; administrator DB tetap perlu kontrol operasional.
- Precision/sign/timezone semantics harus sama pada frontend preview, backend normalization, DB, dedup, dan replay. Rounding yang sudah terjadi pada legacy perlu peringatan, bukan diklaim pulih.
- Seed demo dipisahkan dari platform reference seeding dan account onboarding. Tidak memakai mock P/L/values untuk menutupi API yang belum ada.

## 13. Open questions dan langkah sesudah review

Pertanyaan approval paling awal: apakah pemilik menyetujui **G1-01 (kontrak sumber dan manifest fixture aman)**, dan siapa yang mengesahkan sanitasi sebelum PDF dibuka? Tanpa itu, field coverage aktual tetap belum diketahui.

Pembimbing/pemilik juga perlu menetapkan judul/novelty, ground truth dan metrik evaluasi, amount/tax definitions, unit/tanggal/toleransi, cost-basis, baseline/rebaseline, coverage attestation, snapshot supersession, legacy migration, retention, metric transaction types, dan report/export wajib. Daftar rinci ada pada bagian 14 laporan audit.

Tidak ada persetujuan yang diasumsikan dari berjalannya waktu, hasil audit, atau ketersediaan package. Tidak ada migration/dependency/source edit/implementation di luar dua dokumen Phase 0 ini.

Rekomendasi commit message untuk dilakukan pemilik saja: `docs: add phase 0 reconciliation audit and implementation plan`.

**STOP — menunggu persetujuan pemilik untuk implementasi Gate 1.**
