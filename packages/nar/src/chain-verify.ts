import type { NarChainVerificationResult, NarRecord } from './types'
import { verifyNarRecord } from './record'

export async function detectTampering(
  records: NarRecord[],
  options?: { signingSecret?: string },
): Promise<NarChainVerificationResult['anomalies']> {
  const anomalies: NarChainVerificationResult['anomalies'] = []

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const verification = await verifyNarRecord(record, options?.signingSecret)

    if (!verification.valid) {
      anomalies.push({
        index,
        recordId: record.id,
        reason: verification.errors.join('; '),
      })
    }

    if (index === 0) {
      if (record.seal.previousHash) {
        anomalies.push({
          index,
          recordId: record.id,
          reason: 'Genesis record must not contain previousHash',
        })
      }
      continue
    }

    const previous = records[index - 1]
    if (record.seal.previousHash !== previous.seal.hash) {
      anomalies.push({
        index,
        recordId: record.id,
        reason: `Chain break: expected previousHash ${previous.seal.hash} but found ${record.seal.previousHash ?? 'null'}`,
      })
    }
  }

  return anomalies
}

export async function verifyFullChain(args: {
  organizationId: string
  records: NarRecord[]
  signingSecret?: string
}): Promise<NarChainVerificationResult> {
  const sorted = [...args.records].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  const anomalies = await detectTampering(sorted, { signingSecret: args.signingSecret })
  const corruptionIndex = anomalies.length > 0 ? Math.min(...anomalies.map((item) => item.index)) : undefined

  return {
    organizationId: args.organizationId,
    totalRecords: sorted.length,
    valid: anomalies.length === 0,
    corruptionIndex,
    anomalies,
    rootHash: sorted[sorted.length - 1]?.seal.hash,
  }
}
