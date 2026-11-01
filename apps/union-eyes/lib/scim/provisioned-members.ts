/**
 * SCIM provisioned members: the only place the SCIM routes touch organization_members.
 *
 * A SCIM stream is a machine caller authenticated by the organization's bearer token. It has no session, so it cannot use the tenant
 * connection, and the system role holds no INSERT on the membership table. The database functions of cache migration 0049 are the whole of
 * what a SCIM configuration may do there, and they enforce the envelope themselves: a member created or provisioned again is PENDING with role
 * member, the configuration must belong to the organization named and be live, and a live person of the organization is never created twice.
 * These wrappers add no authority of their own; they pass the configuration and the organization to the function and shape what it returns.
 */
import { sql } from 'drizzle-orm';
import type { RLSTx } from '@/lib/db/with-rls-context';

export interface ScimConfigurationRef {
  configurationId: string;
  organizationId: string;
}

export type ScimProvisionOutcome = 'created' | 'reprovisioned' | 'exists' | 'external_id_conflict';

export interface ScimMember {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  status: string;
  joinedAt: Date | string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  metadata: Record<string, unknown> | null;
}

export interface ScimProvisionInput {
  userName: string;
  /** The identity provider's own subject for the person. It is kept with the row and identifies one live person of the organization. */
  externalId?: string | null;
  name?: string | null;
  email?: string | null;
}

/** The configuration is not enabled, is revoked or expired, or does not belong to the organization named. */
export class ScimConfigurationNotLiveError extends Error {
  constructor() {
    super('SCIM is not enabled for this organization');
    this.name = 'ScimConfigurationNotLiveError';
  }
}

/**
 * Linking a provisioned member to a person's platform account is not implemented, and that is recorded here instead of being guessed.
 * A provisioned member keeps a provisional key (scim:<organization>:<userName>) that no session user id can equal, so it never grants
 * access: it stays pending and the kernel reads it as inactive. Binding it to an account by an e-mail address or a userName is refused
 * (the identity provider names a person, it does not prove who signs in); the platform binds an identity only from a verified provider claim.
 */
export const SCIM_MEMBER_LINK = Object.freeze({
  operation: 'scim.member.link',
  state: 'blocked',
  provisionalKeyPrefix: 'scim:',
  bindsBy: Object.freeze(['verified provider binding (provider and tenant:object subject)']),
  neverBindsBy: Object.freeze(['e-mail address', 'userName', 'externalId alone']),
  requires: Object.freeze([
    "the organization's declared and verified identity-provider tenant (activation of its single sign-on configuration, which is not implemented)",
    'a verified provider binding for the signed-in person from the platform authentication layer',
    'an institution-approved rule for linking a provisioned person at first sign-in, and the person\'s own acceptance',
    'an institution-approved decision on what a deprovision does to a person who is linked to an account (UE-INST-SCIM-PROVISIONING-CREDENTIAL-AND-DEPROVISIONING-AUTHORITY); until then a deprovision reaches only people who are not linked, and removes no one\'s access',
  ]),
  approvedBy: null,
});

const rowsOf = <T,>(result: unknown): T[] =>
  Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] } | null)?.rows ?? []);

type MemberColumns = {
  o_id: string | null;
  o_user_id: string | null;
  o_name: string | null;
  o_email: string | null;
  o_status: string | null;
  o_joined_at: Date | string | null;
  o_created_at: Date | string | null;
  o_updated_at: Date | string | null;
  o_metadata: Record<string, unknown> | null;
};

function memberFrom(row: MemberColumns): ScimMember | null {
  if (!row.o_id || row.o_user_id === null || row.o_status === null) return null;
  return {
    id: row.o_id,
    userId: row.o_user_id,
    name: row.o_name,
    email: row.o_email,
    status: row.o_status,
    joinedAt: row.o_joined_at,
    createdAt: row.o_created_at,
    updatedAt: row.o_updated_at,
    metadata: row.o_metadata,
  };
}

