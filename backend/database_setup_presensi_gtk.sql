-- ==========================================
-- AISYA Database Setup for GTK Attendance
-- ==========================================

-- 1. Create table presensi_gtk
CREATE TABLE IF NOT EXISTS presensi_gtk (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pengguna_id UUID NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('hadir', 'sakit', 'izin', 'alpha')),
    dicatat_oleh UUID REFERENCES pengguna(id) ON DELETE SET NULL,
    keterangan TEXT,
    sumber_pencatatan VARCHAR(50) DEFAULT 'manual_panel',
    tahun_ajaran_id UUID NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pengguna_id, tanggal)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_presensi_gtk_pengguna ON presensi_gtk(pengguna_id);
CREATE INDEX IF NOT EXISTS idx_presensi_gtk_tanggal ON presensi_gtk(tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_gtk_tahun_ajaran ON presensi_gtk(tahun_ajaran_id);

-- 3. Enable RLS (Optional, adjust based on project requirements)
ALTER TABLE presensi_gtk ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Users can view their own attendance
CREATE POLICY "Users can view their own GTK attendance"
ON presensi_gtk FOR SELECT
USING (
    pengguna_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM pengguna 
        WHERE id = auth.uid() AND role IN ('kepala_ra', 'admin', 'admin_ra')
    )
);

-- Users can insert their own attendance
CREATE POLICY "Users can insert their own GTK attendance"
ON presensi_gtk FOR INSERT
WITH CHECK (
    pengguna_id = auth.uid()
);

-- Admin/Kepala can manage all attendance
CREATE POLICY "Admin/Kepala can manage all GTK attendance"
ON presensi_gtk FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM pengguna 
        WHERE id = auth.uid() AND role IN ('kepala_ra', 'admin', 'admin_ra')
    )
);
