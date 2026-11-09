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
 */

import { sql } from 'drizzle-orm';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { inOrganization } from '../org-scope';
import { buildDependencyPropagationMap } from './dependency-propagator';
import { resolveCurrentNodeId } from './graph-identity';
import type {
  VerifiedDependencyRecord,
  SubmitVerifiedDependencyInput,
  VerifiedDependencyReviewDecision,
  VerifiedDependencyLookup,
} from './verified-dependency-models';

interface VerifiedDependencyRow {
  id: string;
  organization_id: string;
  dependent_node_id: string;
  depends_on_node_id: string;
  process_or_system: string;
  responsible_authority: string;
  evidence_reference: string;
  status: VerifiedDependencyRecord['status'];
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: VerifiedDependencyRow): VerifiedDependencyRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    dependentNodeId: row.dependent_node_id,
    dependsOnNodeId: row.depends_on_node_id,
    processOrSystem: row.process_or_system,
    responsibleAuthority: row.responsible_authority,
    evidenceReference: row.evidence_reference,
    status: row.status,
    submittedBy: row.submitted_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Dependency node ids are derived from mutable interview tag labels (topic-graph-builder.ts), so a submission or a
 * pending review can reference an id that no longer corresponds to any current node - the label changed, the
 * underlying tag fell out of use, or it never existed. Checking against the CURRENT propagation map (not a cached
 * or historical one) at both submission and verification time is what DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-
 * SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE's "validate that submitted dependency references resolve to
 * authorized, existing organizational nodes" requires - this does not retroactively invalidate an ALREADY-verified
 * record if its nodes later drift (lookupVerifiedDependency still returns it; a human reviewer owns revalidation
 * on an explicit re-review), it only gates new submissions and new verifications.
 *
 * Resolution is canonical-identity-tolerant (graph-identity.ts): a node id that differs from a current node only
 * by case, whitespace or punctuation still resolves, closing the collision/drift class the shared evidence
 * contract requires - but a label retired or genuinely renamed into a different canonical key is never guessed at.
 */
async function assertNodesCurrentlyExist(orgId: string, nodeIds: string[]): Promise<void> {
  const propagationMap = await buildDependencyPropagationMap(orgId);
  const currentIds = propagationMap.nodes.map((node) => node.id);
  const unknown = nodeIds.filter((id) => resolveCurrentNodeId(currentIds, id) === null);
  if (unknown.length > 0) {
    throw new Error(`The following node id(s) do not correspond to any current dependency node for this organization: ${unknown.join(', ')}`);
  }
}

/** Submits new verified-dependency evidence. Always starts pending_review — nothing is self-certifying. */
export async function submitVerifiedDependency(
  orgId: string,
  input: SubmitVerifiedDependencyInput,
  submittedBy: string,
): Promise<VerifiedDependencyRecord> {
  if (input.dependentNodeId === input.dependsOnNodeId) {
    throw new Error('dependentNodeId and dependsOnNodeId must differ');
  }
  await assertNodesCurrentlyExist(orgId, [input.dependentNodeId, input.dependsOnNodeId]);
  const rows = await inOrganization(orgId, async (tx) => {
    const inserted = await tx.execute(sql`
      INSERT INTO ue_verified_dependency_evidence
        (organization_id, dependent_node_id, depends_on_node_id, process_or_system, responsible_authority, evidence_reference, status, submitted_by)
      VALUES
        (${orgId}, ${input.dependentNodeId}, ${input.dependsOnNodeId}, ${input.processOrSystem}, ${input.responsibleAuthority}, ${input.evidenceReference}, 'pending_review', ${submittedBy})
      RETURNING *
    `);
    const record = (inserted as unknown as VerifiedDependencyRow[])[0];
    await persistAtomicAudit(tx, {
      organizationId: orgId,
      action: 'verified_dependency.submit',
      resourceType: 'verified_dependency_evidence',
      resourceId: record.id,
      userId: submittedBy,
      details: { dependentNodeId: input.dependentNodeId, dependsOnNodeId: input.dependsOnNodeId },
    });
    return inserted;
  });
  return rowToRecord((rows as unknown as VerifiedDependencyRow[])[0]);
}

/**
 * Reviews a pending submission. Returns null (not found/not reviewable) when the record does not exist, is not
 * pending_review, or the reviewer matches the submitter — a zero-row conditional update, never a silent no-op
 * presented as success.
 */
export async function reviewVerifiedDependency(
  orgId: string,
  id: string,
  decision: VerifiedDependencyReviewDecision,
  reviewedBy: string,
  reviewNotes: string | undefined,
): Promise<VerifiedDependencyRecord | null> {
  if (decision === 'verified') {
    // Re-validate at the moment of verification, not just at submission: time may have passed and the underlying
    // node(s) may no longer exist in the organization's current dependency graph.
    const rows = await inOrganization(orgId, (tx) =>
      tx.execute(sql`SELECT dependent_node_id, depends_on_node_id FROM ue_verified_dependency_evidence WHERE id = ${id} AND organization_id = ${orgId}`),
    );
    const target = (rows as unknown as Array<{ dependent_node_id: string; depends_on_node_id: string }>)[0];
    if (target) await assertNodesCurrentlyExist(orgId, [target.dependent_node_id, target.depends_on_node_id]);
  }
  return inOrganization(orgId, async (tx) => {
    const updated = await tx.execute(sql`
      UPDATE ue_verified_dependency_evidence
      SET status = ${decision}, reviewed_by = ${reviewedBy}, reviewed_at = now(), review_notes = ${reviewNotes ?? null}, updated_at = now()
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
      details: { decision },
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
 * The single check every confirmed-risk, succession, simulation or compliance consumer must call before reporting
 * a dependency between two propagation-map node ids as established. Never falls back to the exploratory graph —
 * an absent or no-longer-current verification reports 'unavailable' with a specific reason, not a guess.
 */
export async function lookupVerifiedDependency(
  orgId: string,
  dependentNodeId: string,
  dependsOnNodeId: string,
): Promise<VerifiedDependencyLookup> {
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      SELECT * FROM ue_verified_dependency_evidence
      WHERE organization_id = ${orgId} AND dependent_node_id = ${dependentNodeId} AND depends_on_node_id = ${dependsOnNodeId}
      ORDER BY created_at DESC
    `),
  );
  const all = (rows as unknown as VerifiedDependencyRow[]).map(rowToRecord);
  const verified = all.find((r) => r.status === 'verified');
  if (verified) return { state: 'verified', record: verified };
  // A submission still awaiting review is not yet "revoked or rejected" - that reason is reserved for a decisive
  // negative outcome. Pending (like no submission at all) is just "nothing verified yet".
  const hasPending = all.some((r) => r.status === 'pending_review');
  const hasDecisiveNegative = all.some((r) => r.status === 'rejected' || r.status === 'revoked');
  if (hasDecisiveNegative && !hasPending) return { state: 'unavailable', reason: 'all_evidence_revoked_or_rejected' };
  return { state: 'unavailable', reason: 'no_verified_evidence_recorded' };
}
