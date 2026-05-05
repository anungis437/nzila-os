-- Ingestion hardening tables
-- @see apps/union-eyes/db/schema/ingestion-schema.ts

CREATE TABLE IF NOT EXISTS "ingestion_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "source_system" varchar(100) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "total_records" integer NOT NULL DEFAULT 0,
  "processed" integer NOT NULL DEFAULT 0,
  "succeeded" integer NOT NULL DEFAULT 0,
  "failed" integer NOT NULL DEFAULT 0,
  "skipped" integer NOT NULL DEFAULT 0,
  "error_summary" jsonb DEFAULT '[]',
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_by" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "metadata" jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS "idx_ingestion_batches_org" ON "ingestion_batches" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_ingestion_batches_status" ON "ingestion_batches" ("status");

CREATE TABLE IF NOT EXISTS "ingestion_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL REFERENCES "ingestion_batches"("id") ON DELETE CASCADE,
  "record_index" integer NOT NULL,
  "record_type" varchar(50) NOT NULL,
  "external_id" varchar(255),
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "entity_id" uuid,
  "error_message" text,
  "error_details" jsonb,
  "fingerprint" varchar(64),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "idx_ingestion_records_batch" ON "ingestion_records" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_ingestion_records_status" ON "ingestion_records" ("status");
CREATE INDEX IF NOT EXISTS "idx_ingestion_records_ext_id" ON "ingestion_records" ("external_id");

-- NOTE: grievance_id is NOT a FK to grievances(id) because grievances was dropped at migration 0019
-- and never recreated. We store the UUID reference without an enforced FK constraint.
CREATE TABLE IF NOT EXISTS "grievance_timeline_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "grievance_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "event_type" varchar(100) NOT NULL,
  "event_date" timestamptz NOT NULL,
  "actor" varchar(255),
  "description" text,
  "content_hash" varchar(64) NOT NULL,
  "source_system" varchar(100),
  "import_batch_id" uuid,
  "sequence_number" integer NOT NULL DEFAULT 0,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_timeline_events_dedup" ON "grievance_timeline_events" ("grievance_id", "event_date", "event_type", "content_hash");
CREATE INDEX IF NOT EXISTS "idx_timeline_events_grievance" ON "grievance_timeline_events" ("grievance_id");
CREATE INDEX IF NOT EXISTS "idx_timeline_events_org" ON "grievance_timeline_events" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_timeline_events_date" ON "grievance_timeline_events" ("event_date");