import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pilotApplications } from '@/db/schema';
import { withApiAuth, hasMinRole } from '@/lib/api-auth-guard';
import { enforcePilotOwnership } from '@/lib/pilot/pilot-ownership';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { buildProposalPackage, normalizeCommercialState } from '@/lib/pilot/commercialization-wave1';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const GET = withApiAuth(async (_request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) => {
  try {
    const canAccess = await hasMinRole('steward');
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rawParams = context?.params ? await context.params : undefined;
    const id = rawParams?.id;
    if (!id) {
      return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });
    }

    const [application] = await withSystemContext((_tx) =>
      db
        .select()
        .from(pilotApplications)
        .where(and(eq(pilotApplications.id, id))),
    );

    if (!application) {
      return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
    }

    const denied = await enforcePilotOwnership(application);
    if (denied) return denied;

    const responses = (application.responses ?? {}) as Record<string, unknown>;
    const commercialState = normalizeCommercialState(responses.commercialState);

    const proposal = buildProposalPackage(
      {
        id: application.id,
        organizationName: application.organizationName,
        organizationType: application.organizationType as 'local' | 'regional' | 'national',
        contactName: application.contactName,
        contactEmail: application.contactEmail,
        memberCount: application.memberCount,
        jurisdictions: application.jurisdictions ?? [],
        sectors: application.sectors ?? [],
        currentSystem: application.currentSystem,
        challenges: application.challenges ?? [],
        goals: application.goals ?? [],
        readinessScore: application.readinessScore,
      },
      {
        commercialState,
        championScore: typeof responses.championScore === 'number' ? responses.championScore : undefined,
        activityScore: typeof responses.activityScore === 'number' ? responses.activityScore : undefined,
      },
    );

    const intakeSummary = [
      '# Intake Summary',
      '',
      `- Organization: ${application.organizationName}`,
      `- Organization type: ${application.organizationType}`,
      `- Contact: ${application.contactName} <${application.contactEmail}>`,
      `- Member count: ${application.memberCount}`,
      `- Jurisdictions: ${(application.jurisdictions ?? []).join(', ') || 'n/a'}`,
      `- Sectors: ${(application.sectors ?? []).join(', ') || 'n/a'}`,
      `- Current system: ${application.currentSystem ?? 'n/a'}`,
      `- Challenges: ${(application.challenges ?? []).join('; ') || 'n/a'}`,
      `- Goals: ${(application.goals ?? []).join('; ') || 'n/a'}`,
      `- Opportunity score: ${proposal.qualificationScores.overallOpportunityScore}`,
      `- Opportunity tier: ${proposal.qualificationScores.opportunityTier}`,
      `- Commercial state: ${commercialState}`,
      '',
    ].join('\n');

    const bundleMarkdown = [
      '# Pilot Package Export',
      '',
      `Generated at: ${proposal.generatedAt}`,
      `Pilot application ID: ${application.id}`,
      '',
      intakeSummary,
      proposal.artifacts.proposal.markdown,
      '',
      proposal.artifacts.statementOfWork.markdown,
      '',
      proposal.artifacts.successMetrics.markdown,
      '',
      proposal.artifacts.pilotPlan.markdown,
      '',
    ].join('\n');

    return NextResponse.json({
      data: {
        fileName: `pilot-package-${toSlug(application.organizationName || 'pilot')}.md`,
        generatedAt: proposal.generatedAt,
        intakeSummary,
        proposal: proposal.artifacts.proposal,
        statementOfWork: proposal.artifacts.statementOfWork,
        successMetrics: proposal.artifacts.successMetrics,
        pilotPlan: proposal.artifacts.pilotPlan,
        bundleMarkdown,
      },
    });
  } catch (error) {
    logger.error('pilot_package_export:failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to export pilot package' }, { status: 500 });
  }
});
