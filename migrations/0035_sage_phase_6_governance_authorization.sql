-- Migration 0035: SAGE Phase 6 — governance derivative-authorization envelope
--
-- Governance records (boundary flags, review notes, decision records) are
-- DERIVED information: their narrative fields (note, rationale, uncertainty,
-- resolution note, decision statement) may summarize or quote restricted
-- evidence. Redacting only the referenced evidence ids is insufficient — the
-- record itself must carry an authorization envelope at least as restrictive as
-- the evidence it was derived from, and reads must filter on it.
--
-- Columns added (all governance tables):
--   * authorization_level  — the record's effective authorization level, from
--     the SAGE authorization ladder (public < administrative < internal <
--     authorized_only < sensitive < excluded).
--   * authorization_basis  — how the level was derived (transparency/tests):
--     workspace_default | target_inherited | evidence_inherited |
--     reviewer_restricted | legacy_conservative.
--   * excluded_from_external_review (decisions only) — true when a decision
--     references excluded evidence; it is not silently downgraded.
--
-- LEGACY BACKFILL SAFETY (the core of this migration):
--   Pre-existing governance narratives must NEVER become LESS protected than
--   the evidence/records they were derived from. 'internal' is assigned ONLY to
--   records provably workspace-level (no evidence target / no references).
--   Every resolvable evidence target/reference inherits that evidence's level
--   ('public'/'administrative' floor UP to 'internal', mirroring the runtime
--   derivation). Any evidence target or reference that CANNOT be resolved
--   (dangling id, unknown/legacy target_type, malformed reference) falls back to
--   the conservative 'sensitive' floor — never 'internal', never 'public'.
--
--   Columns are added NULLABLE first so existing rows are backfilled from their
--   real provenance BEFORE NOT NULL + defense-in-depth defaults are enforced.

-- ── 1. Add the envelope columns (nullable, pre-backfill) ─────────────────────

ALTER TABLE sage_boundary_flag
  ADD COLUMN IF NOT EXISTS authorization_level text,
  ADD COLUMN IF NOT EXISTS authorization_basis text;

ALTER TABLE sage_review_note
  ADD COLUMN IF NOT EXISTS authorization_level text,
  ADD COLUMN IF NOT EXISTS authorization_basis text;

ALTER TABLE sage_decision_record
  ADD COLUMN IF NOT EXISTS authorization_level          text,
  ADD COLUMN IF NOT EXISTS authorization_basis          text,
  ADD COLUMN IF NOT EXISTS excluded_from_external_review boolean;

-- ── 2. Boundary-flag legacy backfill ─────────────────────────────────────────

-- Inherit from a resolvable evidence-SOURCE target (floor 'public'/'admin' → internal).
UPDATE sage_boundary_flag f
SET authorization_level = CASE
      WHEN s.authorization_level::text IN ('public', 'administrative') THEN 'internal'
      ELSE s.authorization_level::text END,
    authorization_basis = 'target_inherited'
FROM sage_evidence_source s
WHERE f.authorization_level IS NULL
  AND f.target_type = 'evidence_source'
  AND f.target_id = s.id;

-- Inherit from a resolvable evidence-ITEM target (via its source).
UPDATE sage_boundary_flag f
SET authorization_level = CASE
      WHEN s.authorization_level::text IN ('public', 'administrative') THEN 'internal'
      ELSE s.authorization_level::text END,
    authorization_basis = 'target_inherited'
FROM sage_evidence_item i
JOIN sage_evidence_source s ON s.id = i.source_id
WHERE f.authorization_level IS NULL
  AND f.target_type = 'evidence_item'
  AND f.target_id = i.id;

-- Conservative fallback for any UNRESOLVED evidence reference: an explicit
-- non-workspace target that did not resolve above, OR a legacy target_id with
-- no target_type. Unknown provenance is treated as 'sensitive', never 'internal'.
UPDATE sage_boundary_flag f
SET authorization_level = 'sensitive',
    authorization_basis = 'legacy_conservative'
WHERE f.authorization_level IS NULL
  AND ( (f.target_type IS NOT NULL AND f.target_type <> 'workspace')
        OR (f.target_type IS NULL AND f.target_id IS NOT NULL) );

