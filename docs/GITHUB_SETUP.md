# Persiapan GitHub

Repository lokal memiliki riwayat commit pada branch `master`. Remote GitHub belum dikonfigurasi saat persiapan ini dimulai.

## Sebelum push

- Pastikan `.env`, database, credential, dependency, dan hasil build tidak tercatat Git. Gunakan `git status --ignored --short` untuk memeriksa file yang diabaikan.
- Jalankan `git diff --check`, pengujian frontend/backend, lint, dan build.
- Tinjau dokumen penelitian dan fixture sebelum menentukan visibilitas repository.
- PDF pada `docs/aset_parser/` sudah tercatat dalam riwayat Git. Pastikan identitas dan data finansial di dalamnya boleh diunggah. Menghapus file terbaru atau menambahkan `.gitignore` tidak menghapus salinannya dari riwayat. Jika masih sensitif, tunda push sampai riwayat dibersihkan.
- Sertakan lockfile dependency dan `.env.example`, tetapi jangan `.env` lokal.

## Menghubungkan repository

Buat repository GitHub kosong di akun tujuan tanpa inisialisasi README, license, atau `.gitignore`. Dari root proyek, ganti URL contoh dengan repository milik Anda:

```powershell
git remote add origin https://github.com/USERNAME/tap-flx.git
git remote -v
git push -u origin master
```

Jika `origin` sudah ada, periksa tujuannya sebelum mengubahnya. Jangan gunakan force push. Jika tujuan sudah memiliki commit, periksa dan integrasikan riwayatnya sebelum push.

Persiapan lokal tidak membuat repository GitHub atau mengunggah data secara otomatis.
