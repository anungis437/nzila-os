-- PLATFORM_SQL — additive evolution of historical fee_adjustment_type.
--
-- Frozen 0086_monetization_phase2.sql defines
-- ('reversal','waiver','correction','dispute_credit'). Platform 0009 also
-- requires partial_reversal before waiver. This statement runs after the
-- DAPL label evolution and before 0009. It does not rewrite rows. A label
-- outside the canonical list, or an order that cannot be preserved, raises
-- and leaves the type unchanged. A missing type is left for 0009 to create.

DO $ue$
DECLARE
  spec record;
  canonical text[];
  existing text[];
  anchors text[];
  label text;
  anchor text;
  i int;
  j int;
BEGIN
  FOR spec IN
    SELECT *
    FROM (VALUES
      (
        'fee_adjustment_type',
        ARRAY['reversal', 'partial_reversal', 'waiver', 'correction', 'dispute_credit']::text[]
      )
    ) AS planned(type_name, labels)
  LOOP
    canonical := spec.labels;
    IF to_regtype(format('public.%I', spec.type_name)) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
      INTO existing
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = spec.type_name;

    j := 1;
    FOREACH label IN ARRAY existing LOOP
      WHILE j <= cardinality(canonical) AND canonical[j] IS DISTINCT FROM label LOOP
        j := j + 1;
      END LOOP;
      IF j > cardinality(canonical) THEN
        RAISE EXCEPTION 'incompatible existing type public.%', spec.type_name;
      END IF;
      j := j + 1;
    END LOOP;

    anchors := existing;
    FOR i IN 1..cardinality(canonical) LOOP
      IF canonical[i] = ANY (anchors) THEN
        CONTINUE;
      END IF;
      anchor := NULL;
      FOR j IN i + 1..cardinality(canonical) LOOP
        IF canonical[j] = ANY (anchors) THEN
          anchor := canonical[j];
          EXIT;
        END IF;
      END LOOP;
      IF anchor IS NULL THEN
        EXECUTE format('ALTER TYPE public.%I ADD VALUE %L', spec.type_name, canonical[i]);
      ELSE
        EXECUTE format('ALTER TYPE public.%I ADD VALUE %L BEFORE %L', spec.type_name, canonical[i], anchor);
      END IF;
    END LOOP;
  END LOOP;
END
$ue$;
