import { auth } from '@nzila/platform-auth/entra/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { Card } from '@nzila/ui';
import { verifyAbrOrgMembership } from '@/lib/trusted-auth';
import { hasPermission } from '@/lib/rbac';
import { listMatterQueueForOrg } from '@/modules/incidents/matter-service';

/**
 * CourtLens tenant matter queue page — Phase 2D (read-only).
 *
 * Server component. Uses the same trusted auth chain as the API routes:
 *   1. auth() → userId from platform-auth session
 *   2. verifyAbrOrgMembership → server-derived role + membership check
 *   3. hasPermission('incident.read') → RBAC gate
 *   4. listMatterQueueForOrg → org-scoped queue projection
 *
 * The browser never sends x-abr-role. Role is derived server-side.
 * Rendered fields are limited to the safe queue projection (no client profile,
 * no notes, no raw events, no AI packet content).
 */
export default async function CourtLensMattersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'courtlens.tenantQueue' });
  const sp = await searchParams;
  const orgParam = typeof sp.org === 'string' ? sp.org : undefined;
  const orgId = orgParam ?? process.env.ABR_DEMO_ORG_ID ?? 'metro-university';

  const membership = await verifyAbrOrgMembership(userId, orgId);
  if (!membership.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-navy">{t('accessDeniedTitle')}</h2>
          <p className="mt-1 text-slate-600">{t('accessDeniedSubtitle')}</p>
        </div>
        <Card>
          <div className="p-6 text-sm text-slate-700">
            {t('accessDeniedNoMembership')}
          </div>
        </Card>
      </div>
    );
  }

  if (!hasPermission(membership.role, 'incident.read')) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-navy">{t('accessDeniedRoleTitle')}</h2>
          <p className="mt-1 text-slate-600">{t('accessDeniedRoleSubtitle')}</p>
        </div>
        <Card>
          <div className="p-6 text-sm text-slate-700">
            {t('accessDeniedRoleMessage')}
          </div>
        </Card>
      </div>
    );
  }

  const items = await listMatterQueueForOrg(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{t('title')}</h2>
        <p className="mt-1 text-slate-600">
          {t('subtitle')}
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <div className="space-y-2 p-6 text-sm text-slate-700">
            <p className="font-medium text-navy">{t('emptyStateTitle')}</p>
            <p>{t('emptyStateBody')}</p>
          </div>
        </Card>
      ) : (
        <div
          className="grid gap-4 lg:grid-cols-2"
          data-testid="courtlens-matter-queue"
        >
          {items.map((item) => (
            <Card key={item.id}>
              <div className="space-y-3 p-6" data-testid="courtlens-matter-row" data-matter-id={item.id}>
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                  <span data-testid="matter-practice-area">{item.practiceArea}</span>
                  <span data-testid="matter-urgency">{item.urgencyLabel}</span>
                </div>
                <h3 className="font-poppins text-base font-semibold text-navy">
                  {item.title}
                </h3>
                {item.subIssue && (
                  <p className="text-xs text-slate-500" data-testid="matter-sub-issue">
                    {t('rowSubIssuePrefix')}{item.subIssue.replaceAll('_', ' ')}
                  </p>
                )}
                <dl className="space-y-1 text-xs text-slate-500">
                  <div>
                    <dt className="inline font-medium">{t('rowStatusLabel')}</dt>
                    <dd className="inline" data-testid="matter-status-label">{item.statusLabel}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">{t('rowOpenedLabel')}</dt>
                    <dd className="inline">{new Date(item.openedAt).toLocaleDateString()}</dd>
                  </div>
                  {item.deadlineDate && (
                    <div>
                      <dt className="inline font-medium">{t('rowDeadlineLabel')}</dt>
                      <dd className="inline">{item.deadlineDate}</dd>
                    </div>
                  )}
                  {item.assignedTo && (
                    <div>
                      <dt className="inline font-medium">{t('rowAssignedLabel')}</dt>
                      <dd className="inline">{item.assignedTo}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline font-medium">{t('rowReviewPacketLabel')}</dt>
                    <dd className="inline" data-testid="matter-ai-status">
                      {item.aiSummaryStatus.replaceAll('_', ' ')}
                      {item.isPacketExternalizable ? '' : t('rowReviewPacketDraftSuffix')}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">{t('rowReferralLabel')}</dt>
                    <dd className="inline">{item.referralStatus}</dd>
                  </div>
                </dl>
                <Link
                  href={`/${locale}/dashboard/courtlens/matters/${item.id}`}
                  className="text-sm font-semibold text-electric"
                >
                  {t('rowOpenDetail')}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
