import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { vi } from 'vitest';

// DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE: the verified dependency
// graph is a separate, review-gated table from the exploratory propagation map. This suite runs the real store
// functions against a PGlite database built from the actual table shape (platform migration 0085), proving:
//  - a submission starts pending_review and is not self-reviewable (DB CHECK rejects a same-identity review attempt
//    even if application code were ever to allow it through)
//  - two reviewers racing to review the same pending row resolve to exactly one winner (conditional UPDATE)
//  - a revoked record is never again reported as verified
//  - a lookup for a different organization's node ids never sees another organization's evidence

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/lib/db/with-rls-context', () => ({
  // Production (postgres-js) returns row arrays from tx.execute(); PGlite's driver wraps them in { rows }. Adapt
  // only that driver result envelope here so the store code under test is the real, unmodified production code.
  withRLSContext: async (...a: unknown[]) => {
    const db = state.db as { execute: (q: unknown) => Promise<{ rows: unknown[] }> };
    const postgresJsDb = new Proxy(db, {
      get(target, property) {
        if (property === 'execute') return async (query: unknown) => (await target.execute(query)).rows;
        return Reflect.get(target, property);
      },
    });
    return (a[a.length - 1] as (tx: unknown) => Promise<unknown>)(postgresJsDb);
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

let pg: PGlite;

beforeAll(async () => {
  const { createTableDatabase } = await import('@/app/api/__tests__/support/pglite-tables');
  const created = await createTableDatabase([], [
    `CREATE TABLE ue_verified_dependency_evidence (
       id uuid primary key default gen_random_uuid(),
       organization_id uuid not null,
       dependent_node_id text not null,
       depends_on_node_id text not null,
       process_or_system varchar(300) not null,
       responsible_authority varchar(300) not null,
       evidence_reference varchar(500) not null,
       status varchar(20) not null default 'pending_review',
       submitted_by text not null,
       reviewed_by text,
       reviewed_at timestamptz,
       review_notes varchar(1000),
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now(),
       constraint ue_verified_dependency_evidence_status_check check (status in ('pending_review','verified','rejected','revoked')),
       constraint ue_verified_dependency_evidence_not_self_dependent check (dependent_node_id <> depends_on_node_id),
       constraint ue_verified_dependency_evidence_reviewer_distinct check (reviewed_by is null or reviewed_by <> submitted_by)
     )`,
  ]);
  pg = created.pg;
  state.db = created.db;
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  await pg.exec('TRUNCATE ue_verified_dependency_evidence');
});

describe('verified dependency evidence — real PGlite SQL', () => {
  it('rejects a self-dependent submission at the database layer', async () => {
    const { submitVerifiedDependency } = await import('../verified-dependency-store');
    await expect(
      submitVerifiedDependency(ORG_A, {
        dependentNodeId: 'same_node', dependsOnNodeId: 'same_node',
        processOrSystem: 'x', responsibleAuthority: 'x', evidenceReference: 'x',
      }, 'u1'),
    ).rejects.toThrow();
  });

  it('starts pending_review and reports unavailable (no_verified_evidence_recorded) before any review', async () => {
    const { submitVerifiedDependency, lookupVerifiedDependency } = await import('../verified-dependency-store');
    await submitVerifiedDependency(ORG_A, {
      dependentNodeId: 'finance_clerk_pending', dependsOnNodeId: 'payroll_system_pending',
      processOrSystem: 'Payroll processing', responsibleAuthority: 'Finance Director', evidenceReference: 'SOP-114',
    }, 'submitter-1');

    const lookup = await lookupVerifiedDependency(ORG_A, 'finance_clerk_pending', 'payroll_system_pending');
    expect(lookup).toEqual({ state: 'unavailable', reason: 'no_verified_evidence_recorded' });
  });

  it('refuses a same-identity review even if application code attempted it (reviewer-distinct CHECK)', async () => {
    const { submitVerifiedDependency } = await import('../verified-dependency-store');
    const record = await submitVerifiedDependency(ORG_A, {
      dependentNodeId: 'a', dependsOnNodeId: 'b', processOrSystem: 'x', responsibleAuthority: 'x', evidenceReference: 'x',
    }, 'same-user');
    await expect(
      pg.query(
        `UPDATE ue_verified_dependency_evidence SET status = 'verified', reviewed_by = $1 WHERE id = $2::uuid`,
        ['same-user', record.id],
      ),
    ).rejects.toThrow();
  });

  it('two reviewers racing to review the same pending submission resolve to exactly one winner', async () => {
    const { submitVerifiedDependency, reviewVerifiedDependency, listVerifiedDependencies } = await import('../verified-dependency-store');
    const record = await submitVerifiedDependency(ORG_A, {
      dependentNodeId: 'finance_clerk', dependsOnNodeId: 'payroll_system',
      processOrSystem: 'Payroll processing', responsibleAuthority: 'Finance Director', evidenceReference: 'SOP-114',
    }, 'submitter-1');

    const [resultA, resultB] = await Promise.all([
      reviewVerifiedDependency(ORG_A, record.id, 'verified', 'reviewer-a', undefined),
      reviewVerifiedDependency(ORG_A, record.id, 'rejected', 'reviewer-b', undefined),
    ]);

    // Exactly one of the two concurrent reviews wins; the other sees a zero-row conditional update (null).
    const winners = [resultA, resultB].filter((r) => r !== null);
    expect(winners).toHaveLength(1);

    const all = await listVerifiedDependencies(ORG_A);
    expect(all).toHaveLength(1);
    expect(['verified', 'rejected']).toContain(all[0].status);
    expect(all[0].reviewedBy).toBe(winners[0]!.reviewedBy);
  });

  it('a revoked dependency is never again reported as verified (conflicting/revoked case)', async () => {
    const { submitVerifiedDependency, reviewVerifiedDependency, revokeVerifiedDependency, lookupVerifiedDependency } = await import('../verified-dependency-store');
    const record = await submitVerifiedDependency(ORG_A, {
      dependentNodeId: 'finance_clerk', dependsOnNodeId: 'payroll_system',
      processOrSystem: 'Payroll processing', responsibleAuthority: 'Finance Director', evidenceReference: 'SOP-114',
    }, 'submitter-1');
    await reviewVerifiedDependency(ORG_A, record.id, 'verified', 'reviewer-a', undefined);

    const verifiedLookup = await lookupVerifiedDependency(ORG_A, 'finance_clerk', 'payroll_system');
    expect(verifiedLookup.state).toBe('verified');

    const revoked = await revokeVerifiedDependency(ORG_A, record.id, 'reviewer-a', 'Process retired');
    expect(revoked?.status).toBe('revoked');

    const afterRevoke = await lookupVerifiedDependency(ORG_A, 'finance_clerk', 'payroll_system');
    expect(afterRevoke).toEqual({ state: 'unavailable', reason: 'all_evidence_revoked_or_rejected' });

    // Revoking twice is a no-op (zero-row conditional update), never re-applies or errors.
    const secondRevoke = await revokeVerifiedDependency(ORG_A, record.id, 'reviewer-a', undefined);
    expect(secondRevoke).toBeNull();
  });

  it('never returns or mutates another organization\'s verified dependency evidence (cross-tenant)', async () => {
    const { submitVerifiedDependency, reviewVerifiedDependency, lookupVerifiedDependency, revokeVerifiedDependency, listVerifiedDependencies } = await import('../verified-dependency-store');
    const recordA = await submitVerifiedDependency(ORG_A, {
      dependentNodeId: 'finance_clerk', dependsOnNodeId: 'payroll_system',
      processOrSystem: 'Payroll processing', responsibleAuthority: 'Finance Director', evidenceReference: 'SOP-114',
    }, 'submitter-1');
    await reviewVerifiedDependency(ORG_A, recordA.id, 'verified', 'reviewer-a', undefined);

    // Org B has never submitted anything for this node pair - must read as never-recorded, not borrow org A's row.
    const crossTenantLookup = await lookupVerifiedDependency(ORG_B, 'finance_clerk', 'payroll_system');
    expect(crossTenantLookup).toEqual({ state: 'unavailable', reason: 'no_verified_evidence_recorded' });

    // Org B cannot list org A's evidence.
    expect(await listVerifiedDependencies(ORG_B)).toEqual([]);

    // Org B cannot revoke org A's verified record by guessing/reusing its id - the organization_id predicate in the
    // UPDATE's WHERE clause means zero rows match, so this is a no-op, not an error that otherwise leaks existence.
    const crossTenantRevoke = await revokeVerifiedDependency(ORG_B, recordA.id, 'attacker', undefined);
    expect(crossTenantRevoke).toBeNull();

    // Org A's record is unaffected by the cross-tenant attempt.
    const stillVerified = await lookupVerifiedDependency(ORG_A, 'finance_clerk', 'payroll_system');
    expect(stillVerified.state).toBe('verified');
  });
});
