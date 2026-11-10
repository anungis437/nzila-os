-- Rollback of platform-migration:ml_predictions_relax_legacy_not_null. Restores NOT NULL on each of the
-- three legacy columns, but only where every existing row already has a non-null value in it - a column
-- that now holds any null (expected, since the forward migration exists precisely so new rows can omit
-- them) cannot have NOT NULL restored without a backfill decision this rollback does not make. Refuses
-- per-column rather than failing the whole statement, since the three columns are independent.
DO $ml_predictions_relax_legacy_not_null_rollback$
DECLARE
  has_null boolean;
BEGIN
  IF to_regclass('public.ml_predictions') IS NULL THEN
    RAISE EXCEPTION 'platform-migration:ml_predictions_relax_legacy_not_null rollback fail-closed: public.ml_predictions does not exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ml_predictions' AND column_name = 'model_name' AND is_nullable = 'YES'
  ) THEN
    SELECT EXISTS (SELECT 1 FROM public.ml_predictions WHERE model_name IS NULL) INTO has_null;
    IF has_null THEN
      RAISE EXCEPTION 'platform-migration:ml_predictions_relax_legacy_not_null rollback refuses: model_name holds a null row; backfill before restoring NOT NULL.';
    END IF;
    ALTER TABLE public.ml_predictions ALTER COLUMN model_name SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ml_predictions' AND column_name = 'model_version' AND is_nullable = 'YES'
  ) THEN
    SELECT EXISTS (SELECT 1 FROM public.ml_predictions WHERE model_version IS NULL) INTO has_null;
    IF has_null THEN
      RAISE EXCEPTION 'platform-migration:ml_predictions_relax_legacy_not_null rollback refuses: model_version holds a null row; backfill before restoring NOT NULL.';
    END IF;
    ALTER TABLE public.ml_predictions ALTER COLUMN model_version SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ml_predictions' AND column_name = 'target_date' AND is_nullable = 'YES'
  ) THEN
    SELECT EXISTS (SELECT 1 FROM public.ml_predictions WHERE target_date IS NULL) INTO has_null;
    IF has_null THEN
      RAISE EXCEPTION 'platform-migration:ml_predictions_relax_legacy_not_null rollback refuses: target_date holds a null row; backfill before restoring NOT NULL.';
    END IF;
    ALTER TABLE public.ml_predictions ALTER COLUMN target_date SET NOT NULL;
  END IF;
END
$ml_predictions_relax_legacy_not_null_rollback$;
