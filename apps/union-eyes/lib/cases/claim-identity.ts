import { sql, type SQL } from 'drizzle-orm'
import type { CaseActor } from './case-authorization'

/**
 * Anonymous filing for claims (`claims.is_anonymous`).
 *
 * An anonymous claim keeps the member's identity (member id, name, email, phone) away from everyone who can otherwise
 * read the case, except:
 *   - the member who filed it, and
 *   - principals who hold a LIVE, non-recused, direct relationship to the case that exists to represent that member:
 *     `creator` (staff who opened it on the member's behalf already know who it is), `owner`, `assignee`
 *     and `represented_member`.
 *
 * Everyone else who reaches the case — a `collaborator`, a supervisory mandate, a delegation, an emergency grant, a
 * triage designation, an export — sees the case without the identity. This only ever NARROWS what a read returns; it
 * never grants access to a case (that remains the kernel's decision, see case-authorization.ts).
 *
 * Unknown or NULL `is_anonymous` is treated as anonymous: hiding an identity by mistake is recoverable, exposing one is not.
 */
export const IDENTITY_REVEALING_RELATIONS = ['creator', 'owner', 'assignee', 'represented_member'] as const

/** The member-identity fields a claim read can carry. Lists, detail and workbench projections all use these names. */
export const CLAIM_IDENTITY_FIELDS = ['memberId', 'memberName', 'memberEmail', 'memberPhone'] as const

/**
 * SQL boolean: may `actor` see the identity of the member on claim row `c`?
 * The query must alias the claims table as `c`.
 */
export function claimIdentityVisible(actor: Pick<CaseActor, 'userId'>): SQL {
  return sql`(
    c.is_anonymous IS FALSE
    OR c.member_id = ${actor.userId}
    OR EXISTS (
      SELECT 1 FROM ue_authority_resource_relationships r
       WHERE r.resource_type = 'case'
         AND r.resource_id = c.claim_id
         AND r.organization_id = c.organization_id
         AND r.principal_user_id = ${actor.userId}
         AND r.relation IN ('creator', 'owner', 'assignee', 'represented_member')
         AND r.status = 'active' AND r.revoked_at IS NULL
         AND r.effective_at <= now() AND (r.expires_at IS NULL OR r.expires_at > now())
         AND NOT EXISTS (
           SELECT 1 FROM ue_authority_recusals z
            WHERE z.organization_id = r.organization_id AND z.principal_user_id = r.principal_user_id
              AND z.resource_type = 'case' AND z.resource_id = r.resource_id AND z.lifted_at IS NULL)
    )
  )`
}

/** `expr` when the identity is visible to `actor`, otherwise NULL. Use for every identity column a claim read selects. */
export function claimIdentityColumn(actor: Pick<CaseActor, 'userId'>, expr: SQL): SQL {
  return sql`CASE WHEN ${claimIdentityVisible(actor)} THEN ${expr} END`
}

/**
 * The identity columns a claim read selects, already gated. `m` must be the `organization_members` join on the member.
 * `withPhone` adds the phone number (detail views only).
 */
export function claimIdentitySelect(actor: Pick<CaseActor, 'userId'>, withPhone = false): SQL {
  const phone = withPhone ? sql`, ${claimIdentityColumn(actor, sql`m.phone`)} AS "memberPhone"` : sql``
  return sql`${claimIdentityColumn(actor, sql`c.member_id`)} AS "memberId",
             ${claimIdentityColumn(actor, sql`m.name`)} AS "memberName",
             ${claimIdentityColumn(actor, sql`m.email`)} AS "memberEmail"${phone}`
}
