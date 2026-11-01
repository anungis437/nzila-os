-- 0059_scim_provisioned_users rollback: drops the provisioned-users directory and removes the columns, constraints and index that 0059 added to the
-- Django scim_events_log stub. Events already recorded are lost with the columns. The base-column defaults (id, created_at, updated_at) are left in
-- place: they are the Django stub fix shared with the other evolved relations and removing them would break inserts through the declaration.
DROP TABLE IF EXISTS public.scim_provisioned_users;
--> statement-breakpoint
DROP INDEX IF EXISTS public.scim_events_log_organization_time_idx;
--> statement-breakpoint
ALTER TABLE public.scim_events_log
  DROP CONSTRAINT IF EXISTS scim_events_log_organization_id_fkey,
  DROP CONSTRAINT IF EXISTS scim_events_log_resource_type_check,
  DROP CONSTRAINT IF EXISTS scim_events_log_status_check,
  DROP CONSTRAINT IF EXISTS scim_events_log_operation_check;
--> statement-breakpoint
ALTER TABLE public.scim_events_log
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS event_type,
  DROP COLUMN IF EXISTS resource_type,
  DROP COLUMN IF EXISTS resource_id,
  DROP COLUMN IF EXISTS operation,
  DROP COLUMN IF EXISTS request_path,
  DROP COLUMN IF EXISTS request_body,
  DROP COLUMN IF EXISTS response_body,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS status_code,
  DROP COLUMN IF EXISTS error_message,
  DROP COLUMN IF EXISTS processing_time_ms,
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS authenticated_as,
  DROP COLUMN IF EXISTS metadata;
