-- Migration: Enable pgvector, convert TEXT embedding columns to vector(1536),
--            and add content_hash to cba_clauses for dedup.
--
-- Tables affected:
--   collective_agreements.embedding
--   cba_clauses.embedding  + NEW content_hash column
--   arbitration_decisions.embedding  (cba-intelligence-schema / intelligence.ts)
--   bargaining_notes.embedding       (cba-intelligence-schema / intelligence.ts)
--   clause_embeddings.embedding_vector
--   lrb_agreements.embedding_vector
--
-- Strategy:
--   1. CREATE EXTENSION IF NOT EXISTS vector
--   2. For each column, cast stored JSON text → real vector
--      - NULL stays NULL
--      - Non-NULL text is a JSON float array, parse with helper
--   3. Build HNSW indexes for cosine similarity
--   4. Add content_hash to cba_clauses for dedup in AI extraction
--
-- Rollback: see bottom of file.

BEGIN;

-- ── 1. Enable pgvector ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. collective_agreements.embedding ──────────────────────────────────────
ALTER TABLE collective_agreements
  ALTER COLUMN embedding TYPE vector(1536)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    ELSE embedding::vector
  END;

-- ── 3. cba_clauses.embedding ────────────────────────────────────────────────
ALTER TABLE cba_clauses
  ALTER COLUMN embedding TYPE vector(1536)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    ELSE embedding::vector
  END;

-- ── 3b. cba_clauses.content_hash for dedup ──────────────────────────────────
ALTER TABLE cba_clauses
  ADD COLUMN IF NOT EXISTS content_hash varchar(64);

CREATE INDEX IF NOT EXISTS idx_cba_clauses_content_hash
  ON cba_clauses (content_hash);

-- ── 4. arbitration_decisions.embedding ──────────────────────────────────────
ALTER TABLE arbitration_decisions
  ALTER COLUMN embedding TYPE vector(1536)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    ELSE embedding::vector
  END;

-- ── 5. bargaining_notes.embedding ───────────────────────────────────────────
ALTER TABLE bargaining_notes
  ALTER COLUMN embedding TYPE vector(1536)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    ELSE embedding::vector
  END;

-- ── 6. clause_embeddings.embedding_vector ───────────────────────────────────
ALTER TABLE clause_embeddings
  ALTER COLUMN embedding_vector TYPE vector(1536)
  USING CASE
    WHEN embedding_vector IS NULL THEN NULL
    ELSE embedding_vector::vector
  END;

-- ── 7. lrb_agreements.embedding_vector ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'lrb_agreements'
  ) THEN
    EXECUTE 'ALTER TABLE lrb_agreements ALTER COLUMN embedding_vector TYPE vector(1536) USING CASE WHEN embedding_vector IS NULL THEN NULL ELSE embedding_vector::vector END';
  END IF;
END $$;

-- ── 8. HNSW indexes for cosine similarity ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_collective_agreements_embedding
  ON collective_agreements USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_cba_clauses_embedding
  ON cba_clauses USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_arbitration_decisions_embedding
  ON arbitration_decisions USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_bargaining_notes_embedding
  ON bargaining_notes USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_clause_embeddings_vector
  ON clause_embeddings USING hnsw (embedding_vector vector_cosine_ops);

COMMIT;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- BEGIN;
-- ALTER TABLE collective_agreements ALTER COLUMN embedding TYPE text USING embedding::text;
-- ALTER TABLE cba_clauses ALTER COLUMN embedding TYPE text USING embedding::text;
-- ALTER TABLE arbitration_decisions ALTER COLUMN embedding TYPE text USING embedding::text;
-- ALTER TABLE bargaining_notes ALTER COLUMN embedding TYPE text USING embedding::text;
-- ALTER TABLE clause_embeddings ALTER COLUMN embedding_vector TYPE text USING embedding_vector::text;
-- DROP INDEX IF EXISTS idx_collective_agreements_embedding;
-- DROP INDEX IF EXISTS idx_cba_clauses_embedding;
-- DROP INDEX IF EXISTS idx_arbitration_decisions_embedding;
-- DROP INDEX IF EXISTS idx_bargaining_notes_embedding;
-- DROP INDEX IF EXISTS idx_clause_embeddings_vector;
-- COMMIT;
