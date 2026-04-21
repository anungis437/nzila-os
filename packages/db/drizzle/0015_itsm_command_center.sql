-- Migration 0015: ITSM Service Operations + Command Center tables
-- Covers: itsmQueues, itsmSlas, itsmContracts, itsmTickets, itsmTicketEvents,
--         itsmAssets, itsmProblems, itsmChanges, itsmApprovals, itsmKbArticles,
--         opsClients, commandAlerts, revenueEvents, renewalTasks,
--         productHealthSnapshots, founderPriorities
-- Apply manually:
--   $env:PGPASSWORD="nzila_dev"
--   Get-Content packages/db/drizzle/0015_itsm_command_center.sql |
--     & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U nzila -d nzila_automation -p 5433 -h localhost

-- ── ITSM Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."itsm_ticket_type" AS ENUM(
    'incident', 'service_request', 'access_request', 'change_request',
    'problem', 'procurement', 'vendor_escalation', 'security_event', 'project_task'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."itsm_ticket_status" AS ENUM(
    'new', 'triage', 'assigned', 'in_progress',
    'waiting_user', 'waiting_vendor', 'resolved', 'closed', 'reopened'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."itsm_priority" AS ENUM(
    'p1_critical', 'p2_high', 'p3_medium', 'p4_low'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."itsm_asset_type" AS ENUM(
    'laptop', 'desktop', 'phone', 'printer', 'network_device',
    'server', 'saas_license', 'cloud_resource', 'facilities', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."itsm_asset_lifecycle" AS ENUM(
    'active', 'in_stock', 'deployed', 'under_repair', 'retired', 'disposed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."itsm_change_type" AS ENUM(
    'standard', 'normal', 'emergency'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."itsm_change_status" AS ENUM(
    'proposed', 'under_review', 'approved', 'scheduled',
    'implementing', 'completed', 'failed', 'rolled_back', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."itsm_problem_status" AS ENUM(
    'open', 'under_investigation', 'known_error',
    'remediation_in_progress', 'resolved', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."itsm_approval_status" AS ENUM(
    'pending', 'approved', 'rejected', 'escalated'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."itsm_contract_status" AS ENUM(
    'active', 'expiring_soon', 'expired', 'suspended', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."itsm_kb_status" AS ENUM(
    'draft', 'under_review', 'published', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Command Center Enums ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."ops_client_onboarding_stage" AS ENUM(
    'prospect', 'contract_signed', 'tenant_created', 'kickoff_booked',
    'training_complete', 'live', 'at_risk', 'churned'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."ops_client_health" AS ENUM(
    'healthy', 'needs_attention', 'at_risk', 'churned'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."command_alert_type" AS ENUM(
    'renewal_risk', 'product_spike', 'onboarding_stall',
    'overload', 'churn_signal', 'invoice_overdue'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."command_alert_severity" AS ENUM(
    'critical', 'high', 'medium'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."revenue_event_type" AS ENUM(
    'contract_signed', 'renewal', 'expansion', 'churn',
    'payment_received', 'invoice_overdue'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."renewal_task_status" AS ENUM(
    'open', 'completed', 'snoozed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."founder_priority_type" AS ENUM(
    'renewal', 'incident', 'proposal', 'risk', 'ops'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── itsm_queues ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."itsm_queues" (
  "id"               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"           uuid         NOT NULL REFERENCES "public"."orgs"("id"),
  "name"             text         NOT NULL,
  "description"      text,
  "member_ids"       jsonb        NOT NULL DEFAULT '[]',
  "default_sla_id"   uuid,
  "active"           boolean      NOT NULL DEFAULT true,
  "created_at"       timestamptz  NOT NULL DEFAULT now(),
  "updated_at"       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "itsm_queues_org_idx" ON "public"."itsm_queues" ("org_id");

-- ── itsm_slas ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."itsm_slas" (
  "id"           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"       uuid         NOT NULL REFERENCES "public"."orgs"("id"),
  "name"         text         NOT NULL,
  "description"  text,
  "targets"      jsonb        NOT NULL,
  "contract_id"  uuid,
  "active"       boolean      NOT NULL DEFAULT true,
  "created_at"   timestamptz  NOT NULL DEFAULT now(),
  "updated_at"   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "itsm_slas_org_idx" ON "public"."itsm_slas" ("org_id");

-- ── itsm_contracts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."itsm_contracts" (
  "id"                          uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                      uuid                     NOT NULL REFERENCES "public"."orgs"("id"),
  "client_org_id"               uuid                     REFERENCES "public"."orgs"("id"),
  "client_name"                 text                     NOT NULL,
  "status"                      itsm_contract_status     NOT NULL DEFAULT 'active',
  "start_date"                  text                     NOT NULL,
  "end_date"                    text                     NOT NULL,
  "included_tickets_per_month"  integer,
  "billable_minutes_threshold"  integer,
  "sla_id"                      uuid,
  "metadata"                    jsonb                    DEFAULT '{}',
  "created_at"                  timestamptz              NOT NULL DEFAULT now(),
  "updated_at"                  timestamptz              NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "itsm_contracts_org_idx"    ON "public"."itsm_contracts" ("org_id");
CREATE INDEX IF NOT EXISTS "itsm_contracts_client_idx" ON "public"."itsm_contracts" ("client_org_id");

-- ── itsm_tickets ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."itsm_tickets" (
  "id"                  uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"              uuid                 NOT NULL REFERENCES "public"."orgs"("id"),
  "ticket_number"       text                 NOT NULL,
  "type"                itsm_ticket_type     NOT NULL,
  "status"              itsm_ticket_status   NOT NULL DEFAULT 'new',
  "priority"            itsm_priority        NOT NULL DEFAULT 'p3_medium',
  "title"               text                 NOT NULL,
  "description"         text,
  "reported_by_id"      text                 NOT NULL,
  "assigned_to_id"      text,
  "queue_id"            uuid                 REFERENCES "public"."itsm_queues"("id"),
  "sla_id"              uuid                 REFERENCES "public"."itsm_slas"("id"),
  "contract_id"         uuid                 REFERENCES "public"."itsm_contracts"("id"),
  "problem_id"          uuid,
  "asset_id"            uuid,
  "change_id"           uuid,
  "sla_response_due"    text,
  "sla_resolution_due"  text,
  "sla_breached"        boolean              NOT NULL DEFAULT false,
  "channel"             text                 NOT NULL DEFAULT 'portal',
  "tags"                jsonb                NOT NULL DEFAULT '[]',
  "attachments"         jsonb                NOT NULL DEFAULT '[]',
  "metadata"            jsonb                DEFAULT '{}',
  "resolved_at"         timestamptz,
  "closed_at"           timestamptz,
  "created_at"          timestamptz          NOT NULL DEFAULT now(),
  "updated_at"          timestamptz          NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "itsm_tickets_org_idx"         ON "public"."itsm_tickets" ("org_id");
CREATE INDEX IF NOT EXISTS "itsm_tickets_org_status_idx"  ON "public"."itsm_tickets" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "itsm_tickets_org_type_idx"    ON "public"."itsm_tickets" ("org_id", "type");
CREATE INDEX IF NOT EXISTS "itsm_tickets_org_assignee_idx" ON "public"."itsm_tickets" ("org_id", "assigned_to_id");
CREATE INDEX IF NOT EXISTS "itsm_tickets_org_created_idx" ON "public"."itsm_tickets" ("org_id", "created_at");
CREATE INDEX IF NOT EXISTS "itsm_tickets_contract_idx"    ON "public"."itsm_tickets" ("contract_id");

-- ── itsm_ticket_events ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."itsm_ticket_events" (
  "id"          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"      uuid         NOT NULL REFERENCES "public"."orgs"("id"),
  "ticket_id"   uuid         NOT NULL REFERENCES "public"."itsm_tickets"("id"),
  "event_type"  text         NOT NULL,
  "actor_id"    text         NOT NULL,
  "from_value"  text,
  "to_value"    text,
  "body"        text,
  "internal"    boolean      NOT NULL DEFAULT false,
  "payload"     jsonb        DEFAULT '{}',
  "created_at"  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "itsm_ticket_events_ticket_idx"  ON "public"."itsm_ticket_events" ("ticket_id");
CREATE INDEX IF NOT EXISTS "itsm_ticket_events_org_idx"     ON "public"."itsm_ticket_events" ("org_id");
CREATE INDEX IF NOT EXISTS "itsm_ticket_events_created_idx" ON "public"."itsm_ticket_events" ("ticket_id", "created_at");

-- ── itsm_assets ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."itsm_assets" (
  "id"                  uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"              uuid                   NOT NULL REFERENCES "public"."orgs"("id"),
  "type"                itsm_asset_type        NOT NULL,
  "lifecycle"           itsm_asset_lifecycle   NOT NULL DEFAULT 'active',
  "name"                text                   NOT NULL,
  "manufacturer"        text,
  "model"               text,
  "serial_number"       text,
  "owner_id"            text,
  "warranty_expiry"     text,
  "purchase_date"       text,
  "purchase_cost"       text,
  "book_value"          text,
  "location"            text,
  "software_installed"  jsonb                  DEFAULT '[]',
  "risk_score"          integer                DEFAULT 0,
  "tags"                jsonb                  DEFAULT '[]',
  "metadata"            jsonb                  DEFAULT '{}',
  "created_at"          timestamptz            NOT NULL DEFAULT now(),
  "updated_at"          timestamptz            NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "itsm_assets_org_idx"       ON "public"."itsm_assets" ("org_id");
CREATE INDEX IF NOT EXISTS "itsm_assets_org_type_idx"  ON "public"."itsm_assets" ("org_id", "type");
CREATE INDEX IF NOT EXISTS "itsm_assets_owner_idx"     ON "public"."itsm_assets" ("org_id", "owner_id");

-- ── itsm_problems ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."itsm_problems" (
  "id"                     uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                 uuid                   NOT NULL REFERENCES "public"."orgs"("id"),
  "problem_number"         text                   NOT NULL,
  "status"                 itsm_problem_status    NOT NULL DEFAULT 'open',
  "title"                  text                   NOT NULL,
  "description"            text,
  "root_cause"             text,
  "workaround"             text,
  "known_error_refs"       jsonb                  DEFAULT '[]',
  "linked_incident_ids"    jsonb                  DEFAULT '[]',
  "remediation_task_ids"   jsonb                  DEFAULT '[]',
  "priority"               itsm_priority          NOT NULL DEFAULT 'p3_medium',
  "assigned_to_id"         text,
  "resolved_at"            timestamptz,
  "created_at"             timestamptz            NOT NULL DEFAULT now(),
  "updated_at"             timestamptz            NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "itsm_problems_org_idx" ON "public"."itsm_problems" ("org_id");

-- ── itsm_changes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."itsm_changes" (
  "id"                        uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                    uuid                  NOT NULL REFERENCES "public"."orgs"("id"),
  "change_number"             text                  NOT NULL,
  "type"                      itsm_change_type      NOT NULL DEFAULT 'normal',
  "status"                    itsm_change_status    NOT NULL DEFAULT 'proposed',
  "title"                     text                  NOT NULL,
  "description"               text,
  "risk_level"                text                  NOT NULL DEFAULT 'medium',
  "impact_summary"            text,
  "rollback_plan"             text,
  "requested_by_id"           text                  NOT NULL,
  "approver_ids"              jsonb                 NOT NULL DEFAULT '[]',
  "approved_by_ids"           jsonb                 NOT NULL DEFAULT '[]',
  "scheduled_start"           text,
  "scheduled_end"             text,
  "implementation_checklist"  jsonb                 DEFAULT '[]',
  "platform_change_id"        text,
  "evidence_refs"             jsonb                 DEFAULT '[]',
  "post_review_notes"         text,
  "completed_at"              timestamptz,
  "created_at"                timestamptz           NOT NULL DEFAULT now(),
  "updated_at"                timestamptz           NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "itsm_changes_org_idx"    ON "public"."itsm_changes" ("org_id");
CREATE INDEX IF NOT EXISTS "itsm_changes_status_idx" ON "public"."itsm_changes" ("org_id", "status");

-- ── itsm_approvals ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."itsm_approvals" (
  "id"                uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"            uuid                   NOT NULL REFERENCES "public"."orgs"("id"),
  "subject_type"      text                   NOT NULL,
  "subject_id"        uuid                   NOT NULL,
  "status"            itsm_approval_status   NOT NULL DEFAULT 'pending',
  "requested_by_id"   text                   NOT NULL,
  "approver_id"       text                   NOT NULL,
  "decision"          text,
  "decision_note"     text,
  "decided_at"        timestamptz,
  "due_by"            timestamptz,
  "created_at"        timestamptz            NOT NULL DEFAULT now(),
  "updated_at"        timestamptz            NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "itsm_approvals_subject_idx"  ON "public"."itsm_approvals" ("subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "itsm_approvals_approver_idx" ON "public"."itsm_approvals" ("approver_id", "status");
CREATE INDEX IF NOT EXISTS "itsm_approvals_org_idx"      ON "public"."itsm_approvals" ("org_id");

-- ── itsm_kb_articles ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."itsm_kb_articles" (
  "id"               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"           uuid            NOT NULL REFERENCES "public"."orgs"("id"),
  "status"           itsm_kb_status  NOT NULL DEFAULT 'draft',
  "title"            text            NOT NULL,
  "slug"             text            NOT NULL,
  "category"         text,
  "tags"             jsonb           DEFAULT '[]',
  "body"             text            NOT NULL,
  "author_id"        text            NOT NULL,
  "reviewed_by_id"   text,
  "view_count"       integer         NOT NULL DEFAULT 0,
  "helpful_count"    integer         NOT NULL DEFAULT 0,
  "not_helpful_count" integer        NOT NULL DEFAULT 0,
  "published_at"     timestamptz,
  "created_at"       timestamptz     NOT NULL DEFAULT now(),
  "updated_at"       timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "itsm_kb_org_status_idx" ON "public"."itsm_kb_articles" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "itsm_kb_slug_idx"        ON "public"."itsm_kb_articles" ("org_id", "slug");

-- ── ops_clients ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."ops_clients" (
  "id"                uuid                           PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"            uuid                           NOT NULL REFERENCES "public"."orgs"("id"),
  "company_name"      text                           NOT NULL,
  "contact_name"      text,
  "contact_email"     text,
  "product"           text                           NOT NULL,
  "onboarding_stage"  ops_client_onboarding_stage    NOT NULL DEFAULT 'prospect',
  "health"            ops_client_health              NOT NULL DEFAULT 'healthy',
  "account_owner_id"  text,
  "go_live_date"      text,
  "renewal_date"      text,
  "contract_value"    text,
  "notes"             text,
  "expansion_notes"   text,
  "health_score"      integer                        DEFAULT 100,
  "open_tickets"      integer                        NOT NULL DEFAULT 0,
  "created_at"        timestamptz                    NOT NULL DEFAULT now(),
  "updated_at"        timestamptz                    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ops_clients_org_idx"     ON "public"."ops_clients" ("org_id");
CREATE INDEX IF NOT EXISTS "ops_clients_product_idx" ON "public"."ops_clients" ("org_id", "product");
CREATE INDEX IF NOT EXISTS "ops_clients_stage_idx"   ON "public"."ops_clients" ("org_id", "onboarding_stage");
CREATE INDEX IF NOT EXISTS "ops_clients_health_idx"  ON "public"."ops_clients" ("org_id", "health");

-- ── command_alerts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."command_alerts" (
  "id"           uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"       uuid                    NOT NULL REFERENCES "public"."orgs"("id"),
  "type"         command_alert_type      NOT NULL,
  "severity"     command_alert_severity  NOT NULL DEFAULT 'medium',
  "title"        text                    NOT NULL,
  "body"         text,
  "client_id"    uuid                    REFERENCES "public"."ops_clients"("id"),
  "product_key"  text,
  "owner_id"     text,
  "resolved_at"  timestamptz,
  "created_at"   timestamptz             NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "command_alerts_org_idx"          ON "public"."command_alerts" ("org_id");
CREATE INDEX IF NOT EXISTS "command_alerts_org_severity_idx" ON "public"."command_alerts" ("org_id", "severity");
CREATE INDEX IF NOT EXISTS "command_alerts_client_idx"       ON "public"."command_alerts" ("client_id");

-- ── revenue_events ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."revenue_events" (
  "id"           uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"       uuid                NOT NULL REFERENCES "public"."orgs"("id"),
  "client_id"    uuid                NOT NULL REFERENCES "public"."ops_clients"("id"),
  "type"         revenue_event_type  NOT NULL,
  "amount_zar"   integer             NOT NULL DEFAULT 0,
  "notes"        text,
  "occurred_at"  timestamptz         NOT NULL DEFAULT now(),
  "created_at"   timestamptz         NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "revenue_events_org_idx"      ON "public"."revenue_events" ("org_id");
CREATE INDEX IF NOT EXISTS "revenue_events_client_idx"   ON "public"."revenue_events" ("client_id");
CREATE INDEX IF NOT EXISTS "revenue_events_org_type_idx" ON "public"."revenue_events" ("org_id", "type");

-- ── renewal_tasks ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."renewal_tasks" (
  "id"           uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"       uuid                   NOT NULL REFERENCES "public"."orgs"("id"),
  "client_id"    uuid                   NOT NULL REFERENCES "public"."ops_clients"("id"),
  "due_date"     text                   NOT NULL,
  "status"       renewal_task_status    NOT NULL DEFAULT 'open',
  "assigned_to"  text,
  "notes"        text,
  "created_at"   timestamptz            NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "renewal_tasks_org_idx"    ON "public"."renewal_tasks" ("org_id");
CREATE INDEX IF NOT EXISTS "renewal_tasks_client_idx" ON "public"."renewal_tasks" ("client_id");
CREATE INDEX IF NOT EXISTS "renewal_tasks_status_idx" ON "public"."renewal_tasks" ("org_id", "status");

-- ── product_health_snapshots ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."product_health_snapshots" (
  "id"                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                 uuid         NOT NULL REFERENCES "public"."orgs"("id"),
  "product"                text         NOT NULL,
  "incidents_this_month"   integer      NOT NULL DEFAULT 0,
  "support_load"           integer      NOT NULL DEFAULT 0,
  "deployments_shipped"    integer      NOT NULL DEFAULT 0,
  "open_bugs"              integer      NOT NULL DEFAULT 0,
  "snapshot_date"          text         NOT NULL,
  "created_at"             timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "product_health_org_idx"     ON "public"."product_health_snapshots" ("org_id");
CREATE INDEX IF NOT EXISTS "product_health_product_idx" ON "public"."product_health_snapshots" ("org_id", "product");

-- ── founder_priorities ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."founder_priorities" (
  "id"                  uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"              uuid                   NOT NULL REFERENCES "public"."orgs"("id"),
  "title"               text                   NOT NULL,
  "type"                founder_priority_type  NOT NULL DEFAULT 'ops',
  "linked_entity_id"    text,
  "linked_entity_type"  text,
  "done"                boolean                NOT NULL DEFAULT false,
  "due_date"            text,
  "created_at"          timestamptz            NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "founder_priorities_org_idx"  ON "public"."founder_priorities" ("org_id");
CREATE INDEX IF NOT EXISTS "founder_priorities_done_idx" ON "public"."founder_priorities" ("org_id", "done");
