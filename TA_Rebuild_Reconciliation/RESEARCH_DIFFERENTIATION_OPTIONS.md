# Research Differentiation Options & News Feasibility

Tanggal review: 27 Oktober 2026, Asia/Makassar. **Dokumen keputusan/usulan; tidak ada fitur yang diimplementasikan.** Gate 3.5 tetap BLOCKED sesuai laporan runtime dan [private test plan](PRIVACY_MODE_REAL_DATA_TEST_PLAN.md).

Rekomendasi: prioritaskan **Explainable Portfolio Reconciliation** sebagai pengembangan terukur dari fokus TA; gunakan dimensi kualitas data sebagai evidence pendukung. Tunda satu angka Portfolio Data Quality & Reliability Index sampai definisi konstruk, bobot, uncertainty dan validasinya disetujui. Berita merupakan opsi kontekstual yang sebaiknya DEFER, bukan pembeda utama yang menggantikan evaluasi rekonsiliasi.

## 1. Baseline proyek: apa yang sudah ada

Gate 1 sudah menyediakan source contracts, validasi typed/exact decimal, provenance/batch/observation, conservative duplicate matching, review status, import idempotency dan audit. Frontend sudah memiliki confidence 0–100 per baris berbasis field/rule; angka itu advisory dan bukan probabilitas kebenaran/kelengkapan portofolio.

Gate 2 sudah menghitung opening + accepted BUY − accepted SELL, membedakan unit/null/coverage, memilih baseline eksplisit, menyediakan snapshot confirmation teraudit, dan memberi deterministic input version. Gate 3 sudah memisahkan numerical equality dari MATCHED/MISMATCH/INCOMPLETE/PENDING_REVIEW, menampilkan quantity/evidence/reason codes, mengikat attestation pada versi/sumber, dan menyimpan history immutable/CURRENT/STALE bila schema tersedia.

`ReconciliationService.php` saat ini mengeluarkan daftar possible_causes generik yang sama saat selisih nonzero: import gap, unit mapping, asset transfer, corporate action, parser error, coverage gap. Daftar tersebut bukan diagnosis root cause spesifik yang terbukti. Header/item evidence tersedia, tetapi belum ada decision trace per rule yang terstruktur, pemeringkatan hipotesis berdasarkan bukti khusus, atau eksperimen manfaat penjelasan bagi pemeriksa.

Spesifikasi acuan lokal: [Gate 1 contract](GATE_1_SOURCE_CONTRACT.md), [Gate 2 holdings](GATE_2_HOLDINGS_SPEC.md), [Gate 3 reconciliation](GATE_3_RECONCILIATION_SPEC.md), [Gate 3.5 runtime status](GATE_3_5_RUNTIME_VALIDATION_REPORT.md). Penomoran/history tidak diubah oleh opsi ini.

## 2. Literatur dan pembanding awal: novelty belum terbukti

Review web ini terbatas pada sumber primer yang relevan, bukan systematic literature review atau uji komparatif produk:

