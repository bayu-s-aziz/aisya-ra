-- Aktifkan ekstensi pgvector (untuk knowledge base)
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1. TABEL RA PROFILES (Profil Sekolah)
-- =====================================================
CREATE TABLE ra_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_ra TEXT NOT NULL,
    alamat TEXT,
    nomor_statistik TEXT,
    logo_url TEXT,
    tahun_ajaran TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger untuk update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ra_profiles_updated_at
    BEFORE UPDATE ON ra_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. TABEL PROFILES (Ekstensi dari auth.users)
-- =====================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    nama TEXT,
    role TEXT CHECK (role IN ('kepala_ra', 'guru')) DEFAULT 'guru',
    ra_id UUID REFERENCES ra_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. TABEL KELOMPOK (Kelas)
-- =====================================================
CREATE TABLE kelompok (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
    nama_kelompok TEXT NOT NULL,
    wali_kelas_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_kelompok_updated_at
    BEFORE UPDATE ON kelompok
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. TABEL SISWA
-- =====================================================
CREATE TABLE siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kelompok_id UUID REFERENCES kelompok(id) ON DELETE SET NULL,
    nama TEXT NOT NULL,
    status_aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_siswa_updated_at
    BEFORE UPDATE ON siswa
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. TABEL CHAT ROOMS
-- =====================================================
CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    tipe TEXT CHECK (tipe IN ('utama', 'rpph', 'anekdot', 'surat', 'presensi', 'custom')) DEFAULT 'custom',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_chat_rooms_updated_at
    BEFORE UPDATE ON chat_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. TABEL CHAT HISTORY
-- =====================================================
CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    role_msg TEXT CHECK (role_msg IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_history_room_id ON chat_history(room_id);
CREATE INDEX idx_chat_history_timestamp ON chat_history(timestamp DESC);

-- =====================================================
-- 7. TABEL RPPH
-- =====================================================
CREATE TABLE rpph (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kelompok_id UUID REFERENCES kelompok(id) ON DELETE SET NULL,
    tanggal DATE NOT NULL,
    tema TEXT,
    subtema TEXT,
    konten_json JSONB NOT NULL,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_rpph_updated_at
    BEFORE UPDATE ON rpph
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. TABEL CATATAN ANEKDOT
-- =====================================================
CREATE TABLE catatan_anekdot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    input_teks TEXT,
    input_audio_url TEXT,
    transkripsi TEXT,
    aspek_stppa TEXT CHECK (aspek_stppa IN ('NAM', 'FM', 'Kognitif', 'Bahasa', 'Sosem', 'Seni')),
    level_capaian TEXT CHECK (level_capaian IN ('BB', 'MB', 'BSH', 'BSB')),
    narasi_ai TEXT,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_catatan_anekdot_updated_at
    BEFORE UPDATE ON catatan_anekdot
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. TABEL PRESENSI
-- =====================================================
CREATE TABLE presensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    status TEXT CHECK (status IN ('hadir', 'sakit', 'izin', 'alpha')) NOT NULL,
    dicatat_oleh UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(siswa_id, tanggal)
);

CREATE TRIGGER update_presensi_updated_at
    BEFORE UPDATE ON presensi
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. TABEL NOTIFIKASI
-- =====================================================
CREATE TABLE notifikasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    judul TEXT NOT NULL,
    pesan TEXT NOT NULL,
    dibaca BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifikasi_user_id ON notifikasi(user_id);
CREATE INDEX idx_notifikasi_dibaca ON notifikasi(dibaca) WHERE NOT dibaca;

-- =====================================================
-- 11. TABEL KNOWLEDGE DOCUMENTS
-- =====================================================
CREATE TABLE knowledge_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
    nama_file TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 12. TABEL KNOWLEDGE CHUNKS (dengan vektor)
-- =====================================================
CREATE TABLE knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(768)  -- dimensi untuk text-embedding-004
);

CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);

-- =====================================================
-- 13. TABEL TEMPLATE SURAT
-- =====================================================
CREATE TABLE template_surat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
    nama_template TEXT NOT NULL,
    jenis_surat TEXT CHECK (jenis_surat IN ('undangan', 'keterangan', 'tugas', 'izin', 'lainnya')) DEFAULT 'lainnya',
    konten_template TEXT NOT NULL,  -- dengan placeholder seperti {{nama_siswa}}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_template_surat_updated_at
    BEFORE UPDATE ON template_surat
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 14. TABEL SURAT
-- =====================================================
CREATE TABLE surat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ra_id UUID NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
    template_id UUID REFERENCES template_surat(id) ON DELETE SET NULL,
    nomor_surat TEXT UNIQUE NOT NULL,
    judul TEXT,
    konten_final TEXT NOT NULL,
    file_pdf_url TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 15. TABEL COUNTER NOMOR SURAT (per RA per bulan/tahun)
