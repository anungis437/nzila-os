import { createHash } from 'node:crypto'
import type { ConsentRecord } from './types.js'

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

export class ConsentService {
  private records = new Map<string, ConsentRecord>()

  recordConsent(
    orgId: string,
    subjectId: string,
    purpose: string,
    granted: boolean,
    expiresAt?: string,
  ): ConsentRecord {
    const now = new Date().toISOString()
    const record: ConsentRecord = {
      id: generateId(`consent:${orgId}:${subjectId}:${purpose}:${now}`),
      orgId,
      subjectId,
      purpose,
      granted,
      grantedAt: now,
      expiresAt,
    }
    this.records.set(`${orgId}:${subjectId}:${purpose}`, record)
    return record
  }

  revokeConsent(orgId: string, consentId: string): ConsentRecord {
    const record = Array.from(this.records.values()).find(
      (r) => r.orgId === orgId && r.id === consentId,
    )
    if (!record) throw new Error(`Consent record not found: ${consentId}`)
    const revoked: ConsentRecord = {
      ...record,
      revokedAt: new Date().toISOString(),
      granted: false,
    }
    this.records.set(`${orgId}:${record.subjectId}:${record.purpose}`, revoked)
    return revoked
  }

  getConsent(orgId: string, subjectId: string, purpose: string): ConsentRecord | null {
    return this.records.get(`${orgId}:${subjectId}:${purpose}`) ?? null
  }

  isConsentActive(record: ConsentRecord): boolean {
    if (!record.granted) return false
    if (record.revokedAt) return false
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) return false
    return true
  }
}
