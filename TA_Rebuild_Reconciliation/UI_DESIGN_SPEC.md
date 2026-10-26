# UI Design Specification — Financial Portfolio Workspace

Tanggal: 20 Oktober 2026. Scope: UI/UX Design Gate, sesudah fondasi Gate 1.

## 1. Dasar rancangan dan audit UI awal

Konteks target berasal dari seluruh paket `TA_Rebuild_Reconciliation`, termasuk sepuluh dokumen arsitektur di `docs/`, README/prompt paket, laporan Phase 0, dan empat dokumen Gate 1. Instruksi UI gate serta larangan mutasi Git dari pemilik mengatasi instruksi commit pada dokumen lama. Dokumen konteks root yang telah dihapus tidak dipakai.

Frontend React/Vite existing masih layak. Sebelum perubahan, Overview berupa halaman sambutan dan tautan ke transaksi/pemrosesan dokumen. Routing, Sanctum session authentication, transaction CRUD/pagination, PDF.js lokal, preview/parser validation, dan explicit structured import sudah nyata. Styling global bawaan Vite dan styling halaman belum membentuk workspace konsisten. Belum ada shell delapan halaman, komponen rekonsiliasi, atau state analitik yang menjelaskan kelengkapan data.

Referensi `docs/design-reference/dashboard-ui-reference.png` digunakan untuk arah navy navigation, canvas terang, hierarchy angka, dan tabel. Proporsi dan susunan diadaptasi untuk fokus rekonsiliasi serta ketersediaan data proyek. Tidak ada nilai pada gambar referensi yang disalin menjadi data pengguna.

Prinsip utama: tampilkan bukti dan ketidakpastian dengan jelas. Ledger, observed snapshot, projection, dan valuasi adalah konsep berbeda. UI tidak mengubah salah satunya menjadi yang lain.

## 2. Arah visual dan design system

Implementasi token dan state berada pada `frontend/src/ui/workspace.css`, diimpor dari `index.css`.

- Canvas `--canvas: #f4f6f9`; surface putih; surface sekunder `#f8fafc`.
- Teks utama `--ink: #17283f`; teks sekunder `--muted: #617185`; border `#dfe5ed`.
- Navigasi `--navy: #101e34`, teks navigasi `#b6c2d3`.
- Aksen utama `--blue: #2861cf`, hover `#194eaf`, surface aksen `#edf3ff`.
- Semantik success `#16704e`, danger `#a7353d`, warning `#865700`. Status selalu mempunyai label teks; warna bukan satu-satunya pembeda.
- Font stack lokal Inter jika terpasang, kemudian Segoe UI/system sans. Tidak mengambil font eksternal. Base 14px; informasi sekunder/form/tabel 12–13px; judul panel 15–17px; judul halaman 25–28px; angka utama 21–29px menurut viewport. Line height dasar 1,5.
- Angka finansial memakai tabular numerals dan alignment kanan. Format tampilan `id-ID`, mata uang eksplisit, tanggal dalam `Asia/Makassar`. Pemformatan bukan kalkulasi finansial dan tidak mengubah payload desimal.
- Spacing tokens 4/8/12/16/20/24/32/40px; padding panel sekitar 18–24px, gap antarseksi 22–24px. Radius kontrol 5px, panel 9px. Elevation terutama melalui border dan surface; tidak memakai dekorasi glass/neon/shadow besar.
- Hierarchy menggunakan metric strip dengan pembagi, reconciliation band, panel chart, daftar sumber, dan tabel. Komponen tidak seluruhnya dibuat menjadi kartu metrik identik.

States: hover dan focus-visible eksplisit; tombol nonaktif saat request; skeleton untuk resource loading; error dengan retry; unavailable dan empty mempunyai alasan serta aksi yang sesuai. Pesan kegagalan generik tidak menyalin SQL, exception server, atau isi PDF. Reduced-motion menonaktifkan animasi skeleton/transisi.

## 3. Shell dan information architecture

`AppShell` membungkus route terautentikasi melalui `WorkspaceProvider` dan nested React Router Outlet. Sidebar desktop 236px, dipadatkan menjadi 208px pada laptop/tablet, berubah menjadi drawer pada lebar maksimal 760px.

