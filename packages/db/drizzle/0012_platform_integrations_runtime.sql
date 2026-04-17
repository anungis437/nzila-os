CREATE TYPE "public"."platform_integration_delivery_status" AS ENUM('queued', 'sent', 'failed', 'dlq');

CREATE TABLE "platform_integration_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "provider" "platform_integration_provider" NOT NULL,
  "channel" varchar(32) NOT NULL,
  "recipient" text NOT NULL,
  "status" "platform_integration_delivery_status" DEFAULT 'queued' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "platform_integration_dlq_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "delivery_id" uuid,
  "provider" "platform_integration_provider" NOT NULL,
  "event_type" varchar(128) NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "last_error" text NOT NULL,
  "payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "failed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "replayed_at" timestamp with time zone,
  "replayed_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "platform_integration_deliveries"
  ADD CONSTRAINT "platform_integration_deliveries_org_id_orgs_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "platform_integration_dlq_entries"
  ADD CONSTRAINT "platform_integration_dlq_entries_org_id_orgs_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "platform_integration_dlq_entries"
  ADD CONSTRAINT "platform_integration_dlq_entries_delivery_id_platform_integration_deliveries_id_fk"
  FOREIGN KEY ("delivery_id") REFERENCES "public"."platform_integration_deliveries"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "platform_integration_deliveries_org_provider_created_idx"
  ON "platform_integration_deliveries" USING btree ("org_id", "provider", "created_at");

CREATE INDEX "platform_integration_dlq_entries_org_provider_failed_idx"
  ON "platform_integration_dlq_entries" USING btree ("org_id", "provider", "failed_at");
