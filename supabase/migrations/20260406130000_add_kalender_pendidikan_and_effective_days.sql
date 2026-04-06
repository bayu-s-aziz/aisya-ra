-- Kalender Pendidikan per RA/Tahun Ajaran + konfigurasi hari efektif belajar

ALTER TABLE tahun_ajaran
  ADD COLUMN IF NOT EXISTS hari_efektif_belajar SMALLINT NOT NULL DEFAULT 5;

ALTER TABLE tahun_ajaran
  DROP CONSTRAINT IF EXISTS tahun_ajaran_hari_efektif_check;

ALTER TABLE tahun_ajaran
  ADD CONSTRAINT tahun_ajaran_hari_efektif_check
  CHECK (hari_efektif_belajar IN (5, 6));

CREATE TABLE IF NOT EXISTS kalender_pendidikan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ra_id UUID NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
  tahun_ajaran_id UUID NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  nama_event TEXT NOT NULL,
  is_holiday BOOLEAN NOT NULL DEFAULT TRUE,
  sumber TEXT NOT NULL DEFAULT 'manual' CHECK (sumber IN ('kemenag', 'manual')),
  keterangan TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kalender_unique_event_source
  ON kalender_pendidikan(tahun_ajaran_id, tanggal, nama_event, sumber);

CREATE INDEX IF NOT EXISTS idx_kalender_ra_tahun_tanggal
  ON kalender_pendidikan(ra_id, tahun_ajaran_id, tanggal);

CREATE INDEX IF NOT EXISTS idx_kalender_is_holiday
  ON kalender_pendidikan(tahun_ajaran_id, is_holiday, tanggal);

DROP TRIGGER IF EXISTS update_kalender_pendidikan_updated_at ON kalender_pendidikan;
CREATE TRIGGER update_kalender_pendidikan_updated_at
BEFORE UPDATE ON kalender_pendidikan
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE kalender_pendidikan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kalender_pendidikan_all ON kalender_pendidikan;
CREATE POLICY kalender_pendidikan_all ON kalender_pendidikan
  USING (ra_id = get_my_ra_id());
