-- ========================================
-- AISYA Database Setup for Surat (Letters)
-- ========================================

-- 1. Tabel template_surat
-- Menyimpan template surat dengan placeholder
CREATE TABLE IF NOT EXISTS template_surat (
    id SERIAL PRIMARY KEY,
    ra_id INT NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
    nama_template VARCHAR(255) NOT NULL,
    jenis_surat VARCHAR(50) NOT NULL,  -- undangan, keterangan, pemberitahuan, permohonan, lainnya
    konten_template TEXT NOT NULL,     -- Konten dengan placeholder {{nama_siswa}}, {{tanggal}}, dll
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX idx_template_surat_ra ON template_surat(ra_id);
CREATE INDEX idx_template_surat_jenis ON template_surat(jenis_surat);

-- 2. Tabel surat
-- Menyimpan surat yang sudah di-generate
CREATE TABLE IF NOT EXISTS surat (
    id SERIAL PRIMARY KEY,
    ra_id INT NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
    template_id INT REFERENCES template_surat(id) ON DELETE SET NULL,
    nomor_surat VARCHAR(100) NOT NULL UNIQUE,  -- Format: 001/RA/III/2026
    judul VARCHAR(255) NOT NULL,
    konten_final TEXT NOT NULL,                -- Konten yang sudah diisi dari template
    file_pdf_url VARCHAR(500),                 -- URL file PDF jika disimpan
    created_by INT NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX idx_surat_ra ON surat(ra_id);
CREATE INDEX idx_surat_nomor ON surat(nomor_surat);
CREATE INDEX idx_surat_created ON surat(created_at DESC);

-- 3. Tabel nomor_surat_counter
-- Counter untuk auto-generate nomor surat per RA, tahun, dan bulan
CREATE TABLE IF NOT EXISTS nomor_surat_counter (
    ra_id INT NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
    tahun INT NOT NULL,
    bulan INT NOT NULL,  -- 1-12
    counter INT NOT NULL DEFAULT 0,
    PRIMARY KEY (ra_id, tahun, bulan)
);

-- Index untuk performa
CREATE INDEX idx_nomor_surat_counter_ra ON nomor_surat_counter(ra_id);

-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================

-- RLS untuk template_surat
ALTER TABLE template_surat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their RA's templates"
ON template_surat FOR SELECT
USING (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Users can insert templates for their RA"
ON template_surat FOR INSERT
WITH CHECK (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Users can update their RA's templates"
ON template_surat FOR UPDATE
USING (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their RA's templates"
ON template_surat FOR DELETE
USING (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

-- RLS untuk surat
ALTER TABLE surat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their RA's surat"
ON surat FOR SELECT
USING (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Users can insert surat for their RA"
ON surat FOR INSERT
WITH CHECK (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Users can update their RA's surat"
ON surat FOR UPDATE
USING (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their RA's surat"
ON surat FOR DELETE
USING (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

-- RLS untuk nomor_surat_counter
ALTER TABLE nomor_surat_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their RA's counter"
ON nomor_surat_counter FOR SELECT
USING (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their RA's counter"
ON nomor_surat_counter FOR ALL
USING (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

-- ========================================
-- Sample Data (Optional)
-- ========================================

-- Contoh template surat undangan
-- Uncomment untuk insert sample data
/*
INSERT INTO template_surat (ra_id, nama_template, jenis_surat, konten_template) VALUES
(1, 'Undangan Rapat Orang Tua', 'undangan', 
'Kepada Yth.
Bapak/Ibu Wali Murid {{kelompok}}
Di Tempat

Assalamu''alaikum Wr. Wb.

Dengan hormat, kami mengundang Bapak/Ibu untuk menghadiri:

Hari/Tanggal : {{tanggal}}
Waktu        : {{waktu}}
Tempat       : {{tempat}}
Acara        : {{acara}}

Demikian undangan ini kami sampaikan. Atas perhatian dan kehadiran Bapak/Ibu, kami ucapkan terima kasih.

Wassalamu''alaikum Wr. Wb.

Kepala RA
{{nama_kepala}}');

INSERT INTO template_surat (ra_id, nama_template, jenis_surat, konten_template) VALUES
(1, 'Surat Keterangan Siswa', 'keterangan',
'SURAT KETERANGAN

Yang bertanda tangan di bawah ini:

Nama            : {{nama_kepala}}
Jabatan         : Kepala RA {{nama_ra}}
Alamat          : {{alamat_ra}}

Dengan ini menerangkan bahwa:

Nama            : {{nama_siswa}}
Tempat/Tgl Lahir: {{tempat_lahir}}, {{tanggal_lahir}}
Jenis Kelamin   : {{jenis_kelamin}}
Alamat          : {{alamat_siswa}}

Adalah benar-benar siswa RA {{nama_ra}} Kelompok {{kelompok}} Tahun Ajaran {{tahun_ajaran}}.

Surat keterangan ini dibuat untuk {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya.

{{tempat}}, {{tanggal}}
Kepala RA

{{nama_kepala}}');
*/

-- ========================================
-- Catatan Penggunaan
-- ========================================

-- 1. Format Nomor Surat:
--    [counter]/[kode]/[bulan_romawi]/[tahun]
--    Contoh: 001/RA/III/2026
--
--    - counter: Auto-increment per bulan (001, 002, dst)
--    - kode: Kode surat (default: RA, bisa custom)
--    - bulan_romawi: I-XII
--    - tahun: 4 digit

-- 2. Placeholder dalam template:
--    Gunakan format {{nama_variable}}
--    Contoh: {{nama_siswa}}, {{tanggal}}, {{alamat}}
--
--    Saat generate surat, kirim parameters:
--    {"nama_siswa": "Ahmad", "tanggal": "10 Maret 2026"}

-- 3. Query untuk melihat nomor surat terakhir:
--    SELECT * FROM nomor_surat_counter 
--    WHERE ra_id = 1 AND tahun = 2026 AND bulan = 3;

-- 4. Reset counter di awal bulan (opsional, counter akan auto-create):
--    INSERT INTO nomor_surat_counter (ra_id, tahun, bulan, counter)
--    VALUES (1, 2026, 4, 0);
