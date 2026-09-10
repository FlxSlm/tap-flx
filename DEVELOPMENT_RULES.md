# DEVELOPMENT RULES
## Aturan Kerja AI Agent

### A. Umum
1. Baca PROJECT_CONTEXT.md, CURRENT_STATUS.md, TASK.md dan proposal sebelum perubahan besar.
2. Proposal terbaru adalah sumber kebenaran untuk scope akademik.
3. Jangan menambah fitur hanya karena dianggap menarik.
4. Utamakan implementasi sederhana, jelas, maintainable, dan sesuai level prototipe S1.
5. Hindari dependency tambahan jika tidak diperlukan.
6. Sebelum menambah library, jelaskan alasan dan dampaknya.

### B. Incremental Development
1. Hanya kerjakan increment yang tercantum di CURRENT_STATUS.md.
2. Jangan mengerjakan increment berikutnya secara diam-diam.
3. Pecah pekerjaan besar menjadi task kecil.
4. Setiap task harus: implement → test → document → commit.
5. Setiap increment harus punya output yang dapat ditunjukkan dan diuji.

### C. Kode
1. Periksa repository sebelum edit.
2. Jangan menimpa kode yang belum dipahami.
3. Jangan menghapus fitur yang sudah bekerja tanpa alasan.
4. Hindari overengineering.

### D. Testing
Setelah perubahan bermakna:
- jalankan test relevan;
- jalankan build/lint bila tersedia;
- periksa error runtime;
- dokumentasikan hasil.
Jangan menyatakan selesai hanya karena kode berhasil ditulis.

### E. Git / Checkpoint
Git adalah mekanisme penyelamatan progres.
Setelah task bermakna:
1. git status
2. git diff
3. test
4. update CURRENT_STATUS.md
5. update TASK.md
6. commit

Contoh commit:
- chore: initialize project
- feat(auth): add authentication
- feat(db): add canonical transactions schema
- feat(api): add transaction endpoints
- test(api): verify transaction flow

### F. TOKEN / CONTEXT EXHAUSTION
Jika context/token mulai terbatas:
1. jangan mulai task baru;
2. simpan perubahan stabil;
3. jalankan test;
4. update CURRENT_STATUS.md;
5. update TASK.md;
6. update CHANGELOG.md bila penting;
7. buat Git commit;
8. tulis handoff.

Handoff harus mencakup:
- current increment;
- task aktif;
- yang selesai;
- file berubah;
- test terakhir;
- hasil test;
- known issues;
- langkah berikutnya.

Jangan menyimpan progres penting hanya di chat.

### G. RECOVERY
Agent baru harus:
1. baca PROJECT_CONTEXT.md;
2. baca DEVELOPMENT_RULES.md;
3. baca CURRENT_STATUS.md;
4. baca TASK.md;
5. jalankan git status;
6. lihat git log;
7. periksa perubahan terakhir;
8. jalankan test/build;
9. lanjut dari task yang tercatat.

Jika status file berbeda dari repository, jangan menebak. Periksa git history dan file aktual.

### H. SECURITY
- Jangan commit API key/password/token.
- Gunakan .env.
- Pastikan .env ada di .gitignore.
- Jangan menulis secret ke file context/status/task.

### I. AKADEMIK
- Jangan mengubah metodologi atau scope tanpa persetujuan user.
- Bedakan requirement, implementasi, testing, dan hasil.
- Jangan mengarang hasil evaluasi.
- Jangan membuat citation palsu.
