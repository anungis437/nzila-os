import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { employerRemittanceRuns, employerRemittanceSubmissions } from '@/db/schema';

const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const POST = withApi({
  auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
  body: z.object({ submissionAuthorityRef: z.string().min(1).max(255) }),
  successStatus: 201,
}, async ({ organizationId, userId, params, request, body }) => {
  if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
  const key = request.headers.get('idempotency-key')?.trim();
  if (!key || key.length > 200) throw ApiError.badRequest('A bounded Idempotency-Key header is required');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:execute', resourceId: params.id });
    const [run] = await tx.select().from(employerRemittanceRuns).where(and(
      eq(employerRemittanceRuns.id, params.id),
      eq(employerRemittanceRuns.organizationId, organizationId),
    )).limit(1).for('update');
    if (!run || !run.immutableSnapshotLocked || !run.evidenceManifestHash) throw ApiError.conflict('A sealed remittance package is required');
    const packageDigest = digest(JSON.stringify({
      schema: run.packageSchemaVersion,
      sourceRevisionHash: run.sourceRevisionHash,
      evidenceManifestHash: run.evidenceManifestHash,
      summary: run.packageSummary,
    }));
    const [submission] = await tx.insert(employerRemittanceSubmissions).values({
      organizationId,
      remittanceRunId: run.id,
      idempotencyKeyHash: digest(key),
      status: 'prepared',
      submissionAuthorityRef: body.submissionAuthorityRef,
      packageDigest,
      submittedBy: userId,
    }).onConflictDoUpdate({
      target: [employerRemittanceSubmissions.remittanceRunId, employerRemittanceSubmissions.idempotencyKeyHash],
      set: { updatedAt: new Date() },
    }).returning();
    if (submission.packageDigest !== packageDigest || submission.submissionAuthorityRef !== body.submissionAuthorityRef) {
      throw ApiError.conflict('Idempotency-Key was already used for a different package or authority');
    }
    await persistAtomicAudit(tx, {
      organizationId, userId, action: 'employer_execution.remittance_submission.prepare',
      resourceType: 'employer_remittance_submissions', resourceId: submission.id,
      details: { remittanceRunId: run.id, packageDigest, packageSchemaVersion: run.packageSchemaVersion },
    });
    return { submission, externalSubmissionPerformed: false };
  });
});

export const PATCH = withApi({
  auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
  body: z.object({ submissionId: z.guid(), outcome: z.enum(['acknowledged', 'rejected']), providerReceiptRef: z.string().min(1).max(255) }),
}, async ({ organizationId, userId, params, body }) => {
  if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:approve', resourceId: params.id });
    const [submission] = await tx.select().from(employerRemittanceSubmissions).where(and(
      eq(employerRemittanceSubmissions.id, body.submissionId),
      eq(employerRemittanceSubmissions.remittanceRunId, params.id),
      eq(employerRemittanceSubmissions.organizationId, organizationId),
    )).limit(1).for('update');
    if (!submission) throw ApiError.notFound('Remittance submission');
    if (submission.submittedBy === userId) throw ApiError.forbidden('Submission reconciliation requires an independent approver');
    if (submission.status !== 'prepared' && submission.providerReceiptRef !== body.providerReceiptRef) {
      throw ApiError.conflict('Submission is already reconciled with a different receipt');
    }
    const now = new Date();
    const [updated] = await tx.update(employerRemittanceSubmissions).set({
      status: body.outcome,
      providerReceiptRef: body.providerReceiptRef,
      submittedAt: submission.submittedAt ?? now,
      reconciledBy: userId,
      reconciledAt: now,
      updatedAt: now,
    }).where(eq(employerRemittanceSubmissions.id, submission.id)).returning();
    await tx.update(employerRemittanceRuns).set({
      status: body.outcome === 'acknowledged' ? 'submitted' : 'failed', updatedAt: now,
    }).where(and(eq(employerRemittanceRuns.id, submission.remittanceRunId), eq(employerRemittanceRuns.organizationId, organizationId)));
    await persistAtomicAudit(tx, {
      organizationId, userId, action: `employer_execution.remittance_submission.${body.outcome}`,
      resourceType: 'employer_remittance_submissions', resourceId: submission.id,
      details: { remittanceRunId: submission.remittanceRunId, providerReceiptRef: body.providerReceiptRef },
    });
    return { submission: updated };
  });
});
