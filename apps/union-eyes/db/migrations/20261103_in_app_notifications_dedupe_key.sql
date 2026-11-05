-- UE Gate 0 (DEF-0B6-SYS-SLA-WATCHDOG-EVENTS-HAVE-NO-SUBSCRIBER): the SLA watchdog now writes a durable inbox row per claim, alert kind and
-- deadline for the assigned steward. The row carries its dedupe key in data->>'dedupeKey'; this partial unique index makes the write
-- idempotent so a rerun, a retry or two overlapping runs add nothing. Only rows that carry a key are constrained.
-- Idempotent on PostgreSQL 15 and 16; requires migration-owner privileges.
DO $$
BEGIN
  IF to_regclass('in_app_notifications') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_in_app_notifications_dedupe
      ON in_app_notifications (organization_id, user_id, (data->>'dedupeKey'))
      WHERE data ? 'dedupeKey';
  END IF;
END
$$;
