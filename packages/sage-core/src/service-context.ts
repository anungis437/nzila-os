// ─── @nzila/sage-core — service context ──────────────────────────────────────
// Explicit, no globals. The actor carries the resolved permission set
// (from @nzila/platform-auth); services check SAGE_PERMISSIONS against it.

/**
 * Classification of the authenticated actor, derived from trusted session
 * information by the platform runtime — never supplied by the browser.
 *
 *  - 'human'   an authenticated interactive person
 *  - 'service' a service principal / machine identity
 *  - 'system'  internal/system execution (jobs, migrations, bootstrap)
 *
 * Named-human governance operations (review notes, boundary resolution, decision
 * records) require `'human'`; a real UUID belonging to a service principal is
 * NOT sufficient.
 */
export type SageActorKind = 'human' | 'service' | 'system'

export type SageServiceActor = {
  actorId: string
  orgId: string
  permissions: string[]
  /**
   * Trusted actor classification. Optional at the type level for backward
   * compatibility, but `assertActorIsHuman` requires an explicit `'human'`
   * (absent/undefined fails closed).
   */
  actorKind?: SageActorKind
}

export type SageServiceContext = {
  actor: SageServiceActor
  /** Injectable clock for deterministic tests. Defaults to Date. */
  now?: () => Date
}

export function contextNow(ctx: SageServiceContext): string {
  return (ctx.now?.() ?? new Date()).toISOString()
}