1. `/` — Overview: ringkasan ketersediaan nilai, kelengkapan, rekonsiliasi, chart, alokasi, holdings, aktivitas ledger terbaru dan impor sesi.
2. `/portfolio` — My Portfolio: holdings unavailable dan daftar akun nyata.
3. `/transactions` — Transactions: CRUD, filter akun, pagination, basis nominal dan review status existing.
4. `/reconciliation` — perbandingan posisi dan bukti; presentasi kontrak, belum ada engine.
5. `/documents` — Document Center: ekstraksi lokal, deteksi, validasi, preview, konfirmasi, hasil dan penelusuran impor.
6. `/analytics` — metrik/performance/alokasi dengan state belum tersedia.
7. `/connections` — akun per sumber dan pilihan pemrosesan dokumen manual; email automation belum tersedia.
8. `/settings` — nama/email sesi dan penjelasan privasi; profil read-only.

Route lama `/process-document` mengarah ke `/documents`. Login/register tetap publik; seluruh route workspace tetap melewati ProtectedRoute. Tujuan halaman disimpan saat diarahkan ke login. Provider autentikasi, CSRF, axios credentials, endpoint dan ownership backend dipertahankan.

Topbar menampilkan lokasi halaman, privacy indicator, dan tautan profil. Sidebar mempunyai user identity dan logout dengan error/pending state. Menu aktif memakai `aria-current`. Pergantian halaman mengubah document title dan memindahkan focus ke main.

## 4. Komponen reusable dan batas tanggung jawab

- `Icon`: native SVG untuk aksi/navigasi; ikon dekoratif disembunyikan dari accessibility tree.
- `PageHeading`, `Panel`, `Metric`, `Badge`: hierarchy dan status konsisten.
- `EmptyState`, `LoadingState`, `Notice`: membedakan belum tersedia, loading, kosong dalam data termuat, dan gagal memuat.
- `TableRegion`: area tabel dengan horizontal overflow, nama aksesibel, dan focus keyboard.
- `WorkspaceFilters`: periode bulan, provider, akun; perubahan provider mereset akun yang sebelumnya dipilih.
- `WorkspaceProvider` / hooks `workspace.js`: resource akun, scope pilihan, recent ledger, dan maksimal 20 catatan impor sesi. Tidak menyimpan data finansial pada localStorage.
- `PerformanceChart`: SVG presentational, rentang, pointer selection, keyboard range input, serta output tanggal/nilai yang tetap terbaca. Tidak membangun riwayat valuasi dari transaksi.
- `HoldingsTable`, `AllocationView`, `ReconciliationSummary`: menerima data presentasi yang sudah disiapkan layanan; default jujur saat data tidak tersedia.
- `ImportHistory`: catatan impor sesi dan penelusuran batch milik pengguna melalui API Gate 1.
- `AuthLayout`: visual login/register yang selaras dengan workspace.

Tidak ada dependency UI/chart/icon tambahan.

## 5. Kontrak data aktual dan filter

Endpoint yang dipakai tetap endpoint existing:

- `/api/user`, CSRF cookie, `/login`, `/register`, `/logout`: sesi autentikasi existing.
- `GET /api/investment-accounts`: daftar akun, nama dan kode provider.
- `GET /api/transactions`: data paginated. Overview hanya memuat halaman pertama maksimal 50 transaksi terbaru; lima ditampilkan sebagai recent activity setelah filter.
- CRUD `/api/transactions/{id}` dan POST `/api/transactions`: tetap pada halaman Transactions.
- `POST /api/source-imports`: hanya setelah tombol Import Selected, melalui builder allowlist integrity-v1 existing.
- `GET /api/source-imports/{batch UUID}`: receipt dan current observations, setelah permintaan pengguna.

API belum mempunyai pembacaan holdings/snapshot, summary valuation, performance, analytics, reconciliation, atau daftar histori seluruh sumber. UI tidak memanggil endpoint rekaan. Filter periode/provider Overview bekerja terhadap halaman ledger yang dimuat; filter akun dapat dikirim ke API. UI secara eksplisit menyebut batas 50, sehingga hasil filter bukan total bulanan atau bukti tidak ada aktivitas. Transaksi mempunyai filter/pagination sendiri. Resource fetch Overview mengabaikan respons terlambat dari scope sebelumnya.

Timestamp terakhir data bukan waktu browser selesai mengambil HTTP response. Selama backend belum menyediakan timestamp sumber/valuasi/reconciliation yang relevan, UI menampilkan belum tersedia.

