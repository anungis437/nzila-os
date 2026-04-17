CREATE TYPE "public"."platform_integration_provider" AS ENUM('resend', 'sendgrid', 'mailgun', 'twilio', 'firebase', 'slack', 'teams', 'hubspot', 'm365', 'google-workspace', 'webhooks');
--> statement-breakpoint
CREATE TYPE "public"."platform_integration_connection_status" AS ENUM('connected', 'degraded', 'error', 'disconnected');
--> statement-breakpoint
CREATE TABLE "platform_integration_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "provider" "platform_integration_provider" NOT NULL,
  "status" "platform_integration_connection_status" DEFAULT 'disconnected' NOT NULL,
  "secrets_encrypted" text NOT NULL,
  "secrets_fingerprint" varchar(128) NOT NULL,
  "last_validated_at" timestamp with time zone,
  "last_validation_ok" boolean DEFAULT false NOT NULL,
  "last_validation_error" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_integration_connections" ADD CONSTRAINT "platform_integration_connections_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_integration_connections_org_provider_uq" ON "platform_integration_connections" USING btree ("org_id","provider");
