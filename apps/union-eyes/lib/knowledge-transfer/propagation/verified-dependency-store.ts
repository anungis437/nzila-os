/**
 * Verified Dependency Evidence Store
 *
 * Persists and reviews verified operational dependency evidence, separate from the exploratory propagation map.
 * Uses the ue_verified_dependency_evidence table (platform migration 0085, RLS scoped 0059). This module never
 * issues DDL and every statement runs on the tenant runtime identity via inOrganization/withRLSContext.
 *
 * Review workflow mirrors the exit-interview governance reclassification pattern: submission starts
 * pending_review; a review conditionally transitions it to verified or rejected and is rejected itself (409-style,
 * via a zero-row update) if the record has already been reviewed, or if the reviewer is the same identity as the
 * submitter — the database CHECK constraint (ue_verified_dependency_evidence_reviewer_distinct) enforces the
 * latter independently of this code. A verified record can later be revoked; a revoked or rejected record is never
 * silently treated as verified again.
 *
 * Family 1 final correction: node references are resolved (graph-identity.ts resolveNodeReference - an ambiguous or
 * unknown reference is refused, never guessed) and stored as the RESOLVED current node ids; the fingerprint is
 * recorded under identity-key version 2; a document reference is bound to its exact content; an external citation
 * cannot be verified without the reviewer's written attestation; and a verified record that has become stale is
 * brought current only by an explicit re-verification by a reviewer distinct from the submitter. Whether a record is
 * current is decided ONLY by graph-evidence-evaluator.ts.
 */

import { sql, type SQL } from 'drizzle-orm';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { inOrganization } from '../org-scope';
import { IDENTITY_KEY_VERSION, resolveNodeReference } from './graph-identity';
import { computeSourceFingerprint } from './graph-fingerprint';
import { evaluateRecordCurrentness, loadGraphEvidenceContext, type GraphEvidenceContext } from './graph-evidence-evaluator';
import { currentDocumentIntegrity, resolveEvidenceDocumentForSubmission } from './evidence-document-reference';
import type {
  VerifiedDependencyRecord,
  SubmitVerifiedDependencyInput,
  VerifiedDependencyReviewDecision,
  VerifiedDependencyLookup,
  EvidenceStaleReason,
  ExternalAttestationInput,
} from './verified-dependency-models';

