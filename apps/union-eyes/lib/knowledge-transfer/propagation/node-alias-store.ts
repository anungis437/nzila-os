/**
 * Node Alias Store — durable, explicitly-authorized identity/alias mapping (graph-identity.ts's resolveConceptLabel).
 * Uses the ue_graph_node_alias table (platform migration 0086, RLS scoped 0060). This module never issues DDL and
 * every statement runs on the tenant runtime identity via inOrganization/withRLSContext.
 *
 * An alias is never inferred - it is always an explicit, audited action by an authorized reviewer (same floor as
 * verified-dependency review: national_officer+, see app/api/exit-interviews/node-aliases/route.ts), recorded with
 * a reason. Creating a new alias for a label that already has an active one SUPERSEDES the prior entry (sets its
 * supersededBy/supersededAt) rather than deleting it, so the full history of identity decisions for a label is
 * preserved - never a destructive rewrite.
 */
import { sql } from 'drizzle-orm';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { inOrganization } from '../org-scope';
import type { NodeAlias, CreateNodeAliasInput } from './verified-dependency-models';

interface NodeAliasRow {
  id: string;
  organization_id: string;
  alias_label: string;
  canonical_concept_label: string;
  reason: string;
  created_by: string;
  created_at: string;
  superseded_by: string | null;
  superseded_at: string | null;
}

function rowToAlias(row: NodeAliasRow): NodeAlias {
  return {
    id: row.id,
    organizationId: row.organization_id,
    aliasLabel: row.alias_label,
    canonicalConceptLabel: row.canonical_concept_label,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    supersededBy: row.superseded_by,
    supersededAt: row.superseded_at,
  };
}

/**
 * Records a new alias, superseding any prior active alias for the same label in the same transaction (never a
 * silent duplicate active mapping - the unique index on (organization_id, alias_label) WHERE superseded_at IS NULL
 * enforces this at the database layer too). Refuses a self-referential alias (a label aliased to itself names no
 * migration at all).
 */
export async function createNodeAlias(orgId: string, input: CreateNodeAliasInput, createdBy: string): Promise<NodeAlias> {
  if (input.aliasLabel.trim().length === 0 || input.canonicalConceptLabel.trim().length === 0) {
    throw new Error('aliasLabel and canonicalConceptLabel must not be empty');
  }
  if (input.aliasLabel === input.canonicalConceptLabel) {
    throw new Error('aliasLabel and canonicalConceptLabel must differ');
  }
  return inOrganization(orgId, async (tx) => {
    await tx.execute(sql`
      UPDATE ue_graph_node_alias
      SET superseded_by = ${createdBy}, superseded_at = now()
      WHERE organization_id = ${orgId} AND alias_label = ${input.aliasLabel} AND superseded_at IS NULL
    `);
    const inserted = await tx.execute(sql`
      INSERT INTO ue_graph_node_alias (organization_id, alias_label, canonical_concept_label, reason, created_by)
      VALUES (${orgId}, ${input.aliasLabel}, ${input.canonicalConceptLabel}, ${input.reason}, ${createdBy})
      RETURNING *
    `);
    const record = (inserted as unknown as NodeAliasRow[])[0];
    await persistAtomicAudit(tx, {
      organizationId: orgId,
      action: 'graph_node_alias.create',
      resourceType: 'ue_graph_node_alias',
      resourceId: record.id,
      userId: createdBy,
      details: { aliasLabel: input.aliasLabel, canonicalConceptLabel: input.canonicalConceptLabel },
    });
    return rowToAlias(record);
  });
}

/** Every currently-active (non-superseded) alias for the organization. */
export async function listActiveNodeAliases(orgId: string): Promise<NodeAlias[]> {
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`SELECT * FROM ue_graph_node_alias WHERE organization_id = ${orgId} AND superseded_at IS NULL ORDER BY created_at DESC`),
  );
  return (rows as unknown as NodeAliasRow[]).map(rowToAlias);
}

/** Full alias history for the organization, active and superseded, newest first - for audit/UI display. */
export async function listAllNodeAliases(orgId: string): Promise<NodeAlias[]> {
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`SELECT * FROM ue_graph_node_alias WHERE organization_id = ${orgId} ORDER BY created_at DESC`),
  );
  return (rows as unknown as NodeAliasRow[]).map(rowToAlias);
}
