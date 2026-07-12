// ─── @nzila/sage-core — service context ──────────────────────────────────────
// Explicit, no globals. The actor carries the resolved permission set
// (from @nzila/platform-auth); services check SAGE_PERMISSIONS against it.

export type SageServiceActor = {
  actorId: string
  orgId: string
  permissions: string[]
}

export type SageServiceContext = {
  actor: SageServiceActor
  /** Injectable clock for deterministic tests. Defaults to Date. */
  now?: () => Date
}

export function contextNow(ctx: SageServiceContext): string {
  return (ctx.now?.() ?? new Date()).toISOString()
}