interface VerifiedDependencyRow {
  id: string;
  organization_id: string;
  dependent_node_id: string;
  depends_on_node_id: string;
  process_or_system: string;
  responsible_authority: string;
  evidence_reference: string;
  evidence_reference_type: VerifiedDependencyRecord['evidenceReferenceType'];
  evidence_document_id: string | null;
  evidence_document_integrity: string | null;
  external_attestation: string | null;
  external_attested_by: string | null;
  external_attested_at: string | Date | null;
  identity_key_version: number | null;
  source_fingerprint: string | null;
  status: VerifiedDependencyRecord['status'];
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: VerifiedDependencyRow): VerifiedDependencyRecord {
  const attestedAt = row.external_attested_at;
  return {
    id: row.id,
    organizationId: row.organization_id,
    dependentNodeId: row.dependent_node_id,
    dependsOnNodeId: row.depends_on_node_id,
    processOrSystem: row.process_or_system,
    responsibleAuthority: row.responsible_authority,
    evidenceReference: row.evidence_reference,
    evidenceReferenceType: row.evidence_reference_type,
    evidenceDocumentId: row.evidence_document_id,
    evidenceDocumentIntegrity: row.evidence_document_integrity ?? null,
    externalAttestation: row.external_attestation ?? null,
    externalAttestedBy: row.external_attested_by ?? null,
    externalAttestedAt: attestedAt == null ? null : attestedAt instanceof Date ? attestedAt.toISOString() : String(attestedAt),
    identityKeyVersion: Number(row.identity_key_version) === 2 ? 2 : 1,
    sourceFingerprint: row.source_fingerprint,
    status: row.status,
    submittedBy: row.submitted_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Thrown for a request the caller can correct (unknown/ambiguous node, invalid evidence). Routes map it to 4xx. */
export class VerifiedDependencyInputError extends Error {
  constructor(message: string, readonly code: 'node_not_current' | 'node_reference_ambiguous' | 'invalid_evidence' | 'attestation_required' | 'same_node') {
    super(message);
    this.name = 'VerifiedDependencyInputError';
  }
}

/**
 * Resolves a dependent/depends-on pair against the CURRENT graph and returns the resolved current node ids and the
 * version-2 fingerprint of that directed pair. Refuses (never guesses) an unknown or ambiguous reference, and a pair
 * that resolves to one node.
 */
function resolvePairForAttestation(context: GraphEvidenceContext, dependentRef: string, dependsOnRef: string) {
  const resolved = [dependentRef, dependsOnRef].map((ref) => ({ ref, resolution: resolveNodeReference(context.aliases, context.currentNodeIds, ref) }));
  const ambiguous = resolved.filter((r) => r.resolution.status === 'ambiguous');
  if (ambiguous.length > 0) {
    throw new VerifiedDependencyInputError(
      `Node reference(s) match more than one current node and must be disambiguated with an alias first: ${ambiguous.map((r) => r.ref).join(', ')}`,
      'node_reference_ambiguous',
    );
  }
  const unknown = resolved.filter((r) => r.resolution.status === 'not_found');
  if (unknown.length > 0) {
    throw new VerifiedDependencyInputError(
      `The following node id(s) do not correspond to any current dependency node for this organization: ${unknown.map((r) => r.ref).join(', ')}`,
      'node_not_current',
    );
  }
  const [dependentId, dependsOnId] = resolved.map((r) => (r.resolution.status === 'resolved' ? r.resolution.nodeId : ''));
  if (dependentId === dependsOnId) throw new VerifiedDependencyInputError('dependentNodeId and dependsOnNodeId must name different nodes', 'same_node');
  const fingerprint = computeSourceFingerprint(context.nodesById.get(dependentId)!, context.nodesById.get(dependsOnId)!, IDENTITY_KEY_VERSION);
  return { dependentId, dependsOnId, fingerprint };
}

/** Validates an evidence reference at submission and returns the document content identity to store (null for an
 *  external citation, which carries no system-verifiable content until a reviewer attests it). */
async function validateEvidenceReference(
  orgId: string,
  input: Pick<SubmitVerifiedDependencyInput, 'evidenceReferenceType' | 'evidenceDocumentId'>,
  submittedBy: string,
): Promise<string | null> {
  if (input.evidenceReferenceType === 'external_citation') {
    if (input.evidenceDocumentId) throw new VerifiedDependencyInputError('evidenceDocumentId must not be set when evidenceReferenceType is external_citation', 'invalid_evidence');
    return null;
  }
  if (!input.evidenceDocumentId) throw new VerifiedDependencyInputError('evidenceDocumentId is required when evidenceReferenceType is document', 'invalid_evidence');
  const resolution = await resolveEvidenceDocumentForSubmission(orgId, input.evidenceDocumentId, submittedBy);
  if (resolution.status === 'not_found') throw new VerifiedDependencyInputError('evidenceDocumentId does not resolve to an active document in this organization', 'invalid_evidence');
  if (resolution.status === 'not_authorized') throw new VerifiedDependencyInputError('You are not authorized to reference this document as evidence', 'invalid_evidence');
  if (resolution.status === 'no_content_hash') throw new VerifiedDependencyInputError('This document has no content hash, so its content cannot be bound as evidence', 'invalid_evidence');
  return resolution.integrity;
}

/** The evidence fields a verification (or re-verification) writes: the document's content identity as it stands
 *  now, or the reviewer's attestation of the external source. */
async function attestEvidence(
  orgId: string,
  record: Pick<VerifiedDependencyRecord, 'evidenceReferenceType' | 'evidenceDocumentId'>,
  attestation: ExternalAttestationInput | undefined,
): Promise<{ documentIntegrity: string | null; externalAttestation: string | null }> {
  if (record.evidenceReferenceType === 'document') {
    const integrity = record.evidenceDocumentId ? await currentDocumentIntegrity(orgId, record.evidenceDocumentId) : null;
    if (integrity === null) {
      throw new VerifiedDependencyInputError('The evidence document is no longer active or has no content hash; it cannot be verified', 'invalid_evidence');
    }
    return { documentIntegrity: integrity, externalAttestation: null };
  }
  const text = attestation?.attestation?.trim() ?? '';
  if (text.length === 0) {
    throw new VerifiedDependencyInputError(
      'Verifying an external citation requires your written attestation of how you checked the cited source',
      'attestation_required',
    );
  }
  return { documentIntegrity: null, externalAttestation: text };
}

async function loadRecord(orgId: string, id: string): Promise<VerifiedDependencyRecord | null> {
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`SELECT * FROM ue_verified_dependency_evidence WHERE id = ${id} AND organization_id = ${orgId}`),
  );
  const row = (rows as unknown as VerifiedDependencyRow[])[0];
  return row ? rowToRecord(row) : null;
}

