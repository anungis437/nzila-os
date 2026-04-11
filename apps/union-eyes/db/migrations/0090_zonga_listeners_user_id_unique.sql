-- Migration 0090: Add unique index on zonga_listeners.user_id
-- Required for the ON CONFLICT (user_id) upsert in ensureListenerProfile
CREATE UNIQUE INDEX IF NOT EXISTS zonga_listeners_user_id_key
  ON zonga_listeners (user_id);
