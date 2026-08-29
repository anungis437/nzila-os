CREATE TABLE "ue_governance_job_cancellation_audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_execution_state_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_sequence" text NOT NULL,
	"actor" text NOT NULL,
	"actor_type" text NOT NULL,
	"details" jsonb,
	"message" text,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ue_governance_job_cancellation_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_execution_state_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"requested_by" text NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"processed_at" timestamp,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ue_governance_job_execution_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"job_run_id" uuid NOT NULL,
	"job_batch_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_requested" boolean DEFAULT false NOT NULL,
	"cancellation_idempotency_key" text,
	"cancellation_requested_at" timestamp,
	"cancellation_acknowledged_at" timestamp,
	"cancelled_by" text,
	"context" jsonb,
	"result" jsonb,
	"error" jsonb,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ue_governance_job_reconciliation_pass" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pass_started_at" timestamp NOT NULL,
	"pass_completed_at" timestamp,
	"jobs_scanned" jsonb,
	"jobs_cancelled" jsonb,
	"jobs_reconciled" jsonb,
	"jobs_unreconcilable" jsonb,
	"scan_type" text DEFAULT 'automatic' NOT NULL,
	"triggered_by" text,
	"details" jsonb,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ue_governance_job_cancellation_audit_event_org_id_idx" ON "ue_governance_job_cancellation_audit_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ue_governance_job_cancellation_audit_event_job_id_idx" ON "ue_governance_job_cancellation_audit_event" USING btree ("job_execution_state_id");--> statement-breakpoint
CREATE INDEX "ue_governance_job_cancellation_audit_event_type_idx" ON "ue_governance_job_cancellation_audit_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "ue_governance_job_cancellation_audit_event_timestamp_idx" ON "ue_governance_job_cancellation_audit_event" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "ue_governance_job_cancellation_request_org_id_idx" ON "ue_governance_job_cancellation_request" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ue_governance_job_cancellation_request_idempotency_idx" ON "ue_governance_job_cancellation_request" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ue_governance_job_cancellation_request_acknowledged_idx" ON "ue_governance_job_cancellation_request" USING btree ("acknowledged");--> statement-breakpoint
CREATE INDEX "ue_governance_job_execution_state_org_id_idx" ON "ue_governance_job_execution_state" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ue_governance_job_execution_state_job_identity_idx" ON "ue_governance_job_execution_state" USING btree ("organization_id","job_type","job_run_id");--> statement-breakpoint
CREATE INDEX "ue_governance_job_execution_state_cancellation_idempotency_idx" ON "ue_governance_job_execution_state" USING btree ("organization_id","cancellation_idempotency_key");--> statement-breakpoint
CREATE INDEX "ue_governance_job_execution_state_status_idx" ON "ue_governance_job_execution_state" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ue_governance_job_execution_state_job_type_idx" ON "ue_governance_job_execution_state" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "ue_governance_job_reconciliation_pass_org_id_idx" ON "ue_governance_job_reconciliation_pass" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ue_governance_job_reconciliation_pass_started_idx" ON "ue_governance_job_reconciliation_pass" USING btree ("pass_started_at");--> statement-breakpoint
CREATE INDEX "ue_governance_job_reconciliation_pass_status_idx" ON "ue_governance_job_reconciliation_pass" USING btree ("status");