/** Submits new verified-dependency evidence. Always starts pending_review — nothing is self-certifying. */
export async function submitVerifiedDependency(
  orgId: string,
  input: SubmitVerifiedDependencyInput,
  submittedBy: string,
): Promise<VerifiedDependencyRecord> {
  if (input.dependentNodeId === input.dependsOnNodeId) {
    throw new VerifiedDependencyInputError('dependentNodeId and dependsOnNodeId must differ', 'same_node');
  }
  const { context } = await loadGraphEvidenceContext(orgId, []);
  const pair = resolvePairForAttestation(context, input.dependentNodeId, input.dependsOnNodeId);
  const documentIntegrity = await validateEvidenceReference(orgId, input, submittedBy);
  const rows = await inOrganization(orgId, async (tx) => {
    const inserted = await tx.execute(sql`
      INSERT INTO ue_verified_dependency_evidence
        (organization_id, dependent_node_id, depends_on_node_id, process_or_system, responsible_authority, evidence_reference,
         evidence_reference_type, evidence_document_id, evidence_document_integrity, source_fingerprint, identity_key_version, status, submitted_by)
      VALUES
        (${orgId}, ${pair.dependentId}, ${pair.dependsOnId}, ${input.processOrSystem}, ${input.responsibleAuthority}, ${input.evidenceReference},
         ${input.evidenceReferenceType}, ${input.evidenceDocumentId ?? null}, ${documentIntegrity}, ${pair.fingerprint}, ${IDENTITY_KEY_VERSION}, 'pending_review', ${submittedBy})
      RETURNING *
    `);
    const record = (inserted as unknown as VerifiedDependencyRow[])[0];
    await persistAtomicAudit(tx, {
      organizationId: orgId,
      action: 'verified_dependency.submit',
      resourceType: 'verified_dependency_evidence',
      resourceId: record.id,
      userId: submittedBy,
      details: {
        dependentNodeId: pair.dependentId,
        dependsOnNodeId: pair.dependsOnId,
        submittedDependentReference: input.dependentNodeId,
        submittedDependsOnReference: input.dependsOnNodeId,
        evidenceReferenceType: input.evidenceReferenceType,
      },
    });
    return inserted;
  });
  return rowToRecord((rows as unknown as VerifiedDependencyRow[])[0]);
}

/**
 * Reviews a pending submission. Returns null (not found/not reviewable) when the record does not exist, is not
 * pending_review, or the reviewer matches the submitter — a zero-row conditional update, never a silent no-op
 * presented as success; two concurrent reviews therefore produce exactly one decision.
 *
 * A 'verified' decision re-attests the CURRENT state: the references are re-resolved (and stored resolved), the
 * fingerprint is recomputed under the current identity-key version, a document's content identity is captured as it
 * stands now, and an external citation requires the reviewer's written attestation.
 */
