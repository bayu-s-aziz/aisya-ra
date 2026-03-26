-- Extend profiles table to support GTK (data guru) import fields

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telepon TEXT,
  ADD COLUMN IF NOT EXISTS jabatan TEXT,
  ADD COLUMN IF NOT EXISTS nik TEXT,
  ADD COLUMN IF NOT EXISTS nuptk TEXT,
  ADD COLUMN IF NOT EXISTS status_kepegawaian TEXT,
  ADD COLUMN IF NOT EXISTS nip TEXT,
  ADD COLUMN IF NOT EXISTS jenis_kelamin TEXT,
  ADD COLUMN IF NOT EXISTS tempat_lahir TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
  ADD COLUMN IF NOT EXISTS email_akun_madrasah_digital TEXT,
  ADD COLUMN IF NOT EXISTS tugas TEXT,
  ADD COLUMN IF NOT EXISTS mata_pelajaran TEXT,
  ADD COLUMN IF NOT EXISTS penempatan TEXT,
  ADD COLUMN IF NOT EXISTS total_jtm TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_ra_id ON profiles(ra_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_nik ON profiles(nik);
CREATE INDEX IF NOT EXISTS idx_profiles_nuptk ON profiles(nuptk);
CREATE INDEX IF NOT EXISTS idx_profiles_nip ON profiles(nip);
