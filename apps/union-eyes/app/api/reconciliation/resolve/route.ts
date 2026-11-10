import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { withRLSContext } from '@/lib/db/with-rls-context';
import {
  reconciliationExceptions,
  reconciliationResolutionDecisions,
  reconciliationResolutionPostings,
} from '@/db/schema';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  exceptionId: z.guid(),
  disposition: z.enum(['adjustment', 'write_off']),
  notes: z.string().trim().min(10).max(2000),
  evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const approveSchema = z.object({ decisionId: z.guid() }).strict();
const correctSchema = z.object({ postingId: z.guid(), reason: z.string().trim().min(10).max(2000) }).strict();

function postingAccounts() {
  const debitAccount = process.env.UE_RECONCILIATION_DEBIT_ACCOUNT?.trim();
  const creditAccount = process.env.UE_RECONCILIATION_CREDIT_ACCOUNT?.trim();
  if (!debitAccount || !creditAccount || debitAccount === creditAccount) {
    throw ApiError.capabilityUnavailable('Institution-approved reconciliation debit and credit accounts are not configured');
  }
  return { debitAccount, creditAccount };
}

export const POST = withApi(
  {
    rlsOrgContext: true,
    auth: { minRole: 'admin' },
    entitlement: 'commercial_reporting',
    body: requestSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: { tags: ['Reconciliation'], summary: 'Request an evidenced reconciliation disposition' },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    return withRLSContext({ organizationId, userId }, async (tx) => {
      await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:reconcile', resourceId: body.exceptionId });
      const [exception] = await tx
        .select({ id: reconciliationExceptions.id, status: reconciliationExceptions.status, varianceCad: reconciliationExceptions.varianceCad })
        .from(reconciliationExceptions)
        .where(and(
          eq(reconciliationExceptions.id, body.exceptionId),
          eq(reconciliationExceptions.organizationId, organizationId),
          inArray(reconciliationExceptions.status, ['open', 'under_review']),
        ))
        .limit(1)
        .for('update');
      if (!exception) throw ApiError.notFound('Reconciliation exception');
      const amount = Math.abs(Number(exception.varianceCad ?? 0));
      if (!Number.isFinite(amount) || amount <= 0) throw ApiError.badRequest('Exception has no non-zero supported variance to post');

      const [decision] = await tx.insert(reconciliationResolutionDecisions).values({
        organizationId,
        exceptionId: exception.id,
        disposition: body.disposition,
        status: 'pending',
        requestedBy: userId,
        evidenceDigest: body.evidenceDigest,
        notes: body.notes,
      }).onConflictDoNothing().returning();
      if (!decision) throw ApiError.conflict('A disposition decision already exists for this exception');
      await tx.update(reconciliationExceptions).set({ status: 'under_review', updatedAt: new Date() }).where(and(eq(reconciliationExceptions.id, exception.id), eq(reconciliationExceptions.organizationId, organizationId)));
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'reconciliation.disposition.requested',
        resourceType: 'reconciliation_resolution_decision',
        resourceId: decision.id,
        details: { exceptionId: exception.id, disposition: body.disposition, evidenceDigest: body.evidenceDigest },
      });
      return { data: decision };
    });
  },
);

export const PATCH = withApi(
  {
    rlsOrgContext: true,
    auth: { minRole: 'admin' },
    entitlement: 'commercial_reporting',
    body: approveSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: { tags: ['Reconciliation'], summary: 'Independently approve and post a reconciliation disposition' },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const accounts = postingAccounts();
    return withRLSContext({ organizationId, userId }, async (tx) => {
      await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:approve', requiresLedger: true });
      const [decision] = await tx
        .select()
        .from(reconciliationResolutionDecisions)
        .where(and(
          eq(reconciliationResolutionDecisions.id, body.decisionId),
          eq(reconciliationResolutionDecisions.organizationId, organizationId),
          eq(reconciliationResolutionDecisions.status, 'pending'),
          ne(reconciliationResolutionDecisions.requestedBy, userId),
          isNull(reconciliationResolutionDecisions.approvedBy),
        ))
        .limit(1)
        .for('update');
      if (!decision) throw ApiError.conflict('Decision is unavailable, changed, or self-approval was attempted');
      const [exception] = await tx
        .select({ id: reconciliationExceptions.id, varianceCad: reconciliationExceptions.varianceCad })
        .from(reconciliationExceptions)
        .where(and(eq(reconciliationExceptions.id, decision.exceptionId), eq(reconciliationExceptions.organizationId, organizationId), eq(reconciliationExceptions.status, 'under_review')))
        .limit(1)
        .for('update');
      if (!exception) throw ApiError.conflict('Exception is no longer under review');
      const amount = Math.abs(Number(exception.varianceCad ?? 0)).toFixed(2);

      const [posting] = await tx.insert(reconciliationResolutionPostings).values({
        organizationId,
        decisionId: decision.id,
        ...accounts,
        debitAmountCad: amount,
        creditAmountCad: amount,
        reason: decision.notes,
        postedBy: userId,
      }).returning();
      await tx.update(reconciliationResolutionDecisions).set({ status: 'approved', approvedBy: userId, approvedAt: new Date() }).where(and(eq(reconciliationResolutionDecisions.id, decision.id), eq(reconciliationResolutionDecisions.status, 'pending')));
      await tx.update(reconciliationExceptions).set({
        status: decision.disposition === 'write_off' ? 'written_off' : 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolutionNotes: decision.notes,
        updatedAt: new Date(),
      }).where(and(eq(reconciliationExceptions.id, exception.id), eq(reconciliationExceptions.organizationId, organizationId), eq(reconciliationExceptions.status, 'under_review')));
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'reconciliation.disposition.posted',
        resourceType: 'reconciliation_resolution_posting',
        resourceId: posting.id,
        details: { decisionId: decision.id, exceptionId: exception.id, amountCad: amount, balanced: true },
      });
      return { data: { decisionId: decision.id, postingId: posting.id, amountCad: amount } };
    });
  },
);

export const DELETE = withApi(
  {
    rlsOrgContext: true,
    auth: { minRole: 'admin' },
    entitlement: 'commercial_reporting',
    body: correctSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: { tags: ['Reconciliation'], summary: 'Post an immutable compensating reconciliation correction' },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    return withRLSContext({ organizationId, userId }, async (tx) => {
      await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:approve', requiresLedger: true });
      const [original] = await tx.select().from(reconciliationResolutionPostings).where(and(eq(reconciliationResolutionPostings.id, body.postingId), eq(reconciliationResolutionPostings.organizationId, organizationId))).limit(1).for('update');
      if (!original) throw ApiError.notFound('Reconciliation posting');
      const [correction] = await tx.insert(reconciliationResolutionPostings).values({
        organizationId,
        decisionId: original.decisionId,
        debitAccount: original.creditAccount,
        creditAccount: original.debitAccount,
        debitAmountCad: original.creditAmountCad,
        creditAmountCad: original.debitAmountCad,
        reversalOfId: original.id,
        reason: body.reason,
        postedBy: userId,
      }).onConflictDoNothing().returning();
      if (!correction) throw ApiError.conflict('This posting already has a compensating correction');
      await persistAtomicAudit(tx, { organizationId, userId, action: 'reconciliation.disposition.corrected', resourceType: 'reconciliation_resolution_posting', resourceId: correction.id, details: { reversalOfId: original.id } });
      return { data: { correctionId: correction.id, reversalOfId: original.id } };
    });
  },
);
