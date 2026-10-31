-- Rollback for 0043_knowledge_transfer_owner: forward recovery only. created_by records who opened each conversation and session; drop it only after confirming nothing reads it.
DROP INDEX IF EXISTS public.ue_copilot_conversations_owner_idx;
DROP INDEX IF EXISTS public.ue_reasoning_sessions_owner_idx;
