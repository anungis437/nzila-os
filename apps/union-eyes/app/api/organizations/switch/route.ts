/**
 * POST /api/organizations/switch
 *
 * V2 rotates a password session or validates a provider selection hint using private memberships.
 * Legacy mode validates public membership/admin authority and returns organization metadata.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { organizations, organizationMembers } from '@/db/schema-organizations';
import { and, eq, isNull } from 'drizzle-orm';
import { isPlatformAdminUser } from '@/lib/api-auth-guard';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';
import { recordOrganizationSelection } from '@/lib/auth/organization-selection-audit';
import { readBoundedJson, RequestBodyTooLargeError } from '@/lib/api/bounded-json';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { UUID_PATTERN } from '@/lib/organizations/read-authority';
import { organizationWire } from '@/lib/organizations/organization-wire';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4 * 1024;

type Selection =
  | { kind: 'not-found' }
  | { kind: 'denied' }
  | { kind: 'allowed'; org: typeof organizations.$inferSelect };

export async function POST(req: NextRequest) {
  if (currentStateContextEnabled()) {
    const { handleCanonicalOrganizationSwitch } =
      await import('@/lib/auth/canonical-organization-selection')
    return handleCanonicalOrganizationSwitch(req)
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let organizationId: string;
  try {
    const body = await readBoundedJson(req, MAX_BODY_BYTES) as { organizationId?: unknown } | null;
    organizationId = typeof body?.organizationId === 'string' ? body.organizationId : '';
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }
  if (!UUID_PATTERN.test(organizationId)) {
    return NextResponse.json({ error: 'organizationId must be a valid organization id' }, { status: 400 });
  }

  const isAdmin = await isPlatformAdminUser(userId);

  // The caller's memberships span organizations, which no single-organization transaction can show, so the lookup is the system role's,
  // exactly as the organization read authority does it (lib/organizations/read-authority.ts).
  const selection = await withSystemContext(async (tx): Promise<Selection> => {
    const [org] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) return { kind: 'not-found' };

    // Platform admins can switch to any org without membership check
    if (isAdmin) return { kind: 'allowed', org };

    // An archived or inactive organization cannot be switched to: the resolver that reads the selection requires it to be active.
    if ((org.status ?? 'active') !== 'active') return { kind: 'not-found' };

    // Membership organization_id is the organization UUID, matching the Django
    // foreign key. A slug comparison cannot succeed against that column.
    const [userMembership] = await tx
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId),
          // Only an active, non-removed membership counts: a suspended, inactive or removed member is not a member here.
          eq(organizationMembers.status, 'active'),
          isNull(organizationMembers.deletedAt),
        ),
      )
      .limit(1);

    return userMembership ? { kind: 'allowed', org } : { kind: 'denied' };
  });

  if (selection.kind === 'not-found') {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }
  if (selection.kind === 'denied') {
    return NextResponse.json({ error: 'Access denied: not a member of this organization' }, { status: 403 });
  }
  const org = selection.org;

  // A selection that leaves no trail is refused: a platform administrator choosing an organization they hold no membership of is the case
  // that matters most.
  try {
    await recordOrganizationSelection({ organizationId: org.id, userId, authority: isAdmin ? 'platform_administrator' : 'membership', mode: 'legacy' });
  } catch {
    return NextResponse.json({ error: 'The organization selection could not be recorded' }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    organization: organizationWire(org),
  });
}