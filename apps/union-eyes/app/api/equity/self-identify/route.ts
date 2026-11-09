import { createHash } from 'node:crypto';
import { z } from 'zod';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { equityConsentNoticeVersions, equityPurposeConsents, equitySelfIdentificationRecords } from '@/db/schema';
import { encryptionService } from '@/lib/encryption';

export const dynamic = 'force-dynamic';
const PURPOSE = 'equity_self_identification';
const payloadSchema = z.object({
  genderIdentity: z.enum(['woman', 'man', 'non_binary', 'two_spirit', 'another_identity', 'prefer_not_to_say']).optional(),
  indigenousIdentity: z.array(z.enum(['first_nations', 'inuit', 'metis'])).max(3).optional(),
  racialized: z.boolean().optional(),
  personWithDisability: z.boolean().optional(),
  lgbtq2Plus: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const GET = withApi({ auth: { required: true, minRole: 'member' }, requireOrg: true, openapi: { tags: ['Equity'], summary: 'Read only the caller own active equity self-identification' } }, async ({ organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  return withRLSContext({ organizationId }, async (tx) => {
    const [record] = await tx.select().from(equitySelfIdentificationRecords).where(and(eq(equitySelfIdentificationRecords.organizationId, organizationId), eq(equitySelfIdentificationRecords.subjectUserId, userId), eq(equitySelfIdentificationRecords.purpose, PURPOSE), isNull(equitySelfIdentificationRecords.deletedAt), gt(equitySelfIdentificationRecords.retentionUntil, new Date()))).limit(1);
    if (!record?.encryptedPayload) return { data: null };
    const plaintext = await encryptionService.decrypt(JSON.stringify(record.encryptedPayload), { userId, organizationId, resource: 'equity_self_identification_records', resourceId: record.id, fields: ['self_identification'], reason: 'subject access' });
    return { data: JSON.parse(plaintext), retentionUntil: record.retentionUntil };
  });
});

export const POST = withApi({ auth: { required: true, minRole: 'member' }, requireOrg: true, body: payloadSchema, openapi: { tags: ['Equity'], summary: 'Store encrypted, consent-bound equity self-identification' } }, async ({ organizationId, userId, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  const plaintext = JSON.stringify(body);
  const encrypted = await encryptionService.encrypt(plaintext);
  const payloadDigest = createHash('sha256').update(plaintext).digest('hex');
  return withRLSContext({ organizationId }, async (tx) => {
    const now = new Date();
    const [consent] = await tx.select({ consent: equityPurposeConsents, retentionDays: equityConsentNoticeVersions.retentionDays }).from(equityPurposeConsents).innerJoin(equityConsentNoticeVersions, eq(equityConsentNoticeVersions.id, equityPurposeConsents.noticeVersionId)).where(and(eq(equityPurposeConsents.organizationId, organizationId), eq(equityPurposeConsents.subjectUserId, userId), eq(equityPurposeConsents.purpose, PURPOSE), eq(equityPurposeConsents.status, 'active'), or(isNull(equityPurposeConsents.expiresAt), gt(equityPurposeConsents.expiresAt, now)))).limit(1);
    if (!consent) throw ApiError.forbidden('Active purpose-bound equity consent is required');
    const retentionUntil = new Date(now.getTime() + consent.retentionDays * 86_400_000);
    const [record] = await tx.insert(equitySelfIdentificationRecords).values({ organizationId, subjectUserId: userId, purpose: PURPOSE, consentId: consent.consent.id, encryptedPayload: encrypted as unknown as Record<string, unknown>, payloadDigest, keyVersion: encrypted.keyId ?? encrypted.keyVersion ?? null, retentionUntil, deletedAt: null, updatedAt: now }).onConflictDoUpdate({ target: [equitySelfIdentificationRecords.organizationId, equitySelfIdentificationRecords.subjectUserId, equitySelfIdentificationRecords.purpose], set: { consentId: consent.consent.id, encryptedPayload: encrypted as unknown as Record<string, unknown>, payloadDigest, keyVersion: encrypted.keyId ?? encrypted.keyVersion ?? null, retentionUntil, deletedAt: null, updatedAt: now } }).returning();
    await persistAtomicAudit(tx, { organizationId, userId, action: 'equity.self_identification.stored', resourceType: 'equity_self_identification_records', resourceId: record.id, details: { purpose: PURPOSE, consentId: consent.consent.id, payloadDigest, retentionUntil: retentionUntil.toISOString() } });
    return { status: 'stored', retentionUntil };
  });
});
