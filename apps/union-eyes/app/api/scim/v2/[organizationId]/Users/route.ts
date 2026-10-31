/**
 * SCIM 2.0 Users endpoint
 * GET /api/scim/v2/[organizationId]/Users — list users in SCIM format
 * POST /api/scim/v2/[organizationId]/Users — provision a new user
 *
 * The caller is an identity provider, not a signed-in person: it authenticates with the organization's SCIM bearer token (see
 * lib/scim/scim-token.ts). The token, not the organization named in the path, decides which organization is acted on; a path that names
 * any other organization is a 404.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { authenticateScimRequest } from '@/lib/scim/scim-token';
import { checkRateLimit } from '@/lib/rate-limiter';
import { clientAddress } from '@/lib/public-intake/guard';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import { z } from 'zod';
import { and, asc, count as countRows, eq, isNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// A provisioning request is bounded, typed input. Malformed or oversized input is a 400 naming the field, not a 500 from a failed insert.
const provisionSchema = z.object({
  userName: z.string().trim().min(1).max(320),
  name: z.object({ givenName: z.string().trim().max(100).optional(), familyName: z.string().trim().max(100).optional() }).optional(),
  emails: z.array(z.object({ value: z.string().trim().email().max(320), primary: z.boolean().optional() })).max(10).optional(),
});

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

// The token is the only credential on this surface, so guessing is bounded per client address before the token is looked up. A shared
// limiter that is unavailable refuses the request rather than leaving the endpoint unbounded.
async function authenticateScim(request: Request, pathOrganizationId: string | undefined) {
  const limited = await checkRateLimit(`scim:${clientAddress(request)}`, { limit: 600, window: 60, identifier: 'scim', failOpen: false }).catch(() => null);
  if (!limited) throw ApiError.externalService('rate-limiter', 'Provisioning is temporarily unavailable');
  if (!limited.allowed) throw ApiError.rateLimited(limited.resetIn ?? 60);
  const auth = await authenticateScimRequest(request);
  if (!auth.ok) {
    throw auth.status === 403 ? ApiError.forbidden('SCIM provisioning is not enabled for this organization') : ApiError.unauthorized('Invalid SCIM token');
  }
  if (pathOrganizationId !== auth.organizationId) throw ApiError.notFound('Organization');
  return auth;
}

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Auth'],
      summary: 'SCIM list users',
      description: 'Returns organization members in SCIM 2.0 format.',
    },
  },
  async ({ params, request }) => {
    const { organizationId: orgId } = await authenticateScim(request, params.organizationId);
    const url = new URL(request.url);
    const startIndex = Math.max(1, Number.parseInt(url.searchParams.get('startIndex') || '1', 10) || 1);
    const count = Math.min(100, Math.max(0, Number.parseInt(url.searchParams.get('count') || '50', 10) || 0));

    // A removed member is not a user of the organization, and the page is read in SQL with the count, not by loading the whole roster.
    const live = and(eq(organizationMembers.organizationId, orgId), isNull(organizationMembers.deletedAt));
    const { total, paged } = await withRLSContext({ organizationId: orgId }, async (tx) => {
      const [{ total }] = await tx.select({ total: countRows() }).from(organizationMembers).where(live);
      const paged = count === 0
        ? []
        : await tx
            .select()
            .from(organizationMembers)
            .where(live)
            .orderBy(asc(organizationMembers.createdAt), asc(organizationMembers.id))
            .limit(count)
            .offset(startIndex - 1);
      return { total, paged };
    });

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
    auth: { required: false },
    openapi: {
      tags: ['Auth'],
      summary: 'SCIM create user',
      description: 'Provisions a new user in the organization via SCIM 2.0.',
    },
  },
  async ({ params, request }) => {
    const scim = await authenticateScim(request, params.organizationId);
    const organizationId = scim.organizationId;
    if (!scim.syncUsers) throw ApiError.forbidden('User provisioning is not enabled for this organization');
    const parsed = provisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw ApiError.badRequest(`Invalid SCIM user: ${parsed.error.issues.map((i) => i.path.join('.') || 'body').join(', ')}`);
    }
    const { userName, name, emails } = parsed.data;

    const primaryEmail = emails?.find((e) => e.primary)?.value ?? emails?.[0]?.value;

    const fullName = [name?.givenName, name?.familyName].filter(Boolean).join(' ') || userName;

    return withRLSContext({ organizationId }, async (tx) => {
      const [created] = await tx
        .insert(organizationMembers)
        .values({
          organizationId,
          // The IdP names a person; it does not assert that person's platform identity. A provisional, organization-scoped key stands
          // until the person signs in and the membership is linked to their account.
          userId: `scim:${organizationId}:${userName.toLowerCase()}`,
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
        userId: `system:scim:${scim.configurationId}`,
        action: 'scim.user.provision',
        resourceType: 'organization_members',
        resourceId: created.id,
        details: { provisionedUserName: userName },
      });
      return toScimUser(created);
    });
  },
);
