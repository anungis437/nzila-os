-- platform-migration:ml_predictions_relax_legacy_not_null: resolves DEF-0B9-ML-DECLARED-PREDICTION-SHAPE-
-- CONFLICTS-WITH-THE-SQL-THAT-CREATES-THE-TABLE. Three historical migrations (db/migrations/
-- 20260324_add_remaining_missing_tables.sql, db/migrations/20260507_fixup_create_break_glass_activations.sql,
-- db/migrations/manual/067_advanced_analytics_q1_2025.sql) each create public.ml_predictions with
-- model_name, model_version and target_date NOT NULL and no default - a shape matching the now-shadowed
-- db/schema/domains/analytics/analytics.ts Drizzle declaration, superseded by db/schema/domains/ml/
-- predictions.ts (db/schema/index.ts: "ML domain is the canonical source for predictions"). Platform
-- migration 0019 only ADDS the canonical columns (prediction_type, prediction_date, predicted_value, ...)
-- and never touches these three, so on a table created from one of those three legacy files every insert
-- that does not supply all three is refused - exactly what every current write path does (the SLA breach
-- risk route, the generic prediction routes, actions/analytics-actions.ts's generatePredictions). Zero
-- production code reads or writes model_name or target_date under any name; model_version is read/written
-- by the SLA route but not by every insert path (analytics-actions.ts's generatePredictions omits it too),
-- so it cannot stay a hard requirement either. This migration only relaxes NOT NULL on the three legacy
-- columns, each guarded so it is a no-op wherever the column does not exist (a table built fresh from the
-- canonical Drizzle shape never had them) or is already nullable. No row's data changes.
DO $ml_predictions_relax_legacy_not_null$
BEGIN
  IF to_regclass('public.ml_predictions') IS NULL THEN
    RAISE EXCEPTION 'platform-migration:ml_predictions_relax_legacy_not_null fail-closed: public.ml_predictions does not exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ml_predictions' AND column_name = 'model_name' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.ml_predictions ALTER COLUMN model_name DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ml_predictions' AND column_name = 'model_version' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.ml_predictions ALTER COLUMN model_version DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ml_predictions' AND column_name = 'target_date' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.ml_predictions ALTER COLUMN target_date DROP NOT NULL;
  END IF;
END
$ml_predictions_relax_legacy_not_null$;
