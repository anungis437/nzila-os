-- 0031_feature_flags_attribution_columns rollback: drop the attribution columns (their contents are lost).
ALTER TABLE public.feature_flags DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE public.feature_flags DROP COLUMN IF EXISTS created_by;
