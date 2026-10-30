# Updated Implementation Roadmap — Gate 1.5

Tanggal: 29 Oktober 2026. Fokus penelitian Portfolio Reconciliation Engine tetap. Gate 2 holdings dan Gate 3 reconciliation sudah mempunyai implementasi/tests; tidak dibangun ulang atau diturunkan prioritas menjadi penghapusan kode. Prioritas saat ini adalah acquisition/import yang bisa didemonstrasikan.

## 1. Urutan dan acceptance

1. **Stabilization internal — diuji.** Session-expiry handling, account onboarding existing, source-schema error, shared parsers, BIONS field tests dan HTTP persistence. Konfirmasi gejala browser utama masih memerlukan pemilik login ulang/Network QA.
2. **Automatic MVP internal — diimplementasikan, diuji simulasi.** OAuth/Gmail backend, PDF attachment processing, password pending review, receipt/dedup, mode switching, multiple connection foundation dan n8n assets. Google boundary fake pada integration; live sign-off BLOCKED.
3. **Prioritas berikutnya — satu live acceptance terisolasi.** Pemilik konfigurasi OAuth/n8n sesuai setup guide → synthetic email/PDF → workflow → review/import/receipt → replay → refresh/restart → disconnect/pause. Browser/network desktop/mobile harus dicatat. Tidak memerlukan main migration untuk membuktikan demo.
4. **Main safety gate — BLOCKED.** Backup dan restore diverifikasi, review log/private-data checklist, keputusan retention, browser QA dan keputusan migration manual. Gate 3.5 tetap BLOCKED sampai seluruh syarat dipenuhi. Tidak ada perpindahan otomatis ke Gate 4.
5. **Perluasan berdasarkan bukti.** Sanitized Stockbit dividend email dan Pluang transaction email → source contract EMAIL tervalidasi + fixtures + parser/version + provenance + cross-PDF/email matching konservatif. Saat belum ada sampel, UNSUPPORTED_EMAIL tetap benar; jangan membuat parser generik atau menganggap PDF mencakup seluruh aktivitas.
6. **Baseline account persistence dan cash contract** setelah MVP live diterima; kemudian penyempurnaan kualitas/reconciliation/analytics berbasis data lengkap. AI fallback/assistant terakhir, terpisah dari perhitungan backend. News/market data/P&L tetap tidak diintegrasikan pada gate ini.

Tidak menetapkan tanggal selesai palsu sebelum external setup/approval tersedia. Hasil gate keseluruhan saat ini BLOCKED — DO NOT COMMIT; tool readiness source yang lulus bukan pengganti acceptance live/UI.

## 2. Initial portfolio baseline per account — desain, belum migration baru

Gate 2 sudah mendukung opening snapshot eksplisit pada projection request dan konfirmasi snapshot teraudit. Yang belum ada adalah pilihan default baseline yang bertahan sebagai revision per akun. Rekomendasi entity account_baseline_revisions:

- UUID/revision, investment_account_id, portfolio_snapshot_id, source_document_id (nullable hanya jika sumber legacy memang belum diketahui), baseline_as_of_date dari snapshot, position_coverage, confirmation/audit reference, status PROPOSED/ACTIVE/SUPERSEDED/INVALIDATED, created_by/confirmed_at, supersedes_id.
- Simpan source/input version dan kebijakan unit/time boundary agar default tidak menutupi baseline yang menjadi stale. Snapshot quantity asli tidak diubah. Authoritative as-of tetap snapshot, bukan upload/import time.
- Pilih baseline hanya dari owned snapshot yang valid dan terkonfirmasi, coverage/unit sesuai aturan. Baseline UNKNOWN/PARTIAL tidak membuat aset absen menjadi nol. Jangan auto-select snapshot latest untuk pertanyaan historis.
- Baseline baru membuat revision; tidak menghapus baseline, transactions atau source history sebelumnya. UI menampilkan periode/bukti/status dan pengaruh pada hasil.
- DATE mempertahankan interval (baseline_date, target_date]. Transaksi sebelum/tepat baseline tidak dihitung ulang. TIMESTAMP membutuhkan timezone/cutoff eksplisit seperti persetujuan Gate 2; ambigu → INCOMPLETE. Late-arriving event memakai effective date dan input version, kemudian rekalkulasi/freshness Gate 3, tanpa trade penyeimbang.

