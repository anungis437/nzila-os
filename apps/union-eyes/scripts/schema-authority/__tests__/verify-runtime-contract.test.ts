import { describe, expect, it } from 'vitest';
import { verify } from '../verify-runtime-contract';
import { loadDispositions, loadRegistry, loadRequiredContract } from '../lib/contracts';
import type { CanonicalSchemaFile } from '../lib/contracts';
import type { CanonicalColumn, CanonicalTable } from '../lib/normalize';

function col(name: string, type = 'text'): CanonicalColumn {
  return { column: name, type, nullable: true, default: null, primaryKey: name === 'id' };
}

function table(name: string, columns: string[], rlsEnabled = true): CanonicalTable {
  return {
    table: name,
    columns: columns.map((c) => col(c)),
    primaryKey: ['id'],
    foreignKeys: [],
    uniqueConstraints: [],
    indexes: [],
    rlsEnabled,
    rlsForced: false,
  };
}

function canonical(tables: CanonicalTable[]): CanonicalSchemaFile {
  return { meta: {}, digest: 'test-digest', schemas: [{ schema: 'public', tables }] };
}

// ff989637 physical state: Django stub `documents`, organization_members with
// no deleted_at and no member-directory columns, claims with no idempotency_hash,
// organizations without app_id (stale), users without PII, no notifications table.
function ff989637Canonical(): CanonicalSchemaFile {
  return canonical([
    table('organizations', ['id', 'name', 'slug', 'created_at', 'updated_at']),
    table('organization_members', ['id', 'organization_id', 'user_id', 'role', 'status', 'created_at', 'updated_at']),
    table('documents', ['id', 'created_at', 'updated_at', 'organization_id', 'checksum']),
    table('claims', ['id', 'organization_id', 'status', 'claim_amount', 'created_at', 'updated_at']),
    table('users', ['id', 'email', 'created_at', 'updated_at']),
  ]);
}

const inputs = () => ({
  requiredContract: loadRequiredContract(),
  dispositions: loadDispositions(),
  registry: loadRegistry(),
});

describe('runtime-contract verifier — ff989637 known-defect baseline', () => {
  const r = verify({ ...inputs(), canonical: ff989637Canonical() });

  it('BASELINE_SCHEMA_CONTRACT_VERDICT = FAIL', () => {
    expect(r.verdict).toBe('FAIL');
  });

  it('detects organization_members.deleted_at', () => {
    expect(r.MISSING_RUNTIME_REQUIRED_COLUMNS).toContain('public.organization_members.deleted_at');
  });

  it('detects claims.idempotency_hash', () => {
    expect(r.MISSING_RUNTIME_REQUIRED_COLUMNS).toContain('public.claims.idempotency_hash');
  });

  it('detects the document schema defect', () => {
    const docMissing = r.MISSING_RUNTIME_REQUIRED_COLUMNS.filter((c) => c.startsWith('public.documents.'));
    expect(docMissing.length).toBeGreaterThan(0);
    expect(docMissing).toContain('public.documents.title');
  });

  it('does NOT false-positive on stale organizations.app_id', () => {
    expect(r.MISSING_RUNTIME_REQUIRED_COLUMNS.some((c) => c.endsWith('.app_id'))).toBe(false);
  });

  it('NON_REQUIRED_USERS_FALSE_POSITIVES = 0', () => {
    expect(r.MISSING_RUNTIME_REQUIRED_COLUMNS.filter((c) => c.startsWith('public.users.')).length).toBe(0);
  });

  it('NON_REQUIRED_NOTIFICATIONS_FALSE_POSITIVES = 0', () => {
    expect(r.MISSING_RUNTIME_REQUIRED_COLUMNS.filter((c) => c.startsWith('public.notifications.')).length).toBe(0);
    expect(r.MISSING_RUNTIME_REQUIRED_TABLES).not.toContain('public.notifications');
  });

  it('does not flag dispositioned semantic columns (claim_amount)', () => {
    expect(r.MISSING_RUNTIME_REQUIRED_COLUMNS.some((c) => c.endsWith('.claim_amount'))).toBe(false);
    expect(r.SEMANTIC_RUNTIME_TYPE_MISMATCHES.length).toBe(0);
  });
});

describe('runtime-contract verifier — converged schema passes', () => {
  it('PASS when every REQUIRED_NOW column exists', () => {
    const contract = loadRequiredContract();
    const byTable = new Map<string, Set<string>>();
    for (const e of contract.entries) {
      if (!byTable.has(e.table)) byTable.set(e.table, new Set(['id']));
      byTable.get(e.table)!.add(e.column);
    }
    const tables = [...byTable.entries()].map(([t, cols]) => table(t, [...cols]));
    const r = verify({ ...inputs(), canonical: canonical(tables) });
    expect(r.MISSING_RUNTIME_REQUIRED_COLUMNS).toEqual([]);
    expect(r.MISSING_RUNTIME_REQUIRED_TABLES).toEqual([]);
    expect(r.verdict).toBe('PASS');
  });
});

describe('runtime-contract verifier — contradiction guard', () => {
  it('throws if a REQUIRED_NOW column is also dispositioned', () => {
    const contract = loadRequiredContract();
    const first = contract.entries[0];
    const badDispositions = {
      version: 1,
      dispositions: [
        { schema: first.schema, table: first.table, column: first.column, class: 'INCIDENTAL_ONLY' as const, requiredNow: false as const },
      ],
    };
    expect(() =>
      verify({ requiredContract: contract, dispositions: badDispositions, registry: loadRegistry(), canonical: ff989637Canonical() }),
    ).toThrow(/contradiction/i);
  });
});
