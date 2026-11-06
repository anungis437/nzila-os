-- Platform migration document_intake_matter_binding
--
-- DEF-0B8-FED-EXTERNAL-UPLOAD-ATTACHES-ANY-ORGANIZATION-BLOB-TO-GRIEVANCE. The external upload attached whatever stored object the representative
-- named under the organization's prefix: nothing showed the object was uploaded by that representative, for that matter. An external upload now goes
-- through a document intake (platform 0022), which already binds the object to the principal who uploaded it, the organization, a server-chosen
-- storage key and a server-computed checksum. This adds the matter: matter_type and matter_id name the one matter an intake was opened for, both or
-- neither. An intake that names a matter is accepted only for that matter; the internal repository routes, which name none, never accept it.
-- Additive and nullable: existing intakes keep NULL (they name no matter) and nothing is backfilled. Idempotent.
DO $ue_intake_matter$
BEGIN
  IF to_regclass('public.document_intakes') IS NULL THEN
    RAISE EXCEPTION 'platform document_intake_matter_binding fail-closed: public.document_intakes does not exist (platform 0022 not applied).';
  END IF;
END $ue_intake_matter$;
--> statement-breakpoint
ALTER TABLE public.document_intakes ADD COLUMN IF NOT EXISTS matter_type text;
--> statement-breakpoint
ALTER TABLE public.document_intakes ADD COLUMN IF NOT EXISTS matter_id uuid;
--> statement-breakpoint
DO $ue_intake_matter_ck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.document_intakes'::regclass AND conname = 'document_intakes_matter_ck'
  ) THEN
    ALTER TABLE public.document_intakes
      ADD CONSTRAINT document_intakes_matter_ck CHECK ((matter_type IS NULL) = (matter_id IS NULL));
  END IF;
END $ue_intake_matter_ck$;
--> statement-breakpoint
-- The matter is fixed when the intake is opened: no writer can move an intake to another matter afterwards.
CREATE OR REPLACE FUNCTION public.document_intakes_matter_immutable() RETURNS trigger LANGUAGE plpgsql AS $ue_fn$
BEGIN
  IF NEW.matter_type IS DISTINCT FROM OLD.matter_type OR NEW.matter_id IS DISTINCT FROM OLD.matter_id THEN
    RAISE EXCEPTION 'document_intakes: the matter of an intake cannot change' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $ue_fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_intakes_matter_immutable ON public.document_intakes;
--> statement-breakpoint
CREATE TRIGGER document_intakes_matter_immutable BEFORE UPDATE ON public.document_intakes
  FOR EACH ROW EXECUTE FUNCTION public.document_intakes_matter_immutable();
