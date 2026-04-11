-- Migration 0091: Create missing Zonga social interaction tables
-- Required by listener-actions.ts, social-actions.ts, search-actions.ts, release-actions.ts

-- Follows: listener ↔ creator relationship
CREATE TABLE IF NOT EXISTS zonga_listener_follows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES orgs(id),
  listener_id UUID NOT NULL REFERENCES zonga_listeners(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES zonga_creators(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listener_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_zonga_listener_follows_listener
  ON zonga_listener_follows (listener_id);
CREATE INDEX IF NOT EXISTS idx_zonga_listener_follows_creator
  ON zonga_listener_follows (creator_id);

-- Favorites: listener bookmarks for any entity type
CREATE TABLE IF NOT EXISTS zonga_listener_favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES orgs(id),
  listener_id UUID NOT NULL REFERENCES zonga_listeners(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listener_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_zonga_listener_favorites_listener
  ON zonga_listener_favorites (listener_id);

-- Activity log: tracks listener actions (follow, play, favorite, etc.)
CREATE TABLE IF NOT EXISTS zonga_listener_activity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES orgs(id),
  listener_id   UUID NOT NULL REFERENCES zonga_listeners(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     UUID NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zonga_listener_activity_listener
  ON zonga_listener_activity (listener_id);
CREATE INDEX IF NOT EXISTS idx_zonga_listener_activity_type
  ON zonga_listener_activity (activity_type);
