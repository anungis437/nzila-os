import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

// DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE (Family 1 final correction).
//
// Runs the real store, alias store, evidence-document binding and single currentness evaluator against PGlite. The
// verified-dependency table is built from the ACTUAL platform migrations 0085, 0086 and 0087 (so every CHECK the
// migrations declare is exercised), and evidence documents live in real documents/document_versions rows read
// through the real evidence-document-reference module. Only the exploratory graph (buildDependencyPropagationMap),
// document authorization and audit persistence are stubbed.

const state = vi.hoisted(() => ({
  db: null as unknown,
  /** The current exploratory graph: label = id unless overridden. */
  nodes: [] as Array<{ id: string; label?: string; category?: string; nodeType?: string }>,
  authorized: true,
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  // Production (postgres-js) returns row arrays from tx.execute(); PGlite's driver wraps them in { rows }.
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
vi.mock('@/db/db', async () => {
  const { lateBoundDb } = await import('@/app/api/__tests__/support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/services/document-authorization-service', () => ({
  authorizeDocumentsForActor: async ({ documents }: { documents: Array<{ id: string }> }) => documents.map((d) => ({ id: d.id, allowed: state.authorized })),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));
vi.mock('../dependency-propagator', () => ({
  buildDependencyPropagationMap: async () => ({
    nodes: state.nodes.map((n) => ({ id: n.id, label: n.label ?? n.id, category: n.category ?? 'operational', nodeType: n.nodeType ?? 'process' })),
    edges: [],
    bottlenecks: [],
    downstreamImpacts: [],
  }),
}));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const DOC = '33333333-3333-4333-8333-333333333333';
const DOC_NO_HASH = '44444444-4444-4444-8444-444444444444';
const ATTEST = { attestation: 'Read clause 14.2 of the 2025 collective agreement; it names Payroll as the dependency.' };

const DEFAULT_NODES = ['a', 'b', 'c', 'Finance_Steward', 'Payroll_System'].map((id) => ({ id }));

let pg: PGlite;

function migration(file: string): string {
  return readFileSync(path.resolve(__dirname, '../../../../db/migrations-platform', file), 'utf8');
}

beforeAll(async () => {
  const { createTableDatabase } = await import('@/app/api/__tests__/support/pglite-tables');
  const created = await createTableDatabase([], [
    migration('0085_verified_dependency_evidence.sql'),
    migration('0086_graph_evidence_integrity_and_identity.sql'),
    migration('0087_verified_dependency_evidence_binding.sql'),
    `CREATE TABLE documents (
       id uuid primary key, organization_id uuid not null, status text not null default 'active',
       privacy_label text not null default 'team_confidential', sha256 text, checksum text
     )`,
    `CREATE TABLE document_versions (
       id uuid primary key default gen_random_uuid(), organization_id uuid not null, document_id uuid not null,
       version_no integer not null, content_hash text not null
     )`,
  ]);
  pg = created.pg;
  state.db = created.db;
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  await pg.exec('TRUNCATE ue_verified_dependency_evidence, ue_graph_node_alias, documents, document_versions');
  await pg.query(`INSERT INTO documents (id, organization_id, sha256) VALUES ($1, $2, 'abc123')`, [DOC, ORG_A]);
  await pg.query(`INSERT INTO documents (id, organization_id) VALUES ($1, $2)`, [DOC_NO_HASH, ORG_A]);
  state.nodes = DEFAULT_NODES.map((n) => ({ ...n }));
  state.authorized = true;
});

const store = () => import('../verified-dependency-store');
const evidenceService = () => import('../graph-evidence-service');

function input(dependent: string, dependsOn: string, overrides: Record<string, unknown> = {}) {
  return {
    dependentNodeId: dependent,
    dependsOnNodeId: dependsOn,
    processOrSystem: 'Payroll processing',
    responsibleAuthority: 'Finance Director',
    evidenceReference: 'Collective agreement 14.2',
    evidenceReferenceType: 'external_citation' as const,
    ...overrides,
  };
}

/** Submits and verifies dependent -> dependsOn with an attested external citation; returns the verified record. */
async function verifiedExternal(dependent: string, dependsOn: string, orgId = ORG_A) {
  const { submitVerifiedDependency, reviewVerifiedDependency } = await store();
  const submitted = await submitVerifiedDependency(orgId, input(dependent, dependsOn), 'submitter-1');
  const verified = await reviewVerifiedDependency(orgId, submitted.id, 'verified', 'reviewer-a', undefined, ATTEST);
  expect(verified?.status).toBe('verified');
  return verified!;
}

async function staleReasonsOf(recordId: string) {
  const { loadGraphEvidence } = await evidenceService();
  const evidence = await loadGraphEvidence(ORG_A);
  return evidence.staleVerified.find((s) => s.record.id === recordId)?.staleReasons ?? null;
}

describe('submission and review', () => {
  it('refuses a self-dependent submission, an unknown node, and an ambiguous node reference', async () => {
    const { submitVerifiedDependency } = await store();
    await expect(submitVerifiedDependency(ORG_A, input('a', 'a'), 'u1')).rejects.toMatchObject({ code: 'same_node' });
    await expect(submitVerifiedDependency(ORG_A, input('a', 'gone'), 'u1')).rejects.toMatchObject({ code: 'node_not_current' });
    // Two current nodes that differ only by case/spacing collide under the identity key - never guessed.
    state.nodes.push({ id: 'payroll_system' });
    await expect(submitVerifiedDependency(ORG_A, input('a', 'Payroll System'), 'u1')).rejects.toMatchObject({ code: 'node_reference_ambiguous' });
  });

  it('stores the RESOLVED current node ids and a version-2 fingerprint, starting pending_review', async () => {
    const { submitVerifiedDependency, lookupVerifiedDependency } = await store();
    const record = await submitVerifiedDependency(ORG_A, input('finance steward', 'PAYROLL SYSTEM'), 'submitter-1');
    expect(record).toMatchObject({ dependentNodeId: 'Finance_Steward', dependsOnNodeId: 'Payroll_System', identityKeyVersion: 2, status: 'pending_review' });
    expect(await lookupVerifiedDependency(ORG_A, 'Finance_Steward', 'Payroll_System')).toEqual({ state: 'unavailable', reason: 'no_verified_evidence_recorded' });
  });

  it('the database refuses a same-identity review even if application code attempted it', async () => {
    const { submitVerifiedDependency } = await store();
    const record = await submitVerifiedDependency(ORG_A, input('a', 'b'), 'same-user');
    await expect(pg.query(`UPDATE ue_verified_dependency_evidence SET status = 'verified', reviewed_by = $1 WHERE id = $2::uuid`, ['same-user', record.id])).rejects.toThrow();
  });

  it('refuses to verify a submission whose node left the graph by review time, but still allows rejecting it', async () => {
    const { submitVerifiedDependency, reviewVerifiedDependency } = await store();
    const record = await submitVerifiedDependency(ORG_A, input('a', 'b'), 'submitter-1');
    state.nodes = state.nodes.filter((n) => n.id !== 'b');
    await expect(reviewVerifiedDependency(ORG_A, record.id, 'verified', 'reviewer-a', undefined, ATTEST)).rejects.toMatchObject({ code: 'node_not_current' });
    expect((await reviewVerifiedDependency(ORG_A, record.id, 'rejected', 'reviewer-a', 'node gone'))?.status).toBe('rejected');
  });

  it('two reviewers racing on one pending submission resolve to exactly one decision', async () => {
    const { submitVerifiedDependency, reviewVerifiedDependency, listVerifiedDependencies } = await store();
    const record = await submitVerifiedDependency(ORG_A, input('Finance_Steward', 'Payroll_System'), 'submitter-1');
    const results = await Promise.all([
      reviewVerifiedDependency(ORG_A, record.id, 'verified', 'reviewer-a', undefined, ATTEST),
      reviewVerifiedDependency(ORG_A, record.id, 'rejected', 'reviewer-b', undefined),
    ]);
    const winners = results.filter((r) => r !== null);
    expect(winners).toHaveLength(1);
    const all = await listVerifiedDependencies(ORG_A);
    expect(all).toHaveLength(1);
    expect(all[0].reviewedBy).toBe(winners[0]!.reviewedBy);
  });

  it('a revoked dependency is never again reported as verified', async () => {
    const { revokeVerifiedDependency, lookupVerifiedDependency } = await store();
    const record = await verifiedExternal('Finance_Steward', 'Payroll_System');
    expect((await lookupVerifiedDependency(ORG_A, 'Finance_Steward', 'Payroll_System')).state).toBe('verified');
    expect((await revokeVerifiedDependency(ORG_A, record.id, 'reviewer-a', 'Process retired'))?.status).toBe('revoked');
    expect(await lookupVerifiedDependency(ORG_A, 'Finance_Steward', 'Payroll_System')).toEqual({ state: 'unavailable', reason: 'all_evidence_revoked_or_rejected' });
    expect(await revokeVerifiedDependency(ORG_A, record.id, 'reviewer-a', undefined)).toBeNull();
    const { loadGraphEvidence, hasVerifiedDependency } = await evidenceService();
    expect(hasVerifiedDependency(await loadGraphEvidence(ORG_A), 'Finance_Steward', 'Payroll_System')).toBe(false);
  });

  it('never returns, confirms or mutates another organization\'s evidence', async () => {
    const { lookupVerifiedDependency, revokeVerifiedDependency, reverifyVerifiedDependency, listVerifiedDependencies } = await store();
    const record = await verifiedExternal('Finance_Steward', 'Payroll_System');
    expect(await lookupVerifiedDependency(ORG_B, 'Finance_Steward', 'Payroll_System')).toEqual({ state: 'unavailable', reason: 'no_verified_evidence_recorded' });
    expect(await listVerifiedDependencies(ORG_B)).toEqual([]);
    expect(await revokeVerifiedDependency(ORG_B, record.id, 'attacker', undefined)).toBeNull();
    expect(await reverifyVerifiedDependency(ORG_B, record.id, 'attacker', undefined, ATTEST)).toBeNull();
    const { loadGraphEvidence } = await evidenceService();
    expect((await loadGraphEvidence(ORG_B)).currentVerified).toEqual([]);
    expect((await lookupVerifiedDependency(ORG_A, 'Finance_Steward', 'Payroll_System')).state).toBe('verified');
  });
});

describe('directional integrity', () => {
  it('A depends on B is never B depends on A - in the lookup, the evidence envelope and claims', async () => {
    const { lookupVerifiedDependency } = await store();
    await verifiedExternal('Finance_Steward', 'Payroll_System');
    expect((await lookupVerifiedDependency(ORG_A, 'Finance_Steward', 'Payroll_System')).state).toBe('verified');
    expect(await lookupVerifiedDependency(ORG_A, 'Payroll_System', 'Finance_Steward')).toEqual({ state: 'unavailable', reason: 'no_verified_evidence_recorded' });
    const { loadGraphEvidence, hasVerifiedDependency, assessDependencyClaim } = await evidenceService();
    const evidence = await loadGraphEvidence(ORG_A);
    expect(hasVerifiedDependency(evidence, 'Finance_Steward', 'Payroll_System')).toBe(true);
    expect(hasVerifiedDependency(evidence, 'Payroll_System', 'Finance_Steward')).toBe(false);
    expect(assessDependencyClaim(evidence, { kind: 'dependency', dependentNodeId: 'Payroll_System', dependsOnNodeId: 'Finance_Steward' }).status).toBe('hypothesis');
  });
});

describe('external evidence tiers', () => {
  it('refuses to verify an external citation without the reviewer\'s written attestation', async () => {
    const { submitVerifiedDependency, reviewVerifiedDependency } = await store();
    const record = await submitVerifiedDependency(ORG_A, input('a', 'b'), 'submitter-1');
    await expect(reviewVerifiedDependency(ORG_A, record.id, 'verified', 'reviewer-a', undefined)).rejects.toMatchObject({ code: 'attestation_required' });
    await expect(reviewVerifiedDependency(ORG_A, record.id, 'verified', 'reviewer-a', undefined, { attestation: '   ' })).rejects.toMatchObject({ code: 'attestation_required' });
  });

  it('records the attestation under the reviewer and confirms only as human_attested_external', async () => {
    const { lookupVerifiedDependency } = await store();
    const record = await verifiedExternal('a', 'b');
    expect(record).toMatchObject({ externalAttestation: ATTEST.attestation, externalAttestedBy: 'reviewer-a' });
    expect(record.externalAttestedAt).not.toBeNull();
    const lookup = await lookupVerifiedDependency(ORG_A, 'a', 'b');
    expect(lookup).toMatchObject({ state: 'verified', evidenceTier: 'human_attested_external' });
  });

  it('an unattested verified external citation (a row from before 0087) never confirms', async () => {
    const { submitVerifiedDependency, lookupVerifiedDependency } = await store();
    const record = await submitVerifiedDependency(ORG_A, input('a', 'b'), 'submitter-1');
    await pg.query(`UPDATE ue_verified_dependency_evidence SET status = 'verified', reviewed_by = 'reviewer-a' WHERE id = $1::uuid`, [record.id]);
    expect(await staleReasonsOf(record.id)).toEqual(['external_evidence_not_attested']);
    expect(await lookupVerifiedDependency(ORG_A, 'a', 'b')).toMatchObject({ state: 'unavailable', reason: 'requires_reverification', staleReasons: ['external_evidence_not_attested'] });
  });

  it('the database refuses an attestation by the submitter, a partial attestation, or one on document evidence', async () => {
    const { submitVerifiedDependency } = await store();
    const external = await submitVerifiedDependency(ORG_A, input('a', 'b'), 'submitter-1');
    await expect(pg.query(`UPDATE ue_verified_dependency_evidence SET external_attestation = 'x', external_attested_by = 'submitter-1', external_attested_at = now() WHERE id = $1::uuid`, [external.id])).rejects.toThrow();
    await expect(pg.query(`UPDATE ue_verified_dependency_evidence SET external_attestation = 'x' WHERE id = $1::uuid`, [external.id])).rejects.toThrow();
    const document = await submitVerifiedDependency(ORG_A, input('a', 'c', { evidenceReferenceType: 'document', evidenceDocumentId: DOC }), 'submitter-1');
    await expect(pg.query(`UPDATE ue_verified_dependency_evidence SET external_attestation = 'x', external_attested_by = 'r', external_attested_at = now() WHERE id = $1::uuid`, [document.id])).rejects.toThrow();
    await expect(pg.query(`UPDATE ue_verified_dependency_evidence SET evidence_document_integrity = 'sha256:x' WHERE id = $1::uuid`, [external.id])).rejects.toThrow();
  });
});

describe('document evidence integrity', () => {
  it('binds document evidence to its content and confirms as system_resolved_document', async () => {
    const { submitVerifiedDependency, reviewVerifiedDependency, lookupVerifiedDependency } = await store();
    const record = await submitVerifiedDependency(ORG_A, input('a', 'b', { evidenceReferenceType: 'document', evidenceDocumentId: DOC }), 'submitter-1');
    expect(record.evidenceDocumentIntegrity).toBe('sha256:abc123');
    await reviewVerifiedDependency(ORG_A, record.id, 'verified', 'reviewer-a', undefined);
    expect(await lookupVerifiedDependency(ORG_A, 'a', 'b')).toMatchObject({ state: 'verified', evidenceTier: 'system_resolved_document' });
  });

  it('refuses a document with no content hash, a document in another organization, and an unauthorized document', async () => {
    const { submitVerifiedDependency } = await store();
    await expect(submitVerifiedDependency(ORG_A, input('a', 'b', { evidenceReferenceType: 'document', evidenceDocumentId: DOC_NO_HASH }), 's')).rejects.toThrow(/no content hash/);
    await expect(submitVerifiedDependency(ORG_B, input('a', 'b', { evidenceReferenceType: 'document', evidenceDocumentId: DOC }), 's')).rejects.toThrow(/does not resolve/);
    state.authorized = false;
    await expect(submitVerifiedDependency(ORG_A, input('a', 'b', { evidenceReferenceType: 'document', evidenceDocumentId: DOC }), 's')).rejects.toThrow(/not authorized/);
  });

  it('a new document version makes the record stale until re-verified, and re-verification binds the new content', async () => {
    const { submitVerifiedDependency, reviewVerifiedDependency, reverifyVerifiedDependency, lookupVerifiedDependency } = await store();
    const record = await submitVerifiedDependency(ORG_A, input('a', 'b', { evidenceReferenceType: 'document', evidenceDocumentId: DOC }), 'submitter-1');
    await reviewVerifiedDependency(ORG_A, record.id, 'verified', 'reviewer-a', undefined);
    await pg.query(`INSERT INTO document_versions (organization_id, document_id, version_no, content_hash) VALUES ($1, $2, 2, 'def456')`, [ORG_A, DOC]);
    expect(await staleReasonsOf(record.id)).toEqual(['evidence_document_changed']);
    expect(await lookupVerifiedDependency(ORG_A, 'a', 'b')).toMatchObject({ state: 'unavailable', reason: 'requires_reverification' });
    // The submitter can never re-verify their own evidence.
    expect(await reverifyVerifiedDependency(ORG_A, record.id, 'submitter-1', undefined)).toBeNull();
    const reverified = await reverifyVerifiedDependency(ORG_A, record.id, 'reviewer-b', 'checked v2');
    expect(reverified?.evidenceDocumentIntegrity).toBe('version:2:def456');
    expect((await lookupVerifiedDependency(ORG_A, 'a', 'b')).state).toBe('verified');
  });

  it('an archived document makes the record stale (evidence no longer resolves) and cannot be re-verified', async () => {
    const { submitVerifiedDependency, reviewVerifiedDependency, reverifyVerifiedDependency } = await store();
    const record = await submitVerifiedDependency(ORG_A, input('a', 'b', { evidenceReferenceType: 'document', evidenceDocumentId: DOC }), 'submitter-1');
    await reviewVerifiedDependency(ORG_A, record.id, 'verified', 'reviewer-a', undefined);
    await pg.query(`UPDATE documents SET status = 'archived' WHERE id = $1::uuid`, [DOC]);
    expect(await staleReasonsOf(record.id)).toEqual(['evidence_reference_no_longer_resolves']);
    await expect(reverifyVerifiedDependency(ORG_A, record.id, 'reviewer-b', undefined)).rejects.toMatchObject({ code: 'invalid_evidence' });
  });
});

describe('graph identity and currentness', () => {
  it('a re-classified node (material attested fact) requires re-verification', async () => {
    const record = await verifiedExternal('a', 'b');
    state.nodes = state.nodes.map((n) => (n.id === 'b' ? { ...n, category: 'governance' } : n));
    expect(await staleReasonsOf(record.id)).toEqual(['source_fingerprint_mismatch']);
  });

  it('a deleted node makes the record stale and the lookup report node_not_current', async () => {
    const { lookupVerifiedDependency } = await store();
    const record = await verifiedExternal('a', 'b');
    state.nodes = state.nodes.filter((n) => n.id !== 'b');
    expect(await staleReasonsOf(record.id)).toEqual(['node_no_longer_current']);
    expect(await lookupVerifiedDependency(ORG_A, 'a', 'b')).toEqual({ state: 'unavailable', reason: 'node_not_current' });
  });

  it('a later collision never silently attaches evidence to one of two nodes: it is ambiguous until an alias resolves it', async () => {
    const { lookupVerifiedDependency } = await store();
    const record = await verifiedExternal('Finance_Steward', 'Payroll_System');
    state.nodes.push({ id: 'payroll_system' });
    expect(await staleReasonsOf(record.id)).toEqual(['node_reference_ambiguous']);
    expect(await lookupVerifiedDependency(ORG_A, 'Finance_Steward', 'Payroll_System')).toEqual({ state: 'unavailable', reason: 'node_reference_ambiguous' });
  });

  it('a semantic rename carried by an alias resolves, but the attested label changed, so it must be re-verified', async () => {
    const { reverifyVerifiedDependency, lookupVerifiedDependency } = await store();
    const { createNodeAlias } = await import('../node-alias-store');
    const record = await verifiedExternal('a', 'Payroll_System');
    state.nodes = state.nodes.map((n) => (n.id === 'Payroll_System' ? { id: 'Compensation_Platform' } : n));
    expect(await staleReasonsOf(record.id)).toEqual(['node_no_longer_current']);
    await createNodeAlias(ORG_A, { aliasLabel: 'Payroll_System', canonicalConceptLabel: 'Compensation_Platform', reason: 'Renamed in 2026' }, 'reviewer-a');
    expect(await staleReasonsOf(record.id)).toEqual(['source_fingerprint_mismatch']);
    const reverified = await reverifyVerifiedDependency(ORG_A, record.id, 'reviewer-b', 'rename confirmed', ATTEST);
    expect(reverified).toMatchObject({ dependentNodeId: 'a', dependsOnNodeId: 'Compensation_Platform', identityKeyVersion: 2 });
    // Both the old label (through the alias) and the new one find the same, now current, evidence.
    expect((await lookupVerifiedDependency(ORG_A, 'a', 'Payroll_System')).state).toBe('verified');
    expect((await lookupVerifiedDependency(ORG_A, 'a', 'Compensation_Platform')).state).toBe('verified');
  });

  it('re-targeting an alias changes which node a reference names, so evidence through it becomes stale', async () => {
    const { submitVerifiedDependency, reviewVerifiedDependency } = await store();
    const { createNodeAlias } = await import('../node-alias-store');
    state.nodes.push({ id: 'Payroll_Vendor' });
    await createNodeAlias(ORG_A, { aliasLabel: 'Pay', canonicalConceptLabel: 'Payroll_System', reason: 'shorthand' }, 'reviewer-a');
    const submitted = await submitVerifiedDependency(ORG_A, input('a', 'Pay'), 'submitter-1');
    expect(submitted.dependsOnNodeId).toBe('Payroll_System');
    // Simulate a pre-correction row that stored the raw alias label, then re-target the alias.
    await pg.query(`UPDATE ue_verified_dependency_evidence SET depends_on_node_id = 'Pay' WHERE id = $1::uuid`, [submitted.id]);
    const verified = await reviewVerifiedDependency(ORG_A, submitted.id, 'verified', 'reviewer-a', undefined, ATTEST);
    expect(verified?.dependsOnNodeId).toBe('Payroll_System');
    await pg.query(`UPDATE ue_verified_dependency_evidence SET depends_on_node_id = 'Pay' WHERE id = $1::uuid`, [submitted.id]);
    expect(await staleReasonsOf(submitted.id)).toBeNull();
    await createNodeAlias(ORG_A, { aliasLabel: 'Pay', canonicalConceptLabel: 'Payroll_Vendor', reason: 'shorthand now means the vendor' }, 'reviewer-a');
    expect(await staleReasonsOf(submitted.id)).toEqual(['source_fingerprint_mismatch']);
  });

  it('two concurrent re-verifications of one stale record produce exactly one', async () => {
    const { reverifyVerifiedDependency } = await store();
    const record = await verifiedExternal('a', 'b');
    state.nodes = state.nodes.map((n) => (n.id === 'b' ? { ...n, nodeType: 'system' } : n));
    const results = await Promise.all([
      reverifyVerifiedDependency(ORG_A, record.id, 'reviewer-b', undefined, ATTEST),
      reverifyVerifiedDependency(ORG_A, record.id, 'reviewer-c', undefined, ATTEST),
    ]);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    // A record that is already current is not re-verified again.
    expect(await reverifyVerifiedDependency(ORG_A, record.id, 'reviewer-d', undefined, ATTEST)).toBeNull();
  });
});

describe('legacy (identity-key version 1) fingerprints', () => {
  async function insertLegacy(dependent: string, dependsOn: string, labels: { dependent: string; dependsOn: string }) {
    const { computeSourceFingerprint } = await import('../graph-fingerprint');
    const fingerprint = computeSourceFingerprint(
      { label: labels.dependent, category: 'operational', nodeType: 'process' },
      { label: labels.dependsOn, category: 'operational', nodeType: 'process' },
      1,
    );
    const rows = await pg.query<{ id: string }>(
      `INSERT INTO ue_verified_dependency_evidence
         (organization_id, dependent_node_id, depends_on_node_id, process_or_system, responsible_authority, evidence_reference,
          evidence_reference_type, source_fingerprint, status, submitted_by, reviewed_by, external_attestation, external_attested_by, external_attested_at)
       VALUES ($1, $2, $3, 'p', 'r', 'e', 'external_citation', $4, 'verified', 's', 'r', 'legacy attestation', 'r', now())
       RETURNING id`,
      [ORG_A, dependent, dependsOn, fingerprint],
    );
    return rows.rows[0].id;
  }

  it('a legacy row stays current while its legacy key names exactly one current node', async () => {
    state.nodes.push({ id: 'Côté_Desk' });
    const id = await insertLegacy('a', 'Côté_Desk', { dependent: 'a', dependsOn: 'Côté_Desk' });
    expect(await staleReasonsOf(id)).toBeNull();
    const { lookupVerifiedDependency } = await store();
    expect((await lookupVerifiedDependency(ORG_A, 'a', 'Côté_Desk')).state).toBe('verified');
  });

  it('becomes legacy_fingerprint_ambiguous once the collision-prone legacy key matches two current nodes', async () => {
    // Version 1 stripped accents, so "Côté Desk" and "Cote Desk" shared one legacy key; version 2 keeps them apart.
    state.nodes.push({ id: 'Côté_Desk' }, { id: 'Cote_Desk' });
    const id = await insertLegacy('a', 'Côté_Desk', { dependent: 'a', dependsOn: 'Côté_Desk' });
    expect(await staleReasonsOf(id)).toEqual(['legacy_fingerprint_ambiguous']);
  });

  it('a row with no fingerprint at all is never trusted', async () => {
    const id = await insertLegacy('a', 'b', { dependent: 'a', dependsOn: 'b' });
    await pg.query(`UPDATE ue_verified_dependency_evidence SET source_fingerprint = NULL WHERE id = $1::uuid`, [id]);
    expect(await staleReasonsOf(id)).toEqual(['source_fingerprint_mismatch']);
  });
});

describe('reviewer listing', () => {
  it('reports each verified record as current (with tier) or requiring re-verification (with reasons)', async () => {
    const { listVerifiedDependenciesWithCurrentness, submitVerifiedDependency } = await store();
    const current = await verifiedExternal('a', 'b');
    const stale = await verifiedExternal('a', 'c');
    const pending = await submitVerifiedDependency(ORG_A, input('b', 'c'), 'submitter-1');
    state.nodes = state.nodes.map((n) => (n.id === 'c' ? { ...n, category: 'vendor' } : n));
    const listed = await listVerifiedDependenciesWithCurrentness(ORG_A);
    const byId = new Map(listed.map((r) => [r.id, r.currentness]));
    expect(byId.get(current.id)).toMatchObject({ state: 'current', evidenceTier: 'human_attested_external' });
    expect(byId.get(stale.id)).toEqual({ state: 'requires_reverification', staleReasons: ['source_fingerprint_mismatch'] });
    expect(byId.get(pending.id)).toEqual({ state: 'not_verified' });
  });
});