-- Remaining rows are provably workspace-level → the internal floor.
UPDATE sage_boundary_flag f
SET authorization_level = 'internal',
    authorization_basis = 'workspace_default'
WHERE f.authorization_level IS NULL;

-- ── 3. Review-note legacy backfill (same rules as boundary flags) ────────────

UPDATE sage_review_note n
SET authorization_level = CASE
      WHEN s.authorization_level::text IN ('public', 'administrative') THEN 'internal'
      ELSE s.authorization_level::text END,
    authorization_basis = 'target_inherited'
FROM sage_evidence_source s
WHERE n.authorization_level IS NULL
  AND n.target_type = 'evidence_source'
  AND n.target_id = s.id;

UPDATE sage_review_note n
SET authorization_level = CASE
      WHEN s.authorization_level::text IN ('public', 'administrative') THEN 'internal'
      ELSE s.authorization_level::text END,
    authorization_basis = 'target_inherited'
FROM sage_evidence_item i
JOIN sage_evidence_source s ON s.id = i.source_id
WHERE n.authorization_level IS NULL
  AND n.target_type = 'evidence_item'
  AND n.target_id = i.id;

UPDATE sage_review_note n
SET authorization_level = 'sensitive',
    authorization_basis = 'legacy_conservative'
WHERE n.authorization_level IS NULL
  AND ( (n.target_type IS NOT NULL AND n.target_type <> 'workspace')
        OR (n.target_type IS NULL AND n.target_id IS NOT NULL) );

UPDATE sage_review_note n
SET authorization_level = 'internal',
    authorization_basis = 'workspace_default'
WHERE n.authorization_level IS NULL;

-- ── 4. Decision-record legacy backfill ───────────────────────────────────────
--
-- The decision inherits the MOST RESTRICTIVE level across all RESOLVABLE
-- referenced evidence items (via their source) and referenced boundary flags.
-- Text-based joins (id::text = ref) avoid uuid-cast failures on malformed legacy
-- ids. Rules:
--   * empty reference lists                    → internal / workspace_default
--   * non-empty but NONE resolvable            → sensitive / legacy_conservative
--   * partially resolvable (some refs missing) → at least sensitive
--                                                (missing refs must not
--                                                 downgrade) / legacy_conservative
--   * fully resolvable                         → derived / evidence_inherited
--   * any resolvable excluded evidence         → excluded_from_external_review

WITH decision_refs AS (
  SELECT
    d.id AS decision_id,
    (SELECT count(*) FROM jsonb_array_elements_text(d.referenced_evidence_item_ids)) AS ev_ref_count,
    (SELECT count(*) FROM jsonb_array_elements_text(d.referenced_boundary_flag_ids)) AS fl_ref_count,
    (SELECT count(*)
       FROM jsonb_array_elements_text(d.referenced_evidence_item_ids) AS e(val)
       JOIN sage_evidence_item i ON i.id::text = e.val) AS ev_resolved_count,
    (SELECT count(*)
       FROM jsonb_array_elements_text(d.referenced_boundary_flag_ids) AS b(val)
       JOIN sage_boundary_flag bf ON bf.id::text = b.val) AS fl_resolved_count,
    GREATEST(
      COALESCE((SELECT max(CASE s.authorization_level::text
                             WHEN 'public' THEN 0 WHEN 'administrative' THEN 1
                             WHEN 'internal' THEN 2 WHEN 'authorized_only' THEN 3
                             WHEN 'sensitive' THEN 4 WHEN 'excluded' THEN 5 ELSE 2 END)
                 FROM jsonb_array_elements_text(d.referenced_evidence_item_ids) AS e(val)
                 JOIN sage_evidence_item i ON i.id::text = e.val
                 JOIN sage_evidence_source s ON s.id = i.source_id), -1),
      COALESCE((SELECT max(CASE bf.authorization_level
                             WHEN 'public' THEN 0 WHEN 'administrative' THEN 1
                             WHEN 'internal' THEN 2 WHEN 'authorized_only' THEN 3
                             WHEN 'sensitive' THEN 4 WHEN 'excluded' THEN 5 ELSE 2 END)
                 FROM jsonb_array_elements_text(d.referenced_boundary_flag_ids) AS b(val)
                 JOIN sage_boundary_flag bf ON bf.id::text = b.val), -1)
    ) AS max_rank,
    COALESCE((SELECT bool_or(i.excluded_from_external_review
                             OR s.authorization_level::text = 'excluded')
                FROM jsonb_array_elements_text(d.referenced_evidence_item_ids) AS e(val)
                JOIN sage_evidence_item i ON i.id::text = e.val
                JOIN sage_evidence_source s ON s.id = i.source_id), false) AS any_excluded
  FROM sage_decision_record d
  WHERE d.authorization_level IS NULL
)
UPDATE sage_decision_record d
SET authorization_level = CASE
      WHEN r.ev_ref_count = 0 AND r.fl_ref_count = 0 THEN 'internal'
      WHEN r.ev_resolved_count = 0 AND r.fl_resolved_count = 0 THEN 'sensitive'
      WHEN r.ev_ref_count > r.ev_resolved_count OR r.fl_ref_count > r.fl_resolved_count
        THEN CASE WHEN r.max_rank >= 5 THEN 'excluded' ELSE 'sensitive' END
      ELSE CASE
             WHEN r.max_rank <= 2 THEN 'internal'
             WHEN r.max_rank = 3 THEN 'authorized_only'
             WHEN r.max_rank = 4 THEN 'sensitive'
             WHEN r.max_rank >= 5 THEN 'excluded'
             ELSE 'internal' END
    END,
    authorization_basis = CASE
      WHEN r.ev_ref_count = 0 AND r.fl_ref_count = 0 THEN 'workspace_default'
      WHEN r.ev_resolved_count = 0 AND r.fl_resolved_count = 0 THEN 'legacy_conservative'
      WHEN r.ev_ref_count > r.ev_resolved_count OR r.fl_ref_count > r.fl_resolved_count
        THEN 'legacy_conservative'
      ELSE 'evidence_inherited' END,
    excluded_from_external_review = COALESCE(r.any_excluded, false)