Acceptance: pilih/supersede baseline, cross-user/account reject, same-day boundary, late arrival, stale source, privacy monthly-only dan transaction-based; history lama immutable. Approval dibutuhkan untuk schema revision dan UX default, bukan mengubah histori diam-diam.

## 3. Cash RDN — kontrak rancangan

Pemeriksaan in-memory SOA BIONS dan Stockbit menemukan keyword cash/balance. Sampel BIONS juga mempunyai keyword deposit/withdrawal; pemeriksaan keyword Stockbit tidak menemukan keduanya. Ini bukti keberadaan bagian teks, **bukan verifikasi mapping saldo, signed movements, settled/unsettled atau coverage arus kas**. Tidak menyalin angka/identitas/nomor rekening ke laporan, tidak menulis parser cash atau data cash ke database.

Pisahkan balance observation dari movements. Kandidat cash_balance_snapshots: owned account, source observation, explicit currency, balance_kind CASH_RDN/SETTLED/UNSETTLED/UNKNOWN (hanya bila sumber menyatakannya), amount decimal exact, statement_as_of_date, effective_date jika memang tersedia, imported_at, coverage, confirmation, source version. Source quantity/posisi saham tidak menjadi cash.

Kandidat cash_movements: owned account, source observation, effective_date/date_precision, statement_as_of_date, imported_at, currency, direction CREDIT/DEBIT/UNKNOWN, exact amount, category DEPOSIT/WITHDRAWAL/TRADE_SETTLEMENT/DIVIDEND_CASH_RECEIPT/FEE_TAX/UNKNOWN, linked canonical event nullable, review/validation status dan identity/dedup key. Balance snapshot adalah kategori terpisah, bukan event movement. Jangan membutuhkan nomor RDN asli.

Aturan:

- Hanya saldo akhir diketahui → simpan balance snapshot; tidak membuat movement dari selisih saldo.
- Penarikan efektif 12 Juli baru diketahui statement awal Agustus → effective_date 12 Juli jika sumber membuktikannya, statement_as_of_date sesuai dokumen, imported_at Agustus. Jangan backfill informasi yang belum tersedia pada knowledge-time lama; laporkan freshness dan perubahan input.
- Estimated balance hanya boleh opening confirmed + seluruh evidenced signed cash movements pada interval/currency dengan coverage lengkap dan tanpa unresolved duplicates. Unknown component membuat hasil incomplete, bukan 0. Date ambigu tidak ditebak.
- Trade settlement dan dividend receipt tidak dihitung dua kali jika sudah mempunyai beberapa source evidence. Identitas/financial compatibility dan mandatory review berlaku. Snapshot cash dan movement tidak dijumlahkan sebagai dua aset.
- Total portfolio hanya menjumlahkan nilai saham/crypto dan cash RDN yang comparable pada as-of/currency/freshness yang dinyatakan. Jangan menghitung cash sebagai holding saham atau menjumlahkan cash snapshot beberapa periode. Tidak mengarang FX/market price.
- Dashboard membedakan CONFIRMED_REPORTED, ESTIMATED_WITH_COMPLETE_EVIDENCE, STALE dan UNKNOWN dengan as-of/source/imported time; tidak menampilkan unknown sebagai saldo nol.

Approval berikutnya: settled vs available cash, aturan signs/rounding/currency, sampel coverage, dedup settlement/dividend dan definisi tanggal total valuation. Schema additive dirancang/direview setelah acceptance MVP; belum ada migration cash pada gate ini.

## 4. AI extraction fallback — interface desain saja

Belum menginstal model, memanggil AI, atau membuat route extraction AI. Kontrak yang diusulkan:

```typescript
interface ExtractionSuggestionProvider {
  suggest(context: {
    sourceHash: string; provider: string; documentType: string;
    parserVersion: string; failureCodes: string[];
    redactedText: string; consentReference: string;
  }): Promise<{
    engine: string; modelVersion: string;
    suggestions: Array<{ rowKey: string; fields: Record<string, string | null>; evidenceSpans: string[] }>;
    missingFields: string[]; warnings: string[];
  }>;
}
```

