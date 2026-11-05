-- 0031_feature_flags_attribution_columns
--
-- The canonical feature_flags table (Django) has no created_by or last_modified_by column, but the ORM declaration selects both
-- on every read, so every feature-flag evaluation failed with "column does not exist" and fell closed: a running application
-- logged thousands of errors and no flag could ever be on. The flag writers record who created and last changed a flag, so the
-- columns are added rather than the attribution dropped. Nullable text; existing rows are untouched.

DO $$
BEGIN
  IF to_regclass('public.feature_flags') IS NULL THEN
    RAISE EXCEPTION 'cache 0031 fail-closed: public.feature_flags does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS created_by text;
--> statement-breakpoint
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS last_modified_by text;
