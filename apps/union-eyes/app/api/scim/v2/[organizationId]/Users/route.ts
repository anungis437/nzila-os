/**
 * SCIM 2.0 Users endpoint
 * GET /api/scim/v2/[organizationId]/Users — list users in SCIM format
 * POST /api/scim/v2/[organizationId]/Users — provision a new user
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import { and, asc, count as countRows, eq, isNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function toScimUser(member: typeof organizationMembers.$inferSelect) {
  const parts = (member.name ?? '').split(' ');
  const givenName = parts[0] ?? '';
  const familyName = parts.slice(1).join(' ') ?? '';
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: member.id,
    userName: member.email ?? member.userId,
    name: {
      givenName,
      familyName,
      formatted: member.name ?? '',
    },
    emails: member.email
      ? [{ value: member.email, primary: true, type: 'work' }]
      : [],
    active: member.status === 'active',
    meta: {
      resourceType: 'User',
      created: member.joinedAt ?? member.createdAt,
      lastModified: member.updatedAt,
    },
  };
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Auth'],
      summary: 'SCIM list users',
      description: 'Returns organization members in SCIM 2.0 format.',
    },
  },
  async ({ params, request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    // An administrator lists only the organization they are acting in, whatever the path names.
    if (params.organizationId !== organizationId) throw ApiError.notFound('Organization');
    const orgId = organizationId;
    const url = new URL(request.url);
    const startIndex = Math.max(1, Number.parseInt(url.searchParams.get('startIndex') || '1', 10) || 1);
    const count = Math.min(100, Math.max(0, Number.parseInt(url.searchParams.get('count') || '50', 10) || 0));

    // A removed member is not a user of the organization, and the page is read in SQL with the count, not by loading the whole roster.
    const live = and(eq(organizationMembers.organizationId, orgId), isNull(organizationMembers.deletedAt));
    const [{ total }] = await db.select({ total: countRows() }).from(organizationMembers).where(live);
    const paged = count === 0
      ? []
      : await db
          .select()
          .from(organizationMembers)
          .where(live)
          .orderBy(asc(organizationMembers.createdAt), asc(organizationMembers.id))
          .limit(count)
          .offset(startIndex - 1);

    return {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: Number(total),
        startIndex,
        itemsPerPage: paged.length,
        Resources: paged.map(toScimUser),
      };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Auth'],
      summary: 'SCIM create user',
      description: 'Provisions a new user in the organization via SCIM 2.0.',
    },
  },
  async ({ params, request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    // An administrator provisions users only into the organization they are acting in.
    if (params.organizationId !== organizationId) throw ApiError.notFound('Organization');
    const body = await request.json();
    const { userName, name, emails } = body as {
      userName: string;
      name?: { givenName?: string; familyName?: string };
      emails?: Array<{ value: string; primary?: boolean }>;
    };

    if (!userName) {
      throw ApiError.badRequest('userName is required');
    }

    const primaryEmail = emails?.find((e) => e.primary)?.value ?? emails?.[0]?.value;

    const fullName = [name?.givenName, name?.familyName].filter(Boolean).join(' ') || userName;

    return withRLSContext({ organizationId }, async (tx) => {
      const [created] = await tx
        .insert(organizationMembers)
        .values({
          organizationId,
          userId: userName,
          email: primaryEmail ?? userName,
          name: fullName,
          role: 'member',
          // Provisioning names a user; it does not give that user access. The membership is pending until the person accepts, as for a
          // member added through the roster route, and the SCIM representation reports it as not active.
          status: 'pending',
        })
        .onConflictDoNothing()
        .returning();
      if (!created) throw ApiError.conflict('A user with this userName already exists in the organization');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'scim.user.provision',
        resourceType: 'organization_members',
        resourceId: created.id,
        details: { provisionedUserName: userName },
      });
      return toScimUser(created);
    });
  },
);
