-- 0035_room_bookings_rls_closure
--
-- FORCE RLS for room_bookings once platform 0041 brings the relation to its declared shape (organization_id uuid NOT NULL).
-- It is a direct organization_id tenant table and reuses ue_create_direct_org_rls_policy from 0010. This migration does not
-- grant DML: exact privileges come from the storage-authority manifest (db/rls-storage-authority/reference-latent.ts), which
-- grants the runtime role SELECT, INSERT and UPDATE only. A booking is cancelled, never deleted, so no DELETE is granted.
-- Without the policy the catalog preflight leaves the relation unclassified and runtime grant activation aborts.

DO $$
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0035 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  IF to_regclass('public.room_bookings') IS NULL THEN
    RAISE EXCEPTION 'RLS 0035 fail-closed: public.room_bookings does not exist.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'room_bookings' AND column_name = 'organization_id'
      AND udt_name = 'uuid' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'RLS 0035 fail-closed: public.room_bookings organization_id is not uuid NOT NULL (platform 0041 not applied, or the table holds rows).';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.room_bookings'::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
  ) THEN
    RAISE EXCEPTION 'RLS 0035 fail-closed: public.room_bookings is owned by a runtime role.';
  END IF;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('room_bookings');