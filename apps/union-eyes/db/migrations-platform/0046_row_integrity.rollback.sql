-- Rollback for 0046_row_integrity. The pinned versions of grants are discarded (those grants fall back to the unpinned meaning);
-- review them first. No data row is otherwise changed.
DROP INDEX IF EXISTS public.member_jurisdiction_preferences_user_org_uq;
DROP TRIGGER IF EXISTS ue_employers_parent_same_organization ON public.employers;
DROP FUNCTION IF EXISTS public.ue_employers_parent_same_organization();
ALTER TABLE IF EXISTS public.external_document_access_grants DROP CONSTRAINT IF EXISTS external_document_grants_version_positive;
ALTER TABLE IF EXISTS public.external_document_access_grants DROP COLUMN IF EXISTS document_version_no;
