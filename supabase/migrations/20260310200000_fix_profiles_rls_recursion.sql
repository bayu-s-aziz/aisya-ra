-- =====================================================
-- Fix: infinite recursion in profiles RLS policy
-- Root cause: profiles_select queries profiles itself.
-- Solution: use a SECURITY DEFINER helper function that
--           reads profiles bypassing RLS, then wire it
--           into every policy that previously did
--           "SELECT ra_id FROM profiles WHERE id = auth.uid()".
-- =====================================================

-- 1) Helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_ra_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ra_id FROM profiles WHERE id = auth.uid();
$$;

-- 2) Fix the recursive profiles_select policy
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
    FOR SELECT USING (
        ra_id = get_my_ra_id()
    );

-- 3) Re-wire all other policies to use get_my_ra_id()
--    instead of inline "SELECT ra_id FROM profiles WHERE id = auth.uid()"

-- ra_profiles
DROP POLICY IF EXISTS ra_profiles_select ON ra_profiles;
CREATE POLICY ra_profiles_select ON ra_profiles
    FOR SELECT USING (id = get_my_ra_id());

DROP POLICY IF EXISTS ra_profiles_update ON ra_profiles;
CREATE POLICY ra_profiles_update ON ra_profiles
    FOR UPDATE USING (
        id = get_my_ra_id()
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'kepala_ra'
        )
    );

-- kelompok
DROP POLICY IF EXISTS kelompok_all ON kelompok;
CREATE POLICY kelompok_all ON kelompok
    USING (ra_id = get_my_ra_id());

-- chat_rooms
DROP POLICY IF EXISTS chat_rooms_all ON chat_rooms;
CREATE POLICY chat_rooms_all ON chat_rooms
    USING (ra_id = get_my_ra_id());

-- chat_history
DROP POLICY IF EXISTS chat_history_all ON chat_history;
CREATE POLICY chat_history_all ON chat_history
    USING (
        room_id IN (
            SELECT id FROM chat_rooms WHERE ra_id = get_my_ra_id()
        )
    );

-- rpph
DROP POLICY IF EXISTS rpph_all ON rpph;
CREATE POLICY rpph_all ON rpph
    USING (
        guru_id = auth.uid()
        OR kelompok_id IN (
            SELECT id FROM kelompok WHERE ra_id = get_my_ra_id()
        )
    );

-- catatan_anekdot
DROP POLICY IF EXISTS catatan_anekdot_all ON catatan_anekdot;
CREATE POLICY catatan_anekdot_all ON catatan_anekdot
    USING (
        guru_id = auth.uid()
        OR siswa_id IN (
            SELECT id FROM siswa
            WHERE kelompok_id IN (
                SELECT id FROM kelompok WHERE ra_id = get_my_ra_id()
            )
        )
    );

-- presensi
DROP POLICY IF EXISTS presensi_all ON presensi;
CREATE POLICY presensi_all ON presensi
    USING (
        siswa_id IN (
            SELECT id FROM siswa
            WHERE kelompok_id IN (
                SELECT id FROM kelompok WHERE ra_id = get_my_ra_id()
            )
        )
    );

-- knowledge_docs
DROP POLICY IF EXISTS knowledge_docs_all ON knowledge_docs;
CREATE POLICY knowledge_docs_all ON knowledge_docs
    USING (ra_id = get_my_ra_id());

-- knowledge_chunks
DROP POLICY IF EXISTS knowledge_chunks_all ON knowledge_chunks;
CREATE POLICY knowledge_chunks_all ON knowledge_chunks
    USING (
        doc_id IN (
            SELECT id FROM knowledge_docs WHERE ra_id = get_my_ra_id()
        )
    );

-- template_surat
DROP POLICY IF EXISTS template_surat_all ON template_surat;
CREATE POLICY template_surat_all ON template_surat
    USING (ra_id = get_my_ra_id());

-- surat
DROP POLICY IF EXISTS surat_all ON surat;
CREATE POLICY surat_all ON surat
    USING (ra_id = get_my_ra_id());

-- nomor_surat_counter
DROP POLICY IF EXISTS nomor_surat_counter_all ON nomor_surat_counter;
CREATE POLICY nomor_surat_counter_all ON nomor_surat_counter
    USING (ra_id = get_my_ra_id());
