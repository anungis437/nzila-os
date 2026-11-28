/**
 * Authorizing, revoking and versioning an inbound source (INT-11, INT-12).
 *
 * Each runs in the caller's tenant transaction and records its mandatory audit in that transaction. The caller decides
 * who may do it (an organization administrator); these functions record who did. Revocation is terminal and stops new
 * ingest at the database (the receipt guard refuses a claim on a revoked source); cases, links and receipts that already
 * exist are kept. A mapping version is immutable: a change is a new version, and a receipt keeps the version it ran.
 */
import { sql } from 'drizzle-orm'
import type { MappingRuleDefinition } from '@nzila/platform-integrations-types'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { canonicalJson, rowsOf, sha256 } from './durable-inbound-executor'

export async function authorizeInboundSource(
  tx: RLSTx,
  input: { organizationId: string; sourceKey: string; actorId: string },
): Promise<{ sourceId: string }> {
  const [row] = rowsOf<{ id: string }>(await tx.execute(sql`
    INSERT INTO ue_integration_sources (organization_id, source_key, authorized_by)
    VALUES (${input.organizationId}::uuid, ${input.sourceKey}, ${input.actorId})
    RETURNING id::text`))
  await persistAtomicAudit(tx, {
    organizationId: input.organizationId, action: 'integration.source.authorized', resourceType: 'integration_source',
    resourceId: row.id, userId: input.actorId, details: { sourceKey: input.sourceKey },
  })
  return { sourceId: row.id }
}

export async function revokeInboundSource(
  tx: RLSTx,
  input: { organizationId: string; sourceKey: string; actorId: string; reason: string },
): Promise<{ revoked: boolean }> {
  if (!input.reason.trim()) throw new Error('INBOUND_SOURCE_REVOCATION_REASON_REQUIRED')
  const [row] = rowsOf<{ id: string }>(await tx.execute(sql`
    UPDATE ue_integration_sources
    SET status = 'revoked', revoked_by = ${input.actorId}, revoked_at = now(), revocation_reason = ${input.reason.trim()}
    WHERE organization_id = ${input.organizationId}::uuid AND source_key = ${input.sourceKey} AND status = 'active'
    RETURNING id::text`))
  if (!row) return { revoked: false }
  await persistAtomicAudit(tx, {
    organizationId: input.organizationId, action: 'integration.source.revoked', resourceType: 'integration_source',
    resourceId: row.id, userId: input.actorId, details: { sourceKey: input.sourceKey },
  })
  return { revoked: true }
}

export async function publishMappingVersion(
  tx: RLSTx,
  input: { organizationId: string; sourceKey: string; actorId: string; sourceSchemaVersion: string; rule: MappingRuleDefinition },
): Promise<{ version: number; ruleDigest: string }> {
  if (input.rule.targetEntityType !== 'case') throw new Error('INBOUND_MAPPING_TARGET_UNSUPPORTED')
  const ruleDigest = sha256(canonicalJson(input.rule))
  // The next number is taken under the source's row lock, so two publishers never claim the same version.
  const [source] = rowsOf<{ id: string; status: string }>(await tx.execute(sql`
    SELECT id::text, status FROM ue_integration_sources
    WHERE organization_id = ${input.organizationId}::uuid AND source_key = ${input.sourceKey}
    FOR UPDATE`))
  if (!source) throw new Error('INBOUND_SOURCE_NOT_AUTHORIZED')
  if (source.status !== 'active') throw new Error('INBOUND_SOURCE_REVOKED')
  const [row] = rowsOf<{ version: number }>(await tx.execute(sql`
    INSERT INTO ue_integration_mapping_versions
      (organization_id, source_id, version, target_entity, source_schema_version, rule, rule_digest, created_by)
    SELECT ${input.organizationId}::uuid, ${source.id}::uuid, coalesce(max(version), 0) + 1, 'case', ${input.sourceSchemaVersion},
      ${JSON.stringify(input.rule)}::jsonb, ${ruleDigest}, ${input.actorId}
    FROM ue_integration_mapping_versions WHERE organization_id = ${input.organizationId}::uuid AND source_id = ${source.id}::uuid
    RETURNING version`))
  await persistAtomicAudit(tx, {
    organizationId: input.organizationId, action: 'integration.mapping.published', resourceType: 'integration_source',
    resourceId: source.id, userId: input.actorId, details: { version: row.version, ruleDigest, sourceSchemaVersion: input.sourceSchemaVersion },
  })
  return { version: row.version, ruleDigest }
}
