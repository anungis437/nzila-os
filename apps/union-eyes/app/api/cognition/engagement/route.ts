/**
 * GET /api/cognition/engagement
 *
 * Not implemented. Member-engagement snapshots are produced only by computeMemberEngagement (@nzila/ue-cognition), and nothing in
 * Union Eyes calls it: there is no scheduled, tenant-scoped scorer and no source wired for its inputs (logins, message reads, event
 * attendance). The route used to list whatever the package's file-backed store held, which in a deployment is nothing, so it answered
 * 200 with an empty list. A scorer is a product change; until one exists the capability answers 501 (DEF-0B5-COGNITION-ENGAGEMENT-NEVER-COMPUTED).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';

const ENGAGEMENT_NOT_IMPLEMENTED_REASON =
  'Member engagement is not computed: no scheduled, organization-scoped engagement scorer exists, so there is no disengagement measurement to return.';

export const GET = withOrganizationAuth(async (
  _request: NextRequest,
  _context,
) => {
  const allowed = await hasMinRole('steward');
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(
    { error: { code: 'NOT_IMPLEMENTED', message: ENGAGEMENT_NOT_IMPLEMENTED_REASON } },
    { status: 501 },
  );
});
