-- Add NIS field for internal student numbering
ALTER TABLE siswa
  ADD COLUMN IF NOT EXISTS nis TEXT;

CREATE INDEX IF NOT EXISTS idx_siswa_nis_internal ON siswa(nis);
