import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { billingAutomationMandates } from '@/db/schema';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

const issueSchema = z.object({ validFrom: z.string().datetime(), validUntil: z.string().datetime() }).strict();
const idSchema = z.object({ mandateId: z.guid() }).strict();

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' }, body: issueSchema, openapi: { tags: ['Billing'], summary: 'Issue a pending tenant billing automation mandate' } },
  async ({ organizationId, userId, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    const validFrom = new Date(body.validFrom);
    const validUntil = new Date(body.validUntil);
    if (validUntil <= validFrom || validUntil.getTime() - validFrom.getTime() > 366 * 86400_000) {
      throw ApiError.badRequest('Mandate validity must be positive and no longer than 366 days');
    }
    return withRLSContext({ organizationId, userId }, async (tx) => {
      await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:execute', requiresLedger: true });
      const [row] = await tx.insert(billingAutomationMandates).values({
        organizationId,
        status: 'pending',
        cadence: 'monthly',
        issuedBy: userId,
        validFrom,
        validUntil,
      }).returning();
      await persistAtomicAudit(tx, { organizationId, userId, action: 'billing.automation_mandate.issued', resourceType: 'billing_automation_mandates', resourceId: row.id, details: { validFrom: body.validFrom, validUntil: body.validUntil } });
      return { data: row };
    });
  },
);

export const PATCH = withApi(
  { auth: { required: true, minRole: 'admin' }, body: idSchema, openapi: { tags: ['Billing'], summary: 'Independently approve a tenant billing automation mandate' } },
  async ({ organizationId, userId, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    return withRLSContext({ organizationId, userId }, async (tx) => {
      await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:approve', requiresLedger: true });
      const [row] = await tx.update(billingAutomationMandates).set({ status: 'active', approvedBy: userId, approvedAt: new Date(), updatedAt: new Date() }).where(and(
        eq(billingAutomationMandates.id, body.mandateId),
        eq(billingAutomationMandates.organizationId, organizationId),
        eq(billingAutomationMandates.status, 'pending'),
        gt(billingAutomationMandates.validUntil, new Date()),
        isNull(billingAutomationMandates.approvedBy),
        // The issuer cannot approve their own automation authority.
        sql`${billingAutomationMandates.issuedBy} <> ${userId}`,
      )).returning();
      if (!row) throw ApiError.conflict('Mandate is unavailable, expired, changed, or self-approval was attempted');
      await persistAtomicAudit(tx, { organizationId, userId, action: 'billing.automation_mandate.approved', resourceType: 'billing_automation_mandates', resourceId: row.id, details: { mandateId: row.id } });
      return { data: row };
    });
  },
);

export const DELETE = withApi(
  { auth: { required: true, minRole: 'admin' }, body: idSchema, openapi: { tags: ['Billing'], summary: 'Revoke a tenant billing automation mandate' } },
  async ({ organizationId, userId, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    return withRLSContext({ organizationId, userId }, async (tx) => {
      await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:execute', requiresLedger: true });
      const [row] = await tx.update(billingAutomationMandates).set({ status: 'revoked', revokedBy: userId, revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(billingAutomationMandates.id, body.mandateId), eq(billingAutomationMandates.organizationId, organizationId), eq(billingAutomationMandates.status, 'active'))).returning();
      if (!row) throw ApiError.notFound('Active automation mandate not found');
      await persistAtomicAudit(tx, { organizationId, userId, action: 'billing.automation_mandate.revoked', resourceType: 'billing_automation_mandates', resourceId: row.id, details: { mandateId: row.id } });
      return { data: row };
    });
  },
);