Actual implementation nanti wajib memakai schema allowlist yang lebih sempit per provider/document, length/row limits, exact decimal strings, null untuk unknown, unit/timezone tanpa tebakan, evidence span yang tidak masuk log. Interface bukan izin mengirim raw text atau mengaktifkan model cloud.

Pipeline: regex → deterministic validation → jika gagal/ambigu, optional extraction suggestion → schema validation → exact financial validation existing → mandatory owner review → confirmed Gate 1 import. LLM tidak mempunyai DB writer, tidak mengubah ledger/cash, tidak membuat BUY/SELL/nominal/quantity, dan tidak menerima confidence-nya sendiri sebagai acceptance.

Ollama dengan model lokal qwen3:4b menjadi kandidat evaluasi, bukan model yang sudah terbukti cocok. Registry menyediakan tag tersebut dan Ollama mendukung inference lokal tanpa API key; hardware, latency dan akurasi harus diukur di komputer target. [Qwen3 4B registry](https://ollama.com/library/qwen3:4b), [Ollama local quickstart](https://docs.ollama.com/quickstart).

Jika text berpindah dari browser ke Laravel/Ollama server, disclosure batas privasi dan consent wajib; jangan menyebut Zero-Knowledge. Gemini unpaid tidak menjadi default untuk data pribadi: ketentuan saat ditinjau menjelaskan penggunaan input/output untuk pengembangan layanan serta kemungkinan human review, dan melarang pengiriman informasi sensitif/confidential/personal ke unpaid services. Cloud hanya dipertimbangkan untuk data sintetis atau redacted yang sesuai kebijakan dan persetujuan eksplisit; persetujuan tidak mengalahkan ketentuan penyedia. [Gemini API terms](https://ai.google.dev/gemini-api/terms).

Dataset: synthetic labeled fields dan sanitized fixtures yang disetujui, pisah train-like prompt examples dari held-out format variants. Metrik: exact field match, row precision/recall, invalid arithmetic/unsupported field rate, hallucination rate, mandatory-review correction rate, latency/memory dan biaya. Tidak membuat klaim novelty/accuracy universal dari beberapa sampel atau benchmark model umum.

## 5. AI portfolio assistant — future read-only

Context builder backend melakukan ownership check, lalu menghasilkan as-of, explicit currency/unit, backend-computed holdings/allocation/valuation jika tersedia, source/reconciliation reason codes, coverage dan CURRENT/STALE history. Semua nominal dihitung oleh service backend dan disertai availability; model tidak menghitung ulang atau melengkapi unknown.

Assistant hanya menjelaskan kondisi/alokasi/perubahan yang terbukti, status reconciliation dan completeness; menyertakan source/input version dan uncertainty. Tidak mempunyai import/edit/delete/trading tools, autonomous trading, prediction atau rekomendasi BUY/SELL tidak terverifikasi. Berita relevan baru dapat ditambahkan sesudah scope/lisensi/relevansi disetujui terpisah. Belum ada endpoint/chat/model/key pada gate ini.

## 6. Keputusan yang masih diperlukan

- Pemilik mengonfigurasi Google/n8n dan menyelesaikan consent secara lokal; tidak mengirim secret ke Agent.
- Pembimbing/pemilik menerima atau meminta revisi batas MVP: review wajib, attachment PDF dulu, unsupported email formats, label90-day window/UNKNOWN coverage, retention queue dan security assurance sender.
- Pemilik menyelesaikan browser functional/network QA serta backup+restore; setelah itu meninjau migration manual pada environment yang dikehendaki.
- Sediakan sanitized email samples sebelum parser Stockbit dividend/Pluang transaction; persetujuan kontrak EMAIL diperlukan sebelum implementasi.
- Baseline revisions, cash schema, local AI consent/retention dan evaluasi model ditinjau per gate berikutnya. Tidak ada modul baru otomatis dibangun setelah laporan ini.

Rekomendasi implementasi berikutnya setelah acceptance eksternal: tutup temuan live Gmail/n8n dan browser terlebih dahulu, lalu tambah verified email-source contract/parser secara kecil. Hindari memperluas analytics/AI sebelum completeness acquisition dapat dijelaskan.
