/**
 * SCIM 2.0 single user
 * GET    /api/scim/v2/[organizationId]/Users/[id] — one person this stream provisioned
 * PATCH  /api/scim/v2/[organizationId]/Users/[id] — change attributes, deprovision (active: false) or restore (active: true)
 * PUT    /api/scim/v2/[organizationId]/Users/[id] — the same changes, stated as the user resource (an omitted attribute is left as it is)
 * DELETE /api/scim/v2/[organizationId]/Users/[id] — deprovision
 *
 * A deprovision is the organization's own choice, stored in its SCIM configuration (suspend, archive or delete), and the database applies it: the
 * membership is set suspended, inactive, or soft-deleted and revoked. No row is removed. Only a person this stream provisioned is reachable, so
 * the id of a person who was invited or who signed in is a 404 here, and a deprovision cannot remove anyone's access to an account. Restoring a
 * person (active: true) undoes only a deprovision this stream made, never a suspension by the organization. Because provisioning never links a
 * person to an account (SCIM_MEMBER_LINK in lib/scim/provisioned-members.ts), a provisioned person is reported as not active.
 */
import { withApi } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { parseScimPatch, parseScimUserResource } from '@/lib/scim/patch';
import { getScimMember, toScimUser } from '@/lib/scim/provisioned-members';
import { handleScim, ScimHttpError, scimJson, scimNoContent } from '@/lib/scim/responses';
import { isUuid, scimCaller, scimLocation } from '@/lib/scim/route-support';
import { applyScimUserChanges, removeScimUser } from '@/lib/scim/user-operations';

export const dynamic = 'force-dynamic';

type Params = { id?: string } & Record<string, string>;

// An id that is not a UUID names no member, whatever else it is.
function memberId(params: Params): string {
  if (!isUuid(params.id)) throw new ScimHttpError(404, 'User not found');
  return params.id;
}

const refOf = (machine: { configurationId: string; organizationId: string }) => ({ configurationId: machine.configurationId, organizationId: machine.organizationId });

export const GET = withApi(
  {
    auth: { machine: scimCaller },
    openapi: { tags: ['Auth'], summary: 'SCIM get user', description: 'Returns one person this SCIM stream provisioned.' },
  },
  async ({ params, machine }) =>
    handleScim(async () => {
      const id = memberId(params as Params);
      const member = await withSystemContext((tx) => getScimMember(tx, refOf(machine), id));
      if (!member) throw new ScimHttpError(404, 'User not found');
      return scimJson(toScimUser(member, scimLocation(machine.organizationId, member.id)));
    }),
);

export const PATCH = withApi(
  {
    auth: { machine: scimCaller },
    openapi: { tags: ['Auth'], summary: 'SCIM patch user', description: 'Changes attributes of, deprovisions or restores a person this SCIM stream provisioned.' },
  },
  async ({ request, params, machine }) =>
    handleScim(async () => {
      if (!machine.syncUsers) throw new ScimHttpError(403, 'User provisioning is not enabled for this organization');
      const id = memberId(params as Params);
      const changes = parseScimPatch(await request.json().catch(() => null));
      const { member } = await withSystemContext((tx) => applyScimUserChanges(tx, refOf(machine), id, changes, 'patch'));
      return scimJson(toScimUser(member, scimLocation(machine.organizationId, member.id)));
    }),
);

export const PUT = withApi(
  {
    auth: { machine: scimCaller },
    openapi: { tags: ['Auth'], summary: 'SCIM replace user', description: 'Updates the stated attributes of a person this SCIM stream provisioned.' },
  },
  async ({ request, params, machine }) =>
    handleScim(async () => {
      if (!machine.syncUsers) throw new ScimHttpError(403, 'User provisioning is not enabled for this organization');
      const id = memberId(params as Params);
      const changes = parseScimUserResource(await request.json().catch(() => null));
      const { member } = await withSystemContext((tx) => applyScimUserChanges(tx, refOf(machine), id, changes, 'put'));
      return scimJson(toScimUser(member, scimLocation(machine.organizationId, member.id)));
    }),
);

export const DELETE = withApi(
  {
    auth: { machine: scimCaller },
    openapi: { tags: ['Auth'], summary: 'SCIM delete user', description: "Deprovisions a person this SCIM stream provisioned, by the organization's configured action." },
  },
  async ({ params, machine }) =>
    handleScim(async () => {
      if (!machine.syncUsers) throw new ScimHttpError(403, 'User provisioning is not enabled for this organization');
      const id = memberId(params as Params);
      await withSystemContext((tx) => removeScimUser(tx, refOf(machine), id));
      return scimNoContent();
    }),
);
