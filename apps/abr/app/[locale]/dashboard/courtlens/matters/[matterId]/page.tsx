import { auth } from '@nzila/platform-auth/entra/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Card } from '@nzila/ui';
import { verifyAbrOrgMembership } from '@/lib/trusted-auth';
import { hasPermission } from '@/lib/rbac';
import { getMatterDetail, buildMatterDetailView } from '@/modules/incidents/matter-service';

/**
 * CourtLens tenant matter detail page — Phase 2D (read-only).
 *
 * Server component. Uses trusted auth chain:
 *   1. auth() → userId from platform-auth session
 *   2. verifyAbrOrgMembership → server-derived role + membership
 *   3. hasPermission('incident.read')
 *   4. getMatterDetail + buildMatterDetailView with the trusted role
 *
 * All redaction happens server-side in buildMatterDetailView.
 * The rendered fields exactly mirror the API response — the UI does not
 * attempt to reconstruct hidden fields or bypass role gating.
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
  const sp = await searchParams;
  const orgParam = typeof sp.org === 'string' ? sp.org : undefined;
  const orgId = orgParam ?? process.env.ABR_DEMO_ORG_ID ?? 'metro-university';

  const membership = await verifyAbrOrgMembership(userId, orgId);
  if (!membership.ok || !hasPermission(membership.role, 'incident.read')) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-navy">Matter Detail</h2>
          <p className="mt-1 text-slate-600">
            You do not have access to this matter.
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

  return (
    <div className="space-y-6" data-testid="courtlens-matter-detail">
      <div>
        <Link
          href={`/${locale}/dashboard/courtlens/matters`}
          className="text-sm font-semibold text-electric"
        >
          ← Back to queue
        </Link>
      </div>

      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{view.title}</h2>
        <p className="mt-1 text-slate-600">
          Read-only reviewer view. This surface displays operational status only. It is not legal advice.
        </p>
      </div>

      <Card>
        <div className="space-y-3 p-6 text-sm" data-testid="matter-summary">
          <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <dt className="font-medium text-navy">Status</dt>
              <dd data-testid="detail-status-label">{view.statusLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-navy">Practice area</dt>
              <dd data-testid="detail-practice-area">{view.practiceArea}</dd>
            </div>
            {view.subIssue && (
              <div>
                <dt className="font-medium text-navy">Sub-issue</dt>
                <dd>{view.subIssue.replaceAll('_', ' ')}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-navy">Urgency</dt>
              <dd>{view.urgencyLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-navy">AI review packet</dt>
              <dd data-testid="detail-ai-status">
                {view.aiSummaryStatus.replaceAll('_', ' ')}
                {view.isPacketExternalizable
                  ? ''
                  : ' — draft only; requires human review before external use'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-navy">Referral</dt>
              <dd>{view.referralStatus}</dd>
            </div>
            {view.assignedTo && (
              <div>
                <dt className="font-medium text-navy">Assigned</dt>
                <dd>{view.assignedTo}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-navy">Opened</dt>
              <dd>{new Date(view.openedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {(view.clientGoal || view.hearingDate || view.deadlineDate) && (
        <Card>
          <div className="space-y-3 p-6 text-sm" data-testid="matter-context">
            <h3 className="font-poppins text-base font-semibold text-navy">Matter context</h3>
            {view.clientGoal && (
              <div>
                <span className="font-medium text-navy">Client goal: </span>
                <span>{view.clientGoal}</span>
              </div>
            )}
            {view.hearingDate && (
              <div>
                <span className="font-medium text-navy">Hearing date: </span>
                <span>{view.hearingDate}</span>
              </div>
            )}
            {view.deadlineDate && (
              <div>
                <span className="font-medium text-navy">Deadline: </span>
                <span>{view.deadlineDate}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {view.riskFlags && (
        <Card>
          <div className="space-y-3 p-6 text-sm" data-testid="matter-risk-flags">
            <h3 className="font-poppins text-base font-semibold text-navy">Risk indicators</h3>
            <ul className="space-y-1">
              {Object.entries(view.riskFlags)
                .filter(([, v]) => v === true)
                .map(([k]) => (
                  <li key={k}>{k.replace(/^risk_/, '').replaceAll('_', ' ')}</li>
                ))}
              {Object.values(view.riskFlags).every((v) => !v) && (
                <li className="text-slate-500">No risk indicators recorded.</li>
              )}
            </ul>
          </div>
        </Card>
      )}

      {view.clientProfile && (
        <Card>
          <div className="space-y-3 p-6 text-sm" data-testid="matter-client-profile">
            <h3 className="font-poppins text-base font-semibold text-navy">Client profile</h3>
            {view.clientProfile.clientName && (
              <div>
                <span className="font-medium text-navy">Name: </span>
                <span>{view.clientProfile.clientName}</span>
              </div>
            )}
            {view.clientProfile.householdSize != null && (
              <div>
                <span className="font-medium text-navy">Household size: </span>
                <span>{view.clientProfile.householdSize}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-navy">Consent: </span>
              <span>{view.clientProfile.consentStatus}</span>
            </div>
          </div>
        </Card>
      )}

      {view.notes.length > 0 && (
        <Card>
          <div className="space-y-3 p-6 text-sm" data-testid="matter-notes">
            <h3 className="font-poppins text-base font-semibold text-navy">Reviewer notes</h3>
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
          <p className="font-medium text-navy">Legal notice</p>
          <p>{view.legalBoundaryNotice}</p>
        </div>
      </Card>
    </div>
  );
}
