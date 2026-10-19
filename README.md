# tap-flx

Prototipe web integrasi data portofolio aset finansial untuk penelitian S1. Backend: Laravel 12. Frontend: React 19 + Vite. Fitur saat ini mencakup autentikasi, transaksi, dan pemrosesan dokumen Stockbit, Pluang, serta BIONS melalui Privacy Mode di browser.

Automatic Mode, integrasi email, market data, dan reporting lanjutan masih dalam rencana increment berikutnya. Lihat [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) dan [CURRENT_STATUS.md](CURRENT_STATUS.md).

## Prasyarat

- PHP 8.2+ dengan ekstensi Laravel dan PDO SQLite untuk pengujian.
- Composer 2, Node.js 24+, npm, dan Git.
- MySQL dapat digunakan sebagai alternatif SQLite untuk pengembangan.

## Instalasi lokal

Perintah berikut menggunakan PowerShell dari folder proyek yang sudah di-clone.

### Backend

```powershell
cd backend
composer install
Copy-Item .env.example .env
php artisan key:generate
New-Item -ItemType File -Path database/database.sqlite
php artisan migrate
php artisan serve --host=localhost --port=8000
```

Buat file database hanya pada instalasi baru. Jangan menimpa `.env` yang sudah dikonfigurasi. Contoh environment menggunakan SQLite. Untuk MySQL, atur `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, dan `DB_PASSWORD` pada `backend/.env` sebelum migrasi.

### Frontend

Buka terminal kedua dari root proyek:

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Buka `http://localhost:5173`. Gunakan host `localhost` secara konsisten untuk frontend dan backend agar autentikasi cookie Sanctum berjalan. `VITE_API_URL` mengatur alamat backend; `FRONTEND_URL` dan `SANCTUM_STATEFUL_DOMAINS` pada backend harus sesuai dengan alamat frontend.

Daftarkan akun melalui halaman registrasi. Opsional, jalankan `php artisan db:seed` dari folder backend untuk data demonstrasi lokal. Seeder menyediakan akun `test@example.com` / `password`; gunakan hanya untuk pengembangan lokal.

## Pemeriksaan

```powershell
cd frontend
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Di terminal lain dari root:

```powershell
cd backend
php artisan test
```

Pengujian backend menggunakan SQLite in-memory sesuai `backend/phpunit.xml`. Unit test parser memakai teks fixture di source test; PDF di `docs/aset_parser` tidak diperlukan untuk menjalankan unit test tersebut.

## Struktur

- `frontend/`: UI React dan pemrosesan PDF di browser.
- `backend/`: API Laravel, autentikasi Sanctum, migrasi, dan pengujian.
- `docs/`: dokumentasi penelitian, spesifikasi parser, dan referensi.
- `PROJECT_CONTEXT.md`, `DEVELOPMENT_RULES.md`, `CURRENT_STATUS.md`, `TASK.md`: konteks, aturan, dan progres pengembangan.

## GitHub

Lihat [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md) untuk pemeriksaan sebelum push dan cara menghubungkan repository tujuan. `.env`, dependency, hasil build, database lokal, dan kredensial tidak boleh diunggah. Nilai `VITE_*` masuk ke bundle browser sehingga tidak boleh berisi rahasia.
