-- Create automation enums if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'command_status') THEN
    CREATE TYPE "public"."command_status" AS ENUM('pending', 'approved', 'dispatched', 'running', 'succeeded', 'failed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'playbook_name') THEN
    CREATE TYPE "public"."playbook_name" AS ENUM('contract_guardian', 'lint_check', 'typecheck', 'unit_tests', 'full_ci');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "automation_commands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "correlation_id" uuid NOT NULL,
  "playbook" "playbook_name" NOT NULL,
  "status" "command_status" DEFAULT 'pending' NOT NULL,
  "dry_run" boolean DEFAULT true NOT NULL,
  "requested_by" text NOT NULL,
  "args" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "run_id" text,
  "run_url" text,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "automation_commands_correlation_id_unique" UNIQUE("correlation_id")
);

CREATE TABLE IF NOT EXISTS "automation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "command_id" uuid NOT NULL REFERENCES "automation_commands"("id"),
  "correlation_id" uuid NOT NULL,
  "event" varchar(50) NOT NULL,
  "actor" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "hash" text NOT NULL,
  "previous_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
