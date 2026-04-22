# Aisya-RA: AI Chat Workspace Redesign Strategy & Blueprint

Dokumen ini berisi hasil audit UX komprehensif dan strategi desain ulang (redesign) untuk mengubah aplikasi Anda menjadi **AI chat workspace modern** khusus untuk manajemen administrasi Raudhathul Athfal (RA).

---

## A. UX Audit (Potensi Masalah & Evaluasi)

Berdasarkan konteks sistem yang memadukan percakapan ("ngobrol") dan tindakan operasional ("menyimpan data"), berikut lanskap masalah yang berisiko terjadi pada desain saat ini:

| Masalah | Severity | Dampak pada Sistem & Pengguna |
| :--- | :---: | :--- |
| **Ambiguitas Mode (Chat vs Aksi)** | **Critical** | User tidak sadar bahwa perintahnya mengubah data sekolah secara permanen, atau sebaliknya, mengira data sudah tersimpan padahal AI hanya membuat draft. Menurunkan kepercayaan keamanan data. |
| **Tidak ada Preview & Konfirmasi** | **Critical** | Proses mutasi data (seperti absensi) tanpa preview tabel/form berisiko tinggi terjadi human/AI error. |
| **Kepadatan Informasi (Cognitive Load)** | **Major** | Menyatukan menu admin tradisional (dashboard) dengan antarmuka chat membuat sidebar terlalu ramai dan membingungkan hierarki navigasi. |
| **Empty State yang Terlalu Generik** | **Major** | Layar kosong hanya berisi "How can I help you?". User staf RA mungkin tidak tahu bahwa AI bisa membuat RPPH atau merekap absen jika tidak diberi affordance yang jelas. |
| **Composer Terbatas** | **Minor** | Input text yang sempit dan minim shortcut membuat instruksi kompleks (menyusun surat/laporan) terasa sulit diketik. |

---

## B. Redesign Strategy

Untuk mencapai standar "Premium AI Product" dengan keandalan "Enterprise Admin System", kita menggunakan 4 prinsip utama:

1. **Intent-Driven UI (Antarmuka Berbasis Niat):** UI beradaptasi sesuai niat pengguna. Jika user ingin ngobrol, UI fokus ke teks. Jika user ingin input absen, UI memunculkan tabel interaktif di dalam chat stream.
2. **Progressive Disclosure:** Jangan tampilkan semua menu admin di sidebar. Biarkan chat composer menjadi "menu utama".
3. **Trust Through Friction (Kepercayaan melalui Gesekan):** Untuk aksi yang mengubah data sistem (CREATE/UPDATE/DELETE), tambahkan sedikit friction berupa kartu konfirmasi (Confirmation Card) wajib sebelum perintah dijalankan.
4. **Calm & Focused Aesthetics:** Menggunakan palet monokromatik lembut dengan warna aksen untuk tindakan, memberikan kesan profesional, tenang, dan dapat dialkan oleh staf administrasi.

---

## C. New Product Structure

Struktur diubah agar titik fokus 100% berada pada proses penyelesaian tugas (Task Completion).

*   **Left Sidebar (Collapsible):**
    *   **Top:** Tombol Primary "New Chat" (sangat menonjol).
    *   **Section 1: Workspaces & Tools:** Shortcut cepat untuk context-switching (misal: Mode Surat, Mode Kehadiran, Mode RPPH), bukan menu navigasi halaman.
    *   **Section 2: Pinned / Recent Chats:** Riwayat percakapan dikelompokkan berdasarkan rentang waktu (Today, Previous 7 Days).
    *   **Bottom:** User Profile & Settings.
*   **Main Canvas (Center):**
    *   **Top Bar:** Judul percakapan (auto-generated), Model Selector (jika ada), tombol Export/Print.
    *   **Messaging Area:** Ruang luas untuk chat log dan peletakan Dynamic UI Widgets (tabel, dokumen, form).
    *   **Bottom:** Smart Composer (Auto-resize text area + Quick Action chips di atasnya).
*   **Context Panel (Optional - Right Slide-out):**
    *   Panel transien yang muncul hanya ketika user mereview dokumen panjang (Surat/RPPH) agar tidak mengganggu scroll history chat utama.

---

## D. Screen-by-Screen Spec

