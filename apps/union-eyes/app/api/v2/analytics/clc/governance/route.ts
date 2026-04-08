/**
 * GET /api/v2/analytics/clc/governance
 * Governed CLC endpoint — consent, participation, and cohort health.
 * Requires MANAGE_CROSS_UNION_ANALYTICS permission.
 */
import { withApi } from '@/lib/api/framework';
import { getConsentedOrgIds, getParticipationRegistry, resolveGovernanceContext } from '@/lib/clc/governance';
import { queryGovernanceSummary } from '@/lib/clc/data-products';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { generateGovernanceBriefing } from '@/lib/clc/nil-briefing';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'clc_staff' },
    openapi: {
      tags: ['Analytics', 'CLC Intelligence'],
      summary: 'Governance dashboard (governed)',
      description:
        'Consent status, participation rates, and cohort health for CLC intelligence layer.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const govCtx = await resolveGovernanceContext(userId!, organizationId);
    const url = new URL(request.url);
    const includeBriefing = url.searchParams.get('briefing') === 'true';

    if (!govCtx.hasPermission('manage_cross_union_analytics')) {
      throw new Error('Permission required: manage_cross_union_analytics');
    }

    const registry = getParticipationRegistry();
    const consentedCrossUnion = getConsentedOrgIds('crossUnionAnalytics', registry);
    const consentedSectorBenchmarks = getConsentedOrgIds('sectorBenchmarks', registry);
    const consentedNationalSignals = getConsentedOrgIds('nationalSignals', registry);

    await auditLog({
      eventType: AuditEventType.DATA_ACCESS,
      severity: AuditSeverity.LOW,
      userId: govCtx.userId,
      organizationId: govCtx.organizationId ?? undefined,
      resource: 'clc-intelligence',
      action: 'governance-dashboard',
      outcome: 'success',
      details: {
        consentedCrossUnion: consentedCrossUnion.length,
        consentedSectorBenchmarks: consentedSectorBenchmarks.length,
        consentedNationalSignals: consentedNationalSignals.length,
      },
    });

    const summary = await withSystemContext(() =>
      queryGovernanceSummary(consentedCrossUnion, consentedSectorBenchmarks, consentedNationalSignals),
    );

    return {
      summary,
      ...(includeBriefing && { briefing: generateGovernanceBriefing(summary) }),
    };
  },
);
