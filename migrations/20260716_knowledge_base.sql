-- Migration: Create knowledge_base table
-- Part of document ingestion pipeline for RAG/AI search + Agreements UI
-- Requires pgvector extension (v0.8.2+)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_base (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Document details
  title         TEXT NOT NULL,
  document_type knowledge_document_type NOT NULL,
  content       TEXT NOT NULL,
  summary       TEXT,

  -- Source
  source_type   TEXT NOT NULL,          -- manual, cba, policy, law, bylaws, etc.
  source_id     TEXT,                   -- Reference to original document
  source_url    TEXT,

  -- Embeddings for semantic search (pgvector)
  embedding           vector(1536),
  embedding_model     TEXT DEFAULT 'text-embedding-3-small',
  embedding_model_version TEXT DEFAULT 'text-embedding-3-small@1',

  -- Metadata
  tags          JSONB,                  -- string[]
  keywords      JSONB,                  -- string[]
  language      TEXT NOT NULL DEFAULT 'en',

  -- Document currency
  effective_date TIMESTAMPTZ,
  expiry_date    TIMESTAMPTZ,

  -- Version control
  version            INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID,

  -- Access control
  is_public              BOOLEAN NOT NULL DEFAULT false,
  allowed_organizations  JSONB,         -- string[]

  -- Usage statistics
  view_count     INTEGER NOT NULL DEFAULT 0,
  citation_count INTEGER NOT NULL DEFAULT 0,
  last_used_at   TIMESTAMPTZ,

  -- Status
  is_active      BOOLEAN NOT NULL DEFAULT true,

  created_by     TEXT NOT NULL REFERENCES profiles(user_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_base_organization_id_idx ON knowledge_base(organization_id);
CREATE INDEX IF NOT EXISTS knowledge_base_document_type_idx   ON knowledge_base(document_type);
CREATE INDEX IF NOT EXISTS knowledge_base_is_active_idx       ON knowledge_base(is_active);
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx        ON knowledge_base USING hnsw (embedding vector_cosine_ops);