- W3C PROV memodelkan provenance berupa entities/activities/agents dan derivation/versioning. Karena konsep provenance sudah mapan, menambah source ID atau audit trail saja tidak cukup sebagai klaim novelty. Implementasi tidak harus memakai RDF/ontology untuk mendapat manfaat pemodelan tersebut. [PROV Overview, W3C Working Group Note 2013](https://www.w3.org/TR/prov-overview/).
- Wang dan Strong membahas kualitas data lebih luas dari accuracy dan sesuai konteks pemakaiannya. Dimensi/indeks proyek harus diturunkan dari tugas quantity reconciliation, bukan mengklaim menemukan konsep data quality. [Beyond Accuracy, 1996, versi penulis MIT](https://web.mit.edu/tdqm/www/tdqmpub/beyondaccuracy_files/beyondaccuracy.html).
- Doshi-Velez dan Kim menekankan kebutuhan evaluasi interpretability yang jelas. Prinsip evaluasi dapat menginspirasi studi pengguna, tetapi paper ini membahas ML dan tidak membuktikan kebaruan mesin rekonsiliasi rule-based ini. [Towards A Rigorous Science of Interpretable Machine Learning, 2017](https://arxiv.org/abs/1702.08608).
- GnuCash sudah mempunyai reconciliation transaksi terhadap statement. Ini pembanding konsep keuangan, bukan bukti fitur/unit/coverage identik dengan proyek ini. Jangan mengadopsi balancing/dummy transaction dari produk pembanding. [GnuCash Reconcile Window](https://www.gnucash.org/docs/v5/C/gnucash-manual/gui-reconcile.html).
- Portfolio Performance mendokumentasikan pemeriksaan konsistensi impor dan data quality harga historis. Temuan ini menolak klaim umum bahwa aplikasi portofolio lain tidak memeriksa konsistensi/kualitas; kesamaan spesifik dengan quantity reconciliation lintas sumber masih perlu diperiksa. [CSV import consistency](https://help.portfolio-performance.info/en/reference/file/import/csv-import/), [data quality terminology](https://help.portfolio-performance.info/en/concepts/portfolio-performance-terminology/).

Sebelum menyatakan novelty, lakukan pencarian terstruktur pada karya ilmiah/TA dan produk pembanding: portfolio/account reconciliation, statement-ledger consistency, provenance/why-provenance, explainable discrepancy diagnosis, data-quality assessment, incomplete financial records, dan late-arriving events. Catat query/tanggal/database akademik, kriteria inclusion/exclusion, versi produk, fitur yang benar-benar dicoba, dataset/metric dan batas akses full text. Lakukan backward/forward citation serta perbandingan penelitian TA sejenis yang diminta pembimbing. Belum ada temuan “tidak ada penelitian serupa” yang sah dari review terbatas ini.

## 3. Opsi A — Explainable Portfolio Reconciliation

### Rumusan masalah

Bagaimana menyajikan alasan hasil rekonsiliasi dan ketidakcukupan bukti secara dapat ditelusuri, sehingga pemeriksa dapat menentukan pemeriksaan berikutnya dengan lebih tepat/cepat, tanpa menyimpulkan transaksi hilang tertentu dari delta dan tanpa mengubah ledger?

Pertanyaan empiris: apakah structured explanation meningkatkan ketepatan triage dan pemahaman atas uncertainty dibanding UI Gate 3 dengan status/reason/evidence existing? Menambah narasi saja belum menjawab pertanyaan ini.

### Kontribusi teknis yang diusulkan

1. Decision trace deterministik: setiap status dihubungkan dengan rule ID/version, predicate hasil TRUE/FALSE/UNKNOWN, input reference dan blocking effect. Pisahkan aritmetika valid, kelengkapan posisi, aktivitas, unit/date comparability, source validity, dan review/duplicate.
2. Evidence path: statement → observation → canonical event/revision → quantity contribution → comparison → keputusan coverage/status. Negative evidence harus hati-hati: tidak menemukan event di ledger hanya membuktikan event tidak ada pada input yang diperiksa, bukan tidak ada di dunia nyata.
3. Hipotesis terstruktur berlabel **didukung bukti tertentu / perlu pemeriksaan / tidak dapat ditentukan**, dengan evidence pendukung, batas kesimpulan dan next check. Daftar generik Gate 3 tetap baseline; jangan mengubahnya menjadi root-cause claim hanya dengan mengganti kata.
4. Explanation atas perubahan input: membedakan perubahan yang teramati pada source/event/revision/baseline dari perubahan hasil, dan menjelaskan stale proof/history. Input fingerprint account-wide dapat berubah karena input di luar interval; jangan selalu mengklaim late trade periode ini penyebabnya.
5. Evaluasi fidelity dan kegunaan penjelasan dengan ground truth independen serta tugas pengguna, bukan hanya snapshot test teks UI.

Ini sistem explainable rule-based, bukan kewajiban menambah LLM, SHAP, classifier atau metode kausal. Tidak mengklaim sebab-akibat ekonomi atau asal transaksi yang belum dibuktikan.

### Algoritma/rules yang dibutuhkan

- Tetap panggil engine Gate 2–3; jangan membuat kalkulasi authoritative kedua di React.
- Susun typed explanation facts dari DTO/input manifest dan evidence yang owner-scoped. Emit rule trace dengan urutan deterministik dan stable evidence references.
- Bentuk blocking set yang menjelaskan mengapa MATCHED/MISMATCH belum boleh diberikan. Jangan menghilangkan blocker ketika prose dibuat lebih ringkas.
- Saring hipotesis hanya dengan bukti spesifik: unit conflict mendukung pemeriksaan unit; unresolved candidate mendukung duplicate review; DATE/TIMESTAMP ambiguity mendukung cutoff review. Delta tanpa bukti lain menghasilkan undetermined/provisional gap, bukan “SELL sebesar delta hilang”.
- Sebutkan next check seperti meninjau unit statement atau source coverage. Tidak mengisi tanggal/quantity/harga transaksi yang tidak ada dan tidak membuat adjustment BUY/SELL.
- Fakta terkonfirmasi harus selalu mempunyai reference. User attestation dilabeli sebagai attestation, bukan verifikasi dokumen otomatis.
- Explanation yang bergantung input versi lama tetap historical/stale; jangan memperbarui stored result secara diam-diam.

Contoh sintetis: calculated 120 dan reported 120 dengan activity UNKNOWN harus menjelaskan “aritmetika sama; bukti kelengkapan interval belum dikonfirmasi; hasil INCOMPLETE”. Ketika calculated 115 versus reported 120 dengan coverage sah, jelaskan delta +5 dan evidence yang terlibat, tanpa menciptakan BUY 5.

### Perubahan database

Minimum awal dapat berupa DTO penjelasan on-demand di atas result existing, tanpa tabel baru. Namun untuk reproduksi penjelasan historis diperlukan explanation_schema_version, explanation_rule_version, input_version dan input manifest minimal yang memadai pada run baru.

Pilihan setelah approval: additive explanation record/run attachment yang append-only, atau schema result versi baru untuk **run baru**. Jangan overwrite JSON run lama. Bila trace dibangkitkan belakangan dari hasil historis, labeli waktu/versi pembangkit dan bukti yang tidak tersedia. Gate 3 belum menyimpan seluruh historical excluded input/revision state; jangan menjanjikan rekonstruksi full decision trace lama dari current ledger.

Model graph penuh, resolution workflow dan bitemporal ledger bukan prasyarat eksperimen awal; menambah ketiganya sekaligus memperbesar scope.

### Dataset dan evaluasi

Usulan dataset, belum dibuat: episode opening/events/closing berlabel untuk Stockbit/BIONS/Pluang snapshot dan sumber transaksi yang memang tersedia; synthetic confirmed events dapat menguji arithmetic, tetapi tidak boleh disebut parser Pluang TC PDF/email yang belum tersedia. Kasus meliputi complete match/mismatch, equal-but-unknown, monthly-only, partial/missing symbol, conflicting unit, duplicate ambiguity, rejected/unsupported event, timestamp ambiguity, late import dan stale history.

Bangun single fault dan kombinasi fault, termasuk beberapa kemungkinan sebab yang sengaja tidak dapat dibedakan. Label oleh pemeriksa independen/dua reviewer dengan pedoman, bukan mengambil label dari engine yang sedang dievaluasi. Sanitized PDF ground truth bila disetujui tetap dipisahkan dari private raw statement; real-data test tidak otomatis menjadi dataset publik.

Metrik yang diusulkan:

- Decision fidelity: persentase status/quantity/blockers penjelasan konsisten dengan engine/input rule yang benar; duplicate implementation error diperiksa dengan invariants.
- Evidence precision/coverage: klaim fakta yang memiliki reference benar dibanding seluruh klaim; blocker yang harus dijelaskan dibanding blocker ground truth. Template fluency bukan ukuran correctness.
- Unsupported assertion rate dan abstention correctness: berapa kali penjelasan mengklaim sebab/transaksi pasti tanpa bukti, atau tepat menyatakan tidak dapat ditentukan.
- Triage accuracy, waktu menyelesaikan tugas, dan pemahaman uncertainty pada perbandingan UI Gate 3 versus UI explanation. Gunakan tugas ekuivalen/counterbalanced order untuk mengurangi learning effect; laporkan sampel, variasi, effect size/interval yang sesuai, bukan hanya rata-rata membaik.
- Deterministic replay dan version/stale correctness; latency/resource overhead pada dataset yang ditentukan.

Split evaluasi berdasarkan episode/source/template/generator seed, bukan random rows dari statement yang sama. Pisahkan skenario tuning dari held-out evaluation. Tetapkan target penerimaan dan jumlah kasus/peserta bersama pembimbing sebelum hasil dilihat; tidak ada angka kinerja yang sudah diukur pada review ini.

### Kompleksitas dan risiko overclaim

Kompleksitas **menengah** bila membatasi diri pada rule trace, evidence mapping dan studi triage; menjadi tinggi untuk cause ranking yang tervalidasi, full history reconstruction atau resolution workflow. Kekuatan utama: memanfaatkan foundation existing. Risiko: sekadar rebranding reason codes Gate 3, tautologi explanation, “penjelasan terasa benar” tanpa fidelity, dan menyebut hipotesis sebagai penyebab pasti.

Klaim yang mungkin layak setelah evaluasi: manfaat mekanisme penjelasan berbasis bukti pada task/dataset yang ditentukan. Klaim yang belum layak: algoritma rekonsiliasi pertama, deteksi semua missing trades, causal diagnosis otomatis, atau unggul terhadap seluruh aplikasi portofolio.

## 4. Opsi B — Portfolio Data Quality & Reliability Index

### Rumusan masalah

Bagaimana merangkum kecukupan data untuk **tugas quantity reconciliation pada account/interval/unit tertentu**, sambil mempertahankan UNKNOWN, bukti, applicability dan blocking conditions sehingga angka ringkasan tidak memberi false assurance?

“Reliability” harus didefinisikan operasional. Indeks ini bukan risiko investasi, kinerja portofolio, kualitas emiten, probabilitas laporan benar, atau sertifikasi keaslian dokumen. Jika tidak ada outcome/ground truth independen untuk reliability, nama lebih jujur adalah **Portfolio Data Quality Assessment** terlebih dahulu.

### Kontribusi teknis dan beda dari existing

Existing: confidence per row, validation/review flags, coverage position/activity, numerical reconciliation, source references dan input freshness. Proposed: assessment lintas dimensi yang scope/version-nya eksplisit, dengan denominator, unknown/applicability, rule profile, explanations dan validasi hubungan terhadap kesalahan/triage. Menjumlah ulang confidence client atau persentase MATCHED bukan kontribusi baru yang cukup.

Dimensi kandidat yang harus didefinisikan terpisah:

1. Structural validity: passed checks terhadap input manifest, termasuk rejected/pending rows yang relevan, bukan hanya accepted ledger.
2. Unit dan temporal comparability: known comparable unit, effective interval yang dapat ditempatkan; tidak mengonversi LOT/SHARE/COIN.
3. Provenance traceability: input terhubung ke evidence/source/rule version, bukan jumlah file yang diunggah.
4. Uniqueness/review resolution: tidak ada ambiguity kritis; replay source identik tidak boleh menambah score.
5. Position dan activity evidence: FULL posisi berbeda dari activity attestation. Attestation harus diberi basis/evidence strength, tidak menjadi label objective truth.
6. Reconciliation consistency sebagai dimensi terpisah: mismatch pada input lengkap dapat menunjukkan isu konsistensi, sedangkan equality pada input tidak lengkap tidak membuktikan completeness.
7. Freshness terhadap input/target: CURRENT/STALE fingerprint berbeda dari umur dokumen. Snapshot 2020 valid untuk evaluasi historis 2020; jangan memberi penalti usia hanya karena hari ini 2026.

### Algoritma/rules dan uncertainty

Untuk setiap dimensi tentukan applicability, numerator, denominator, rule version, evidence, nilai KNOWN/UNKNOWN/NOT_APPLICABLE dan blocker. Denominator dunia transaksi yang sebenarnya tidak diketahui tidak boleh diganti jumlah rows terimpor. “Tidak ada pending rows” pada input parsial tidak membuktikan seluruh aktivitas unik/lengkap.

Bila score komposit disetujui, bobot adalah keputusan model yang perlu justifikasi, bukan probabilitas statistik. Usulan formula konseptual untuk nilai dimensi known `d_i` dalam [0,1], bobot positif `w_i`, dan himpunan applicable A:

```text
D = sum(w_i untuk seluruh dimensi applicable)
K = dimensi applicable yang nilainya known
U = dimensi applicable yang unknown
a = sum(w_i * d_i untuk i di K)
evidence_coverage = sum(w_i untuk i di K) / D
lower_bound = 100 * a / D
upper_bound = 100 * (a + sum(w_i untuk i di U)) / D
```

D=0 atau seluruh input tidak memadai → N/A/INSUFFICIENT_EVIDENCE, bukan 0/100. UNKNOWN tetap unknown; lower/upper adalah rentang matematis kemungkinan skor di bawah asumsi formula, **bukan confidence interval empiris** dan bukan mengasumsikan missing=0. NOT_APPLICABLE hanya untuk dimensi benar-benar tidak relevan menurut profile, bukan untuk menyembunyikan field hilang.

Jika ada critical unit/date/source/coverage/duplicate blocker, headline index harus unavailable dan readiness tidak lulus, berapa pun subscore lain. Jika belum semua applicable dimensions diketahui, tampilkan evidence profile/range secara provisional; jangan menonjolkan observed-only score tinggi sebagai reliability final. Score tidak boleh mengubah status Gate 3 atau meloloskan MATCHED/MISMATCH.

Validasi invariants: menambahkan duplicate/rejected event tidak meningkatkan eligibility; menggandakan source identik tidak memperkuat evidence; menghapus input buruk tidak memperbaiki quality dengan mengecilkan denominator secara tersembunyi; coverage UNKNOWN tidak menjadi FULL karena delta nol; known exact quantity tetap dihitung oleh service existing.

### Perubahan database

Assessment awal on-demand tidak harus menambah tabel. Persistence setelah approval memerlukan assessment run yang append-only: account/interval/target, input_version, assessment_rule/profile/version, bobot/applicability, evidence summary, unknown/blockers, actor/basis, timestamp; per-dimension values/reasons dan nullable composite/range. Profile/bobot di-version dan hasil lama tidak ditimpa ketika formula berubah.

Jangan menambah kolom mutable “quality_score” pada account lalu memperlakukannya berlaku untuk semua periode/unit/task. Jangan menggunakan score quantity-activity untuk income/fees/P&L readiness. Data finansial yang disalin ke assessment harus minimal dan owner-scoped.

### Dataset dan metrik evaluasi

Usulan: paired clean/corrupted episodes berlabel dengan missing events, unknown coverage, unit/date errors, duplicates, invalid metadata, source loss, stale input dan kombinasi fault. Sertakan equality yang kebetulan menutupi dua kesalahan, dataset monthly-only yang sah tetapi kurang untuk ledger reconciliation, dan no-activity period terkonfirmasi.

Ground truth independen menjelaskan apakah data cukup untuk tugas dan kesalahan apa yang ada; jangan menilai score dengan label yang dihitung dari formula score sendiri. Gunakan held-out episode/template/provider case setelah pemilihan aturan/bobot; bila data terlalu sedikit, laporkan batas generalisasi alih-alih memilih bobot terbaik pada test set.

Metrik yang diusulkan:

- False-ready/false-assurance rate pada input yang seharusnya ditahan; ini lebih penting daripada sekadar rata-rata score.
- Agreement terhadap expert sufficiency labels dan inter-rater agreement; macro F1/precision/recall untuk kelas readiness bila memang didefinisikan.
- Fault sensitivity, monotonicity violations, duplicate/gaming resistance, dan stabilitas per provider/unit/mode.
- Sensitivity analysis bobot/threshold dan ablation per dimensi; bandingkan terhadap confidence row existing serta binary gate/coverage vector sederhana. Composite harus menunjukkan manfaat tambahan.
- Association/ranking terhadap error severity atau triage outcome independen; korelasi tidak membuktikan kausalitas. Calibration/Brier hanya relevan jika kelak benar-benar ada predictive probability model dan target probabilistik yang sah.
- Reproducibility input/rule version dan latency. Jumlah peserta/skenario/threshold masih usulan untuk persetujuan, bukan hasil.

### Kompleksitas dan academic overclaim

Kompleksitas **menengah–tinggi**: arithmetic score mudah, tetapi construct validity, bobot, denominator, uncertainty dan evaluasinya sulit. Risiko terbesar adalah angka 0–100 yang tampak ilmiah tanpa dasar, kebocoran label dari engine, penalti terhadap monthly-only secara tidak adil, dan claim reliability dunia nyata dari data import yang tidak lengkap.

Tidak layak menyebut score “95% pasti benar” atau membandingkan kualitas investor antar-akun tanpa scope/evidence yang sama. Assessment vector yang dapat dijelaskan lebih defensible daripada indeks tunggal yang belum divalidasi.

## 5. Rekomendasi pemilihan dan keputusan pembimbing

Prioritas teknis yang disarankan:

1. Tutup blocker Gate 3.5 dan siapkan private preview/import environment sesuai test plan; tidak memulai migration main atau fitur baru dari dokumen ini.
2. Setujui literatur/pembanding dan label ground truth; pilih satu pertanyaan penelitian utama.
3. Jika memilih A, bekukan explanation contract/rule trace + evidence sufficiency, lalu evaluasi terhadap baseline Gate 3. Gunakan dimensi kualitas sebagai bahan penjelasan, tanpa score komposit pada increment pertama.
4. Pertimbangkan B sebagai eksperimen terpisah hanya jika ada justifikasi bobot/uncertainty dan kapasitas validasi; jangan menggabungkan A+B+news sebagai satu deliverable besar.
5. Berita tetap optional dan tidak memengaruhi canonical ledger, reconciliation, coverage maupun data-quality score.

Persetujuan yang diperlukan: rumusan masalah/judul resmi, definisi kontribusi di luar Gate 3, unit evaluasi dan pembanding, source-ground-truth policy, participant task/protocol, target penerimaan, scope persistence/retention dan versi explanation/assessment. Judul akademis tidak diganti oleh Agent.

## 6. News API feasibility — hanya perencanaan

Fakta plan/API berikut diperiksa pada 27 Oktober 2026 melalui dokumentasi resmi. Harga/quota/terms dapat berubah; verifikasi ulang sebelum pendaftaran, pembelian, demo publik atau distribusi dataset. Tidak ada API key diminta/disimpan, artikel diimpor, atau provider diintegrasikan.

### GNews

Free saat diperiksa: 100 request/hari, maksimal 10 artikel/request, delay 12 jam, history 30 hari, CORS localhost. Essential tercantum €49,99/bulan untuk 1.000 request/hari dan maksimal 25 artikel/request. Ini batas plan, bukan jaminan jumlah artikel relevan untuk emiten Indonesia/crypto. [GNews pricing](https://gnews.io/pricing).

Search mendukung keyword/phrase/boolean, from/to, language/country dan field title/description/content; country filter menunjuk negara penerbit, bukan jaminan aset/peristiwa di negara itu. Resolver aset tetap diperlukan. [GNews Search API](https://docs.gnews.io/endpoints/search-endpoint).

Terms terkini mengizinkan personal/academic/non-commercial pada free dan reasonable response caching untuk performance, tetapi membatasi commercial use serta redistribusi/competing database. Hak konten pihak ketiga tidak otomatis diberikan oleh subscription. Pricing juga membedakan published projects/paid use: klasifikasi demo akademik yang dipublikasikan perlu konfirmasi tertulis, bukan mengasumsikan localhost atau status TA membebaskan semua ketentuan. [GNews terms, updated 18 October 2026](https://gnews.io/legal/terms-of-service).

GNews adalah penyedia API pada domain tersebut; jangan menyamakan produk ini dengan layanan resmi Google News atau paket scraping open source yang kebetulan bernama mirip.

### NewsAPI.org

Developer saat diperiksa: 100 request/hari, delay artikel 24 jam, history sekitar satu bulan, CORS localhost. Business tercantum US$449/bulan dan 250.000 request/bulan. Developer hanya untuk development/testing; staging/production termasuk penggunaan internal tidak otomatis diizinkan. [NewsAPI pricing](https://newsapi.org/pricing), [NewsAPI terms](https://newsapi.org/terms).

Everything menyediakan q, searchIn, source/domain filtering, date range dan ordering; keyword relevance bukan security/entity resolution. Content response tersedia secara terbatas, bukan full-text archive yang otomatis boleh diterbitkan ulang. [Everything endpoint](https://newsapi.org/docs/endpoints/everything). Cakupan Indonesia/nama emiten harus diukur dengan sampel, bukan disimpulkan dari jumlah sumber total.

Pertahankan publisher/author/source notices dan cek hak penggunaan pihak ketiga; atribusi saja bukan izin menyalin copyrighted article. Terms yang ditinjau tidak memberikan TTL caching universal yang jelas untuk semua penggunaan: konfirmasi hak retention/cache sesuai plan sebelum menyimpan arsip atau dataset publik. Tidak mengasumsikan aturan caching GNews berlaku untuk NewsAPI. [NewsAPI data license](https://newsapi.org/terms).

Key dapat dikirim melalui X-Api-Key/Authorization; dokumentasi menyarankan header dibanding query string untuk mengurangi exposure. Tetap redaksi credential headers pada log server. [NewsAPI authentication](https://newsapi.org/docs/authentication).

### Alternatif feed berita

RSS/Atom publisher yang secara eksplisit disediakan dapat mengurangi kebutuhan API key dan memberi sumber lokal. Contoh katalog resmi ANTARA memuat feed ekonomi/finansial/bursa. Ketersediaan katalog tidak sama dengan hasil pengujian semua feed atau izin redistribusi/full-text. [ANTARA RSS directory](https://en.antaranews.com/rss/).

Tradeoff: biasanya tidak ada search per aset atau historical query seragam; cakupan bergantung feed dan buffer artikel terkini. Tidak ada quota/SLA universal: cek aturan tiap publisher, gunakan polling sopan, conditional GET/ETag/Last-Modified bila didukung, backoff dan batas ukuran. Izin pemanfaatan, cache/retention dan atribusi harus ditinjau per feed. Publik dapat dibaca tidak berarti bebas lisensi. Jika izin tidak jelas, DEFER atau tampilkan tautan sumber yang disetujui tanpa menyimpan artikel penuh.

Feed resmi pengumuman emiten/bursa dapat menjadi sumber kontekstual bila benar-benar tersedia/diizinkan, tetapi tidak diasumsikan mempunyai endpoint tertentu. Tidak membuat scraper paywall, Google News endpoint tidak terdokumentasi, atau parser feed khayalan pada tahap ini.

## 7. Desain relevansi, cache, key dan attribution yang disarankan bila kelak disetujui

**Relevansi:** registry asset identity terverifikasi (provider/exchange, canonical symbol, legal/company/project name, alias dan negative keywords), bukan query ticker mentah. Ticker pendek/ambigu, akronim, token yang juga kata umum, nama grup/subsidiary, sector-only article dan market roundup dapat false relevant. Exact legal/project name + finance context dapat memperkuat evidence; hasil yang hanya menyebut simbol ambigu harus ditahan/dilabeli lemah.

Proposed retrieval flow: public asset aliases → provider query/feed fetch → dedup URL/source/headline/time → entity/context rule → label direct/indirect/uncertain dengan alasan. Tetap simpan retrieved_at/published_at/source dan bedakan tidak ada hasil dari quota/error/stale cache. Tidak ada inference bahwa artikel menyebabkan harga/selisih portofolio.

**Validasi:** kumpulkan query/candidate pool untuk aset publik dan hard negatives, label dua reviewer, ukur precision@k, false-relevance rate, duplicate rate, freshness dan coverage per bahasa/provider. Recall memerlukan reference corpus yang didefinisikan; tidak mengklaim recall seluruh berita internet. News boleh menunjukkan relevansi awal, bukan investment recommendation atau causal evidence reconciliation.

**Quota/cache:** shared server cache per normalized public query/filter/provider/language/time-bucket/schema-version, bukan per user/page refresh. TTL dan retention diatur sesuai license/delay; tampilkan cache age. Usulan awal 30–60 menit adalah parameter engineering untuk diuji, bukan TTL yang dijamin diizinkan provider. Coalesce concurrent misses, bounded retries, backoff, daily budget serta stale/error UI; jangan menyiasati quota dengan multiple keys.

Contoh hitungan desain, bukan benchmark: 20 query publik setiap jam dapat memerlukan 480 request/hari sebelum pagination/retry, melampaui free 100/hari. Empat kali refresh per hari untuk 20 query sekitar 80/hari dan menyisakan sedikit headroom. Request count tidak sama dengan jumlah artikel atau kelengkapan coverage.

**Key management:** backend .env/secret storage, tidak VITE_*, bundle React, URL client, Git, screenshot atau logs. Backend proxy dengan fixed provider/query allowlist, rate limits, timeout dan no arbitrary fetch URL. NewsAPI header key bila didukung; GNews documented query key perlu disensor dari URL/error/access logging. Tidak menyimpan provider key per portfolio item.

**Privasi:** backend proxy tidak otomatis menyembunyikan arti query dari provider. Meminta berita berdasarkan simbol yang dipilih dari portfolio privat tetap dapat mengungkap minat/holding selection. Gunakan public watchlist/universe bersama/cache tanpa user/account IDs, jumlah aset, saldo, waktu transaksi, document hashes atau text statement; personalisasi berdasarkan private holdings memerlukan consent tersendiri. Jangan mengaktifkan news fetch pada jalur PDF processing.

**Attribution/rendering:** minimal judul, publisher/author bila disyaratkan, published_at, source link dan label hasil relevansi/cache; cuplikan/gambar hanya bila haknya diizinkan. Jangan menayangkan full content atau menghapus notices karena API mengembalikannya. Render sebagai text aman, bukan raw HTML; remote images/links dapat mengirim IP/referrer/tracking. Hindari auto-load gambar pihak ketiga pada halaman private dan review noreferrer/referrer policy bila kelak dibuat. Ketersediaan API tidak memberi izin publikasi ulang dataset artikel untuk lampiran TA.

**Scope:** news tidak memperbaiki missing transaction, tidak membuktikan corporate action, tidak menaikkan FULL coverage, dan tidak menyelesaikan mismatch. Mengubahnya menjadi sentiment/price prediction/automatic trading akan memperlebar scope secara material. Rekomendasi saat ini: DEFER integrasi sampai kontribusi rekonsiliasi dan Gate 3.5 selesai serta hak penggunaan/dataset relevansi disetujui.

## 8. Handoff dan batas pekerjaan

Hasil review ini adalah dua dokumen: dokumen opsi ini dan `PRIVACY_MODE_REAL_DATA_TEST_PLAN.md`. Tidak ada source/dependency/migration, konfigurasi lokal atau database diubah; perubahan Gate 3.5 yang sudah ada tetap dipertahankan. Tidak membaca enam PDF asli atau membuat private-data fixture.

Gate 3.5 **BLOCKED** sampai backup/restore main diverifikasi, browser functional/network QA dilakukan dan persyaratan migration manual terpenuhi. Tidak ada main migration, git add/commit/push atau mutasi Git dijalankan. Readiness commit tidak mengatasi blocker runtime/privacy atau membuktikan novelty.

Verifikasi review ini: 21 targeted synthetic tests/3 frontend files PASS; local document links dan whitespace diperiksa; read-only pre-commit readiness setelah kedua dokumen selesai menghasilkan **READY FOR MANUAL COMMIT**, problems kosong, 221 kandidat (216 tracked + 5 untracked), 218 text files dipindai, enam PDF ignored, nol penghapusan/nol unpushed commits. Remote main `5f6371d01c92c2d6731946ed8b72c288162ab90d`. Verifikasi jaringan awal dalam sandbox gagal; pengulangan read-only yang diizinkan berhasil. Kandidat juga mencakup perubahan Gate 3.5 yang belum committed, bukan hanya dua dokumen baru. Tidak ada full regression/build, real-PDF/browser test atau literature novelty claim baru yang tersirat dari readiness ini.

Rekomendasi commit message untuk tambahan review dokumentasi ini: `docs: review privacy testing and research differentiation options`.
