/**
 * Durable, organization-scoped audit for social analytics exports.
 * Never records post content, account names, member identities, or CSV data.
 * An audit outage rejects the export rather than delivering unrecorded data.
 */
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export async function auditSocialAnalyticsExport(input: {
  organizationId: string;
  userId: string;
  dataType: string;
  format: string;
  startDate: string;
  endDate: string;
  rowCount: number;
}): Promise<void> {
  if (!input.organizationId || !input.userId) throw new Error('Export audit requires actor and organization');
  const details = {
    dataType: input.dataType,
    format: input.format,
    startDate: input.startDate,
    endDate: input.endDate,
    rowCount: input.rowCount,
  };
  await withRLSContext({ organizationId: input.organizationId }, async (tx) => {
    await persistAtomicAudit(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      action: 'social_media_analytics_export',
      resourceType: 'social_analytics',
      resourceId: null,
      details,
    });
  });
}