// The database refuses a configuration that is not live with a permission error. The driver may wrap it, so the code is read from the cause too.
function refusedAsNotLive(error: unknown): boolean {
  const code = (error as { code?: unknown; cause?: { code?: unknown } } | null);
  return code?.code === '42501' || code?.cause?.code === '42501';
}

export async function provisionScimMember(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  input: ScimProvisionInput,
): Promise<{ outcome: ScimProvisionOutcome; member: ScimMember | null }> {
  try {
    const rows = rowsOf<MemberColumns & { o_outcome: ScimProvisionOutcome }>(
      await tx.execute(
        sql`SELECT * FROM public.ue_scim_provision_member(${ref.configurationId}::uuid, ${ref.organizationId}::uuid, ${input.userName}::text, ${input.externalId ?? null}::text, ${input.name ?? null}::text, ${input.email ?? null}::text)`,
      ),
    );
    const row = rows[0];
    if (!row) throw new Error('SCIM provisioning returned no result');
    return { outcome: row.o_outcome, member: memberFrom(row) };
  } catch (error) {
    if (refusedAsNotLive(error)) throw new ScimConfigurationNotLiveError();
    throw error;
  }
}

export async function listScimMembers(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  page: { startIndex: number; count: number },
): Promise<{ total: number; members: ScimMember[] }> {
  try {
    const totals = rowsOf<{ total: string | number }>(
      await tx.execute(sql`SELECT public.ue_scim_member_total(${ref.configurationId}::uuid, ${ref.organizationId}::uuid) AS total`),
    );
    const total = Number(totals[0]?.total ?? 0);
    if (page.count <= 0) return { total, members: [] };
    const rows = rowsOf<MemberColumns>(
      await tx.execute(
        sql`SELECT * FROM public.ue_scim_list_members(${ref.configurationId}::uuid, ${ref.organizationId}::uuid, ${Math.max(0, page.startIndex - 1)}::int, ${page.count}::int)`,
      ),
    );
    return { total, members: rows.map(memberFrom).filter((member): member is ScimMember => member !== null) };
  } catch (error) {
    if (refusedAsNotLive(error)) throw new ScimConfigurationNotLiveError();
    throw error;
  }
}

export type ScimUpdateOutcome = 'updated' | 'unchanged' | 'not_found' | 'external_id_conflict' | 'held';
export type ScimDeprovisionOutcome = 'deprovisioned' | 'unchanged' | 'not_found';
export type ScimDeprovisionAction = 'suspend' | 'archive' | 'delete';

/** The attributes the identity provider owns. An absent key is left as it is; `externalId: null` removes it. */
export interface ScimMemberChanges {
  name?: string;
  email?: string;
  externalId?: string | null;
  /** Restore a person this same stream deprovisioned. It never restores a membership the organization itself suspended. */
  reactivate?: boolean;
}

/** The people this configuration provisioned that match a filter on userName or externalId. At most a handful, so there is no paging. */
export async function findScimMembers(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  filter: { attribute: 'userName' | 'externalId'; value: string },
): Promise<ScimMember[]> {
  try {
    const rows = rowsOf<MemberColumns>(
      await tx.execute(
        sql`SELECT * FROM public.ue_scim_find_member(${ref.configurationId}::uuid, ${ref.organizationId}::uuid, ${filter.attribute}::text, ${filter.value}::text)`,
      ),
    );
    return rows.map(memberFrom).filter((member): member is ScimMember => member !== null);
  } catch (error) {
    if (refusedAsNotLive(error)) throw new ScimConfigurationNotLiveError();
    throw error;
  }
}

/** One person this configuration provisioned. A member the stream did not provision, or that is removed, is not found, whatever the id. */
export async function getScimMember(tx: RLSTx, ref: ScimConfigurationRef, memberId: string): Promise<ScimMember | null> {
  try {
    const rows = rowsOf<MemberColumns>(
      await tx.execute(sql`SELECT * FROM public.ue_scim_get_member(${ref.configurationId}::uuid, ${ref.organizationId}::uuid, ${memberId}::uuid)`),
    );
    return rows[0] ? memberFrom(rows[0]) : null;
  } catch (error) {
    if (refusedAsNotLive(error)) throw new ScimConfigurationNotLiveError();
    throw error;
  }
}

