// ─── SAGE Phase 6 — migration 0035 legacy-backfill safety (structural) ───────
// There is no executable SQL harness for the root `migrations/` chain, so these
// are STRUCTURAL assertions over the migration text. They prove the legacy
// governance backfill is conservative: existing narratives are never silently
// weakened to 'internal'/'public', unresolved provenance falls back to
// 'sensitive', and NOT NULL is only enforced AFTER backfill.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SQL = readFileSync(
  join(__dirname, '..', '..', '..', 'migrations', '0035_sage_phase_6_governance_authorization.sql'),
  'utf-8',
)

describe('migration 0035 — governance authorization backfill safety', () => {
  it('adds authorization columns NULLABLE first (no NOT NULL/DEFAULT at add time)', () => {
    // The ADD COLUMN block must not pre-seed a blanket value; that would prevent
    // the provenance-aware backfill (WHERE authorization_level IS NULL) from
    // ever running for existing rows.
    const addColumnRegion = SQL.slice(0, SQL.indexOf('-- ── 2.'))
    expect(addColumnRegion).toMatch(/ADD COLUMN IF NOT EXISTS authorization_level\s+text\s*,/i)
    expect(addColumnRegion).not.toMatch(/authorization_level[^\n]*NOT NULL/i)
    expect(addColumnRegion).not.toMatch(/authorization_level[^\n]*DEFAULT/i)
  })

  it('never assigns public to an existing governance record', () => {
    expect(SQL).not.toMatch(/=\s*'public'/i)
    expect(SQL).not.toMatch(/SET authorization_level\s*=\s*'public'/i)
  })

  it('inherits a resolvable evidence-source/item target level (target_inherited)', () => {
    for (const table of ['sage_boundary_flag', 'sage_review_note']) {
      // Source-target inheritance update present for this table.
      expect(SQL).toMatch(
        new RegExp(`UPDATE ${table}[\\s\\S]*?FROM sage_evidence_source`, 'i'),
      )
      // Item-target inheritance update present for this table.
      expect(SQL).toMatch(
        new RegExp(`UPDATE ${table}[\\s\\S]*?FROM sage_evidence_item`, 'i'),
      )
      // Both target kinds are handled by the discriminator.
      expect(SQL).toMatch(new RegExp(`${table}[\\s\\S]*?target_type = 'evidence_source'`, 'i'))
      expect(SQL).toMatch(new RegExp(`${table}[\\s\\S]*?target_type = 'evidence_item'`, 'i'))
    }
    expect(SQL).toMatch(/authorization_basis = 'target_inherited'/i)
  })

  it('floors public/administrative evidence up to internal (never below the floor)', () => {
    expect(SQL).toMatch(/IN \('public', 'administrative'\) THEN 'internal'/i)
  })

  it('falls back to a conservative sensitive level for unresolved legacy provenance', () => {
    // Boundary flags + review notes: unresolved evidence target → sensitive.
    for (const table of ['sage_boundary_flag', 'sage_review_note']) {
      const re = new RegExp(
        `UPDATE ${table}[\\s\\S]*?authorization_level = 'sensitive',\\s*authorization_basis = 'legacy_conservative'`,
        'i',
      )
      expect(SQL).toMatch(re)
    }
    // Decisions: non-empty-but-unresolvable references → sensitive / legacy_conservative.
    expect(SQL).toMatch(/legacy_conservative/i)
  })

  it('defaults only provably workspace-level records to internal', () => {
    for (const table of ['sage_boundary_flag', 'sage_review_note']) {
      const re = new RegExp(
        `UPDATE ${table}[\\s\\S]*?authorization_level = 'internal',\\s*authorization_basis = 'workspace_default'\\s*WHERE [\\s\\S]*?authorization_level IS NULL;`,
        'i',
      )
      expect(SQL).toMatch(re)
    }
  })

  it('derives decision authorization from referenced evidence + flags (jsonb-safe)', () => {
    expect(SQL).toMatch(/jsonb_array_elements_text\(d\.referenced_evidence_item_ids\)/i)
    expect(SQL).toMatch(/jsonb_array_elements_text\(d\.referenced_boundary_flag_ids\)/i)
    // Text-based joins avoid uuid-cast failures on malformed legacy ids.
    expect(SQL).toMatch(/i\.id::text = e\.val/i)
    expect(SQL).toMatch(/bf\.id::text = b\.val/i)
    // empty reference lists → internal / workspace_default
    expect(SQL).toMatch(/ev_ref_count = 0 AND r?\.?fl_ref_count = 0 THEN 'internal'/i)
    // excluded evidence propagates the external-review flag
    expect(SQL).toMatch(/excluded_from_external_review/i)
    expect(SQL).toMatch(/bool_or\([\s\S]*?authorization_level::text = 'excluded'/i)
  })

  it('enforces NOT NULL only AFTER the backfill UPDATEs', () => {
    const firstNotNull = SQL.search(/ALTER COLUMN authorization_level SET NOT NULL/i)
    const lastBackfill = SQL.lastIndexOf('authorization_level IS NULL')
    expect(firstNotNull).toBeGreaterThan(-1)
    expect(lastBackfill).toBeGreaterThan(-1)
    expect(firstNotNull).toBeGreaterThan(lastBackfill)
  })

  it('uses a RESTRICTIVE sensitive future default (never a blanket internal/public default)', () => {
    // The static column default must fail restrictive: an out-of-band insert
    // that omits authorization_level lands at 'sensitive', not 'internal'.
    expect(SQL).toMatch(/ALTER COLUMN authorization_level SET DEFAULT 'sensitive'/i)
    expect(SQL).not.toMatch(/SET DEFAULT 'internal'/i)
    expect(SQL).not.toMatch(/SET DEFAULT 'public'/i)
    // Each governance table gets the restrictive default.
    const sensitiveDefaults = SQL.match(/SET DEFAULT 'sensitive'/gi) ?? []
    expect(sensitiveDefaults.length).toBe(3)
  })

  it('still backfills provably workspace-level records to internal (via UPDATE, not default)', () => {
    // 'internal' is only ever assigned by a provenance-aware UPDATE for a
    // workspace-level record — never as the column default.
    expect(SQL).toMatch(/authorization_level = 'internal',\s*authorization_basis = 'workspace_default'/i)
  })
})
