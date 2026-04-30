-- Migration: Simplify and Remove Anekdot
-- Created: 2026-04-23

-- 1. Hapus Tabel Catatan Anekdot
DROP TABLE IF EXISTS catatan_anekdot CASCADE;

-- 2. Rename Tabel
ALTER TABLE ra_profiles RENAME TO sekolah;
ALTER TABLE profiles RENAME TO pengguna;
ALTER TABLE kelompok RENAME TO kelompok_belajar;
ALTER TABLE chat_rooms RENAME TO chat_ruang;
ALTER TABLE chat_history RENAME TO chat_riwayat;
ALTER TABLE template_surat RENAME TO surat_template;
ALTER TABLE surat RENAME TO surat_keluar;
ALTER TABLE nomor_surat_counter RENAME TO surat_nomor_counter;

-- 3. Perbarui Trigger (Nama trigger biasanya tidak otomatis berubah mengikuti nama tabel baru)
DROP TRIGGER IF EXISTS after_ra_profiles_insert ON sekolah;
CREATE TRIGGER after_sekolah_insert
    AFTER INSERT ON sekolah
    FOR EACH ROW
    EXECUTE FUNCTION create_default_chat_room();

-- 4. Perbarui RLS Policies
-- Kita perlu drop dan recreate karena subqueries mungkin masih merujuk nama tabel lama.

-- Helper: Drop all policies
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || pol.policyname || ' ON ' || pol.tablename;
    END LOOP;
END $$;

-- Recreate Policies (Bahasa Indonesia & New Names)

-- Sekolah
ALTER TABLE sekolah ENABLE ROW LEVEL SECURITY;
CREATE POLICY sekolah_select ON sekolah FOR SELECT USING (id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid()));
CREATE POLICY sekolah_update ON sekolah FOR UPDATE USING (id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid() AND role = 'kepala_ra'));

-- Pengguna
ALTER TABLE pengguna ENABLE ROW LEVEL SECURITY;
CREATE POLICY pengguna_select ON pengguna FOR SELECT USING (ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid()));
CREATE POLICY pengguna_update ON pengguna FOR UPDATE USING (id = auth.uid());

-- Tahun Ajaran
ALTER TABLE tahun_ajaran ENABLE ROW LEVEL SECURITY;
CREATE POLICY tahun_ajaran_all ON tahun_ajaran USING (ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid()));

-- Kelompok Belajar
ALTER TABLE kelompok_belajar ENABLE ROW LEVEL SECURITY;
CREATE POLICY kelompok_belajar_all ON kelompok_belajar USING (ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid()));

-- Siswa
ALTER TABLE siswa ENABLE ROW LEVEL SECURITY;
CREATE POLICY siswa_all ON siswa USING (kelompok_id IN (SELECT id FROM kelompok_belajar WHERE ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid())));

-- Chat Ruang
ALTER TABLE chat_ruang ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_ruang_all ON chat_ruang USING (ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid()));

-- Chat Riwayat
ALTER TABLE chat_riwayat ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_riwayat_all ON chat_riwayat USING (room_id IN (SELECT id FROM chat_ruang WHERE ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid())));

-- Presensi
ALTER TABLE presensi ENABLE ROW LEVEL SECURITY;
CREATE POLICY presensi_all ON presensi USING (siswa_id IN (SELECT id FROM siswa WHERE kelompok_id IN (SELECT id FROM kelompok_belajar WHERE ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid()))));

-- RPPH
ALTER TABLE rpph ENABLE ROW LEVEL SECURITY;
CREATE POLICY rpph_all ON rpph USING (guru_id = auth.uid() OR kelompok_id IN (SELECT id FROM kelompok_belajar WHERE ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid())));

-- Surat Template
ALTER TABLE surat_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY surat_template_all ON surat_template USING (ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid()));

-- Surat Keluar
ALTER TABLE surat_keluar ENABLE ROW LEVEL SECURITY;
CREATE POLICY surat_keluar_all ON surat_keluar USING (ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid()));

-- Nomor Surat Counter
ALTER TABLE surat_nomor_counter ENABLE ROW LEVEL SECURITY;
CREATE POLICY surat_nomor_counter_all ON surat_nomor_counter USING (ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid()));

-- Notifikasi
ALTER TABLE notifikasi ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifikasi_all ON notifikasi USING (user_id = auth.uid());

-- Knowledge
ALTER TABLE knowledge_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_docs_all ON knowledge_docs USING (ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid()));

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_chunks_all ON knowledge_chunks USING (doc_id IN (SELECT id FROM knowledge_docs WHERE ra_id IN (SELECT ra_id FROM pengguna WHERE id = auth.uid())));
