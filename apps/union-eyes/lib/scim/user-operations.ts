/**
 * What an identity provider's change to a provisioned person does, as one unit on the caller's system transaction: the attribute update, the
 * restoration or the deprovision, and the audit of each effective change. The database functions of cache 0049 decide what is allowed (only a
 * person this configuration provisioned, only through the organization's own configured action); this applies them in order and records them.
 * A change that changed nothing is not audited, and a refusal writes nothing.
 */
import type { RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { ScimUserChanges } from '@/lib/scim/patch';
import { ScimHttpError } from '@/lib/scim/responses';
import {
  deprovisionScimMember,
  getScimMember,
  updateScimMember,
  type ScimConfigurationRef,
  type ScimDeprovisionAction,
  type ScimMember,
} from '@/lib/scim/provisioned-members';

const principal = (ref: ScimConfigurationRef) => `system:scim:${ref.configurationId}`;
const notFound = () => new ScimHttpError(404, 'User not found');

// The stored name is one string; a change to the given or family name keeps the other part as it is.
function composeName(current: string | null, changes: ScimUserChanges): string | undefined {
  if (changes.givenName === undefined && changes.familyName === undefined) return changes.displayName;
  const parts = (current ?? '').split(' ');
  const given = changes.givenName ?? parts[0] ?? '';
  const family = changes.familyName ?? parts.slice(1).join(' ');
  return [given, family].filter(Boolean).join(' ') || undefined;
}

/** The userName a person was provisioned under: the key is scim:<organization>:<lower-cased userName>. */
const provisionedUserName = (member: ScimMember, ref: ScimConfigurationRef) => member.userId.slice(`scim:${ref.organizationId}:`.length);

export interface ScimChangeResult {
  member: ScimMember;
  /** The person was deprovisioned by this request (not already so). */
  deprovisioned: ScimDeprovisionAction | null;
}

export async function applyScimUserChanges(
  tx: RLSTx,
  ref: ScimConfigurationRef,
  memberId: string,
  changes: ScimUserChanges,
  via: 'patch' | 'put',
): Promise<ScimChangeResult> {
  const current = await getScimMember(tx, ref, memberId);
  if (!current) throw notFound();
  if (changes.userName !== undefined && changes.userName.toLowerCase() !== provisionedUserName(current, ref)) {
    throw new ScimHttpError(400, 'userName identifies the person and is not changed by an update', 'mutability');
  }

  let member = current;
  const name = composeName(current.name, changes);
  const reactivate = changes.active === true;
  if (name !== undefined || changes.email !== undefined || changes.externalId !== undefined || reactivate) {
    const { outcome, member: updated } = await updateScimMember(tx, ref, memberId, { name, email: changes.email, externalId: changes.externalId, reactivate });
    if (outcome === 'not_found') throw notFound();
    if (outcome === 'external_id_conflict') throw new ScimHttpError(409, 'Another user of the organization already has this externalId', 'uniqueness');
    if (outcome === 'held') {
      throw new ScimHttpError(409, 'This person was suspended by the organization, not by the identity provider, and is not reactivated by it');
    }
    if (updated) member = updated;
    if (outcome === 'updated') {
      const fields = [
        ...(updated && updated.name !== current.name ? ['name'] : []),
        ...(updated && updated.email !== current.email ? ['email'] : []),
        ...(changes.externalId !== undefined ? ['externalId'] : []),
      ];
      if (updated && updated.status !== current.status) {
        await persistAtomicAudit(tx, {
          organizationId: ref.organizationId,
          userId: principal(ref),
          action: 'scim.user.reactivate',
          resourceType: 'organization_members',
          resourceId: updated.id,
          details: { from: current.status, to: updated.status, via },
        });
      }
      if (fields.length > 0) {
        await persistAtomicAudit(tx, {
          organizationId: ref.organizationId,
          userId: principal(ref),
          action: 'scim.user.update',
          resourceType: 'organization_members',
          resourceId: member.id,
          details: { fields, via },
        });
      }
    }
  }

  let deprovisioned: ScimDeprovisionAction | null = null;
  if (changes.active === false) {
    const result = await deprovisionScimMember(tx, ref, memberId, via);
    if (result.outcome === 'not_found') throw notFound();
    if (result.member) member = result.member;
    if (result.outcome === 'deprovisioned') {
      deprovisioned = result.action;
      await persistAtomicAudit(tx, {
        organizationId: ref.organizationId,
        userId: principal(ref),
        action: 'scim.user.deprovision',
        resourceType: 'organization_members',
        resourceId: member.id,
        details: { action: result.action, from: current.status, via },
      });
    }
  }
  return { member, deprovisioned };
}

/** DELETE: the organization's configured deprovision action. A person already deprovisioned stays so, and the request is answered as done. */
export async function removeScimUser(tx: RLSTx, ref: ScimConfigurationRef, memberId: string): Promise<{ deprovisioned: ScimDeprovisionAction | null }> {
  const result = await deprovisionScimMember(tx, ref, memberId, 'delete');
  if (result.outcome === 'not_found') throw notFound();
  if (result.outcome === 'deprovisioned') {
    await persistAtomicAudit(tx, {
      organizationId: ref.organizationId,
      userId: principal(ref),
      action: 'scim.user.deprovision',
      resourceType: 'organization_members',
      resourceId: result.member?.id,
      details: { action: result.action, via: 'delete' },
    });
  }
  return { deprovisioned: result.outcome === 'deprovisioned' ? result.action : null };
}
