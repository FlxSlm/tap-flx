# PROJECT CONTEXT
## Rancang Bangun Integrasi Data Portofolio Aset Finansial Berbasis Web Prototipe

## 1. IDENTITAS
- Judul: Rancang Bangun Integrasi Data Portofolio Aset Finansial Berbasis Web Prototipe
- Studi kasus: Stockbit dan Pluang
- Hasil: prototipe web
- Fokus: otomasi dan integrasi data portofolio
- Bukan fokus utama: AI/ML, RPA klasik, OCR sebagai metode utama, atau trading recommendation.

## 2. MASALAH UTAMA
Data investasi tersebar pada beberapa platform, struktur laporan berbeda, dan konsolidasi manual berulang serta berisiko terlupakan.

Sistem bertujuan:
1. memperoleh data transaksi dari Stockbit/Pluang;
2. menyediakan Automatic Mode dan Privacy Mode;
3. menormalisasi data sumber berbeda;
4. menyimpan satu canonical transaction ledger;
5. menghasilkan holdings;
6. mengambil market data untuk valuasi;
7. menampilkan dashboard dan reporting.

## 3. MODEL PENGEMBANGAN
Incremental Development adalah model SDLC utama.

Urutan penelitian secara umum:
1. identifikasi masalah & kajian pustaka;
2. pengumpulan data;
3. analisis kebutuhan;
4. perancangan;
5. pembangunan incremental;
6. integrasi & pengujian;
7. evaluasi & penyempurnaan;
8. analisis hasil & dokumentasi.

Applied Research adalah orientasi/jenis penelitian.
Design and Implementation adalah pendekatan penelitian terhadap pembangunan artefak.
Keduanya bukan dua SDLC tambahan.

## 4. ENAM INCREMENT
### Increment 1 — Foundation
- React/PWA dasar
- Laravel backend
- MySQL
- authentication
- canonical transaction schema
- API internal transaksi
- mock transaction
- testing dasar

### Increment 2 — Document Processing & Privacy Mode
- PDF.js/client-side processing
- parser Stockbit dan Pluang
- regex/rule-based extraction
- normalization
- ground truth
- Privacy Mode

### Increment 3 — Automatic Mode
- Gmail OAuth 2.0
- n8n
- email trigger/filter
- attachment retrieval
- document-processing pipeline
- structured result ke Laravel

### Increment 4 — Validation & Canonical Ledger
- hard validation
- rule-based confidence scoring
- review
- deduplication/idempotency
- transaction hash
- canonical ledger

### Increment 5 — Market Data & Valuation
- saham: Yahoo Finance primary, GOAPI fallback
- crypto: Indodax
- REST/WebSocket sesuai kebutuhan
- latest available price
- LIVE/DELAYED/STALE
- holdings
- valuation = quantity × latest available price
- provider health/failover

### Increment 6 — Reporting & End-to-End
- dashboard final
- period-based reporting
- report generator
- end-to-end integration
- final testing
- evaluation

## 5. ARSITEKTUR KONSEPTUAL
Stockbit / Pluang
→ Automatic Mode OR Privacy Mode
→ Document Processing
→ Provider-specific Parser
→ Normalize
→ Validate
→ Confidence / Review
→ Deduplicate
→ Canonical Transaction Ledger
→ Holdings
→ Market Data
→ Valuation
→ Dashboard / Reporting

## 6. CANONICAL TRANSACTION SCHEMA
Field inti:
- user_id
- source
- transaction_date
- symbol
- transaction_type
- quantity
- price
- total
- source_document_id
- transaction_hash
- parser_version
- timestamps

Schema final boleh disesuaikan dengan desain database aktual selama tetap konsisten dengan proposal.

## 7. PENTING UNTUK IMPLEMENTASI
Pada Increment 1:
- API dasar transaksi = API internal Laravel.
- TIDAK perlu Yahoo Finance.
- TIDAK perlu GOAPI.
- TIDAK perlu Indodax.
- TIDAK perlu Gmail OAuth.
- TIDAK perlu n8n.
- TIDAK perlu PDF parsing.
- TIDAK perlu valuation.

Target inti pertama:
React → Laravel API → MySQL → response → React,
dengan minimal satu transaksi dummy berhasil diproses.

## 8. DATA & TESTING
Dataset utama:
- Stockbit valid: 10–20
- Pluang valid: 10–20
- duplicate: 2–5
- irrelevant documents: 5
- encrypted correct password: 5 jika tersedia
- wrong password: 5
- changed-layout mocks: 5–10
- email samples: 10–20

Kuesioner:
- 21 responden
- hanya pendukung analisis kebutuhan
- bukan dataset parser
- bukan dasar generalisasi populasi

## 9. ATURAN SCOPE
Jangan menambahkan fitur besar di luar proposal tanpa persetujuan user.
Jangan mengerjakan increment berikutnya sebelum increment aktif cukup stabil.
Jangan mengubah arsitektur besar tanpa menjelaskan alasan dan dampaknya.
Jangan menyimpan secrets di source control.
Jangan mengklaim absolute real-time tanpa bukti provider.
Jangan mengklaim zero-knowledge untuk seluruh aplikasi.

## 10. CURRENT FOCUS
Current increment: Increment 1 — Foundation.
