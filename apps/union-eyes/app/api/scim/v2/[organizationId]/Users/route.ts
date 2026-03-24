/**
 * SCIM 2.0 Users endpoint
 * GET /api/scim/v2/[organizationId]/Users — list users in SCIM format
 * POST /api/scim/v2/[organizationId]/Users — provision a new user
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import { eq } from 'drizzle-orm';

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
  async ({ params, request }) => {
    const orgId = params.organizationId;
    const url = new URL(request.url);
    const startIndex = Math.max(1, parseInt(url.searchParams.get('startIndex') || '1', 10));
    const count = Math.min(100, parseInt(url.searchParams.get('count') || '50', 10));

    const members = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));

    const paged = members.slice(startIndex - 1, startIndex - 1 + count);

    return {
      data: {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: members.length,
        startIndex,
        itemsPerPage: paged.length,
        Resources: paged.map(toScimUser),
      },
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
  async ({ params, request }) => {
    const orgId = params.organizationId;
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

    const [created] = await db
      .insert(organizationMembers)
      .values({
        organizationId: orgId,
        userId: userName,
        email: primaryEmail ?? userName,
        name: fullName,
        role: 'member',
        status: 'active',
      })
      .returning();

    return { data: toScimUser(created) };
  },
);
