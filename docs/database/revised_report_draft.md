# Revisi Draft Laporan Skripsi (Bab 4.5.2)

Berikut adalah revisi draft laporan Anda yang telah disesuaikan dengan implementasi database terbaru yang kita lakukan. Revisi ini menggunakan nomenklatur Bahasa Indonesia yang konsisten dan mencerminkan struktur modul yang sebenarnya.

---

### **4.5.2 Perancangan Basis Data**

Perancangan basis data pada AISYA-RA dilakukan menggunakan pendekatan relasional yang dimodelkan melalui *Entity Relationship Diagram* (ERD) untuk memetakan entitas utama, atribut, dan hubungan antardata yang diperlukan sistem. Basis data dirancang agar seluruh informasi administratif dapat disimpan secara terstruktur, mudah ditelusuri, dan mendukung kebutuhan operasional maupun analitis. Dengan basis data yang telah disederhanakan, sistem mampu mencatat transaksi administrasi harian sekaligus menyediakan riwayat terintegrasi antarfitur.

Entitas utama dalam rancangan basis data dikelompokkan ke dalam empat modul utama: Manajemen RA, Akademik, Kurikulum, dan Administrasi. Entitas **Sekolah** menyimpan profil lembaga seperti nama, alamat, dan nomor statistik. Entitas **Pengguna** menyimpan data profil tenaga pendidik (Guru dan Kepala RA) yang terintegrasi dengan sistem otentikasi. Entitas **Tahun Ajaran** dan **Kelompok Belajar** (Kelas) digunakan untuk mengorganisasi periode akademik dan pengelompokan siswa. Entitas **Siswa** memuat identitas peserta didik yang terikat pada kelompok belajar tertentu.

Pada modul kurikulum dan administrasi, entitas **RPPH** menyimpan rencana pembelajaran harian dalam format JSON terstruktur. Entitas **Presensi** mencatat kehadiran siswa dengan status yang jelas (hadir, sakit, izin, atau alpha). Untuk kebutuhan persuratan, sistem menggunakan entitas **Surat Template** dan **Surat Keluar**. Adapun untuk fitur asisten AI, digunakan entitas **Chat Ruang** dan **Chat Riwayat** untuk menyimpan konteks percakapan secara terpisah berdasarkan kategori fitur, serta entitas **Knowledge Docs** yang berfungsi sebagai basis pengetahuan sistem.

Relasi antarentitas dirancang untuk memastikan integritas data. Sekolah menjadi pusat relasi bagi Pengguna, Kelompok Belajar, dan Siswa. Setiap Pengguna (Guru) berelasi dengan RPPH dan Presensi sebagai pihak yang melakukan input data. Siswa berelasi dengan Presensi secara *one-to-many*, di mana satu siswa dapat memiliki banyak catatan kehadiran. Kelompok Belajar bertindak sebagai penghubung antara Guru (Wali Kelas), Siswa, dan Tahun Ajaran. Sementara itu, Chat Riwayat terikat pada Chat Ruang untuk mendukung manajemen sesi percakapan yang rapi. Struktur ini dirancang agar AISYA-RA mampu mendukung alur kerja administratif secara konsisten sekaligus menyediakan fondasi yang kuat bagi pemrosesan data oleh asisten AI.

[Gambar 4.5: ERD AISYA-RA — disesuaikan dengan skema simplified_schema.sql]

---

## Catatan Perubahan untuk ERD:
Jika Anda menggambar ERD, pastikan relasi berikut terlihat:
1. **Sekolah (1) <---> (N) Pengguna**: Satu sekolah memiliki banyak guru/staf.
2. **Sekolah (1) <---> (N) Kelompok Belajar**: Satu sekolah memiliki banyak kelas.
3. **Kelompok Belajar (1) <---> (N) Siswa**: Satu kelas berisi banyak siswa.
4. **Tahun Ajaran (1) <---> (N) Kelompok Belajar & Siswa**: Memastikan data terikat pada periode akademik.
5. **Pengguna (1) <---> (N) RPPH & Presensi**: Guru mengelola data pembelajaran dan kehadiran.
6. **Chat Ruang (1) <---> (N) Chat Riwayat**: Struktur sesi percakapan chatbot.
