// ─── @nzila/sage-core — Phase 8A external-recipient access context ───────────
// A verified external recipient is NOT a workspace/org actor. Recipient package
// access uses this dedicated context — it carries no org role, no workspace
// role, and no permission set, and it is structurally + nominally distinct from
// `SageServiceContext` so the two can never be substituted for one another.

/**
 * Trusted external-recipient identity, derived SERVER-SIDE from a claimed,
 * grant-scoped recipient session — never from a browser-supplied field. An
 * external recipient always maps to actor kind 'human' but never receives a
 * `SageServiceContext`.
 */
export interface SageRecipientActor {
  readonly actorKind: 'human'
  readonly authenticationType: 'external_recipient'
  /** Identity provider that vouches for the recipient (e.g. the invitation flow). */
  identityProvider: string
  /** Stable subject id within that provider. Bound at grant claim. */
  identitySubject: string
}

/**
 * Grant-scoped recipient access context. The literal `kind` discriminant makes
 * this nominally incompatible with `SageServiceContext` (which has no such
 * field and requires `actor.orgId`/`actor.permissions`).
 */
export interface SageRecipientAccessContext {
  readonly kind: 'sage_recipient_access'
  actor: SageRecipientActor
  recipientId: string
  grantId: string
  /** Injectable clock for deterministic tests. Defaults to Date. */
  now?: () => Date
}

export function recipientContextNow(ctx: SageRecipientAccessContext): string {
  return (ctx.now?.() ?? new Date()).toISOString()
}

/**
 * Runtime guard: a value is a valid recipient access context. Fails closed on
 * any missing/incorrect discriminant so a `SageServiceContext` (or a forged
 * object) can never be used to reach recipient services.
 */
export function isSageRecipientAccessContext(value: unknown): value is SageRecipientAccessContext {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<SageRecipientAccessContext> & { actor?: Partial<SageRecipientActor> }
  return (
    v.kind === 'sage_recipient_access' &&
    typeof v.recipientId === 'string' &&
    v.recipientId.length > 0 &&
    typeof v.grantId === 'string' &&
    v.grantId.length > 0 &&
    typeof v.actor === 'object' &&
    v.actor !== null &&
    v.actor.actorKind === 'human' &&
    v.actor.authenticationType === 'external_recipient' &&
    typeof v.actor.identityProvider === 'string' &&
    v.actor.identityProvider.length > 0 &&
    typeof v.actor.identitySubject === 'string' &&
    v.actor.identitySubject.length > 0
  )
}
