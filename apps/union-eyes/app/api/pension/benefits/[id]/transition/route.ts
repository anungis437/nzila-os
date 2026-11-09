import { and, eq, isNull, ne } from 'drizzle-orm';
import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { pensionBenefitClaimEvidence, pensionBenefitClaims, pensionBenefitSettlementHandoffs, pensionMembers, pensionTrusteeDecisions } from '@/db/schema';
import { requirePensionTrusteeMandate } from '@/lib/pension/pension-authority';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.enum(['verify', 'begin_review', 'approve', 'deny', 'prepare_settlement', 'handoff']),
  evidenceType: z.string().trim().min(2).max(50).optional(),
  evidenceReference: z.string().trim().min(3).max(500).optional(),
  evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9:_-]{16,128}$/).optional(),
}).strict();

export const POST = withApi(
  {
    auth: { required: true, minRole: 'secretary_treasurer' },
    body: bodySchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: { tags: ['Pension'], summary: 'Advance an evidence-backed pension benefit claim lifecycle' },
  },
  async ({ organizationId, userId, params, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [record] = await tx.select({ claim: pensionBenefitClaims, planId: pensionMembers.planId }).from(pensionBenefitClaims).innerJoin(pensionMembers, and(eq(pensionMembers.id, pensionBenefitClaims.memberId), eq(pensionMembers.organizationId, organizationId))).where(and(eq(pensionBenefitClaims.id, params.id), eq(pensionBenefitClaims.organizationId, organizationId))).limit(1).for('update');
      if (!record) throw ApiError.notFound('Benefit claim');
      await requirePensionTrusteeMandate(tx, { organizationId, userId, planId: record.planId, action: `pension:claim:${body.action}` });

      let nextStatus = record.claim.status;
      let decisionId: string | null = null;
      if (body.action === 'verify') {
        if (record.claim.status !== 'pending') throw ApiError.conflict('Only a pending claim can be verified');
        if (!body.evidenceType || !body.evidenceReference || !body.evidenceDigest) throw ApiError.badRequest('Verified evidence type, reference and digest are required');
        await tx.insert(pensionBenefitClaimEvidence).values({ organizationId, claimId: record.claim.id, evidenceType: body.evidenceType, evidenceReference: body.evidenceReference, evidenceDigest: body.evidenceDigest, verifiedBy: userId, verifiedAt: new Date() });
        nextStatus = 'verified';
      } else if (body.action === 'begin_review') {
        if (record.claim.status !== 'verified') throw ApiError.conflict('Only a verified claim can enter review');
        nextStatus = 'under_review';
      } else if (body.action === 'approve' || body.action === 'deny') {
        if (record.claim.status !== 'under_review') throw ApiError.conflict('Only a claim under review can be decided');
        if (!body.evidenceDigest) throw ApiError.badRequest('Decision evidence digest is required');
        const action = body.action === 'approve' ? 'claim_approve' : 'claim_deny';
        const [existing] = await tx.select().from(pensionTrusteeDecisions).where(and(eq(pensionTrusteeDecisions.resourceType, 'benefit_claim'), eq(pensionTrusteeDecisions.resourceId, record.claim.id))).limit(1).for('update');
        if (!existing) {
          const [created] = await tx.insert(pensionTrusteeDecisions).values({ organizationId, planId: record.planId, resourceType: 'benefit_claim', resourceId: record.claim.id, action, firstTrusteeUserId: userId, evidenceDigest: body.evidenceDigest, status: 'pending' }).returning();
          decisionId = created.id;
        } else {
          if (existing.action !== action) throw ApiError.conflict('A claim cannot have competing approval and denial decisions');
          if (existing.status !== 'pending' || existing.firstTrusteeUserId === userId || existing.evidenceDigest !== body.evidenceDigest) throw ApiError.conflict('Independent matching trustee decision required');
          const [approved] = await tx.update(pensionTrusteeDecisions).set({ secondTrusteeUserId: userId, status: 'approved', decidedAt: new Date() }).where(and(eq(pensionTrusteeDecisions.id, existing.id), eq(pensionTrusteeDecisions.status, 'pending'), ne(pensionTrusteeDecisions.firstTrusteeUserId, userId), isNull(pensionTrusteeDecisions.secondTrusteeUserId))).returning();
          if (!approved) throw ApiError.conflict('Decision changed concurrently');
          decisionId = approved.id;
          nextStatus = body.action === 'approve' ? 'approved' : 'denied';
        }
      } else if (body.action === 'prepare_settlement') {
        if (record.claim.status !== 'approved') throw ApiError.conflict('Only an approved claim can prepare settlement');
        if (!body.idempotencyKey) throw ApiError.badRequest('idempotencyKey is required');
        const [decision] = await tx.select({ id: pensionTrusteeDecisions.id }).from(pensionTrusteeDecisions).where(and(eq(pensionTrusteeDecisions.resourceType, 'benefit_claim'), eq(pensionTrusteeDecisions.resourceId, record.claim.id), eq(pensionTrusteeDecisions.action, 'claim_approve'), eq(pensionTrusteeDecisions.status, 'approved'))).limit(1);
        if (!decision) throw ApiError.conflict('Approved dual-trustee decision not found');
        const [existingHandoff] = await tx.select().from(pensionBenefitSettlementHandoffs).where(and(eq(pensionBenefitSettlementHandoffs.organizationId, organizationId), eq(pensionBenefitSettlementHandoffs.claimId, record.claim.id))).limit(1).for('update');
        if (existingHandoff && existingHandoff.idempotencyKey !== body.idempotencyKey) {
          throw ApiError.conflict('Settlement has already been prepared with a different idempotency key');
        }
        if (!existingHandoff) {
          const [handoff] = await tx.insert(pensionBenefitSettlementHandoffs).values({ organizationId, claimId: record.claim.id, decisionId: decision.id, idempotencyKey: body.idempotencyKey, status: 'prepared', createdBy: userId }).onConflictDoNothing().returning();
          if (!handoff) throw ApiError.conflict('Settlement preparation changed concurrently');
        }
        nextStatus = 'settlement_prepared';
      } else if (body.action === 'handoff') {
        if (record.claim.status !== 'settlement_prepared') throw ApiError.conflict('Settlement is not prepared');
        const providerMandateReference = process.env.PENSION_SETTLEMENT_PROVIDER_MANDATE_REF?.trim();
        if (!providerMandateReference) throw ApiError.capabilityUnavailable('Pension payout provider mandate is not configured; no payout was attempted');
        const [handoff] = await tx.update(pensionBenefitSettlementHandoffs).set({ status: 'ready_for_provider', providerMandateReference }).where(and(eq(pensionBenefitSettlementHandoffs.claimId, record.claim.id), eq(pensionBenefitSettlementHandoffs.organizationId, organizationId), eq(pensionBenefitSettlementHandoffs.status, 'prepared'))).returning();
        if (!handoff) throw ApiError.conflict('Settlement handoff changed concurrently');
        nextStatus = 'handoff';
      }

      const [updated] = await tx.update(pensionBenefitClaims).set({ status: nextStatus, processedDate: ['approved', 'denied'].includes(nextStatus) ? new Date() : record.claim.processedDate, updatedAt: new Date() }).where(and(eq(pensionBenefitClaims.id, record.claim.id), eq(pensionBenefitClaims.organizationId, organizationId), eq(pensionBenefitClaims.status, record.claim.status))).returning();
      if (!updated) throw ApiError.conflict('Claim changed concurrently');
      await persistAtomicAudit(tx, { organizationId, userId, action: `pension.benefit_claim.${body.action}`, resourceType: 'pension_benefit_claims', resourceId: record.claim.id, details: { from: record.claim.status, to: nextStatus, planId: record.planId, decisionId } });
      return { data: { claim: updated, decisionId, payoutAttempted: false } };
    });
  },
);
