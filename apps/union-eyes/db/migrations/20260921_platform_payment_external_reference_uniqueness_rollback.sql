-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback: Platform payment external-reference idempotency identity
--
-- Drops the per-organization external-reference uniqueness index. After this
-- rollback, platform_payments no longer enforces at-most-one durable payment
-- identity per (organization_id, external_reference); the webhook's
-- ON CONFLICT DO NOTHING reservation degrades to a plain insert.
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS platform_payments_org_external_reference_uq;
