/**
 * Node Alias Store — durable, explicitly-authorized identity/alias mapping (graph-identity.ts's resolveNodeReference).
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
import { canonicalNodeIdentityKey } from './graph-identity';
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
 * Records a new alias, superseding every prior active alias with the same IDENTITY KEY (not just the same raw text -
 * "Payroll" and "payroll " name one label) in the same transaction, so a label never has two active mappings (the
 * unique index on (organization_id, alias_label) WHERE superseded_at IS NULL backs the exact-text case at the
 * database layer). Refuses an alias whose two sides have the same identity key (it would name no migration at all),
 * and an alias whose target is itself an active alias label (aliases are one level deep: no chains, no cycles).
 */
export async function createNodeAlias(orgId: string, input: CreateNodeAliasInput, createdBy: string): Promise<NodeAlias> {
  if (input.aliasLabel.trim().length === 0 || input.canonicalConceptLabel.trim().length === 0) {
    throw new Error('aliasLabel and canonicalConceptLabel must not be empty');
  }
  const aliasKey = canonicalNodeIdentityKey(input.aliasLabel);
  const targetKey = canonicalNodeIdentityKey(input.canonicalConceptLabel);
  if (aliasKey === targetKey) {
    throw new Error('aliasLabel and canonicalConceptLabel must differ');
  }
  return inOrganization(orgId, async (tx) => {
    // Serialize alias decisions per organization so two concurrent creations cannot both leave an active mapping.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ue_graph_node_alias:' || ${orgId}))`);
    const active = (await tx.execute(
      sql`SELECT id, alias_label FROM ue_graph_node_alias WHERE organization_id = ${orgId} AND superseded_at IS NULL`,
    )) as unknown as Array<{ id: string; alias_label: string }>;
    if (active.some((row) => canonicalNodeIdentityKey(row.alias_label) === targetKey)) {
      throw new Error('canonicalConceptLabel is itself an active alias; point the alias at the current label directly');
    }
    const superseded = active.filter((row) => canonicalNodeIdentityKey(row.alias_label) === aliasKey).map((row) => row.id);
    for (const id of superseded) {
      await tx.execute(sql`
        UPDATE ue_graph_node_alias
        SET superseded_by = ${createdBy}, superseded_at = now()
        WHERE id = ${id} AND organization_id = ${orgId} AND superseded_at IS NULL
      `);
    }
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
      details: { aliasLabel: input.aliasLabel, canonicalConceptLabel: input.canonicalConceptLabel, supersededAliasIds: superseded },
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
