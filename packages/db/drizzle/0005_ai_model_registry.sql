-- Migration 0005: AI Model Registry + attestation document category
--
-- Adds the AI model registry tables that back the gateway's DB-driven
-- deployment resolution:
--
--   ai_models              → registered AI models (provider, family, modality)
--   ai_deployments         → deployment configs (env, token limits, cost profile)
--   ai_deployment_routes   → per-entity routing: appKey+profileKey+feature → deployment
--
-- Also adds 'attestation' to the document_category enum so ai-core can store
-- attestation documents (used by the action attestation pipeline in @nzila/ai-core).
--
-- Governance note: ai_environment and ai_request_feature enums were created in
-- migration 0002 and are reused here without modification.

--> statement-breakpoint

ALTER TYPE "public"."document_category" ADD VALUE IF NOT EXISTS 'attestation';

--> statement-breakpoint

CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(60) NOT NULL,
	"family" varchar(120) NOT NULL,
	"modality" varchar(60) DEFAULT 'text' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE TABLE "ai_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"deployment_name" varchar(120) NOT NULL,
	"environment" "ai_environment" DEFAULT 'prod' NOT NULL,
	"allowed_data_classes" jsonb DEFAULT '[]',
	"max_tokens" integer,
	"default_temperature" numeric(4, 3),
	"cost_profile" jsonb DEFAULT '{}',
	"enabled" boolean DEFAULT true NOT NULL,
	"approved_by" varchar(120),
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_deployments_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id")
);

--> statement-breakpoint

CREATE TABLE "ai_deployment_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"profile_key" varchar(60) NOT NULL,
	"feature" "ai_request_feature" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_deployment_routes_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "ai_deployments"("id"),
	CONSTRAINT "ai_deployment_routes_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
);

--> statement-breakpoint

CREATE INDEX "idx_ai_deployments_model" ON "ai_deployments" USING btree ("model_id");
--> statement-breakpoint
CREATE INDEX "idx_ai_deployments_env" ON "ai_deployments" USING btree ("environment");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ai_routes_unique" ON "ai_deployment_routes" USING btree ("entity_id", "app_key", "profile_key", "feature");
--> statement-breakpoint
CREATE INDEX "idx_ai_routes_deployment" ON "ai_deployment_routes" USING btree ("deployment_id");
