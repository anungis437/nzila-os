-- Migration: orchestrator_platform_events
--
-- Durable append-only event log backing the orchestrator's
-- @nzila/platform-event-fabric `PlatformEventStore` interface.
--
-- Default orchestrator wiring uses an in-memory store, which is fine for
-- single-instance deploys but loses events on restart and is invisible
-- across replicas. Setting ORCHESTRATOR_DURABLE_EVENT_STORE=1 swaps in
-- the Postgres-backed store implemented in
-- apps/orchestrator-api/src/event-store/postgres.ts.
--
-- Rows are append-only. UPDATE/DELETE are NOT blocked at the DB level
-- (unlike decision_events) because replay semantics permit administrative
-- pruning by tenant + time range; integrity comes from the (id) primary
-- key + monotonic created_at index.

CREATE TABLE IF NOT EXISTS orchestrator_platform_events (
  id               UUID PRIMARY KEY,
  event_type       TEXT NOT NULL,
  tenant_id        UUID NOT NULL,
  org_id           UUID,
  actor_id         TEXT NOT NULL,
  correlation_id   UUID NOT NULL,
  causation_id     UUID,
  source           TEXT NOT NULL,
  schema_version   INTEGER NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL,
  persisted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ope_type_created_idx
  ON orchestrator_platform_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS ope_tenant_type_created_idx
  ON orchestrator_platform_events (tenant_id, event_type, created_at);

CREATE INDEX IF NOT EXISTS ope_correlation_idx
  ON orchestrator_platform_events (correlation_id);
