# Persiapan GitHub

Repository lokal menggunakan branch `master`. Repository tujuan: `https://github.com/FlxSlm/tap-flx.git`.

## Sebelum push

- Pastikan `.env`, database, credential, dependency, dan hasil build tidak tercatat Git. Gunakan `git status --ignored --short` untuk memeriksa file yang diabaikan.
- Jalankan `git diff --check`, pengujian frontend/backend, lint, dan build.
- Tinjau dokumen penelitian dan fixture sebelum menentukan visibilitas repository.
- PDF tidak boleh diunggah sesuai instruksi pemilik. File PDF lokal diabaikan Git dan seluruh riwayat branch yang akan dikirim dibersihkan dari PDF. Backup lokal sebelum pembersihan disimpan di `.local-backups/` dan tidak boleh diunggah. Jangan mengirim backup atau riwayat lama ke GitHub.
- Sertakan lockfile dependency dan `.env.example`, tetapi jangan `.env` lokal.

## Menghubungkan repository

Buat repository GitHub kosong di akun tujuan tanpa inisialisasi README, license, atau `.gitignore`. Dari root proyek, ganti URL contoh dengan repository milik Anda:

```powershell
git remote add origin https://github.com/FlxSlm/tap-flx.git
git remote -v
git push -u origin master
```

Jika `origin` sudah ada, periksa tujuannya sebelum mengubahnya. Jangan gunakan force push. Jika tujuan sudah memiliki commit, periksa dan integrasikan riwayatnya sebelum push.

Persiapan lokal tidak membuat repository GitHub atau mengunggah data secara otomatis.
