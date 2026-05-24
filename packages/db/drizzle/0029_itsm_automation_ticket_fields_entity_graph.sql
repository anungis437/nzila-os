-- 0029_itsm_automation_ticket_fields_entity_graph.sql
-- Adds:
--   itsm_automation_rules   — persisted automation rules per org
--   itsm_ticket_field_defs  — org-defined custom fields per ticket type
--   platform_entity_nodes   — Drizzle backing store for @nzila/platform-entity-graph
--   platform_entity_edges   — Drizzle backing store for @nzila/platform-entity-graph

CREATE TABLE IF NOT EXISTS "itsm_automation_rules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "org_id" uuid NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "enabled" boolean DEFAULT true NOT NULL,
    "condition_logic" text DEFAULT 'all' NOT NULL,
    "conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "cooldown_minutes" integer,
    "last_triggered_at" timestamp with time zone,
    "trigger_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "itsm_automation_rules_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id")
);
CREATE INDEX IF NOT EXISTS "itsm_automation_rules_org_idx" ON "itsm_automation_rules" ("org_id");
CREATE INDEX IF NOT EXISTS "itsm_automation_rules_org_enabled_idx" ON "itsm_automation_rules" ("org_id","enabled");

CREATE TABLE IF NOT EXISTS "itsm_ticket_field_defs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "org_id" uuid NOT NULL,
    "field_key" text NOT NULL,
    "ticket_type" "itsm_ticket_type" NOT NULL,
    "label" text NOT NULL,
    "field_type" text NOT NULL,
    "options" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "required" boolean DEFAULT false NOT NULL,
    "help_text" text,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "itsm_ticket_field_defs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id")
);
CREATE INDEX IF NOT EXISTS "itsm_ticket_field_defs_org_idx" ON "itsm_ticket_field_defs" ("org_id");
CREATE INDEX IF NOT EXISTS "itsm_ticket_field_defs_type_idx" ON "itsm_ticket_field_defs" ("org_id","ticket_type","sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "itsm_ticket_field_defs_key_uq" ON "itsm_ticket_field_defs" ("org_id","ticket_type","field_key");

CREATE TABLE IF NOT EXISTS "platform_entity_nodes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" text NOT NULL,
    "entity_type" text NOT NULL,
    "entity_id" text NOT NULL,
    "canonical_name" text NOT NULL,
    "status" text NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_entity_nodes_addr_uq" ON "platform_entity_nodes" ("tenant_id","entity_type","entity_id");
CREATE INDEX IF NOT EXISTS "platform_entity_nodes_tenant_type_idx" ON "platform_entity_nodes" ("tenant_id","entity_type");

CREATE TABLE IF NOT EXISTS "platform_entity_edges" (
    "id" text PRIMARY KEY NOT NULL,
    "tenant_id" text NOT NULL,
    "source_entity_type" text NOT NULL,
    "source_entity_id" text NOT NULL,
    "target_entity_type" text NOT NULL,
    "target_entity_id" text NOT NULL,
    "relationship_type" text NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "platform_entity_edges_tenant_idx" ON "platform_entity_edges" ("tenant_id");
CREATE INDEX IF NOT EXISTS "platform_entity_edges_source_idx" ON "platform_entity_edges" ("tenant_id","source_entity_type","source_entity_id");
CREATE INDEX IF NOT EXISTS "platform_entity_edges_target_idx" ON "platform_entity_edges" ("tenant_id","target_entity_type","target_entity_id");
