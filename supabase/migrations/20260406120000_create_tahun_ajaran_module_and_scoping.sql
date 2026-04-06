-- Modul tahun ajaran + scoping data administratif berdasarkan tahun aktif

CREATE TABLE IF NOT EXISTS tahun_ajaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ra_id UUID NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tahun_ajaran_ra_label ON tahun_ajaran(ra_id, label);
CREATE INDEX IF NOT EXISTS idx_tahun_ajaran_ra_id ON tahun_ajaran(ra_id);

DROP TRIGGER IF EXISTS update_tahun_ajaran_updated_at ON tahun_ajaran;
CREATE TRIGGER update_tahun_ajaran_updated_at
BEFORE UPDATE ON tahun_ajaran
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE kelompok ADD COLUMN IF NOT EXISTS tahun_ajaran_id UUID REFERENCES tahun_ajaran(id) ON DELETE RESTRICT;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS tahun_ajaran_id UUID REFERENCES tahun_ajaran(id) ON DELETE RESTRICT;
ALTER TABLE presensi ADD COLUMN IF NOT EXISTS tahun_ajaran_id UUID REFERENCES tahun_ajaran(id) ON DELETE RESTRICT;
ALTER TABLE rpph ADD COLUMN IF NOT EXISTS tahun_ajaran_id UUID REFERENCES tahun_ajaran(id) ON DELETE RESTRICT;
ALTER TABLE catatan_anekdot ADD COLUMN IF NOT EXISTS tahun_ajaran_id UUID REFERENCES tahun_ajaran(id) ON DELETE RESTRICT;

INSERT INTO tahun_ajaran (ra_id, label, is_active)
SELECT
  rp.id,
  CASE
    WHEN rp.tahun_ajaran IS NOT NULL AND BTRIM(rp.tahun_ajaran) <> '' THEN BTRIM(rp.tahun_ajaran)
    WHEN EXTRACT(MONTH FROM NOW()) >= 7
      THEN CONCAT(EXTRACT(YEAR FROM NOW())::INT, '/', (EXTRACT(YEAR FROM NOW())::INT + 1))
    ELSE CONCAT((EXTRACT(YEAR FROM NOW())::INT - 1), '/', EXTRACT(YEAR FROM NOW())::INT)
  END,
  TRUE
FROM ra_profiles rp
ON CONFLICT (ra_id, label) DO NOTHING;

WITH target AS (
  SELECT DISTINCT ON (ta.ra_id)
    ta.id,
    ta.ra_id,
    ta.label
  FROM tahun_ajaran ta
  JOIN ra_profiles rp ON rp.id = ta.ra_id
  ORDER BY
    ta.ra_id,
    CASE
      WHEN rp.tahun_ajaran IS NOT NULL
        AND BTRIM(rp.tahun_ajaran) <> ''
        AND ta.label = BTRIM(rp.tahun_ajaran)
      THEN 0 ELSE 1
    END,
    ta.created_at DESC
)
UPDATE tahun_ajaran ta
SET is_active = (ta.id = target.id)
FROM target
WHERE ta.ra_id = target.ra_id;

UPDATE ra_profiles rp
SET tahun_ajaran = ta.label
FROM tahun_ajaran ta
WHERE ta.ra_id = rp.id
  AND ta.is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tahun_ajaran_one_active_per_ra ON tahun_ajaran(ra_id) WHERE is_active;

UPDATE kelompok k
SET tahun_ajaran_id = ta.id
FROM tahun_ajaran ta
WHERE k.tahun_ajaran_id IS NULL
  AND ta.ra_id = k.ra_id
  AND ta.is_active = TRUE;

UPDATE siswa s
SET tahun_ajaran_id = k.tahun_ajaran_id
FROM kelompok k
WHERE s.tahun_ajaran_id IS NULL
  AND s.kelompok_id = k.id
  AND k.tahun_ajaran_id IS NOT NULL;

UPDATE siswa s
SET tahun_ajaran_id = ta.id
FROM tahun_ajaran ta
WHERE s.tahun_ajaran_id IS NULL
  AND s.ra_id = ta.ra_id
  AND ta.is_active = TRUE;

UPDATE presensi p
SET tahun_ajaran_id = s.tahun_ajaran_id
FROM siswa s
WHERE p.tahun_ajaran_id IS NULL
  AND p.siswa_id = s.id
  AND s.tahun_ajaran_id IS NOT NULL;

UPDATE rpph r
SET tahun_ajaran_id = k.tahun_ajaran_id
FROM kelompok k
WHERE r.tahun_ajaran_id IS NULL
  AND r.kelompok_id = k.id
  AND k.tahun_ajaran_id IS NOT NULL;

UPDATE rpph r
SET tahun_ajaran_id = ta.id
FROM profiles pr
JOIN tahun_ajaran ta ON ta.ra_id = pr.ra_id AND ta.is_active = TRUE
WHERE r.tahun_ajaran_id IS NULL
  AND r.guru_id = pr.id;

UPDATE catatan_anekdot c
SET tahun_ajaran_id = s.tahun_ajaran_id
FROM siswa s
WHERE c.tahun_ajaran_id IS NULL
  AND c.siswa_id = s.id
  AND s.tahun_ajaran_id IS NOT NULL;

UPDATE catatan_anekdot c
SET tahun_ajaran_id = ta.id
FROM profiles p
JOIN tahun_ajaran ta ON ta.ra_id = p.ra_id AND ta.is_active = TRUE
WHERE c.tahun_ajaran_id IS NULL
  AND c.guru_id = p.id;

CREATE INDEX IF NOT EXISTS idx_kelompok_tahun_ajaran_id ON kelompok(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_siswa_tahun_ajaran_id ON siswa(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_presensi_tahun_ajaran_id ON presensi(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_rpph_tahun_ajaran_id ON rpph(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_catatan_tahun_ajaran_id ON catatan_anekdot(tahun_ajaran_id);
