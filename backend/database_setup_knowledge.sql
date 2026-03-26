-- ========================================
-- AISYA Database Setup for Knowledge Base
-- ========================================

-- 1. Aktifkan ekstensi pgvector
-- Di Supabase Dashboard: Database > Extensions > cari "vector" > enable
-- Atau jalankan SQL berikut:
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Buat tabel knowledge_docs
CREATE TABLE IF NOT EXISTS knowledge_docs (
    id SERIAL PRIMARY KEY,
    ra_id INT NOT NULL REFERENCES ra_profiles(id) ON DELETE CASCADE,
    nama_file VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX idx_knowledge_docs_ra ON knowledge_docs(ra_id);
CREATE INDEX idx_knowledge_docs_uploaded ON knowledge_docs(uploaded_at DESC);

-- 3. Buat tabel knowledge_chunks dengan vector embedding
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id SERIAL PRIMARY KEY,
    doc_id INT NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(768)  -- Gemini text-embedding-004 menghasilkan 768 dimensions
);

-- Index untuk performa
CREATE INDEX idx_knowledge_chunks_doc ON knowledge_chunks(doc_id);

-- Index untuk vector similarity search (HNSW atau IVFFlat)
-- HNSW lebih akurat tapi lebih lambat untuk insert, IVFFlat lebih cepat
-- Pilih salah satu:

-- Option A: HNSW (lebih akurat, direkomendasikan untuk < 1M vectors)
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Option B: IVFFlat (lebih cepat insert, untuk dataset besar)
-- CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks 
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. Buat RPC function untuk similarity search
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 3,
    filter_ra_id int DEFAULT NULL
)
RETURNS TABLE (
    id int,
    doc_id int,
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
        1 - (kc.embedding <=> query_embedding) as similarity
    FROM knowledge_chunks kc
    INNER JOIN knowledge_docs kd ON kc.doc_id = kd.id
    WHERE 
        (filter_ra_id IS NULL OR kd.ra_id = filter_ra_id)
        AND 1 - (kc.embedding <=> query_embedding) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 5. Grant permissions (adjust sesuai kebutuhan)
-- Jika menggunakan RLS (Row Level Security), pastikan policy sudah benar
-- Contoh RLS untuk knowledge_docs:
ALTER TABLE knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their RA's knowledge docs"
ON knowledge_docs FOR SELECT
USING (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their RA's knowledge docs"
ON knowledge_docs FOR INSERT
WITH CHECK (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their RA's knowledge docs"
ON knowledge_docs FOR DELETE
USING (
    ra_id IN (
        SELECT ra_id FROM ra_profiles 
        WHERE profile_id = auth.uid()
    )
);

-- RLS untuk knowledge_chunks
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chunks from their RA's docs"
ON knowledge_chunks FOR SELECT
USING (
    doc_id IN (
        SELECT kd.id FROM knowledge_docs kd
        INNER JOIN ra_profiles rp ON kd.ra_id = rp.ra_id
        WHERE rp.profile_id = auth.uid()
    )
);

CREATE POLICY "Users can insert chunks for their RA's docs"
ON knowledge_chunks FOR INSERT
WITH CHECK (
    doc_id IN (
        SELECT kd.id FROM knowledge_docs kd
        INNER JOIN ra_profiles rp ON kd.ra_id = rp.ra_id
        WHERE rp.profile_id = auth.uid()
    )
);

CREATE POLICY "Users can delete chunks from their RA's docs"
ON knowledge_chunks FOR DELETE
USING (
    doc_id IN (
        SELECT kd.id FROM knowledge_docs kd
        INNER JOIN ra_profiles rp ON kd.ra_id = rp.ra_id
        WHERE rp.profile_id = auth.uid()
    )
);

-- ========================================
-- Catatan:
-- ========================================
-- 1. Cosine similarity operator: <=>
--    - Nilai 0 = identik
--    - Nilai 1 = sangat berbeda
--    - Kita convert ke similarity score: 1 - distance
--
-- 2. Operators lain yang tersedia:
--    - <-> : L2 distance (Euclidean)
--    - <#> : Inner product
--    - <=> : Cosine distance (direkomendasikan untuk text embeddings)
--
-- 3. Untuk testing manual:
--    SELECT * FROM match_knowledge_chunks(
--        ARRAY[0.1, 0.2, ...]::vector(768),
--        0.5,
--        3,
--        1
--    );
