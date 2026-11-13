import { createHash, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getCanonicalOrganizationContext } from '@/lib/auth/canonical-context'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { canonicalPythonJson } from '@/lib/audit/canonical-audit-chain'

export interface CanonicalEvidencePackResult {
  packId: string
  orgId: string
  status: 'sealed'
  artifactCount: number
  packHash: string
  storage: 'canonical-postgres'
}

export interface CanonicalEvidenceAction {
  actionType: string
  orgId: string
  actorId: string
  artifacts: Array<{ type: string; data: unknown }>
}

/**
 * Persist the models admitted by V2's storage-authority catalog, not the
 * unrelated @nzila/db document/evidence schema. Django's existing export and
 * verify_seal paths can consume these rows without a schema or grant change.
 */
export async function buildCanonicalUnionEvidencePack(action: CanonicalEvidenceAction): Promise<CanonicalEvidencePackResult> {
  if (!Array.isArray(action.artifacts) || action.artifacts.length < 1 || action.artifacts.length > 20)
    throw new Error('Canonical evidence requires between 1 and 20 artifacts')
  for (const artifact of action.artifacts) {
    const json = JSON.stringify(artifact.data)
    if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(artifact.type) || typeof json !== 'string' || Buffer.byteLength(json) > 1_048_576)
      throw new Error('Invalid canonical evidence artifact')
  }
  const actor = await getCanonicalOrganizationContext({
    organizationId: action.orgId,
    expectedActorUserId: action.actorId,
  })
  const packId = randomUUID()
  const artifacts = action.artifacts.map((artifact, index) => {
    // Preserve the exact supplied JSON as a string inside a Python-compatible
    // envelope. This also avoids JavaScript/Python number-format differences.
    const content = { action_type: action.actionType, artifact_type: artifact.type, payload_json: JSON.stringify(artifact.data) }
    const canonical = canonicalPythonJson(content)
    return {
      id: randomUUID(), sourceId: `${packId}:${index + 1}`, content,
      hash: createHash('sha256').update(canonical, 'utf8').digest('hex'),
      bytes: Buffer.byteLength(canonical, 'utf8'),
    }
  })
  const manifest = Object.fromEntries(artifacts.map(artifact => [artifact.id, artifact.hash]))
  const packHash = createHash('sha256').update(canonicalPythonJson(manifest), 'utf8').digest('hex')
  const totalBytes = artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0)
  await withRLSContext({ organizationId: actor.organizationId }, async tx => {
    await tx.execute(sql`
      INSERT INTO public.evidence_packs
        (id, org_id, pack_type, title, description, status, checksum_manifest, pack_hash,
         sealed_by, artifact_count, total_size_bytes, requested_by, metadata, created_at, updated_at)
      VALUES (${packId}::uuid, ${actor.organizationId}::uuid, 'custom', ${action.actionType.slice(0, 512)},
        'Application-generated Union Eyes action evidence', 'draft', '{}'::jsonb, '', '', 0, 0,
        ${actor.userId}, ${JSON.stringify({ actionType: action.actionType, source: 'union-eyes-v2', encoding: 'python-json-string-envelope-v1' })}::jsonb,
        clock_timestamp(), clock_timestamp())
    `)
    for (const artifact of artifacts) await tx.execute(sql`
      INSERT INTO public.evidence_artifacts
        (id, pack_id, artifact_type, source_id, content, content_hash, size_bytes, created_at)
      VALUES (${artifact.id}::uuid, ${packId}::uuid, 'governance_action', ${artifact.sourceId},
        ${JSON.stringify(artifact.content)}::jsonb, ${artifact.hash}, ${artifact.bytes}, clock_timestamp())
    `)
    const sealed = await tx.execute(sql`
      UPDATE public.evidence_packs
      SET status = 'sealed', checksum_manifest = ${JSON.stringify(manifest)}::jsonb, pack_hash = ${packHash},
        sealed_at = clock_timestamp(), sealed_by = ${actor.userId}, artifact_count = ${artifacts.length},
        total_size_bytes = ${totalBytes}, updated_at = clock_timestamp()
      WHERE id = ${packId}::uuid AND org_id = ${actor.organizationId}::uuid AND status = 'draft'
      RETURNING id
    `)
    if (sealed.length !== 1) throw new Error('Canonical evidence pack could not be sealed')
    await persistAtomicAudit(tx, {
      organizationId: actor.organizationId, userId: actor.userId,
      action: 'evidence.pack.seal', resourceType: 'evidence_packs', resourceId: packId,
      details: { actionType: action.actionType, artifactCount: artifacts.length, packHash },
    })
  })
  return { packId, orgId: actor.organizationId, status: 'sealed', artifactCount: artifacts.length, packHash, storage: 'canonical-postgres' }
}
