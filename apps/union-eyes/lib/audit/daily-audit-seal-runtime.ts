import { sql } from 'drizzle-orm'
import { getBuildMetadata } from '@nzila/os-core/health'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { auditPartitions, auditSealFreshness, inspectAuditPartition, sealAuditPartition } from './daily-audit-seal-store'
import { auditSealKeyFingerprint } from './daily-audit-seal'

function sealKey() {
  const key = process.env.EVIDENCE_SEAL_KEY ?? ''
  auditSealKeyFingerprint(key) // No test/development fallback for operational evidence.
  return key
}

export async function runDailyAuditSeals() {
  const started = Date.now()
  const key = sealKey()
  const sourceSha = getBuildMetadata('union-eyes').gitSha
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error('UE_AUDIT_SEAL_SOURCE_UNAVAILABLE')
  const partitions = await withSystemContext(tx => auditPartitions(tx))
  let created = 0, existing = 0
  const failures: { scope: string; reason: string }[] = []
  for (const organizationId of partitions) {
    if (Date.now() - started > 150_000) {
      failures.push({ scope: organizationId ?? 'platform', reason: 'Audit sealing run budget exhausted; partition not processed' })
      continue
    }
    try {
      const result = await withSystemContext(async tx => {
        await tx.execute(sql`SET LOCAL statement_timeout = '10s'`)
        await tx.execute(sql`SET LOCAL lock_timeout = '3s'`)
        return sealAuditPartition(tx, { organizationId, sourceSha, key })
      })
      if (result.created) created++
      else existing++
    } catch {
      failures.push({ scope: organizationId ?? 'platform', reason: 'Audit history verification or durable checkpoint failed' })
    }
  }
  return { job: 'daily-audit-seal', attempted: partitions.length,
    succeeded: created + existing, failures, details: { created, existing, sourceSha } }
}

export async function probeDailyAuditSeals() {
  const started = Date.now()
  try {
    const key = sealKey()
    const keys = new Map([[auditSealKeyFingerprint(key), key]])
    const partitions = await withSystemContext(tx => auditPartitions(tx))
    let verified = 0
    for (const organizationId of partitions) {
      if (Date.now() - started > 90_000) throw new Error('UE_AUDIT_SEAL_RUN_BUDGET')
      const inspected = await withSystemContext(async tx => {
        await tx.execute(sql`SET LOCAL statement_timeout = '10s'`)
        return inspectAuditPartition(tx, organizationId, keys)
      })
      if (!auditSealFreshness(inspected.latestSeal?.sealedAt ?? null)) {
        return { state: 'fail' as const, note: 'A daily audit checkpoint is missing or stale', verifiedPartitions: verified }
      }
      verified++
    }
    return { state: 'ok' as const, note: 'Canonical chains and keyed daily checkpoints verified', verifiedPartitions: verified }
  } catch {
    return { state: 'fail' as const, note: 'Audit checkpoint integrity could not be verified' }
  }
}
