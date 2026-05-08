CREATE TYPE "public"."exit_interview_event_type" AS ENUM('created', 'updated', 'submitted', 'reviewed', 'published', 'archived', 'viewed', 'searched');--> statement-breakpoint
CREATE TYPE "public"."exit_interview_retirement_reason" AS ENUM('retirement', 'career_change', 'health', 'relocation', 'other');--> statement-breakpoint
CREATE TYPE "public"."exit_interview_role" AS ENUM('member', 'steward', 'chief_steward', 'officer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."exit_interview_status" AS ENUM('draft', 'submitted', 'reviewed', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "exit_interview_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"file_url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer,
	"transcript_text" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exit_interview_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type" "exit_interview_event_type" NOT NULL,
	"notes" text,
	"payload" jsonb,
	"actor_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exit_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "exit_interview_status" DEFAULT 'draft' NOT NULL,
	"retiring_employee_name" text NOT NULL,
	"role_in_union" "exit_interview_role" NOT NULL,
	"years_of_service" integer DEFAULT 0 NOT NULL,
	"retirement_reason" "exit_interview_retirement_reason" DEFAULT 'retirement',
	"title" text NOT NULL,
	"summary" text,
	"key_lessons" text NOT NULL,
	"best_practices" text,
	"bargaining_advice" text,
	"mediation_advice" text,
	"incoming_officer_advice" text,
	"topics" jsonb,
	"key_cases" jsonb,
	"metadata" jsonb,
	"contains_pii" boolean DEFAULT false NOT NULL,
	"knowledge_base_id" uuid,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exit_interview_documents" ADD CONSTRAINT "exit_interview_documents_interview_id_exit_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."exit_interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_interview_documents" ADD CONSTRAINT "exit_interview_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_interview_events" ADD CONSTRAINT "exit_interview_events_interview_id_exit_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."exit_interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_interview_events" ADD CONSTRAINT "exit_interview_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD CONSTRAINT "exit_interviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_exit_interview_documents_interview" ON "exit_interview_documents" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "idx_exit_interview_documents_org" ON "exit_interview_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_exit_interview_events_interview" ON "exit_interview_events" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "idx_exit_interview_events_org" ON "exit_interview_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_exit_interview_events_type" ON "exit_interview_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_exit_interview_events_created" ON "exit_interview_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_exit_interviews_org_status" ON "exit_interviews" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_exit_interviews_org_created" ON "exit_interviews" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_exit_interviews_published" ON "exit_interviews" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_exit_interviews_knowledge_base" ON "exit_interviews" USING btree ("knowledge_base_id");