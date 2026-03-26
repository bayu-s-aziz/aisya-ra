-- =====================================================
-- Alignment migration: runtime backend compatibility
-- =====================================================

-- 1) Perbaiki desain nomor_surat_counter agar benar-benar per RA + tahun + bulan
--    Migrasi awal memakai PRIMARY KEY (ra_id) sehingga tidak bisa punya counter per bulan.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'nomor_surat_counter'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'nomor_surat_counter_pkey'
  ) THEN
    ALTER TABLE nomor_surat_counter DROP CONSTRAINT nomor_surat_counter_pkey;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE nomor_surat_counter
  ADD CONSTRAINT nomor_surat_counter_pkey PRIMARY KEY (ra_id, tahun, bulan);

-- 2) Tambahkan RPC function untuk vector retrieval (dipakai backend/app/utils/retrieval.py)
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 3,
    filter_ra_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    doc_id uuid,
    content text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.doc_id,
        kc.content,
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM knowledge_chunks kc
    INNER JOIN knowledge_docs kd ON kc.doc_id = kd.id
    WHERE
        (filter_ra_id IS NULL OR kd.ra_id = filter_ra_id)
        AND 1 - (kc.embedding <=> query_embedding) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 3) Index tambahan yang aman jika belum ada
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_ra_id ON knowledge_docs(ra_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_id ON knowledge_chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_presensi_tanggal ON presensi(tanggal);
CREATE INDEX IF NOT EXISTS idx_rpph_guru_tanggal ON rpph(guru_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_catatan_anekdot_guru_tanggal ON catatan_anekdot(guru_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_catatan_anekdot_siswa_tanggal ON catatan_anekdot(siswa_id, tanggal);
