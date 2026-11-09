import { z } from 'zod';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { equityConsentNoticeVersions, equityPurposeConsents, equitySelfIdentificationRecords } from '@/db/schema';

export const dynamic = 'force-dynamic';
const PURPOSE = 'equity_self_identification';
const grantSchema = z.object({ noticeVersionId: zUUID, granted: z.literal(true) }).strict();
const withdrawSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

export const GET = withApi({ auth: { required: true, minRole: 'member' }, requireOrg: true, openapi: { tags: ['Equity'], summary: 'Read the reviewed equity notice and the caller consent state' } }, async ({ organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  return withRLSContext({ organizationId }, async (tx) => {
    const now = new Date();
    const notices = await tx.select().from(equityConsentNoticeVersions).where(and(eq(equityConsentNoticeVersions.purpose, PURPOSE), eq(equityConsentNoticeVersions.status, 'reviewed'), lte(equityConsentNoticeVersions.effectiveFrom, now), or(isNull(equityConsentNoticeVersions.effectiveUntil), gt(equityConsentNoticeVersions.effectiveUntil, now)))).orderBy(desc(equityConsentNoticeVersions.version)).limit(2);
    if (notices.length !== 1) throw ApiError.capabilityUnavailable(notices.length ? 'Equity notice versions overlap; consent is unavailable' : 'No reviewed equity consent notice is active');
    const [consent] = await tx.select().from(equityPurposeConsents).where(and(eq(equityPurposeConsents.organizationId, organizationId), eq(equityPurposeConsents.subjectUserId, userId), eq(equityPurposeConsents.purpose, PURPOSE), eq(equityPurposeConsents.status, 'active'))).limit(1);
    return { notice: notices[0], consent: consent ?? null };
  });
});

export const POST = withApi({ auth: { required: true, minRole: 'member' }, requireOrg: true, body: grantSchema, openapi: { tags: ['Equity'], summary: 'Grant purpose-bound equity self-identification consent' } }, async ({ organizationId, userId, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  return withRLSContext({ organizationId }, async (tx) => {
    const now = new Date();
    const [notice] = await tx.select().from(equityConsentNoticeVersions).where(and(eq(equityConsentNoticeVersions.id, body.noticeVersionId), eq(equityConsentNoticeVersions.purpose, PURPOSE), eq(equityConsentNoticeVersions.status, 'reviewed'), lte(equityConsentNoticeVersions.effectiveFrom, now), or(isNull(equityConsentNoticeVersions.effectiveUntil), gt(equityConsentNoticeVersions.effectiveUntil, now)))).limit(1);
    if (!notice) throw ApiError.conflict('The consent notice is not the current reviewed notice');
    await tx.update(equityPurposeConsents).set({ status: 'expired', expiresAt: now }).where(and(eq(equityPurposeConsents.organizationId, organizationId), eq(equityPurposeConsents.subjectUserId, userId), eq(equityPurposeConsents.purpose, PURPOSE), eq(equityPurposeConsents.status, 'active')));
    const [consent] = await tx.insert(equityPurposeConsents).values({ organizationId, subjectUserId: userId, purpose: PURPOSE, noticeVersionId: notice.id, status: 'active' }).returning();
    await persistAtomicAudit(tx, { organizationId, userId, action: 'equity.consent.granted', resourceType: 'equity_purpose_consents', resourceId: consent.id, details: { purpose: PURPOSE, noticeVersionId: notice.id, noticeVersion: notice.version } });
    return { consent };
  });
});

export const DELETE = withApi({ auth: { required: true, minRole: 'member' }, requireOrg: true, body: withdrawSchema, openapi: { tags: ['Equity'], summary: 'Withdraw equity consent and erase the encrypted self-identification payload' } }, async ({ organizationId, userId, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  return withRLSContext({ organizationId }, async (tx) => {
    const now = new Date();
    const [consent] = await tx.update(equityPurposeConsents).set({ status: 'withdrawn', withdrawnAt: now, withdrawalReason: body.reason }).where(and(eq(equityPurposeConsents.organizationId, organizationId), eq(equityPurposeConsents.subjectUserId, userId), eq(equityPurposeConsents.purpose, PURPOSE), eq(equityPurposeConsents.status, 'active'))).returning();
    if (!consent) throw ApiError.conflict('No active equity consent exists');
    const erased = await tx.update(equitySelfIdentificationRecords).set({ encryptedPayload: null, deletedAt: now, updatedAt: now }).where(and(eq(equitySelfIdentificationRecords.organizationId, organizationId), eq(equitySelfIdentificationRecords.subjectUserId, userId), eq(equitySelfIdentificationRecords.purpose, PURPOSE))).returning({ id: equitySelfIdentificationRecords.id });
    await persistAtomicAudit(tx, { organizationId, userId, action: 'equity.consent.withdrawn', resourceType: 'equity_purpose_consents', resourceId: consent.id, details: { purpose: PURPOSE, erasedRecordIds: erased.map((row) => row.id) } });
    return { status: 'withdrawn', erasedRecords: erased.length };
  });
});