export async function updateScimMember(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  memberId: string,
  changes: ScimMemberChanges,
): Promise<{ outcome: ScimUpdateOutcome; member: ScimMember | null }> {
  try {
    const rows = rowsOf<MemberColumns & { o_outcome: ScimUpdateOutcome }>(
      await tx.execute(
        sql`SELECT * FROM public.ue_scim_update_member(${ref.configurationId}::uuid, ${ref.organizationId}::uuid, ${memberId}::uuid, ${changes.name ?? null}::text, ${changes.email ?? null}::text, ${changes.externalId ?? null}::text, ${changes.externalId === null}::boolean, ${changes.reactivate === true}::boolean)`,
      ),
    );
    const row = rows[0];
    if (!row) throw new Error('SCIM member update returned no result');
    return { outcome: row.o_outcome, member: memberFrom(row) };
  } catch (error) {
    if (refusedAsNotLive(error)) throw new ScimConfigurationNotLiveError();
    throw error;
  }
}

/**
 * Applies the organization's own configured deprovision action to a person this configuration provisioned. The action is read by the database
 * function from the configuration, not passed by the caller, and it only ever changes the membership status (and soft-deletes for `delete`).
 */
export async function deprovisionScimMember(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  memberId: string,
  via: 'patch' | 'put' | 'delete',
): Promise<{ outcome: ScimDeprovisionOutcome; action: ScimDeprovisionAction | null; member: ScimMember | null }> {
  try {
    const rows = rowsOf<MemberColumns & { o_outcome: ScimDeprovisionOutcome; o_action: ScimDeprovisionAction | null }>(
      await tx.execute(
        sql`SELECT * FROM public.ue_scim_deprovision_member(${ref.configurationId}::uuid, ${ref.organizationId}::uuid, ${memberId}::uuid, ${via}::text)`,
      ),
    );
    const row = rows[0];
    if (!row) throw new Error('SCIM deprovisioning returned no result');
    return { outcome: row.o_outcome, action: row.o_action ?? null, member: memberFrom(row) };
  } catch (error) {
    if (refusedAsNotLive(error)) throw new ScimConfigurationNotLiveError();
    throw error;
  }
}

function scimDetails(metadata: Record<string, unknown> | null): { userName?: string; externalId?: string } {
  const scim = metadata && typeof metadata === 'object' ? (metadata as { scim?: unknown }).scim : undefined;
  if (!scim || typeof scim !== 'object') return {};
  const { userName, externalId } = scim as { userName?: unknown; externalId?: unknown };
  return {
    ...(typeof userName === 'string' && userName ? { userName } : {}),
    ...(typeof externalId === 'string' && externalId ? { externalId } : {}),
  };
}

/** The SCIM 2.0 representation. A pending member is reported as not active; the identity provider's own userName and externalId are returned as it sent them. */
export function toScimUser(member: ScimMember, location?: string) {
  const { userName, externalId } = scimDetails(member.metadata);
  const parts = (member.name ?? '').split(' ');
  const givenName = parts[0] ?? '';
  const familyName = parts.slice(1).join(' ') ?? '';
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: member.id,
    ...(externalId ? { externalId } : {}),
    userName: userName ?? member.email ?? member.userId,
    name: {
      givenName,
      familyName,
      formatted: member.name ?? '',
    },
    emails: member.email ? [{ value: member.email, primary: true, type: 'work' }] : [],
    active: member.status === 'active',
    meta: {
      resourceType: 'User',
      created: member.joinedAt ?? member.createdAt,
      lastModified: member.updatedAt,
      ...(location ? { location } : {}),
    },
  };
}