### 1. Home / Empty State ("The Blank Canvas")
*   **Visual:** Layar bersih, logo/icon subtle di tengah atas area chat. Sapaan hangat berdasarkan waktu ("Selamat Pagi, Ustadzah. Ada yang bisa dibantu hari ini?").
*   **Elemen Utama:** 4-6 Suggested Action Chips berbentuk grid/list besar di tengah layar.
    *   Chip 1: "Catat kehadiran siswa grup A" (Ikon absen)
    *   Chip 2: "Buat draf surat undangan rapat" (Ikon dokumen)
    *   Chip 3: "Susun RPPH tema binatang" (Ikon buku)
*   **Interaction:** Klik chip langsung mengisi composer dan (opsional) langsung mengeksekusi pesan.

### 2. Chat dengan Aksi Sistem (Contoh: Input Absensi)
*   **User:** "Tampilkan absen kelas B1, Ahmad hari ini izin."
*   **AI (Thinking):** Status loader kecil "Mengambil data siswa B1..."
*   **AI (Response):** Menampilkan kalimat "Berikut data kehadiran B1. Saya telah mengubah status Ahmad menjadi Izin."
*   **Dynamic UI (Data Preview Table):** Di bawah teks AI, muncul tabel UI native (bukan markdown table biasa) berisi nama siswa dan dropdown status (Hadir, Izin, Sakit, Alpa). Status Ahmad disorot warna kuning (Izin).
*   **Action Confirmation Card:** Di bawah tabel, terdapat block khusus:
    *   Text: "Perubahan belum disimpan ke sistem."
    *   Buttons: [Batal] [Simpan Data Kehadiran] (Primary Action).
*   **Success State:** Setelah klik simpan, tabel terkunci (read-only), Action Card berubah hijau dengan checkmark "✓ Data absensi tanggal 21 April berhasil disimpan."

### 3. Chat dengan Draft Dokumen (Surat / RPPH)
*   **User:** "Buatkan surat undangan wali murid untuk rapat akhir tahun."
*   **AI:** Menghasilkan draf menggunakan Document Preview Card.
*   **Document Preview Card:** Kartu elegan menyerupai kertas A4 (elevation/shadow tipis). Berisi teks surat. Di sudut kanan atas kartu ada tombol [Edit], [Copy], [Download PDF], dan [Simpan ke Arsip].

---

## E. Component Inventory

Komponen yang perlu di-develop di Frontend:

*   **Smart Composer:** TextArea yang bisa expand tinggi otomatis. Memiliki area slot atas untuk Quick Command Chips (muncul pas butuh, misal / ditekan).
*   **Assistant Message Block:** Layout teks biasa dengan line-height lega (minimal 1.6).
*   **Dynamic Interaction Cards (Penting!):**
    *   `ConfirmationCard`: Block aksi `[Cancel] [Confirm Submit]`.
    *   `DocumentDraftCard`: Tampilan mirip kertas (padding besar, font serif opsional untuk surat resmi).
    *   `DataTableCard`: Tabel dengan sticky header, sel yg bisa jadi dropdown untuk koreksi on-the-fly.
    *   `StatusResultCard`: Feedback loop sukses/gagal operasi sistem (Ikon hijau/merah tebal).
*   **Status Indicator:** "Thinking...", "Searching database...", "Drafting document..." (Animasi pulse halus).

---

## F. Interaction Rules

*   **Aksi Destruktif/Mutasi:** **TIDAK BOLEH** dijalankan otomatis oleh AI. AI hanya "menyiapkan payload", user **WAJIB** menekan tombol konfirmasi.
*   **Hover & Focus:** Setiap tombol, input, dan chip harus punya state hover (ubah background-color sedikit lebih gelap/terang) dan focus ring (accessibility navigasi keyboard).
*   **Streaming Content:** Teks yang sedang di-generate harus scroll ke bawah secara otomatis secara halus (smooth scroll), namun berhenti otomatis jika user sengaja men-scroll ke atas (untuk membaca bagian atas).

---

## G. Visual Style Guide

*   **Colors (Premium & Calm):**
    *   Background: Sangat terang, abu-abu putih (`#F9FAFB` pada light mode) atau abu-abu pekat elegan (`#111827` pada dark mode), BUKAN hitam murni.
    *   Primary (Accent): Biru tua keunguan (Indigo/Slate) atau Hijau Zamrud dalam, memberi kesan sekolah yang profesional dan modern.
    *   Surface (Cards): Putih murni (`#FFFFFF`) dengan border halus (`1px solid #E5E7EB`).
