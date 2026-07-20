import { auth } from '@nzila/platform-auth/entra/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { Card } from '@nzila/ui';
import { verifyAbrOrgMembership } from '@/lib/trusted-auth';
import { hasPermission, type AbrPermission } from '@/lib/rbac';
import { getMatterDetail, buildMatterDetailView } from '@/modules/incidents/matter-service';
import { CaseTimelinePanel } from './CaseTimelinePanel';
import { ReviewerActions } from './ReviewerActions';
import { ReviewPacketExportControls } from './ReviewPacketExportControls';
import { RiskPanel } from './RiskPanel';

/**
 * CourtLens tenant matter detail page — Phase 2D (read-only) + Phase 2E (reviewer actions).
 *
 * Server component. Uses trusted auth chain (Phase 2C.6) and server-side
 * redaction via buildMatterDetailView. Copy is fully localized via next-intl.
 */
export default async function CourtLensMatterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; matterId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { locale, matterId } = await params;
  const t = await getTranslations({ locale, namespace: 'courtlens.matterDetail' });
  const sp = await searchParams;
  const orgParam = typeof sp.org === 'string' ? sp.org : undefined;
  const orgId = orgParam ?? process.env.ABR_DEMO_ORG_ID ?? 'metro-university';

  const membership = await verifyAbrOrgMembership(userId, orgId);
  if (!membership.ok || !hasPermission(membership.role, 'incident.read')) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-navy">{t('accessDeniedTitle')}</h2>
          <p className="mt-1 text-slate-600">
            {t('accessDeniedMessage')}
          </p>
        </div>
      </div>
    );
  }

  const result = await getMatterDetail(orgId, matterId, {
    role: membership.role,
    includeSensitiveNotes: true,
  });

  if (!result) notFound();

  const view = buildMatterDetailView(result.matter, result.detail!, membership.role);

  // Server-derived permission set for the reviewer actions component.
  const candidatePermissions: readonly AbrPermission[] = ['incident.update', 'incident.transition', 'export.read'];
  const permissions = candidatePermissions.filter((p) => hasPermission(membership.role, p));
  const canExportPacket = permissions.includes('export.read');

  return (
    <div className="space-y-6" data-testid="courtlens-matter-detail">
      <div>
        <Link
          href={`/${locale}/dashboard/courtlens/matters`}
          className="text-sm font-semibold text-electric"
        >
          {t('backToQueue')}
        </Link>
      </div>

      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{view.title}</h2>
        <p className="mt-1 text-slate-600">
          {t('subtitle')}
        </p>
      </div>

      <Card>
        <div className="space-y-3 p-6 text-sm" data-testid="matter-summary">
          <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <dt className="font-medium text-navy">{t('fieldStatus')}</dt>
              <dd data-testid="detail-status-label">{view.statusLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-navy">{t('fieldPracticeArea')}</dt>
              <dd data-testid="detail-practice-area">{view.practiceArea}</dd>
            </div>
            {view.subIssue && (
              <div>
                <dt className="font-medium text-navy">{t('fieldSubIssue')}</dt>
                <dd>{view.subIssue.replaceAll('_', ' ')}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-navy">{t('fieldUrgency')}</dt>
              <dd>{view.urgencyLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-navy">{t('fieldAiPacket')}</dt>
              <dd data-testid="detail-ai-status">
                {view.aiSummaryStatus.replaceAll('_', ' ')}{' '}
                {view.isPacketExternalizable ? '' : t('fieldAiPacketDraftSuffix')}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-navy">{t('fieldReferral')}</dt>
              <dd>{view.referralStatus}</dd>
            </div>
            {view.assignedTo && (
              <div>
                <dt className="font-medium text-navy">{t('fieldAssigned')}</dt>
                <dd>{view.assignedTo}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-navy">{t('fieldOpened')}</dt>
              <dd>{new Date(view.openedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {(view.clientGoal || view.hearingDate || view.deadlineDate) && (
        <Card>
          <div className="space-y-3 p-6 text-sm" data-testid="matter-context">
            <h3 className="font-poppins text-base font-semibold text-navy">{t('sectionContext')}</h3>
            {view.clientGoal && (
              <div>
                <span className="font-medium text-navy">{t('fieldClientGoal')}</span>
                <span>{view.clientGoal}</span>
              </div>
            )}
            {view.hearingDate && (
              <div>
                <span className="font-medium text-navy">{t('fieldHearingDate')}</span>
                <span>{view.hearingDate}</span>
              </div>
            )}
            {view.deadlineDate && (
              <div>
                <span className="font-medium text-navy">{t('fieldDeadlineDate')}</span>
                <span>{view.deadlineDate}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {view.riskFlags && (
        <Card>
          <div className="p-6" data-testid="matter-risk-flags">
            <h3 className="mb-3 font-poppins text-base font-semibold text-navy">
              {t('sectionRiskFlags')}
            </h3>
            <RiskPanel
              urgencyLabel={view.urgencyLabel}
              urgencyLevel={result.matter.severity}
              riskFlags={view.riskFlags}
            />
          </div>
        </Card>
      )}

      {view.clientProfile && (
        <Card>
          <div className="space-y-3 p-6 text-sm" data-testid="matter-client-profile">
            <h3 className="font-poppins text-base font-semibold text-navy">{t('sectionClientProfile')}</h3>
            {view.clientProfile.clientName && (
              <div>
                <span className="font-medium text-navy">{t('fieldClientName')}</span>
                <span>{view.clientProfile.clientName}</span>
              </div>
            )}
            {view.clientProfile.householdSize != null && (
              <div>
                <span className="font-medium text-navy">{t('fieldHouseholdSize')}</span>
                <span>{view.clientProfile.householdSize}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-navy">{t('fieldConsent')}</span>
              <span>{view.clientProfile.consentStatus}</span>
            </div>
          </div>
        </Card>
      )}

      {view.notes.length > 0 && (
        <Card>
          <div className="space-y-3 p-6 text-sm" data-testid="matter-notes">
            <h3 className="font-poppins text-base font-semibold text-navy">{t('sectionNotes')}</h3>
            <ul className="space-y-2">
              {view.notes.map((note) => (
                <li key={note.id} className="rounded border border-slate-200 p-2">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {note.visibilityScope}
                  </div>
                  <div>{note.content}</div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Card>
        <div className="space-y-2 p-6 text-xs text-slate-600" data-testid="legal-boundary-notice">
          <p className="font-medium text-navy">{t('sectionLegal')}</p>
          <p>{view.legalBoundaryNotice}</p>
        </div>
      </Card>

      <Card>
        <div className="p-6" data-testid="matter-timeline">
          <CaseTimelinePanel timeline={view.timeline} />
        </div>
      </Card>

      <Card>
        <ReviewerActions
          matterId={result.matter.id}
          aiSummaryStatus={result.matter.aiSummaryStatus}
          referralStatus={result.matter.referralStatus}
          status={result.matter.status}
          permissions={permissions}
        />
      </Card>

      <Card>
        <div className="p-6">
          <ReviewPacketExportControls
            matterId={result.matter.id}
            locale={locale}
            canExport={canExportPacket}
            isPacketExternalizable={view.isPacketExternalizable}
          />
        </div>
      </Card>
    </div>
  );
}
