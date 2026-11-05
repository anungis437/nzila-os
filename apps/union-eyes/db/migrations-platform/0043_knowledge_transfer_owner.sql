-- PLATFORM_SQL 0043_knowledge_transfer_owner
--
-- ue_copilot_conversations and ue_reasoning_sessions recorded no creator, so any steward listed every conversation and session of
-- the organization, read any conversation's full message history by id, and could append to it. Each gains created_by (text, the
-- principal that opened it), so the application can hold a steward to their own. Additive and nullable: rows that predate the column
-- keep a NULL creator and are therefore owned by nobody, so no steward sees them (default deny); nothing is backfilled with an
-- invented author. Relations that do not exist are skipped. Idempotent. Registered UNQUALIFIED. Not applied here; native
-- PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.ue_copilot_conversations') IS NOT NULL THEN
    ALTER TABLE public.ue_copilot_conversations ADD COLUMN IF NOT EXISTS created_by text;
    CREATE INDEX IF NOT EXISTS ue_copilot_conversations_owner_idx ON public.ue_copilot_conversations (organization_id, created_by, updated_at DESC);
  END IF;
  IF to_regclass('public.ue_reasoning_sessions') IS NOT NULL THEN
    ALTER TABLE public.ue_reasoning_sessions ADD COLUMN IF NOT EXISTS created_by text;
    CREATE INDEX IF NOT EXISTS ue_reasoning_sessions_owner_idx ON public.ue_reasoning_sessions (organization_id, created_by, updated_at DESC);
  END IF;
END $$;