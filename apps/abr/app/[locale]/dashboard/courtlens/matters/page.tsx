import { auth } from '@nzila/platform-auth/entra/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

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
  const sp = await searchParams;
  const orgParam = typeof sp.org === 'string' ? sp.org : undefined;
  const orgId = orgParam ?? process.env.ABR_DEMO_ORG_ID ?? 'metro-university';

  const membership = await verifyAbrOrgMembership(userId, orgId);
  if (!membership.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-navy">CourtLens Matter Queue</h2>
          <p className="mt-1 text-slate-600">Access to this organisation is not available.</p>
        </div>
        <Card>
          <div className="p-6 text-sm text-slate-700">
            You do not have an active membership in this organisation. Please contact your CourtLens administrator.
          </div>
        </Card>
      </div>
    );
  }

  if (!hasPermission(membership.role, 'incident.read')) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-navy">CourtLens Matter Queue</h2>
          <p className="mt-1 text-slate-600">Your role does not have queue access.</p>
        </div>
        <Card>
          <div className="p-6 text-sm text-slate-700">
            The current role does not include permission to view matters.
          </div>
        </Card>
      </div>
    );
  }

  const items = await listMatterQueueForOrg(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">CourtLens Matter Queue</h2>
        <p className="mt-1 text-slate-600">
          Review-ready operational summary for supervised access-to-justice casework.
          This surface displays operational status only. It is not legal advice.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <div className="space-y-2 p-6 text-sm text-slate-700">
            <p className="font-medium text-navy">No matters yet.</p>
            <p>
              When public intake begins, submitted matters will appear here for reviewer triage.
              This is operational infrastructure for supervised review, not legal advice.
            </p>
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
                    Sub-issue: {item.subIssue.replaceAll('_', ' ')}
                  </p>
                )}
                <dl className="space-y-1 text-xs text-slate-500">
                  <div>
                    <dt className="inline font-medium">Status: </dt>
                    <dd className="inline" data-testid="matter-status-label">{item.statusLabel}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Opened: </dt>
                    <dd className="inline">{new Date(item.openedAt).toLocaleDateString()}</dd>
                  </div>
                  {item.deadlineDate && (
                    <div>
                      <dt className="inline font-medium">Deadline: </dt>
                      <dd className="inline">{item.deadlineDate}</dd>
                    </div>
                  )}
                  {item.assignedTo && (
                    <div>
                      <dt className="inline font-medium">Assigned: </dt>
                      <dd className="inline">{item.assignedTo}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline font-medium">Review packet: </dt>
                    <dd className="inline" data-testid="matter-ai-status">
                      {item.aiSummaryStatus.replaceAll('_', ' ')}
                      {item.isPacketExternalizable ? '' : ' (draft — not for external use)'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Referral: </dt>
                    <dd className="inline">{item.referralStatus}</dd>
                  </div>
                </dl>
                <Link
                  href={`/${locale}/dashboard/courtlens/matters/${item.id}`}
                  className="text-sm font-semibold text-electric"
                >
                  Open matter detail
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
