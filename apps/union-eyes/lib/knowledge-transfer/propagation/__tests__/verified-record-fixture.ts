/**
 * Test-only fixture: a verified dependency record that is genuinely CURRENT under the Family 1 evidence contract
 * (graph-evidence-evaluator.ts) against the nodes it is built from - a version-2 fingerprint over the dependent and
 * depends-on nodes' label/category/nodeType (dependent first), and an external citation attested by a reviewer who is
 * not the submitter. Consumer tests use it so the REAL evaluator decides currentness; nothing is mocked away.
 */
import { computeSourceFingerprint, type FingerprintableNode } from '../graph-fingerprint';
import type { VerifiedDependencyRecord } from '../verified-dependency-models';

export interface FixtureNode extends FingerprintableNode {
  id: string;
}

export function currentVerifiedRecord(
  dependent: FixtureNode,
  dependsOn: FixtureNode,
  overrides: Partial<VerifiedDependencyRecord> = {},
): VerifiedDependencyRecord {
  return {
    id: `vd-${dependent.id}-${dependsOn.id}`,
    organizationId: 'org',
    dependentNodeId: dependent.id,
    dependsOnNodeId: dependsOn.id,
    processOrSystem: 'payroll run',
    responsibleAuthority: 'finance',
    evidenceReference: 'collective agreement art. 12',
    evidenceReferenceType: 'external_citation',
    evidenceDocumentId: null,
    evidenceDocumentIntegrity: null,
    externalAttestation: 'reviewer checked the cited clause',
    externalAttestedBy: 'u2',
    externalAttestedAt: '2026-01-01T00:00:00.000Z',
    identityKeyVersion: 2,
    sourceFingerprint: computeSourceFingerprint(dependent, dependsOn, 2),
    status: 'verified',
    submittedBy: 'u1',
    reviewedBy: 'u2',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    reviewNotes: null,
    createdAt: '2025-12-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
