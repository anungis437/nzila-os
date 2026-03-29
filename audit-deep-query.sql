-- Deep column comparison for misaligned tables
-- 1. claim_updates: PK mismatch (local=id, staging=update_id)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'claim_updates'
ORDER BY ordinal_position;