`null`/tidak diketahui menjadi em dash atau Belum tersedia. Nol hanya ditampilkan bila data memang bernilai nol. Metrik analitik default INCOMPLETE; win rate membutuhkan realized P/L dan metode cost basis. Cost basis, P/L, volume dan jumlah aktivitas bulanan tidak diturunkan dari halaman transaksi parsial.

## 6. Kontrak presentasi rekonsiliasi

Ini kontrak props komponen, bukan endpoint REST baru atau schema database. Adapter layanan berikutnya perlu memetakan DTO backend yang telah disetujui ke kontrak ini.

`Reconciliation` menerima `presentation` nullable:

```ts
type ReconciliationPresentation = {
  period?: string; // YYYY-MM, hasil untuk scope periode ini
  status: 'MATCHED' | 'MISMATCH' | 'INCOMPLETE' | 'PENDING_REVIEW' | 'NOT_RUN';
  items: Array<{
    accountId: number | string;
    accountName: string;
    symbol: string;
    unit: string;
    opening: string | null;
    ledgerClosing: string | null;
    statementClosing: string | null;
    delta: string | null;
    status: ReconciliationPresentation['status'];
    evidence: Array<{ id: string; label: string }>;
  }>;
};
```

Opening/ledger/statement/delta disajikan terpisah. UI tidak mengurangi statement dengan ledger untuk mengisi delta null. Akun/provider/periode membatasi baris presentasi yang diberikan. Evidence dibuka dengan native details/summary; label bukti harus aman dan tidak berisi identitas pribadi/nama file sensitif. Tidak ada tombol adjustment atau run yang berpura-pura menghitung.

`ReconciliationSummary.model` opsional menyediakan status, `lastRunAt` sebagai display label, dan counts per MATCHED/MISMATCH/INCOMPLETE/PENDING_REVIEW. Count yang tidak tersedia menjadi em dash. Route produksi belum mempunyai model/API, sehingga NOT_RUN dan count unavailable tetap terlihat.

Semantik yang harus dijaga adapter/engine berikutnya:

- MATCHED: posisi sesuai dengan prasyarat coverage yang memadai, bukan hanya delta nol.
- MISMATCH: perbedaan pada posisi dengan unit/input yang dapat dibandingkan.
- INCOMPLETE: opening, unit, coverage atau prasyarat belum cukup.
- PENDING_REVIEW: ada konflik/ambiguitas bukti.
- NOT_RUN: belum dihitung, bukan hasil nol.

Snapshot FULL hanya menyatakan kelengkapan posisi menurut aturan sumber. FULL tidak membuktikan seluruh transaksi periode tersedia. Monthly-only observed position tetap terpisah dari ledger-derived position. Late-arriving transactions, duplicate resolution dan correction perlu invalidation/versioned rerun pada engine mendatang; UI gate tidak mengimplementasikannya dan tidak pernah membuat BUY/SELL fiktif.

## 7. Kontrak presentasi portofolio dan chart

Overview optional presentation: `summary {value, costBasis, unrealized, realized}`, `series`, `allocations`, `holdings`. Semua nilai finansial nullable; kontrak produksi selanjutnya perlu menyertakan account/provider/period scope, currency, as-of, completeness dan evidence secara eksplisit sebelum memasang adapter.

- `PerformanceChart.series`: `{date: 'YYYY-MM-DD', value: decimalString}[]`, currency default IDR. Titik yang tidak valid tidak dipaksa nol. 1M/3M/6M/1Y menggunakan jendela 30/90/180/365 hari mundur dari tanggal titik terakhir yang disediakan; ALL seluruh titik. Ini window presentasi, bukan return calculation atau calendar-month accounting.
- `AllocationView.allocations`: `{label, percent, providerLabel}[]`; persentase dipasok layanan, bukan dihitung browser dari partial ledger. Provider dan kategori yang belum tersedia dijelaskan sebagai belum dihitung.
- `HoldingsTable.rows`: accountId, symbol, assetName, provider, quantity, unit, averageCost, marketValue, pnl, currency. Unit UNKNOWN ditulis belum diketahui. Market value bukan harga live.

Adapter berikutnya harus memastikan scope konsisten untuk semua panel. Fixture demo adalah satu skenario statis, bukan aggregator untuk semua kombinasi filter. Pembatasan/filter ledger tidak mengubah synthetic valuation model demo.