*   **Typography:**
    *   Sans-serif bersih: Inter, Plus Jakarta Sans, atau Roobert.
    *   Reading Scale: Body text ukuran `15px` atau `16px` dengan line-height `1.6`. Kesalahan umum adalah font chat terlalu kecil.
*   **Radius (Rounding):**
    *   Kesan soft: Corners menggunakan `12px` untuk cards dan tombol utama. `16px` untuk composer.
*   **Shadow:** Sangat tipis. Hindari drop-shadow tebal. Gunakan teknik elevation untuk membedakan layer UI.

---

## H. UX Writing / Microcopy (Bahasa Indonesia Profesional namun Hangat)

*   **Empty State:** "Selamat pagi. Butuh bantuan dengan absensi, pembuatan surat, atau RPPH hari ini?"
*   **Composer Placeholder:** "Ketik permintaan Anda atau berikan instruksi..."
*   **AI Thinking:** "Menganalisis permintaan..." -> "Menyiapkan format RPPH..."
*   **Confirmation:** "Draf selesai. Mohon periksa kembali sebelum menyimpan ke sistem."
*   **Success (Data Mutasi):** "✓ Data kehadiran berhasil diperbarui."
*   **Error (No Data):** "Maaf, saya tidak dapat menemukan siswa bernama [Nama] di Kelas B1. Apakah ada ejaan lain?"

---

## I. Frontend Implementation Guidance (Untuk Developer)

1.  **Component Architecture (React/Vue/Svelte):**
    *   Jangan gunakan rendering markdown biasa untuk aksi sistem. Buat custom parser/renderer yang bisa mendeteksi tag spesifik dari backend (contoh: `<action-preview type="absensi" data="{...}" />`) lalu mengubah tag tersebut menjadi komponen React interaktif di dalam message thread.
2.  **State Management:** Setiap Message Block harus mengingat state-nya (apakah sudah di-submit, atau masih draft, atau kedaluwarsa). Jika user scroll ke chat lama, tombol [Simpan Data] dari 3 hari lalu harus memiliki status `Disabled` karena sudah lewat/diselesaikan.
3.  **UI Library:** Jika tidak membuat dari scratch, gunakan komponen headless seperti Radix UI atau shadcn/ui dan susun estetika kostum dari sana (menghindari gaya default bootstrap/tailwind yang kaku).

---

## J. Final Deliverables

1.  **Critical Summary:** Pemisahan visual antara "Ngobrol biasa" dan "Melakukan eksekusi sistem" adalah kunci utama. User harus merasa aman dan percaya bahwa AI tidak akan mengacaukan database sekolah secara diam-diam.
2.  **UI/UX Blueprint:** Transisi dari sidebar-heavy dashboard ke Composer-centric chat UI, di mana chat adalah sistem operasi utamanya.
3.  **Ideal Workflow (Absensi):** User ketik "Absen hari ini" -> AI memunculkan tabel nama-nama (opsi default hadir) -> User klik 1 nama untuk ubah jadi "Sakit" -> User klik tombol besar "Simpan Data" -> Tabel mengunci, konfirmasi sukses muncul di bawahnya.
4.  **Prompt Lanjutan:** (Silakan salin dan gunakan prompt di bawah ini untuk fase berikutnya: Wireframing atau Coding).

---

### PROMPT LANJUTAN UNTUK FASE IMPLEMENTASI

> *"Sebagai AI Frontend Developer Canggih, tolong buatkan prototype React (dengan Tailwind CSS) untuk 1 layar utama bedasarkan spesifikasi 'Aisya-RA UX Redesign'. Fokus pada 'Active Chat State' saat user sedang memproses fungsi 'Absensi'. Tampilkan layout yang terdiri dari: Left Sidebar yang clean (menyembunyikan kerumitan), Header dengan active chat title, area chat yang menampilkan 1 pesan user, balasan AI, dan 1 'Data Table Card' interaktif yang menampilkan daftar absen dengan tombol aksi konfirmasi [Simpan Data]. Utamakan tipografi modern (Inter), warna dominan calm/slate, radius yang lembut, dan visual yang premium tanpa meniru persis gaya kompetitor mainstream."*
