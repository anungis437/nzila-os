import { and, eq, isNull, lte } from 'drizzle-orm';
import { equityPurposeConsents, equitySelfIdentificationRecords } from '@/db/schema';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';

const ACTOR = 'system:equity-retention';

/** Erases expired sensitive payloads and expires lapsed grants, with evidence in the same transaction. */
export async function enforceEquityRetention(tx: RLSTx, now = new Date(), limit = 200) {
  const due = await tx.select({ id: equitySelfIdentificationRecords.id, organizationId: equitySelfIdentificationRecords.organizationId })
    .from(equitySelfIdentificationRecords)
    .where(and(isNull(equitySelfIdentificationRecords.deletedAt), lte(equitySelfIdentificationRecords.retentionUntil, now)))
    .limit(limit)
    .for('update', { skipLocked: true });
  let erased = 0;
  for (const row of due) {
    const updated = await tx.update(equitySelfIdentificationRecords)
      .set({ encryptedPayload: null, keyVersion: null, deletedAt: now, updatedAt: now })
      .where(and(eq(equitySelfIdentificationRecords.id, row.id), isNull(equitySelfIdentificationRecords.deletedAt)))
      .returning({ id: equitySelfIdentificationRecords.id });
    if (updated.length === 0) continue;
    erased += 1;
    await persistAtomicAudit(tx, { organizationId: row.organizationId, userId: ACTOR, action: 'equity.self_identification.retention_erased', resourceType: 'equity_self_identification_records', resourceId: row.id, details: { retentionUntilReached: true } });
  }

  const lapsed = await tx.update(equityPurposeConsents)
    .set({ status: 'expired' })
    .where(and(eq(equityPurposeConsents.status, 'active'), lte(equityPurposeConsents.expiresAt, now)))
    .returning({ id: equityPurposeConsents.id, organizationId: equityPurposeConsents.organizationId });
  for (const row of lapsed) {
    await persistAtomicAudit(tx, { organizationId: row.organizationId, userId: ACTOR, action: 'equity.consent.expired', resourceType: 'equity_purpose_consents', resourceId: row.id, details: {} });
  }
  return { erased, consentsExpired: lapsed.length };
}
