-- =====================================================
-- SKEMA DATABASE AISYA-RA (Disederhanakan untuk Skripsi)
-- Modul: Manajemen RA, Akademik, Kurikulum & Administrasi
-- =====================================================

-- 1. MODUL MANAJEMEN RA (CORE)
-- =====================================================

-- Tabel Sekolah (Profil RA)
CREATE TABLE sekolah (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_ra TEXT NOT NULL,
    alamat TEXT,
    nomor_statistik TEXT,
    logo_url TEXT,
    tahun_ajaran TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Pengguna (Guru & Kepala RA)
CREATE TABLE pengguna (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    nama TEXT,
    role TEXT CHECK (role IN ('kepala_ra', 'guru')) DEFAULT 'guru',
    ra_id UUID REFERENCES sekolah(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. MODUL AKADEMIK & SISWA
-- =====================================================

-- Tabel Tahun Ajaran
CREATE TABLE tahun_ajaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- Contoh: 2026/2027
    is_active BOOLEAN DEFAULT false,
    hari_efektif_belajar INT DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Kelompok Belajar (Kelas)
CREATE TABLE kelompok_belajar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
    tahun_ajaran_id UUID REFERENCES tahun_ajaran(id),
    nama_kelompok TEXT NOT NULL,
    wali_kelas_id UUID REFERENCES pengguna(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Siswa
CREATE TABLE siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID REFERENCES sekolah(id),
    tahun_ajaran_id UUID REFERENCES tahun_ajaran(id),
    kelompok_id UUID REFERENCES kelompok_belajar(id) ON DELETE SET NULL,
    nama TEXT NOT NULL,
    status_aktif BOOLEAN DEFAULT true,
    nis TEXT,
    nisn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. MODUL KURIKULUM & PENILAIAN
-- =====================================================

-- Tabel RPPH (Rencana Pelaksanaan Pembelajaran Harian)
CREATE TABLE rpph (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_id UUID NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
    kelompok_id UUID REFERENCES kelompok_belajar(id) ON DELETE SET NULL,
    tahun_ajaran_id UUID REFERENCES tahun_ajaran(id),
    tanggal DATE NOT NULL,
    tema TEXT,
    subtema TEXT,
    konten_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Presensi Siswa
CREATE TABLE presensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    tahun_ajaran_id UUID REFERENCES tahun_ajaran(id),
    tanggal DATE NOT NULL,
    status TEXT CHECK (status IN ('hadir', 'sakit', 'izin', 'alpha')) NOT NULL,
    dicatat_oleh UUID REFERENCES pengguna(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(siswa_id, tanggal)
);

-- 4. MODUL ADMINISTRASI & AI
-- =====================================================

-- Tabel Surat Template
CREATE TABLE surat_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
    nama_template TEXT NOT NULL,
    jenis_surat TEXT CHECK (jenis_surat IN ('undangan', 'keterangan', 'tugas', 'izin', 'lainnya')),
    konten_template TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Surat Keluar
CREATE TABLE surat_keluar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
    template_id UUID REFERENCES surat_template(id),
    nomor_surat TEXT UNIQUE NOT NULL,
    judul TEXT,
    konten_final TEXT NOT NULL,
    created_by UUID REFERENCES pengguna(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Chat Ruang
CREATE TABLE chat_ruang (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    tipe TEXT CHECK (tipe IN ('utama', 'rpph', 'surat', 'presensi', 'custom', 'dashboard')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Chat Riwayat
CREATE TABLE chat_riwayat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES chat_ruang(id) ON DELETE CASCADE,
    user_id UUID REFERENCES pengguna(id),
    role_msg TEXT CHECK (role_msg IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Notifikasi
CREATE TABLE notifikasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
    judul TEXT NOT NULL,
    pesan TEXT NOT NULL,
    dibaca BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Knowledge Docs (Basis Pengetahuan AI)
CREATE TABLE knowledge_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
    nama_file TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
