-- Nzila OS — AI Control Plane migration
-- Run this after Drizzle push/generate to apply pgvector-specific changes.
--
-- Prerequisites:
--   CREATE EXTENSION IF NOT EXISTS vector;

-- ── Fix ai_embeddings.embedding column to use vector(1536) ──────────────────
-- Drizzle cannot express pgvector types natively, so we alter after table creation.

DO $$
BEGIN
  -- Ensure vector extension exists
  CREATE EXTENSION IF NOT EXISTS vector;

  -- Alter the placeholder text column to vector(1536)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_embeddings' AND column_name = 'embedding' AND data_type = 'text'
  ) THEN
    ALTER TABLE ai_embeddings ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector(1536);
  END IF;
END
$$;

-- ── Create HNSW index for fast approximate nearest neighbor search ──────────
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_hnsw
  ON ai_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── Verify all tables exist ─────────────────────────────────────────────────
DO $$
DECLARE
  tbl text;
  expected text[] := ARRAY[
    'ai_apps',
    'ai_capability_profiles',
    'ai_prompts',
    'ai_prompt_versions',
    'ai_requests',
    'ai_request_payloads',
    'ai_usage_budgets',
    'ai_knowledge_sources',
    'ai_embeddings',
    'ai_actions'
  ];
BEGIN
  FOREACH tbl IN ARRAY expected LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      RAISE EXCEPTION 'AI Control Plane table "%" does not exist. Run drizzle-kit push first.', tbl;
    END IF;
  END LOOP;
  RAISE NOTICE 'AI Control Plane: all 10 tables verified.';
END
$$;
