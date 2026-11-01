/**
 * SCIM provisioned users: the directory of people an identity provider named, and the only place the SCIM routes read or write it.
 *
 * A SCIM stream is a machine caller authenticated by the organization's bearer token. It has no session, so it cannot use the tenant connection,
 * and the system role holds no INSERT on the membership table, so the people it provisions are not roster rows. They are rows of
 * public.scim_provisioned_users (platform 0059, closed to everything but the system role by cache 0051): pending, never active, and not linked to
 * anyone's account. That is the whole of what the stream can create, so provisioning cannot name a role, make anyone a member, or reach a person who
 * signed in: the roster is a different table.
 *
 * Every operation first proves, on the caller's own transaction, that the configuration belongs to the organization named and is live (enabled, not
 * revoked, not past its expiry, and for a change with user sync switched on), and it holds a share lock on that row until the transaction ends, so a
 * revocation cannot slip in between the check and the write. The statements below name the organization in every predicate. A live person is unique
 * per organization by userName and by externalId, which the partial unique indexes of platform 0059 guarantee; the advisory locks only make the
 * outcome deterministic (a request that loses the race is told the person exists, not given a constraint error).
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
  /** The userName as the identity provider sent it. The person is unique per organization by its lower-cased form. */
  userName: string;
  /** The identity provider's own subject for the person. */
  externalId: string | null;
  name: string | null;
  email: string | null;
  /** pending, or the state a deprovision left the person in (suspended, inactive, revoked). A provisioned person is never active. */
  status: string;
  provisionedAt: Date | string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
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
 * Linking a provisioned person to a platform account is not implemented, and that is recorded here instead of being guessed. A provisioned person
 * is a directory entry of this stream, not a member: nothing in the roster names them, so they have no access and a deprovision cannot take any
 * access away. Binding one to an account by an e-mail address or a userName is refused (the identity provider names a person, it does not prove who
 * signs in); the platform binds an identity only from a verified provider claim.
 */
export const SCIM_MEMBER_LINK = Object.freeze({
  operation: 'scim.member.link',
  state: 'blocked',
  directory: 'public.scim_provisioned_users',
  bindsBy: Object.freeze(['verified provider binding (provider and tenant:object subject)']),
  neverBindsBy: Object.freeze(['e-mail address', 'userName', 'externalId alone']),
  requires: Object.freeze([
    "the organization's declared and verified identity-provider tenant (activation of its single sign-on configuration, which is not implemented)",
    'a verified provider binding for the signed-in person from the platform authentication layer',
    "an institution-approved rule for linking a provisioned person at first sign-in, and the person's own acceptance",
    "an institution-approved decision on what a deprovision does to a person who is linked to an account (UE-INST-SCIM-PROVISIONING-CREDENTIAL-AND-DEPROVISIONING-AUTHORITY); until then a deprovision reaches only the directory entry, and removes no one's access",
  ]),
  approvedBy: null,
});

const rowsOf = <T,>(result: unknown): T[] =>
  Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] } | null)?.rows ?? []);

type MemberRow = {
  id: string;
  user_name: string;
  external_id: string | null;
  display_name: string | null;
  email: string | null;
  status: string;
  provisioned_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};
type StateRow = MemberRow & { deleted_at: Date | string | null; deprovisioned_by: string | null };

const MEMBER_COLUMNS = sql.raw('id, user_name, external_id, display_name, email, status, provisioned_at, created_at, updated_at');
const STATE_COLUMNS = sql.raw('id, user_name, external_id, display_name, email, status, provisioned_at, created_at, updated_at, deleted_at, deprovisioned_by');

