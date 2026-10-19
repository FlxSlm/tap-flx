# Persiapan GitHub

Repository lokal menggunakan branch `main`. Repository tujuan: `https://github.com/FlxSlm/tap-flx.git`.

## Sebelum push

- Pastikan `.env`, database, credential, dependency, dan hasil build tidak tercatat Git. Gunakan `git status --ignored --short` untuk memeriksa file yang diabaikan.
- Jalankan `git diff --check`, pengujian frontend/backend, lint, dan build.
- Tinjau dokumen penelitian dan fixture sebelum menentukan visibilitas repository.
- PDF tidak boleh diunggah sesuai instruksi pemilik. File PDF lokal diabaikan Git dan seluruh riwayat branch yang akan dikirim dibersihkan dari PDF. Backup lokal sebelum pembersihan disimpan di `.local-backups/` dan tidak boleh diunggah. Jangan mengirim backup atau riwayat lama ke GitHub.
- Sertakan lockfile dependency dan `.env.example`, tetapi jangan `.env` lokal.

## Menghubungkan repository

Remote origin sudah dikonfigurasi. Commit awal README pada main GitHub diintegrasikan ke riwayat lokal. Untuk mengunggah dari root proyek:

```powershell
git remote -v
git push -u origin main
```

Jika `origin` sudah ada, periksa tujuannya sebelum mengubahnya. Jangan gunakan force push. Jika tujuan sudah memiliki commit, periksa dan integrasikan riwayatnya sebelum push.

Persiapan lokal tidak membuat repository GitHub atau mengunggah data secara otomatis.
