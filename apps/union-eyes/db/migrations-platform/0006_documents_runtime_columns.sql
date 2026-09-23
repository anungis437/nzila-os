-- PLATFORM_SQL 0006 - additive documents columns required by runtime repository API.
-- Authority: Drizzle apps/union-eyes/db/schema/documents-schema.ts
-- Runtime-proven gap on reconstituted staging: repository GET selects name/file_url/
-- uploaded_by/deleted_at which were absent after lineage restore.
-- Idempotent ADD COLUMN IF NOT EXISTS only. No redesign.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description text;

-- Backfill NOT NULL-ish operational defaults for existing Phase G / reconstituted rows
UPDATE documents SET name = COALESCE(NULLIF(name, ''), NULLIF(title, ''), NULLIF(filename, ''), 'document') WHERE name IS NULL;
UPDATE documents SET file_url = COALESCE(NULLIF(file_url, ''), 'phase-g://placeholder/' || id::text) WHERE file_url IS NULL;
UPDATE documents SET uploaded_by = COALESCE(NULLIF(uploaded_by, ''), 'phase-g-seed') WHERE uploaded_by IS NULL;