export async function reviewVerifiedDependency(
  orgId: string,
  id: string,
  decision: VerifiedDependencyReviewDecision,
  reviewedBy: string,
  reviewNotes: string | undefined,
  attestation?: ExternalAttestationInput,
): Promise<VerifiedDependencyRecord | null> {
  let verification: SQL = sql``;
  if (decision === 'verified') {
    const target = await loadRecord(orgId, id);
    if (!target || target.status !== 'pending_review' || target.submittedBy === reviewedBy) return null;
    const { context } = await loadGraphEvidenceContext(orgId, []);
    const pair = resolvePairForAttestation(context, target.dependentNodeId, target.dependsOnNodeId);
    const evidence = await attestEvidence(orgId, target, attestation);
    verification = sql`,
      dependent_node_id = ${pair.dependentId},
      depends_on_node_id = ${pair.dependsOnId},
      source_fingerprint = ${pair.fingerprint},
      identity_key_version = ${IDENTITY_KEY_VERSION},
      evidence_document_integrity = ${evidence.documentIntegrity},
      external_attestation = ${evidence.externalAttestation},
      external_attested_by = ${evidence.externalAttestation === null ? null : reviewedBy},
      external_attested_at = ${evidence.externalAttestation === null ? sql`NULL` : sql`now()`}`;
  }
  return inOrganization(orgId, async (tx) => {
    const updated = await tx.execute(sql`
      UPDATE ue_verified_dependency_evidence
      SET status = ${decision}, reviewed_by = ${reviewedBy}, reviewed_at = now(), review_notes = ${reviewNotes ?? null}, updated_at = now()
        ${verification}
      WHERE id = ${id}
        AND organization_id = ${orgId}
        AND status = 'pending_review'
        AND submitted_by <> ${reviewedBy}
      RETURNING *
    `);
    const rows = updated as unknown as VerifiedDependencyRow[];
    if (rows.length === 0) return null;
    await persistAtomicAudit(tx, {
      organizationId: orgId,
      action: `verified_dependency.${decision}`,
      resourceType: 'verified_dependency_evidence',
      resourceId: id,
      userId: reviewedBy,
      details: { decision, externallyAttested: rows[0].external_attestation !== null },
    });
    return rowToRecord(rows[0]);
  });
}

/**
 * Re-verifies a verified record that is no longer current (a node was renamed or re-classified, an alias changed,
 * the evidence document changed, a legacy fingerprint became ambiguous, or an external citation was never attested).
 * Nothing else brings a stale record back: the reviewer (distinct from the submitter) re-attests the claim against
 * the graph and evidence as they stand now. Returns null when the record is missing, not 'verified', already
 * current, reviewed by its own submitter, or was changed concurrently (optimistic check on every attested field the
 * reviewer saw, so two concurrent re-verifications produce exactly one). The previous attested state is preserved in the audit record.
 */
