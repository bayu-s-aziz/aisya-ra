-- Extend siswa table to support EMIS Kemenag import fields

ALTER TABLE siswa
  ADD COLUMN IF NOT EXISTS ra_id UUID REFERENCES ra_profiles(id) ON DELETE CASCADE;

UPDATE siswa s
SET ra_id = k.ra_id
FROM kelompok k
WHERE s.ra_id IS NULL
  AND s.kelompok_id = k.id;

ALTER TABLE siswa
  ADD COLUMN IF NOT EXISTS nisn TEXT,
  ADD COLUMN IF NOT EXISTS nik TEXT,
  ADD COLUMN IF NOT EXISTS tempat_lahir TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
  ADD COLUMN IF NOT EXISTS tingkat_rombel TEXT,
  ADD COLUMN IF NOT EXISTS umur_text TEXT,
  ADD COLUMN IF NOT EXISTS jenis_kelamin TEXT,
  ADD COLUMN IF NOT EXISTS alamat TEXT,
  ADD COLUMN IF NOT EXISTS no_telepon TEXT,
  ADD COLUMN IF NOT EXISTS kebutuhan_khusus TEXT,
  ADD COLUMN IF NOT EXISTS disabilitas TEXT,
  ADD COLUMN IF NOT EXISTS nomor_kip_pip TEXT,
  ADD COLUMN IF NOT EXISTS nama_ayah_kandung TEXT,
  ADD COLUMN IF NOT EXISTS nama_ibu_kandung TEXT,
  ADD COLUMN IF NOT EXISTS nama_wali TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'siswa' AND column_name = 'ra_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_siswa_ra_id ON siswa(ra_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'siswa' AND column_name = 'nisn'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_siswa_nisn ON siswa(nisn);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'siswa' AND column_name = 'nik'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_siswa_nik ON siswa(nik);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'siswa' AND column_name = 'tingkat_rombel'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_siswa_tingkat_rombel ON siswa(tingkat_rombel);
  END IF;
END $$;
