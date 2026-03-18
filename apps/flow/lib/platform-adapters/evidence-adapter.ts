/**
 * Flow — Evidence Adapter
 *
 * Implements the platform evidence contract for Flow.
 * Exports audit events as evidence artifacts for compliance.
 */
import type { EvidenceContract, EvidenceExport, EvidenceArtifact } from '@nzila/platform-contracts'
import { db, flowDomainEvents } from '@nzila/db'
import { eq, and, gte, lte } from 'drizzle-orm'
import { createHash, randomUUID } from 'node:crypto'
import { logger } from '@/lib/logger'

export const evidenceAdapter: EvidenceContract = {
  async export(orgId: string, fromDate: string, toDate: string): Promise<EvidenceExport> {
    const events = await db
      .select()
      .from(flowDomainEvents)
      .where(
        and(
          eq(flowDomainEvents.orgId, orgId),
          gte(flowDomainEvents.createdAt, new Date(fromDate)),
          lte(flowDomainEvents.createdAt, new Date(toDate)),
        ),
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
      .update(artifacts.map(a => a.hash).join('|'))
      .digest('hex')

    logger.info('Evidence export completed', {
      orgId,
      exportId,
      eventCount: events.length,
      artifactCount: artifacts.length,
    })

    return {
      app: 'flow',
      org_id: orgId,
      export_id: exportId,
      artifacts,
      chain_hash: chainHash,
      exported_at: new Date().toISOString(),
    }
  },
}
