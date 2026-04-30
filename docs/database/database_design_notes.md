# Catatan Desain Database AISYA-RA

Dokumen ini menjelaskan struktur database yang telah disederhanakan untuk sistem informasi manajemen Roudhotul Athfal (RA) berbasis AI.

## Struktur Modul

Database dibagi menjadi 4 modul utama untuk memudahkan pengelolaan dan dokumentasi:

### 1. Modul Manajemen RA (Core)
Modul ini menangani identitas lembaga dan profil pengguna.
- **Tabel `sekolah`**: Menyimpan profil utama RA (NPSN, alamat, logo).
- **Tabel `pengguna`**: Menyimpan data guru dan kepala RA yang terintegrasi dengan sistem otentikasi.

### 2. Modul Akademik & Siswa
Modul ini menangani struktur pengorganisasian siswa dan periode belajar.
- **Tabel `tahun_ajaran`**: Mengatur periode akademik aktif.
- **Tabel `kelompok_belajar`**: Mengelompokkan siswa ke dalam kelas-kelas (misal: Kelompok A, Kelompok B).
- **Tabel `siswa`**: Menyimpan data induk siswa.

### 3. Modul Kurikulum & Penilaian
Modul ini menangani aktivitas harian guru dan pemantauan siswa.
- **Tabel `rpph`**: Rencana pembelajaran harian yang disusun oleh guru.
- **Tabel `presensi`**: Pencatatan kehadiran siswa setiap harinya.

### 4. Modul Administrasi & AI
Modul ini mendukung fitur asisten pintar dan persuratan.
- **Tabel `surat_template` & `surat_keluar`**: Sistem otomatisasi pembuatan surat dinas.
- **Tabel `chat_ruang` & `chat_riwayat`**: Menyimpan konteks percakapan antara guru dengan asisten AI (AISYA).
- **Tabel `knowledge_docs`**: Menyimpan basis pengetahuan (seperti regulasi kurikulum) yang digunakan AI untuk memberikan jawaban yang akurat.

## Relasi Antar Tabel

1. **One-to-Many (`sekolah` -> `pengguna`)**: Satu RA dapat memiliki banyak guru.
2. **One-to-Many (`sekolah` -> `kelompok_belajar`)**: Satu RA memiliki banyak kelas/kelompok.
3. **One-to-Many (`kelompok_belajar` -> `siswa`)**: Satu kelas berisi banyak siswa.
4. **Many-to-One (`rpph` -> `pengguna`)**: Setiap RPPH dibuat oleh satu guru tertentu.
5. **One-to-One (`pengguna` -> `auth.users`)**: Setiap profil pengguna terikat pada satu akun otentikasi Supabase.

---
*Dokumen ini disiapkan untuk melampirkan Lampiran Teknik pada Dokumentasi Skripsi.*
