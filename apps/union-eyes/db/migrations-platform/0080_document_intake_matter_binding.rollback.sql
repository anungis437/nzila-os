-- Platform migration rollback document_intake_matter_binding
--
-- Removes the matter binding of document intakes. Refuses while any intake names a matter: dropping the columns would turn an intake opened for one
-- matter into one any route accepts. Run only with the external intake and upload routes disabled.
DO $ue_rollback$
BEGIN
  IF to_regclass('public.document_intakes') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = 'public.document_intakes'::regclass AND attname = 'matter_id' AND NOT attisdropped
  ) AND EXISTS (SELECT 1 FROM public.document_intakes WHERE matter_id IS NOT NULL) THEN
    RAISE EXCEPTION 'rollback document_intake_matter_binding refuses: intakes bound to a matter exist.';
  END IF;
  DROP TRIGGER IF EXISTS document_intakes_matter_immutable ON public.document_intakes;
  DROP FUNCTION IF EXISTS public.document_intakes_matter_immutable();
  ALTER TABLE public.document_intakes DROP CONSTRAINT IF EXISTS document_intakes_matter_ck;
  ALTER TABLE public.document_intakes DROP COLUMN IF EXISTS matter_id;
  ALTER TABLE public.document_intakes DROP COLUMN IF EXISTS matter_type;
END $ue_rollback$;
