-- Add 'dashboard' as valid tipe for chat_rooms
ALTER TABLE chat_rooms
  DROP CONSTRAINT IF EXISTS chat_rooms_tipe_check;

ALTER TABLE chat_rooms
  ADD CONSTRAINT chat_rooms_tipe_check
  CHECK (tipe IN ('utama', 'rpph', 'anekdot', 'surat', 'presensi', 'custom', 'dashboard'));