export async function reverifyVerifiedDependency(
  orgId: string,
  id: string,
  reviewedBy: string,
  reviewNotes: string | undefined,
  attestation?: ExternalAttestationInput,
): Promise<VerifiedDependencyRecord | null> {
  const target = await loadRecord(orgId, id);
  if (!target || target.status !== 'verified' || target.submittedBy === reviewedBy) return null;
  const { context } = await loadGraphEvidenceContext(orgId, [target]);
  const currentness = evaluateRecordCurrentness(target, context);
  if (currentness.current) return null;
  const pair = resolvePairForAttestation(context, target.dependentNodeId, target.dependsOnNodeId);
  const evidence = await attestEvidence(orgId, target, attestation);
  return inOrganization(orgId, async (tx) => {
    const updated = await tx.execute(sql`
      UPDATE ue_verified_dependency_evidence
      SET reviewed_by = ${reviewedBy}, reviewed_at = now(), review_notes = ${reviewNotes ?? null}, updated_at = now(),
        dependent_node_id = ${pair.dependentId},
        depends_on_node_id = ${pair.dependsOnId},
        source_fingerprint = ${pair.fingerprint},
        identity_key_version = ${IDENTITY_KEY_VERSION},
        evidence_document_integrity = ${evidence.documentIntegrity},
        external_attestation = ${evidence.externalAttestation},
        external_attested_by = ${evidence.externalAttestation === null ? null : reviewedBy},
        external_attested_at = ${evidence.externalAttestation === null ? sql`NULL` : sql`now()`}
      WHERE id = ${id}
        AND organization_id = ${orgId}
        AND status = 'verified'
        AND submitted_by <> ${reviewedBy}
        AND source_fingerprint IS NOT DISTINCT FROM ${target.sourceFingerprint}
        AND identity_key_version = ${target.identityKeyVersion}
        AND evidence_document_integrity IS NOT DISTINCT FROM ${target.evidenceDocumentIntegrity}
        AND external_attestation IS NOT DISTINCT FROM ${target.externalAttestation}
      RETURNING *
    `);
    const rows = updated as unknown as VerifiedDependencyRow[];
    if (rows.length === 0) return null;
    await persistAtomicAudit(tx, {
      organizationId: orgId,
      action: 'verified_dependency.reverify',
      resourceType: 'verified_dependency_evidence',
      resourceId: id,
      userId: reviewedBy,
      details: {
        staleReasons: currentness.staleReasons,
        previous: {
          dependentNodeId: target.dependentNodeId,
          dependsOnNodeId: target.dependsOnNodeId,
          sourceFingerprint: target.sourceFingerprint,
          identityKeyVersion: target.identityKeyVersion,
          evidenceDocumentIntegrity: target.evidenceDocumentIntegrity,
          externallyAttested: target.externalAttestation !== null,
        },
      },
    });
    return rowToRecord(rows[0]);
  });
}

/**
 * Revokes a currently-verified record. Returns null when the record does not exist or is not currently verified
 * (already revoked, rejected, or still pending) — revocation narrows what is treated as verified, it never
 * resurrects a rejected or already-revoked row.
 */
export async function revokeVerifiedDependency(
  orgId: string,
  id: string,
  revokedBy: string,
  reviewNotes: string | undefined,
): Promise<VerifiedDependencyRecord | null> {
  return inOrganization(orgId, async (tx) => {
    const updated = await tx.execute(sql`
      UPDATE ue_verified_dependency_evidence
      SET status = 'revoked', reviewed_by = ${revokedBy}, reviewed_at = now(), review_notes = ${reviewNotes ?? null}, updated_at = now()
      WHERE id = ${id}
        AND organization_id = ${orgId}
        AND status = 'verified'
      RETURNING *
    `);
    const rows = updated as unknown as VerifiedDependencyRow[];
    if (rows.length === 0) return null;
    await persistAtomicAudit(tx, {
      organizationId: orgId,
      action: 'verified_dependency.revoke',
      resourceType: 'verified_dependency_evidence',
      resourceId: id,
      userId: revokedBy,
      details: {},
    });
    return rowToRecord(rows[0]);
  });
}

/** Lists verified-dependency evidence for the organization, optionally filtered by status. */
export async function listVerifiedDependencies(
  orgId: string,
  status?: VerifiedDependencyRecord['status'],
): Promise<VerifiedDependencyRecord[]> {
  const rows = await inOrganization(orgId, (tx) =>
    status
      ? tx.execute(sql`SELECT * FROM ue_verified_dependency_evidence WHERE organization_id = ${orgId} AND status = ${status} ORDER BY created_at DESC`)
      : tx.execute(sql`SELECT * FROM ue_verified_dependency_evidence WHERE organization_id = ${orgId} ORDER BY created_at DESC`),
  );
  return (rows as unknown as VerifiedDependencyRow[]).map(rowToRecord);
}

/**
 * The single-pair check for "does dependentNodeId depend on dependsOnNodeId, and is that confirmed right now?". Same
 * evaluator, same identity resolution and same direction rule as loadGraphEvidence: the two references are resolved
 * through aliases, every stored record is resolved the same way, and only a record for the SAME DIRECTED resolved pair
 * is considered. Never falls back to the exploratory graph.
 */
