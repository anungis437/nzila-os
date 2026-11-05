import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { employerRemittanceRuns, employerRemittanceRunItems, employerExecutionArtifacts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export const GET = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'employer_remittance_generation',
    openapi: { tags: ['Employer Execution'], summary: 'Get authorized remittance run detail' },
  },
  async ({ organizationId, userId, params }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Financial organization mandate required');
    const parsed = zUUID.safeParse(params?.id);
    if (!parsed.success) throw ApiError.badRequest('Invalid remittance run id');
    const id = parsed.data;

    // The mandate and every dependent read share a single tenant-local RLS
    // transaction. A valid role title is not sufficient financial authority.
    const loaded = await withRLSContext({ organizationId, userId }, async (tx) => {
      await requireLiveFinancialMandate(tx, {
        organizationId,
        userId,
        action: 'finance:view',
        resourceId: id,
      });
      const [run] = await tx
        .select()
        .from(employerRemittanceRuns)
        .where(and(
          eq(employerRemittanceRuns.organizationId, organizationId),
          eq(employerRemittanceRuns.id, id),
        ))
        .limit(1);
      if (!run) throw ApiError.notFound('Remittance run not found');
      const items = await tx
        .select()
        .from(employerRemittanceRunItems)
        .where(and(
          eq(employerRemittanceRunItems.organizationId, organizationId),
          eq(employerRemittanceRunItems.remittanceRunId, id),
        ));
      // Raw payroll/remittance CSV/JSON artifacts are not returned by a detail
      // request. Access to exports requires a dedicated, separately audited
      // authorized download journey.
      const artifacts = await tx
        .select()
        .from(employerExecutionArtifacts)
        .where(and(
          eq(employerExecutionArtifacts.organizationId, organizationId),
          eq(employerExecutionArtifacts.remittanceRunId, id),
          eq(employerExecutionArtifacts.artifactType, 'evidence_manifest'),
        ));
      return { run, items, artifacts };
    });
    return { data: loaded };
  },
);
