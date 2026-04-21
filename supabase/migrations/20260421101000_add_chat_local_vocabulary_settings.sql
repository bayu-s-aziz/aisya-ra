-- Runtime-configurable local chat vocabulary per RA.
-- This enables admin panel to tune colloquial terms without changing backend code.

CREATE TABLE IF NOT EXISTS chat_local_vocabulary (
  ra_id UUID PRIMARY KEY REFERENCES ra_profiles(id) ON DELETE CASCADE,
  token_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  phrase_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_local_vocabulary_updated_by
  ON chat_local_vocabulary(updated_by);

DROP TRIGGER IF EXISTS update_chat_local_vocabulary_updated_at ON chat_local_vocabulary;
CREATE TRIGGER update_chat_local_vocabulary_updated_at
BEFORE UPDATE ON chat_local_vocabulary
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE chat_local_vocabulary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_local_vocabulary_all ON chat_local_vocabulary;
CREATE POLICY chat_local_vocabulary_all ON chat_local_vocabulary
USING (ra_id = get_my_ra_id())
WITH CHECK (ra_id = get_my_ra_id());
