-- Seed AI capability profiles for union-eyes on staging
-- Requires: entities table with a system entity

-- 1. Insert system entity (nil UUID) if not exists
INSERT INTO entities (id, legal_name, jurisdiction, status)
VALUES ('00000000-0000-0000-0000-000000000000', 'SYSTEM', 'CA', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert AI capability profiles for union-eyes
INSERT INTO ai_capability_profiles
  (id, entity_id, app_key, environment, profile_key, enabled,
   allowed_providers, allowed_models, modalities, features,
   data_classes_allowed, streaming_allowed, determinism_required,
   redaction_mode, created_by)
VALUES
  -- ue-chatbot: text generation for the AI chatbot
  ('c0000001-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000000',
   'union-eyes', 'prod', 'ue-chatbot', true,
   '["openai","azure_openai"]'::jsonb,
   '["gpt-4o"]'::jsonb,
   '["text"]'::jsonb,
   '["chat","generate"]'::jsonb,
   '["public","internal"]'::jsonb,
   true, false, 'balanced', 'system'),

  -- ue-embeddings: embeddings for RAG
  ('c0000001-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000000',
   'union-eyes', 'prod', 'ue-embeddings', true,
   '["openai","azure_openai"]'::jsonb,
   '["text-embedding-3-small"]'::jsonb,
   '["embeddings"]'::jsonb,
   '["embed"]'::jsonb,
   '["public","internal"]'::jsonb,
   false, false, 'balanced', 'system')
ON CONFLICT DO NOTHING;