-- =====================================================
CREATE TABLE nomor_surat_counter (
    ra_id UUID PRIMARY KEY REFERENCES ra_profiles(id) ON DELETE CASCADE,
    tahun INT NOT NULL,
    bulan INT NOT NULL,
    counter INT DEFAULT 0
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Catatan: Sesuaikan dengan kebutuhan aplikasi. 
-- Contoh sederhana: hanya user dari RA yang sama bisa mengakses data.
-- =====================================================

-- Aktifkan RLS pada semua tabel
ALTER TABLE ra_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelompok ENABLE ROW LEVEL SECURITY;
ALTER TABLE siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpph ENABLE ROW LEVEL SECURITY;
ALTER TABLE catatan_anekdot ENABLE ROW LEVEL SECURITY;
ALTER TABLE presensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_surat ENABLE ROW LEVEL SECURITY;
ALTER TABLE surat ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomor_surat_counter ENABLE ROW LEVEL SECURITY;

-- Policy untuk ra_profiles: user dapat melihat profil RA mereka sendiri
CREATE POLICY ra_profiles_select ON ra_profiles
    FOR SELECT USING (
        id IN (SELECT ra_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY ra_profiles_update ON ra_profiles
    FOR UPDATE USING (
        id IN (SELECT ra_id FROM profiles WHERE id = auth.uid() AND role = 'kepala_ra')
    );

-- Policy untuk profiles: user dapat melihat profil di RA yang sama, hanya mengupdate milik sendiri
CREATE POLICY profiles_select ON profiles
    FOR SELECT USING (
        ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY profiles_update ON profiles
    FOR UPDATE USING (id = auth.uid());

-- Policy untuk kelompok: akses berdasarkan ra_id
CREATE POLICY kelompok_all ON kelompok
    USING (ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid()));

-- Policy untuk siswa: akses melalui kelompok (yang berada di RA yang sama)
CREATE POLICY siswa_all ON siswa
    USING (kelompok_id IN (SELECT id FROM kelompok WHERE ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid())));

-- Policy untuk chat_rooms: berdasarkan ra_id
CREATE POLICY chat_rooms_all ON chat_rooms
    USING (ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid()));

-- Policy untuk chat_history: berdasarkan room_id yang dimiliki RA
CREATE POLICY chat_history_all ON chat_history
    USING (room_id IN (SELECT id FROM chat_rooms WHERE ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid())));

-- Policy untuk rpph: akses berdasarkan guru_id atau kelompok yang berada di RA yang sama
CREATE POLICY rpph_all ON rpph
    USING (
        guru_id = auth.uid() OR
        kelompok_id IN (SELECT id FROM kelompok WHERE ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid()))
    );

-- Policy untuk catatan_anekdot: akses berdasarkan guru_id atau siswa_id yang terkait RA
CREATE POLICY catatan_anekdot_all ON catatan_anekdot
    USING (
        guru_id = auth.uid() OR
        siswa_id IN (SELECT id FROM siswa WHERE kelompok_id IN (SELECT id FROM kelompok WHERE ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid())))
    );

-- Policy untuk presensi: akses melalui siswa
CREATE POLICY presensi_all ON presensi
    USING (
        siswa_id IN (SELECT id FROM siswa WHERE kelompok_id IN (SELECT id FROM kelompok WHERE ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid())))
    );

-- Policy untuk notifikasi: hanya untuk user sendiri
CREATE POLICY notifikasi_select ON notifikasi
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifikasi_update ON notifikasi
    FOR UPDATE USING (user_id = auth.uid());

-- Policy untuk knowledge_docs: berdasarkan ra_id
CREATE POLICY knowledge_docs_all ON knowledge_docs
    USING (ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid()));

-- Policy untuk knowledge_chunks: melalui doc_id
CREATE POLICY knowledge_chunks_all ON knowledge_chunks
    USING (doc_id IN (SELECT id FROM knowledge_docs WHERE ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid())));

-- Policy untuk template_surat: berdasarkan ra_id
CREATE POLICY template_surat_all ON template_surat
    USING (ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid()));

-- Policy untuk surat: berdasarkan ra_id
CREATE POLICY surat_all ON surat
    USING (ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid()));

-- Policy untuk nomor_surat_counter: berdasarkan ra_id
CREATE POLICY nomor_surat_counter_all ON nomor_surat_counter
    USING (ra_id IN (SELECT ra_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- FUNCTION UNTUK MEMBUAT CHAT ROOM DEFAULT SAAT RA DIBUAT
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_chat_room()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO chat_rooms (ra_id, nama, tipe, created_by)
    VALUES (NEW.id, 'AISYA RA', 'utama', NULL);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_ra_profiles_insert
    AFTER INSERT ON ra_profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_chat_room();

-- =====================================================
-- FUNCTION UNTUK UPDATE UPDATED_AT SAAT INSERT (opsional)
-- =====================================================
-- (sudah didefinisikan di awal)