export async function lookupVerifiedDependency(
  orgId: string,
  dependentNodeId: string,
  dependsOnNodeId: string,
): Promise<VerifiedDependencyLookup> {
  const all = await listVerifiedDependencies(orgId);
  const { context } = await loadGraphEvidenceContext(orgId, all);
  const resolve = (ref: string) => resolveNodeReference(context.aliases, context.currentNodeIds, ref);
  const queryDependent = resolve(dependentNodeId);
  const queryDependsOn = resolve(dependsOnNodeId);
  if (queryDependent.status === 'ambiguous' || queryDependsOn.status === 'ambiguous') return { state: 'unavailable', reason: 'node_reference_ambiguous' };
  if (queryDependent.status !== 'resolved' || queryDependsOn.status !== 'resolved') return { state: 'unavailable', reason: 'node_not_current' };

  // A stored reference that no longer resolves still belongs to this pair if it names it verbatim (so its history and
  // stale reasons are reported rather than hidden).
  const idOf = (ref: string) => {
    const r = resolve(ref);
    return r.status === 'resolved' ? r.nodeId : ref;
  };
  const forPair = all.filter((r) => idOf(r.dependentNodeId) === queryDependent.nodeId && idOf(r.dependsOnNodeId) === queryDependsOn.nodeId);

  const staleReasons: EvidenceStaleReason[] = [];
  for (const record of forPair.filter((r) => r.status === 'verified')) {
    const result = evaluateRecordCurrentness(record, context);
    if (result.current) return { state: 'verified', record, evidenceTier: result.dependency.evidenceTier };
    for (const reason of result.staleReasons) if (!staleReasons.includes(reason)) staleReasons.push(reason);
  }
  if (forPair.some((r) => r.status === 'verified')) return { state: 'unavailable', reason: 'requires_reverification', staleReasons };
  // A submission still awaiting review is not yet "revoked or rejected" - that reason is reserved for a decisive
  // negative outcome. Pending (like no submission at all) is just "nothing verified yet".
  const hasPending = forPair.some((r) => r.status === 'pending_review');
  const hasDecisiveNegative = forPair.some((r) => r.status === 'rejected' || r.status === 'revoked');
  if (hasDecisiveNegative && !hasPending) return { state: 'unavailable', reason: 'all_evidence_revoked_or_rejected' };
  return { state: 'unavailable', reason: 'no_verified_evidence_recorded' };
}

/** A record with how the single evaluator judges it right now - what the reviewer interface shows. Only 'verified'
 *  records carry a currentness verdict; the others are not candidates for confirmation at all. */
export interface VerifiedDependencyWithCurrentness extends VerifiedDependencyRecord {
  currentness:
    | { state: 'not_verified' }
    | { state: 'current'; evidenceTier: 'system_resolved_document' | 'human_attested_external'; resolvedDependentNodeId: string; resolvedDependsOnNodeId: string }
    | { state: 'requires_reverification'; staleReasons: EvidenceStaleReason[] };
}

export async function listVerifiedDependenciesWithCurrentness(
  orgId: string,
  status?: VerifiedDependencyRecord['status'],
): Promise<VerifiedDependencyWithCurrentness[]> {
  const records = await listVerifiedDependencies(orgId, status);
  const verified = records.filter((r) => r.status === 'verified');
  const { context } = await loadGraphEvidenceContext(orgId, verified);
  return records.map((record) => {
    if (record.status !== 'verified') return { ...record, currentness: { state: 'not_verified' as const } };
    const result = evaluateRecordCurrentness(record, context);
    return result.current
      ? {
          ...record,
          currentness: {
            state: 'current' as const,
            evidenceTier: result.dependency.evidenceTier,
            resolvedDependentNodeId: result.dependency.dependentNodeId,
            resolvedDependsOnNodeId: result.dependency.dependsOnNodeId,
          },
        }
      : { ...record, currentness: { state: 'requires_reverification' as const, staleReasons: result.staleReasons } };
  });
}
