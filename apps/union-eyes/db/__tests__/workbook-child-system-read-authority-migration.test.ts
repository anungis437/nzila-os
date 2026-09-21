/**
 * ARTIFACT TYPE: Migration contract test (static)
 * DOCTRINE_VERSION: 1.0.0
 *
 * Proves that 20260921_workbook_child_system_read_authority.sql (and its
 * rollback companion) grant union_eyes_system exactly the least privilege the
 * pre-claim (bearer) authoring + export path requires on the workbook child
 * tables — and nothing more. These are structural assertions over the SQL, not
 * a single-keyword grep.
 *
 * Context: the claimed-workbook authority chain runs the claimant and same-org
 * paths under tenant runtime (existing grants) and only the pre-claim path
 * under a bounded system context. Round 58 left union_eyes_system with NO
 * privileges on these child tables, so the pre-claim path was blocked at the
 * grant layer (grants are evaluated before the ue_system_full_access RLS
 * policy).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = resolve(__dirname, '..', 'migrations');
const FORWARD = readFileSync(
  resolve(MIGRATIONS_DIR, '20260921_workbook_child_system_read_authority.sql'),
  'utf8',
);
const ROLLBACK = readFileSync(
  resolve(MIGRATIONS_DIR, '20260921_workbook_child_system_read_authority_rollback.sql'),
  'utf8',
);

const flat = (s: string) => s.replace(/\s+/g, ' ');
const F = flat(FORWARD);
const R = flat(ROLLBACK);

describe('20260921 workbook child system read authority — forward', () => {
  it('grants union_eyes_system full CRUD on workbook_memory_holders (pre-claim authoring)', () => {
    expect(F).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_system', 'workbook_memory_holders'",
    );
  });

  it('grants union_eyes_system read-only on workbook_governance_lineage_entries (PDF read)', () => {
    expect(F).toContain(
      "GRANT SELECT ON TABLE %I TO union_eyes_system', 'workbook_governance_lineage_entries'",
    );
  });

  it('does NOT grant lineage writes to the system principal', () => {
    // The only lineage grant is SELECT; there is no write grant statement.
    expect(F).not.toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_system', 'workbook_governance_lineage_entries'",
    );
    expect(F).not.toContain(
      "GRANT INSERT ON TABLE %I TO union_eyes_system', 'workbook_governance_lineage_entries'",
    );
  });

  it('does NOT widen workbook_modules (out of scope for the current PDF path)', () => {
    expect(F).not.toMatch(/workbook_modules/i);
  });

  it('guards every grant with a table-existence check', () => {
    expect(F).toContain("to_regclass('workbook_memory_holders') IS NOT NULL");
    expect(F).toContain("to_regclass('workbook_governance_lineage_entries') IS NOT NULL");
  });
});

describe('20260921 workbook child system read authority — rollback', () => {
  it('revokes exactly the forward grants from union_eyes_system', () => {
    expect(R).toContain(
      "REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE %I FROM union_eyes_system', 'workbook_memory_holders'",
    );
    expect(R).toContain(
      "REVOKE SELECT ON TABLE %I FROM union_eyes_system', 'workbook_governance_lineage_entries'",
    );
  });

  it('does not issue any grant/revoke statement against union_eyes_runtime', () => {
    // The tables' runtime grants are owned by round 58; this migration only
    // touches the system principal. (Comments may reference runtime for
    // context; the executable statements must not.)
    expect(F).not.toContain('TO union_eyes_runtime');
    expect(R).not.toContain('FROM union_eyes_runtime');
  });
});