FROM decision_refs r
WHERE d.id = r.decision_id;

-- Any decision row still NULL (defensive — no matching decision_refs) is floored
-- conservatively rather than left unprotected.
UPDATE sage_decision_record
SET authorization_level = 'sensitive',
    authorization_basis = 'legacy_conservative'
WHERE authorization_level IS NULL;

UPDATE sage_decision_record
SET excluded_from_external_review = false
WHERE excluded_from_external_review IS NULL;

-- ── 5. Enforce NOT NULL + defense-in-depth defaults for FUTURE rows ──────────
--
-- Service inserts ALWAYS supply the derived authorization level explicitly
-- (workspace-level records write 'internal'; evidence-derived records write
-- their calculated level). The DB default is defense-in-depth ONLY — it exists
-- to protect against an out-of-band / legacy / maintenance / defective insert
-- that bypasses the service layer and omits authorization_level.
--
-- Because a static column default cannot know a row's provenance, it must fail
-- RESTRICTIVE: the default is 'sensitive', NOT 'internal'. 'internal' is only
-- correct for a record KNOWN to be workspace-level, which only the service
-- layer can determine. An unknown-provenance direct insert therefore lands at
-- 'sensitive' rather than silently becoming broadly readable.

ALTER TABLE sage_boundary_flag
  ALTER COLUMN authorization_level SET DEFAULT 'sensitive',
  ALTER COLUMN authorization_level SET NOT NULL;

ALTER TABLE sage_review_note
  ALTER COLUMN authorization_level SET DEFAULT 'sensitive',
  ALTER COLUMN authorization_level SET NOT NULL;

ALTER TABLE sage_decision_record
  ALTER COLUMN authorization_level SET DEFAULT 'sensitive',
  ALTER COLUMN authorization_level SET NOT NULL,
  ALTER COLUMN excluded_from_external_review SET DEFAULT false,
  ALTER COLUMN excluded_from_external_review SET NOT NULL;

-- ── 6. Authorization-filtered list indexes ───────────────────────────────────

CREATE INDEX IF NOT EXISTS sage_boundary_flag_auth_idx
  ON sage_boundary_flag (workspace_id, authorization_level);
CREATE INDEX IF NOT EXISTS sage_review_note_auth_idx
  ON sage_review_note (workspace_id, authorization_level);
CREATE INDEX IF NOT EXISTS sage_decision_record_auth_idx
  ON sage_decision_record (workspace_id, authorization_level);
