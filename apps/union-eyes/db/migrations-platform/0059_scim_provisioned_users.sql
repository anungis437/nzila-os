-- PLATFORM_SQL 0059_scim_provisioned_users
--
-- A SCIM stream is a machine caller: it authenticates with the organization's bearer token and has no signed-in user, so the tenant role cannot
-- serve it, and the system role cannot create a membership (it holds no INSERT on organization_members, and widening it to insert members into
-- any organization would be a far larger authority than provisioning needs). The people an identity provider provisions are therefore not
-- roster rows. They are directory entries of their own: pending, never active, and not linked to anyone's account. A person becomes a member
-- only through the platform's own identity binding and the person's acceptance, which is a recorded blocked operation (lib/scim/provisioned-members.ts)
-- and not something this migration invents.
--
--   * scim_provisioned_users: one row per person the identity provider named, keyed by the organization and the lower-cased userName, with the
--     provider's own subject (externalId) when it sent one. A live person is unique per organization by userName and by externalId, enforced
--     by partial unique indexes, so no application lock is needed to keep that true. A deprovision is a state change (suspend, archive or
--     delete = soft delete), never a removal of the row. The system role alone reaches it (cache 0051).
--   * scim_events_log is evolved from the four-column Django stub to the shape its Drizzle declaration writes (UE-CONV-H-007 rules: additive,
--     nullable columns with the declared defaults, NOT NULL only on an empty relation, defaults for Django's base columns). No request or
--     response body is ever stored: they carry names and e-mail addresses.
--
-- Idempotent. Reversible (the rollback drops the new table and the added columns). Registered UNQUALIFIED. RLS and grants are cache 0051.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL OR to_regclass('public.scim_configurations') IS NULL OR to_regclass('public.scim_events_log') IS NULL THEN
    RAISE EXCEPTION 'platform 0059 fail-closed: organizations, scim_configurations or scim_events_log does not exist.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.scim_provisioned_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES public.scim_configurations (id),
  user_name varchar(320) NOT NULL,
  user_name_key varchar(320) NOT NULL,
  external_id varchar(255),
  display_name text,
  email varchar(320),
  status varchar(20) NOT NULL DEFAULT 'pending',
  provisioned_at timestamptz NOT NULL DEFAULT now(),
  deprovisioned_at timestamptz,
  deprovisioned_action varchar(10),
  deprovisioned_by varchar(20),
  deprovisioned_via varchar(10),
  reactivated_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scim_provisioned_users_user_name_check CHECK (length(btrim(user_name)) BETWEEN 1 AND 320),
  CONSTRAINT scim_provisioned_users_key_check CHECK (user_name_key = lower(user_name)),
  CONSTRAINT scim_provisioned_users_external_id_check CHECK (external_id IS NULL OR length(btrim(external_id)) BETWEEN 1 AND 255),
  CONSTRAINT scim_provisioned_users_display_name_check CHECK (display_name IS NULL OR length(display_name) <= 400),
  CONSTRAINT scim_provisioned_users_status_check CHECK (status IN ('pending', 'suspended', 'inactive', 'revoked')),
  CONSTRAINT scim_provisioned_users_action_check CHECK (deprovisioned_action IS NULL OR deprovisioned_action IN ('suspend', 'archive', 'delete')),
  CONSTRAINT scim_provisioned_users_by_check CHECK (deprovisioned_by IS NULL OR deprovisioned_by IN ('scim', 'organization')),
  CONSTRAINT scim_provisioned_users_via_check CHECK (deprovisioned_via IS NULL OR deprovisioned_via IN ('patch', 'put', 'delete')),
  CONSTRAINT scim_provisioned_users_deprovision_check CHECK (
    (status = 'pending' AND deprovisioned_at IS NULL)
    OR (status <> 'pending' AND deprovisioned_at IS NOT NULL AND deprovisioned_by IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS scim_provisioned_users_user_name_uq
  ON public.scim_provisioned_users (organization_id, user_name_key) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS scim_provisioned_users_external_id_uq
  ON public.scim_provisioned_users (organization_id, external_id) WHERE deleted_at IS NULL AND external_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS scim_provisioned_users_list_idx
  ON public.scim_provisioned_users (organization_id, created_at, id) WHERE deleted_at IS NULL;
--> statement-breakpoint
ALTER TABLE public.scim_events_log
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS event_type varchar(50),
  ADD COLUMN IF NOT EXISTS resource_type varchar(50),
  ADD COLUMN IF NOT EXISTS resource_id varchar(255),
  ADD COLUMN IF NOT EXISTS operation varchar(50),
  ADD COLUMN IF NOT EXISTS request_path varchar(500),
  ADD COLUMN IF NOT EXISTS request_body jsonb,
  ADD COLUMN IF NOT EXISTS response_body jsonb,
  ADD COLUMN IF NOT EXISTS status varchar(50),
  ADD COLUMN IF NOT EXISTS status_code integer,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS processing_time_ms integer,
  ADD COLUMN IF NOT EXISTS ip_address varchar(50),
  ADD COLUMN IF NOT EXISTS authenticated_as varchar(255),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
--> statement-breakpoint
-- Django's base model made id, created_at and updated_at NOT NULL without a database default, and the Drizzle declaration relies on the DEFAULT keyword.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scim_events_log' AND column_name = 'id' AND column_default IS NULL) THEN
    ALTER TABLE public.scim_events_log ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scim_events_log' AND column_name = 'created_at' AND column_default IS NULL) THEN
    ALTER TABLE public.scim_events_log ALTER COLUMN created_at SET DEFAULT now();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scim_events_log' AND column_name = 'updated_at' AND column_default IS NULL) THEN
    ALTER TABLE public.scim_events_log ALTER COLUMN updated_at SET DEFAULT now();
  END IF;
  -- NOT NULL is applied only to an empty relation, so a populated stub is never given invented values.
  IF NOT EXISTS (SELECT 1 FROM public.scim_events_log) THEN
    ALTER TABLE public.scim_events_log
      ALTER COLUMN organization_id SET NOT NULL,
      ALTER COLUMN event_type SET NOT NULL,
      ALTER COLUMN resource_type SET NOT NULL,
      ALTER COLUMN operation SET NOT NULL,
      ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scim_events_log_organization_id_fkey' AND conrelid = 'public.scim_events_log'::regclass) THEN
    ALTER TABLE public.scim_events_log
      ADD CONSTRAINT scim_events_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scim_events_log_resource_type_check' AND conrelid = 'public.scim_events_log'::regclass) THEN
    ALTER TABLE public.scim_events_log
      ADD CONSTRAINT scim_events_log_resource_type_check CHECK (resource_type IS NULL OR resource_type IN ('User', 'Group')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scim_events_log_status_check' AND conrelid = 'public.scim_events_log'::regclass) THEN
    ALTER TABLE public.scim_events_log
      ADD CONSTRAINT scim_events_log_status_check CHECK (status IS NULL OR status IN ('success', 'error', 'warning')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scim_events_log_operation_check' AND conrelid = 'public.scim_events_log'::regclass) THEN
    ALTER TABLE public.scim_events_log
      ADD CONSTRAINT scim_events_log_operation_check CHECK (operation IS NULL OR operation IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  -- The relation has never been written, and every added column is nullable, so these validate immediately.
  ALTER TABLE public.scim_events_log VALIDATE CONSTRAINT scim_events_log_organization_id_fkey;
  ALTER TABLE public.scim_events_log VALIDATE CONSTRAINT scim_events_log_resource_type_check;
  ALTER TABLE public.scim_events_log VALIDATE CONSTRAINT scim_events_log_status_check;
  ALTER TABLE public.scim_events_log VALIDATE CONSTRAINT scim_events_log_operation_check;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS scim_events_log_organization_time_idx ON public.scim_events_log (organization_id, created_at);
