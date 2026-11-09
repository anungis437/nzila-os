import { createHash } from 'node:crypto';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { equityDisclosureGrants, equityPurposeConsents, equitySelfIdentificationRecords } from '@/db/schema';
import { encryptionService } from '@/lib/encryption';
import { projectEquitySnapshot } from '@/lib/equity/equity-snapshot-projection';

export const dynamic = 'force-dynamic';
const PURPOSE = 'equity_aggregate_monitoring';

export const GET = withApi({ auth: { required: true, minRole: 'officer' }, requireOrg: true, openapi: { tags: ['Equity'], summary: 'Read a small-cell-suppressed equity aggregate under an explicit grant' } }, async ({ organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  return withRLSContext({ organizationId }, async (tx) => {
    const now = new Date();
    const [grant] = await tx.select().from(equityDisclosureGrants).where(and(eq(equityDisclosureGrants.organizationId, organizationId), eq(equityDisclosureGrants.granteeUserId, userId), eq(equityDisclosureGrants.purpose, PURPOSE), eq(equityDisclosureGrants.aggregateOnly, true), isNull(equityDisclosureGrants.revokedAt), gt(equityDisclosureGrants.expiresAt, now))).limit(1);
    if (!grant || grant.minimumCellSize < 10) throw ApiError.forbidden('An active aggregate-only equity disclosure grant is required');
    const records = await tx.select({ id: equitySelfIdentificationRecords.id, encryptedPayload: equitySelfIdentificationRecords.encryptedPayload }).from(equitySelfIdentificationRecords).innerJoin(equityPurposeConsents, eq(equityPurposeConsents.id, equitySelfIdentificationRecords.consentId)).where(and(eq(equitySelfIdentificationRecords.organizationId, organizationId), eq(equityPurposeConsents.organizationId, organizationId), eq(equitySelfIdentificationRecords.purpose, 'equity_self_identification'), eq(equityPurposeConsents.purpose, 'equity_self_identification'), isNull(equitySelfIdentificationRecords.deletedAt), gt(equitySelfIdentificationRecords.retentionUntil, now), eq(equityPurposeConsents.status, 'active'), or(isNull(equityPurposeConsents.expiresAt), gt(equityPurposeConsents.expiresAt, now))));
    const values: Array<Record<string, unknown>> = [];
    for (const record of records) {
      if (!record.encryptedPayload) continue;
      const plaintext = await encryptionService.decrypt(JSON.stringify(record.encryptedPayload), { userId, organizationId, resource: 'equity_self_identification_records', resourceId: record.id, fields: ['aggregate_only'], reason: PURPOSE });
      values.push(JSON.parse(plaintext) as Record<string, unknown>);
    }
    const count = (predicate: (value: Record<string, unknown>) => boolean) => values.filter(predicate).length;
    const snapshot = projectEquitySnapshot({
      totalMembers: values.length,
      totalConsentGiven: values.length,
      womenCount: count((value) => value.genderIdentity === 'woman'),
      menCount: count((value) => value.genderIdentity === 'man'),
      nonBinaryCount: count((value) => ['non_binary', 'two_spirit', 'another_identity'].includes(String(value.genderIdentity))),
      genderNotDisclosed: count((value) => value.genderIdentity === 'prefer_not_to_say' || value.genderIdentity === undefined),
      visibleMinorityCount: count((value) => value.racialized === true),
      indigenousCount: count((value) => Array.isArray(value.indigenousIdentity) && value.indigenousIdentity.length > 0),
      personsWithDisabilitiesCount: count((value) => value.personWithDisability === true),
      lgbtq2PlusCount: count((value) => value.lgbtq2Plus === true),
    }, grant.minimumCellSize);
    const disclosureDigest = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    await persistAtomicAudit(tx, { organizationId, userId, action: 'equity.aggregate.disclosed', resourceType: 'equity_disclosure_grants', resourceId: grant.id, details: { purpose: PURPOSE, disclosureDigest, contributingRecordCount: values.length, suppression: snapshot.suppression } });
    return { ...snapshot, disclosureDigest };
  });
});
