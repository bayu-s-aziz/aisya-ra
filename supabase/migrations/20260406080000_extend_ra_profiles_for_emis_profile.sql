-- Extend ra_profiles with richer institution profile fields (EMIS-like)
ALTER TABLE ra_profiles
  ADD COLUMN IF NOT EXISTS npsn TEXT,
  ADD COLUMN IF NOT EXISTS status_lembaga TEXT,
  ADD COLUMN IF NOT EXISTS bentuk_pendidikan TEXT,
  ADD COLUMN IF NOT EXISTS penyelenggara TEXT,
  ADD COLUMN IF NOT EXISTS akreditasi TEXT,
  ADD COLUMN IF NOT EXISTS sk_izin_operasional TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_izin_operasional DATE,
  ADD COLUMN IF NOT EXISTS nama_kepala TEXT,
  ADD COLUMN IF NOT EXISTS telepon TEXT,
  ADD COLUMN IF NOT EXISTS email_lembaga TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS kelurahan_desa TEXT,
  ADD COLUMN IF NOT EXISTS kecamatan TEXT,
  ADD COLUMN IF NOT EXISTS kabupaten_kota TEXT,
  ADD COLUMN IF NOT EXISTS provinsi TEXT,
  ADD COLUMN IF NOT EXISTS kode_pos TEXT;
