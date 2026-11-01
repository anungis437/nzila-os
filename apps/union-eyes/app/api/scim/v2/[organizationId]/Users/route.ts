/**
 * SCIM 2.0 Users endpoint
 * GET  /api/scim/v2/[organizationId]/Users — the people this organization's directory holds, one page at a time, or one person by filter
 *                                            (userName eq "x" or externalId eq "x"; any other filter is a 400)
 * POST /api/scim/v2/[organizationId]/Users — provision a person: pending, never active, not linked to anyone's account, not a member
 * One person: GET, PATCH, PUT and DELETE on Users/[id] (deprovision by the organization's own configured action).
 *
 * The caller is an identity provider, not a signed-in person (lib/scim/route-support.ts): the route declares the SCIM bearer token as its machine
 * credential, so the framework verifies it and reads no session. The tenant connection needs a session user and the system role holds no INSERT on
 * the membership table, so the people a stream provisions are rows of their own directory (public.scim_provisioned_users, platform 0059) that only
 * the system role reaches (lib/scim/provisioned-members.ts). Answers are SCIM resources and SCIM errors (lib/scim/responses.ts), not the framework's
 * envelope, because that is what an identity provider reads.
 */
import { withApi } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { recordScimEvent, scimTraceOf } from '@/lib/scim/events-log';
import { parseScimFilter } from '@/lib/scim/filter';
import { findScimMembers, listScimMembers, provisionScimMember, toScimUser, type ScimMember } from '@/lib/scim/provisioned-members';
import { handleScim, ScimHttpError, scimJson } from '@/lib/scim/responses';
import { scimCaller, scimLocation } from '@/lib/scim/route-support';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';

// A provisioning request is bounded, typed input. Malformed or oversized input is a 400 naming the field, not a 500 from a failed insert.
const provisionSchema = z.object({
  userName: z.string().trim().min(1).max(320),
  // The identity provider's own identifier for the person (SCIM core attribute externalId).
  externalId: z.string().trim().min(1).max(255).optional(),
  name: z.object({ givenName: z.string().trim().max(100).optional(), familyName: z.string().trim().max(100).optional() }).optional(),
  emails: z.array(z.object({ value: z.string().trim().email().max(320), primary: z.boolean().optional() })).max(10).optional(),
});

const listResponse = (organizationId: string, members: ScimMember[], total: number, startIndex: number) => ({
  schemas: [LIST_SCHEMA],
  totalResults: total,
  startIndex,
  itemsPerPage: members.length,
  Resources: members.map((member) => toScimUser(member, scimLocation(organizationId, member.id))),
});

export const GET = withApi(
  {
    auth: { machine: scimCaller },
    openapi: {
      tags: ['Auth'],
      summary: 'SCIM list users',
      description: 'Returns the people this SCIM stream provisioned in SCIM 2.0 format, or the one person a userName or externalId filter names.',
    },
  },
  async ({ request, machine }) =>
    handleScim(async () => {
      const ref = { configurationId: machine.configurationId, organizationId: machine.organizationId };
      const url = new URL(request.url);
      const filter = parseScimFilter(url.searchParams.get('filter'));
      if (filter) {
        const found = await withSystemContext((tx) => findScimMembers(tx, ref, filter));
        return scimJson(listResponse(ref.organizationId, found, found.length, 1));
      }

      const startIndex = Math.max(1, Number.parseInt(url.searchParams.get('startIndex') || '1', 10) || 1);
      const count = Math.min(100, Math.max(0, Number.parseInt(url.searchParams.get('count') || '50', 10) || 0));
      // A removed person is not a user of the organization, and the page is read in SQL with the count, not by loading the whole directory.
      const { total, members } = await withSystemContext((tx) => listScimMembers(tx, ref, { startIndex, count }));
      return scimJson(listResponse(ref.organizationId, members, total, startIndex));
    }),
);

export const POST = withApi(
  {
    auth: { machine: scimCaller },
    openapi: {
      tags: ['Auth'],
      summary: 'SCIM create user',
      description: 'Provisions a person in the organization via SCIM 2.0. The person is pending and is not linked to an account.',
    },
  },
  async ({ request, machine }) =>
    handleScim(async () => {
      const organizationId = machine.organizationId;
      if (!machine.syncUsers) throw new ScimHttpError(403, 'User provisioning is not enabled for this organization');
      const parsed = provisionSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) {
        throw new ScimHttpError(400, `Invalid SCIM user: ${parsed.error.issues.map((i) => i.path.join('.') || 'body').join(', ')}`, 'invalidValue');
      }
      const { userName, externalId, name, emails } = parsed.data;

      const primaryEmail = emails?.find((e) => e.primary)?.value ?? emails?.[0]?.value;

      // Nothing is invented for what the identity provider did not send: no name falls back to the userName and no e-mail address is guessed.
      const fullName = [name?.givenName, name?.familyName].filter(Boolean).join(' ') || null;
      const trace = scimTraceOf(request);
      const ref = { configurationId: machine.configurationId, organizationId };

      const member = await withSystemContext(async (tx) => {
        // The IdP names a person; it does not assert that person's platform identity. The person is a pending directory entry (naming a user does not
        // give that user access and does not make them a member) until a verified binding exists; see SCIM_MEMBER_LINK.
        const { outcome, member: provisioned } = await provisionScimMember(tx, ref, { userName, externalId, name: fullName, email: primaryEmail ?? null });
        if (outcome === 'exists') throw new ScimHttpError(409, 'A user with this userName already exists in the organization', 'uniqueness');
        if (outcome === 'external_id_conflict') throw new ScimHttpError(409, 'Another user of the organization already has this externalId', 'uniqueness');
        if (!provisioned) throw new Error('SCIM provisioning returned no member');

        await persistAtomicAudit(tx, {
          organizationId,
          userId: `system:scim:${machine.configurationId}`,
          action: outcome === 'created' ? 'scim.user.provision' : 'scim.user.reprovision',
          resourceType: 'scim_provisioned_users',
          resourceId: provisioned.id,
          details: { provisionedUserName: userName, ...(externalId ? { externalId } : {}), outcome },
        });
        await recordScimEvent(tx, ref, trace, { eventType: 'user.created', resourceId: provisioned.id, operation: 'POST', statusCode: 201 });
        return provisioned;
      });
      const location = scimLocation(organizationId, member.id);
      return scimJson(toScimUser(member, location), 201, location ? { Location: location } : {});
    }),
);
