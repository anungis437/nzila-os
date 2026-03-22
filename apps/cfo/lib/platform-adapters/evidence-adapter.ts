/**
 * CFO — Evidence Adapter
 * Implements the platform evidence contract for CFO.
 * Exports audit events as evidence artifacts for compliance.
 */
import type {
  EvidenceContract,
  EvidenceExport,
  EvidenceArtifact,
} from '@nzila/platform-contracts'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { createHash, randomUUID } from 'node:crypto'
import { logger } from '@/lib/logger'

export const evidenceAdapter: EvidenceContract = {
  async export(
    orgId: string,
    fromDate: string,
    toDate: string,
  ): Promise<EvidenceExport> {
    const events = await platformDb.execute(
      sql`SELECT *
        FROM audit_log
        WHERE org_id = ${orgId}
          AND created_at >= ${fromDate}
          AND created_at <= ${toDate}
        ORDER BY created_at ASC`,
    )

    const exportId = randomUUID()
    const artifacts: EvidenceArtifact[] = []

    // Create event log artifact
    const eventJson = JSON.stringify(events, null, 2)
    const eventHash = createHash('sha256').update(eventJson).digest('hex')

    artifacts.push({
      artifact_id: randomUUID(),
      type: 'domain_event_log',
      format: 'json',
      size_bytes: Buffer.byteLength(eventJson, 'utf-8'),
      hash: eventHash,
      generated_at: new Date().toISOString(),
    })

    // Chain hash for tamper detection
    const chainHash = createHash('sha256')
      .update(artifacts.map((a) => a.hash).join('|'))
      .digest('hex')

    logger.info('Evidence export completed', {
      orgId,
      exportId,
      eventCount: (events as unknown as unknown[]).length,
      artifactCount: artifacts.length,
    })

    return {
      app: 'cfo',
      org_id: orgId,
      export_id: exportId,
      artifacts,
      chain_hash: chainHash,
      exported_at: new Date().toISOString(),
    }
  },
}
