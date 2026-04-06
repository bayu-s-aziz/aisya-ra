-- Extend kelompok and presensi with richer EMIS-like operational fields

ALTER TABLE kelompok
  ADD COLUMN IF NOT EXISTS kode_rombel TEXT,
  ADD COLUMN IF NOT EXISTS tingkat TEXT,
  ADD COLUMN IF NOT EXISTS semester TEXT,
  ADD COLUMN IF NOT EXISTS kurikulum TEXT,
  ADD COLUMN IF NOT EXISTS ruang_kelas TEXT,
  ADD COLUMN IF NOT EXISTS kapasitas INTEGER,
  ADD COLUMN IF NOT EXISTS status_rombel TEXT;

CREATE INDEX IF NOT EXISTS idx_kelompok_kode_rombel ON kelompok(kode_rombel);
CREATE INDEX IF NOT EXISTS idx_kelompok_tingkat ON kelompok(tingkat);

ALTER TABLE presensi
  ADD COLUMN IF NOT EXISTS keterangan TEXT,
  ADD COLUMN IF NOT EXISTS sumber_pencatatan TEXT;

CREATE INDEX IF NOT EXISTS idx_presensi_tanggal_status ON presensi(tanggal, status);