function memberFrom(row: MemberRow): ScimMember {
  return {
    id: row.id,
    userName: row.user_name,
    externalId: row.external_id,
    name: row.display_name,
    email: row.email,
    status: row.status,
    provisionedAt: row.provisioned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const clean = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
};

const MAX_USER_NAME = 320;
const MAX_EXTERNAL_ID = 255;
const MAX_DISPLAY_NAME = 400;
const MAX_EMAIL = 320;

/** The routes parse bounded input before it gets here; this is the last check before a statement, not a second parser. */
function assertBounds(values: { userName?: string | null; externalId?: string | null; name?: string | null; email?: string | null }): void {
  if (values.userName !== undefined && (!values.userName || values.userName.length > MAX_USER_NAME)) throw new RangeError('A SCIM userName of 1 to 320 characters is required');
  if (values.externalId && values.externalId.length > MAX_EXTERNAL_ID) throw new RangeError('A SCIM externalId of at most 255 characters is required');
  if (values.name && values.name.length > MAX_DISPLAY_NAME) throw new RangeError('A SCIM display name of at most 400 characters is required');
  if (values.email && values.email.length > MAX_EMAIL) throw new RangeError('A SCIM e-mail address of at most 320 characters is required');
}

/** The configuration must belong to the organization, be live, and stay so until the transaction ends. */
async function assertConfigurationLive(tx: RLSTx, ref: ScimConfigurationRef, requiresUserSync: boolean): Promise<void> {
  const rows = rowsOf<{ id: string }>(
    await tx.execute(sql`
      SELECT c.id
        FROM public.scim_configurations c
       WHERE c.id = ${ref.configurationId}::uuid
         AND c.organization_id = ${ref.organizationId}::uuid
         AND c.enabled
         AND c.revoked_at IS NULL
         AND (c.token_expires_at IS NULL OR c.token_expires_at > now())
         ${requiresUserSync ? sql`AND c.sync_users` : sql``}
         FOR SHARE`),
  );
  if (rows.length === 0) throw new ScimConfigurationNotLiveError();
}

/** Work on one thing takes turns, so two requests cannot both pass the checks that follow. */
const lock = (tx: RLSTx, name: string) => tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${name}::text, 0))`);

export async function provisionScimMember(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  input: ScimProvisionInput,
): Promise<{ outcome: ScimProvisionOutcome; member: ScimMember | null }> {
  await assertConfigurationLive(tx, ref, true);
  const userName = (input.userName ?? '').trim();
  const externalId = clean(input.externalId);
  const name = clean(input.name);
  const email = clean(input.email);
  assertBounds({ userName, externalId, name, email });
  const key = userName.toLowerCase();

  await lock(tx, `scim-provision:${ref.organizationId}:${key}`);
  if (externalId) await lock(tx, `scim-external:${ref.organizationId}:${externalId}`);

  if (externalId) {
    const clash = rowsOf<{ id: string }>(
      await tx.execute(sql`
        SELECT id FROM public.scim_provisioned_users
         WHERE organization_id = ${ref.organizationId}::uuid AND deleted_at IS NULL AND external_id = ${externalId} AND user_name_key <> ${key}
         LIMIT 1`),
    );
    if (clash.length > 0) return { outcome: 'external_id_conflict', member: null };
  }

  const existing = rowsOf<StateRow>(
    await tx.execute(sql`
      SELECT ${STATE_COLUMNS}
        FROM public.scim_provisioned_users
       WHERE organization_id = ${ref.organizationId}::uuid AND user_name_key = ${key}
       ORDER BY (deleted_at IS NULL) DESC, created_at DESC
       LIMIT 1
         FOR UPDATE`),
  )[0];

  if (existing) {
    if (existing.deleted_at === null) return { outcome: 'exists', member: memberFrom(existing) };
    // A removed person named again by the identity provider is provisioned again as a pending person, not refused as an existing one.
    const revived = rowsOf<MemberRow>(
      await tx.execute(sql`
        UPDATE public.scim_provisioned_users
           SET deleted_at = NULL, status = 'pending',
               deprovisioned_at = NULL, deprovisioned_action = NULL, deprovisioned_by = NULL, deprovisioned_via = NULL, reactivated_at = NULL,
               user_name = ${userName}, external_id = ${externalId},
               display_name = COALESCE(${name}, display_name), email = COALESCE(${email}, email),
               config_id = ${ref.configurationId}::uuid, provisioned_at = now(), updated_at = now()
         WHERE id = ${existing.id}::uuid AND organization_id = ${ref.organizationId}::uuid
         RETURNING ${MEMBER_COLUMNS}`),
    )[0];
    if (!revived) throw new Error('SCIM provisioning returned no result');
    return { outcome: 'reprovisioned', member: memberFrom(revived) };
  }

  const created = rowsOf<MemberRow>(
    await tx.execute(sql`
      INSERT INTO public.scim_provisioned_users (organization_id, config_id, user_name, user_name_key, external_id, display_name, email)
      VALUES (${ref.organizationId}::uuid, ${ref.configurationId}::uuid, ${userName}, ${key}, ${externalId}, ${name}, ${email})
      RETURNING ${MEMBER_COLUMNS}`),
  )[0];
  if (!created) throw new Error('SCIM provisioning returned no result');
  return { outcome: 'created', member: memberFrom(created) };
}

export async function listScimMembers(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  page: { startIndex: number; count: number },
): Promise<{ total: number; members: ScimMember[] }> {
  await assertConfigurationLive(tx, ref, false);
  const totals = rowsOf<{ total: string | number }>(
    await tx.execute(sql`SELECT count(*) AS total FROM public.scim_provisioned_users WHERE organization_id = ${ref.organizationId}::uuid AND deleted_at IS NULL`),
  );
  const total = Number(totals[0]?.total ?? 0);
  if (page.count <= 0) return { total, members: [] };
  const rows = rowsOf<MemberRow>(
    await tx.execute(sql`
      SELECT ${MEMBER_COLUMNS}
        FROM public.scim_provisioned_users
       WHERE organization_id = ${ref.organizationId}::uuid AND deleted_at IS NULL
       ORDER BY created_at ASC, id ASC
      OFFSET ${Math.max(0, page.startIndex - 1)}::int
       LIMIT ${Math.min(100, page.count)}::int`),
  );
  return { total, members: rows.map(memberFrom) };
}

export type ScimUpdateOutcome = 'updated' | 'unchanged' | 'not_found' | 'external_id_conflict' | 'held';
export type ScimDeprovisionOutcome = 'deprovisioned' | 'unchanged' | 'not_found';
export type ScimDeprovisionAction = 'suspend' | 'archive' | 'delete';

/** The attributes the identity provider owns. An absent key is left as it is; `externalId: null` removes it. */
export interface ScimMemberChanges {
  name?: string;
  email?: string;
  externalId?: string | null;
  /** Restore a person this same stream deprovisioned. It never restores a person the organization itself suspended. */
  reactivate?: boolean;
}

/** The people this organization's directory holds that match a filter on userName or externalId. At most a handful, so there is no paging. */
export async function findScimMembers(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  filter: { attribute: 'userName' | 'externalId'; value: string },
): Promise<ScimMember[]> {
  await assertConfigurationLive(tx, ref, false);
  const value = filter.value.trim();
  if (value === '') return [];
  const predicate = filter.attribute === 'userName' ? sql`user_name_key = ${value.toLowerCase()}` : sql`external_id = ${value}`;
  const rows = rowsOf<MemberRow>(
    await tx.execute(sql`
      SELECT ${MEMBER_COLUMNS}
        FROM public.scim_provisioned_users
       WHERE organization_id = ${ref.organizationId}::uuid AND deleted_at IS NULL AND ${predicate}
       ORDER BY created_at ASC, id ASC
       LIMIT 100`),
  );
  return rows.map(memberFrom);
}

/** One person of this organization's directory. A removed person is not found, whatever the id. */
export async function getScimMember(tx: RLSTx, ref: ScimConfigurationRef, memberId: string): Promise<ScimMember | null> {
  await assertConfigurationLive(tx, ref, false);
  const rows = rowsOf<MemberRow>(
    await tx.execute(sql`
      SELECT ${MEMBER_COLUMNS}
        FROM public.scim_provisioned_users
       WHERE id = ${memberId}::uuid AND organization_id = ${ref.organizationId}::uuid AND deleted_at IS NULL`),
  );
  return rows[0] ? memberFrom(rows[0]) : null;
}

async function lockedMember(tx: RLSTx, ref: ScimConfigurationRef, memberId: string): Promise<StateRow | null> {
  await lock(tx, `scim-member:${memberId}`);
  const rows = rowsOf<StateRow>(
    await tx.execute(sql`
      SELECT ${STATE_COLUMNS}
        FROM public.scim_provisioned_users
       WHERE id = ${memberId}::uuid AND organization_id = ${ref.organizationId}::uuid AND deleted_at IS NULL
         FOR UPDATE`),
  );
  return rows[0] ?? null;
}

export async function updateScimMember(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  memberId: string,
  changes: ScimMemberChanges,
): Promise<{ outcome: ScimUpdateOutcome; member: ScimMember | null }> {
  await assertConfigurationLive(tx, ref, true);
  const name = clean(changes.name);
  const email = clean(changes.email);
  const externalId = changes.externalId === null ? null : clean(changes.externalId);
  assertBounds({ externalId, name, email });

  const current = await lockedMember(tx, ref, memberId);
  if (!current) return { outcome: 'not_found', member: null };

  let nextExternalId: string | null = current.external_id;
  let changed = false;
  if (externalId !== null && externalId !== undefined && externalId !== current.external_id) {
    await lock(tx, `scim-external:${ref.organizationId}:${externalId}`);
    const clash = rowsOf<{ id: string }>(
      await tx.execute(sql`
        SELECT id FROM public.scim_provisioned_users
         WHERE organization_id = ${ref.organizationId}::uuid AND deleted_at IS NULL AND id <> ${current.id}::uuid AND external_id = ${externalId}
         LIMIT 1`),
    );
    if (clash.length > 0) return { outcome: 'external_id_conflict', member: null };
    nextExternalId = externalId;
    changed = true;
  } else if (changes.externalId === null && current.external_id !== null) {
    nextExternalId = null;
    changed = true;
  }

  let nextStatus = current.status;
  let clearDeprovision = false;
  if (changes.reactivate === true && (current.status === 'suspended' || current.status === 'inactive')) {
    // Only a deprovision this stream made is undone by it. A person the organization itself suspended stays as it is, and nothing is written.
    if (current.deprovisioned_by !== 'scim') return { outcome: 'held', member: memberFrom(current) };
    nextStatus = 'pending';
    clearDeprovision = true;
    changed = true;
  }

  const nextName = name !== null && name !== current.display_name ? name : null;
  const nextEmail = email !== null && email !== current.email ? email : null;
  if (nextName !== null || nextEmail !== null) changed = true;
  if (!changed) return { outcome: 'unchanged', member: memberFrom(current) };

  const updated = rowsOf<MemberRow>(
    await tx.execute(sql`
      UPDATE public.scim_provisioned_users
         SET display_name = COALESCE(${nextName}, display_name),
             email = COALESCE(${nextEmail}, email),
             external_id = ${nextExternalId},
             status = ${nextStatus},
             deprovisioned_at = ${clearDeprovision ? sql`NULL` : sql`deprovisioned_at`},
             deprovisioned_action = ${clearDeprovision ? sql`NULL` : sql`deprovisioned_action`},
             deprovisioned_by = ${clearDeprovision ? sql`NULL` : sql`deprovisioned_by`},
             deprovisioned_via = ${clearDeprovision ? sql`NULL` : sql`deprovisioned_via`},
             reactivated_at = ${clearDeprovision ? sql`now()` : sql`reactivated_at`},
             updated_at = now()
       WHERE id = ${current.id}::uuid AND organization_id = ${ref.organizationId}::uuid
       RETURNING ${MEMBER_COLUMNS}`),
  )[0];
  if (!updated) throw new Error('SCIM member update returned no result');
  return { outcome: 'updated', member: memberFrom(updated) };
}

const DEPROVISION_STATUS: Record<ScimDeprovisionAction, 'suspended' | 'inactive' | 'revoked'> = {
  suspend: 'suspended',
  archive: 'inactive',
  delete: 'revoked',
};

/**
 * Applies the organization's own configured deprovision action to a person of its directory. The action is read from the configuration, not passed
 * by the caller, a value it does not know suspends (reversible) and never destroys, and no row is ever removed: delete is a soft delete.
 */
export async function deprovisionScimMember(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  memberId: string,
  via: 'patch' | 'put' | 'delete',
): Promise<{ outcome: ScimDeprovisionOutcome; action: ScimDeprovisionAction | null; member: ScimMember | null }> {
  await assertConfigurationLive(tx, ref, true);
  const current = await lockedMember(tx, ref, memberId);
  if (!current) return { outcome: 'not_found', action: null, member: null };

  const configured = rowsOf<{ deprovision_action: string | null }>(
    await tx.execute(sql`SELECT deprovision_action FROM public.scim_configurations WHERE id = ${ref.configurationId}::uuid AND organization_id = ${ref.organizationId}::uuid`),
  )[0]?.deprovision_action;
  const action: ScimDeprovisionAction = configured === 'archive' || configured === 'delete' ? configured : 'suspend';

  if (current.status === 'suspended' || current.status === 'inactive' || current.status === 'revoked') {
    return { outcome: 'unchanged', action, member: memberFrom(current) };
  }

  const updated = rowsOf<MemberRow>(
    await tx.execute(sql`
      UPDATE public.scim_provisioned_users
         SET status = ${DEPROVISION_STATUS[action]},
             deprovisioned_at = now(), deprovisioned_action = ${action}, deprovisioned_by = 'scim', deprovisioned_via = ${via},
             reactivated_at = NULL,
             deleted_at = ${action === 'delete' ? sql`now()` : sql`deleted_at`},
             updated_at = now()
       WHERE id = ${current.id}::uuid AND organization_id = ${ref.organizationId}::uuid
       RETURNING ${MEMBER_COLUMNS}`),
  )[0];
  if (!updated) throw new Error('SCIM deprovisioning returned no result');
  return { outcome: 'deprovisioned', action, member: memberFrom(updated) };
}

/** The SCIM 2.0 representation. A provisioned person is never active: nothing links them to an account (SCIM_MEMBER_LINK). */
export function toScimUser(member: ScimMember, location?: string) {
  const parts = (member.name ?? '').split(' ');
  const givenName = parts[0] ?? '';
  const familyName = parts.slice(1).join(' ');
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: member.id,
    ...(member.externalId ? { externalId: member.externalId } : {}),
    userName: member.userName,
    name: {
      givenName,
      familyName,
      formatted: member.name ?? '',
    },
    emails: member.email ? [{ value: member.email, primary: true, type: 'work' }] : [],
    active: false,
    meta: {
      resourceType: 'User',
      created: member.provisionedAt ?? member.createdAt,
      lastModified: member.updatedAt,
      ...(location ? { location } : {}),
    },
  };
}
