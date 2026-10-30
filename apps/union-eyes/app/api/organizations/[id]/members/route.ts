import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { z } from 'zod';
import { requireUserForOrganization, ROLE_HIERARCHY } from '@/lib/api-auth-guard';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { isAdministrativeRole, resolveOrganizationAccess, UUID_PATTERN } from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Roles each caller level may grant. A role at or above the caller's own is never grantable here. */
const GRANTABLE_ROLES: Record<string, string[]> = {
  // Privileged office grants need a separate dual-approval workflow, not this endpoint.
  admin: ['member', 'observer', 'steward'],
};

const createMemberSchema = z.object({
  user_id: z.string().min(1).max(255),
  role: z.enum(['member', 'steward', 'admin', 'executive', 'observer']).default('member'),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  department: z.string().max(255).optional(),
  membership_number: z.string().max(100).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  // Full roster contacts and membership numbers require ACTIVE, DIRECT
  // membership-office authority. Platform status, ancestry or a steward role
  // alone must not disclose the organization's full roster.
  const access = await resolveOrganizationAccess(userId);
  if (!isAdministrativeRole(access.direct.get(id))) {
    return NextResponse.json({ error: 'Forbidden: requires direct organization administrator' }, { status: 403 });
  }
  const rows = await withRLSContext({ organizationId: id }, async () =>
    db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, id)),
  );

  const mapped = rows.map(row => ({
    id: row.id,
    user_id: row.userId,
    organization_id: row.organizationId,
    role: row.role,
    status: row.status,
    name: row.name,
    email: row.email,
    phone: row.phone,
    department: row.department,
    membership_number: row.membershipNumber,
    is_primary: row.isPrimary,
    created_at: row.createdAt,
    joined_at: row.joinedAt,
    updated_at: row.updatedAt,
  }));

  return NextResponse.json({ data: mapped });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Require caller to hold a verified direct membership in THIS org.
  let userCtx;
  try {
    userCtx = await requireUserForOrganization(id);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const userRole = userCtx.roles[0] || 'member';
  if ((ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] ?? 0) < ROLE_HIERARCHY.steward) {
    return NextResponse.json({ error: 'Forbidden: requires steward role' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues.map(i => ({ path: i.path, message: i.message })) }, { status: 400 });
  }

  const { user_id, role, name, email, phone, department, membership_number } = parsed.data;

  // A caller may grant only roles below their own, never the administrator role through this route, and what they create
  // is a pending membership: naming a user id does not give that person access, they take it up through the invitation.
  const access = await resolveOrganizationAccess(userCtx.userId);
  // A steward can neither create a membership nor grant roles on the roster.
  // Parent-body and platform role titles do not imply a tenant mandate.
  if (!isAdministrativeRole(access.direct.get(id))) {
    return NextResponse.json({ error: 'Forbidden: requires direct organization administrator' }, { status: 403 });
  }
  const grantable = GRANTABLE_ROLES.admin;
  if (!grantable.includes(role)) {
    return NextResponse.json({ error: `Forbidden: your role may not grant the ${role} role` }, { status: 403 });
  }
  const status = 'pending' as const;

  const [created] = await withRLSContext({ organizationId: id }, async (tx) => {
    const inserted = await tx
      .insert(organizationMembers)
      .values({
      userId: user_id,
      organizationId: id,
      role,
      status,
      name,
      email,
      phone,
      department,
      membershipNumber: membership_number,
    })
      .returning();
    // Membership/role change is a launch-critical audited event; failure rolls the insert back.
    await persistAtomicAudit(tx, {
      organizationId: id,
      action: 'membership.create',
      resourceType: 'organization_members',
      resourceId: inserted[0]?.id,
      userId: userCtx.userId,
      details: { memberUserId: user_id, role, status, route: '/api/organizations/[id]/members' },
    });
    return inserted;
  });

  return NextResponse.json({ data: created }, { status: 201 });
}