## 8. Document Center dan Privacy Mode

Dua pola tetap dijelaskan: Transaction-Based Update dari opening snapshot dan transaksi pendukung, serta Monthly Statement-Based Update untuk observed position bulanan dengan aktivitas yang belum lengkap tetap UNKNOWN.

Urutan interaksi: pilih akun → pilih PDF lokal → Process Document → deteksi provider/jenis → preview normalized rows beserta validasi/confidence → pilih baris → Import Selected → hasil terstruktur dan ID batch → receipt/current observations. Tidak ada POST saat pemilihan file atau processing. Source hash/transaction hash tidak dijadikan ID batch atau ditampilkan sebagai badge status.

Raw PDF, extracted text, nama file, dan PDF password tidak ditambahkan ke request. API source metadata tetap allowlist existing. Password-protected PDF gagal secara lokal; belum ada UI password/fallback upload. Error tidak menampilkan isi dokumen. Confidence client ditulis sebagai advisory; status import tercatat tidak diklaim sebagai coverage penuh atau semua review selesai.

Riwayat sesi hanya untuk impor terkonfirmasi selama workspace hidup, maksimal 20 batch, hilang saat reload/logout. UUID batch ditampilkan agar pengguna dapat menelusuri receipt setelah reload. Penelusuran berdasarkan UUID tidak menggantikan endpoint daftar histori penuh. Review-required/current observation ditampilkan; penyelesaian kandidat duplicate/distinct event/snapshot conflict belum menjadi fitur gate ini.

Sumber yang ditampilkan sesuai kemampuan yang tersedia: BIONS SOA/TC/CA PDF, Stockbit SOA/TC PDF, Pluang Monthly Statement PDF. Stockbit Dividend Email dan Pluang Transaction Email tetap target source matrix, belum ditampilkan sebagai koneksi aktif dan tidak dibuat parser email baru.

## 9. Responsive dan aksesibilitas

Breakpoint: desktop luas >=1600; penyesuaian laptop <=1250; kolom menyatu/sidebar menyempit <=1000; drawer/sidebar modal <=760; aksi/form disusun vertikal <=440. Body minimum 320px. Tabel tetap berupa tabel semantik dengan horizontal overflow, bukan memampatkan angka sampai tidak terbaca.

Drawer: label kontrol, aria-expanded/controls, close button, Escape, focus trap, focus kembali ke pemicu, scroll lock, dan inert pada konten di belakang. Resize ke desktop menutup drawer. Skip-link menuju main. Form mempunyai label; tombol range memakai aria-pressed; chart mempunyai judul dan kontrol keyboard/output; loading/error menggunakan status/alert; focus terlihat. Semua perlu pemeriksaan ulang dengan screen reader dan browser nyata sebelum klaim kepatuhan aksesibilitas formal.

Target manual review: 1440×1000, 1280×800, 834×1112, 390×844 dan 320px, keyboard-only, zoom 200%, overflow tabel, login/error, preview dokumen, status kosong, serta drawer pada perangkat sentuh.

## 10. Preview terisolasi dan batas gate

Mode development saja: `/__design-preview`, query `page=reconciliation|documents|portfolio|transactions|analytics|connections|settings`, serta `viewport=mobile` untuk iframe 390×844. Semua contoh investasi dibuat sintetis dan diberi banner DEMO DATA. Preview tidak memakai AuthProvider/akun pengguna, API atau aksi tulis. Preview dokumen read-only; transaksi demo bukan CRUD nyata. Modul fixture di-lazy-import hanya pada cabang `import.meta.env.DEV`; build produksi diperiksa bebas marker fixture finansial.

Dalam sesi implementasi tidak tersedia browser GUI; tidak ada screenshot hasil atau klaim visual QA berhasil. Preview ini disediakan untuk review pemilik, bukan pengganti bukti browser.

Gate berikutnya membutuhkan approval terpisah untuk penerapan migration Gate 1, endpoint read models dan engine. Prioritas: validasi visual nyata → review/migration aman pada salinan DB → read-only snapshot/evidence/history contract → engine quantity reconciliation → scoped UI adapter → valuasi/analitik setelah metode disahkan. OAuth, n8n dan market APIs tidak termasuk UI gate ini.
