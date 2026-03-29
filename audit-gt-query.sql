-- Column diff for grievance_transitions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'grievance_transitions'
ORDER BY ordinal_position;
