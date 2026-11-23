// ─── @nzila/sage-core — institutional capacity / recusal resolution ──────────
//
// Browser-supplied position labels and "I am not conflicted" claims are not
// institutional facts. Consequential admission requires a server-side capacity
// resolution. When the store cannot answer, callers MUST fail closed.

export type SageInstitutionalCapacityLookup = {
  orgId: string
  workspaceId: string
  actorId: string
  resourceId: string
  action: string
  /** Opaque mandate id selected for the act — used to bind office/position. */
  mandateId: string
  /** Position recorded on the locked institutional mandate. */
  mandatePositionId: string
  /** Optional browser-claimed position; when present must match the mandate. */
  claimedPositionId?: string | null
}

export type SageInstitutionalCapacityResolution =
  | {
      resolved: true
      currentPositionId: string
      conflictOrRecusal: boolean
    }
  | {
      resolved: false
      reason:
        | 'CAPACITY_DATA_UNAVAILABLE'
        | 'POSITION_CLAIM_MISMATCH'
        | 'POSITION_UNRESOLVED'
        | 'CONFLICT_DATA_UNAVAILABLE'
    }

/**
 * Trusted capacity/recusal store. Implementations must never read browser
 * verification labels as authority. Returning null for conflict means
 * unavailable (fail closed), not "clear".
 */
export interface SageInstitutionalCapacityStore {
  /**
   * Resolve the actor's active office/position for this workspace.
   * Return null when unknown / store unavailable.
   */
  resolveActivePosition(input: {
    orgId: string
    workspaceId: string
    actorId: string
  }): Promise<string | null>

  /**
   * Resolve conflict/recusal for the exact resource/action.
   * `true` / `false` when verified; `null` when unavailable.
   */
  resolveConflictOrRecusal(input: {
    orgId: string
    workspaceId: string
    actorId: string
    resourceId: string
    action: string
  }): Promise<boolean | null>
}

/**
 * Fail-closed capacity resolution for consequential institutional actions.
 *
 * - Active position must be server-resolved and match the locked mandate office.
 * - Optional browser position claim, when present, must match that same office.
 * - Conflict/recusal must be server-resolved; unavailable ⇒ not admitted.
 */
export async function resolveInstitutionalCapacityForAdmission(
  store: SageInstitutionalCapacityStore | null,
  input: SageInstitutionalCapacityLookup,
): Promise<SageInstitutionalCapacityResolution> {
  if (!store) {
    return { resolved: false, reason: 'CAPACITY_DATA_UNAVAILABLE' }
  }

  const activePosition = await store.resolveActivePosition({
    orgId: input.orgId,
    workspaceId: input.workspaceId,
    actorId: input.actorId,
  })
  if (!activePosition || !activePosition.trim()) {
    return { resolved: false, reason: 'POSITION_UNRESOLVED' }
  }
  if (activePosition !== input.mandatePositionId) {
    return { resolved: false, reason: 'POSITION_CLAIM_MISMATCH' }
  }
  if (
    input.claimedPositionId != null &&
    input.claimedPositionId.trim() !== '' &&
    input.claimedPositionId !== input.mandatePositionId
  ) {
    return { resolved: false, reason: 'POSITION_CLAIM_MISMATCH' }
  }

  const conflict = await store.resolveConflictOrRecusal({
    orgId: input.orgId,
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    resourceId: input.resourceId,
    action: input.action,
  })
  if (conflict === null) {
    return { resolved: false, reason: 'CONFLICT_DATA_UNAVAILABLE' }
  }

  return {
    resolved: true,
    currentPositionId: activePosition,
    conflictOrRecusal: conflict,
  }
}

/** In-memory capacity store for LOCAL_TESTED proofs — never a production authority. */
export class InMemorySageInstitutionalCapacityStore implements SageInstitutionalCapacityStore {
  constructor(
    private readonly state: {
      positions: Map<string, string>
      conflicts: Map<string, boolean>
    } = { positions: new Map(), conflicts: new Map() },
  ) {}

  private posKey(orgId: string, workspaceId: string, actorId: string): string {
    return `${orgId}::${workspaceId}::${actorId}`
  }

  private conflictKey(
    orgId: string,
    workspaceId: string,
    actorId: string,
    resourceId: string,
    action: string,
  ): string {
    return `${orgId}::${workspaceId}::${actorId}::${resourceId}::${action}`
  }

  setPosition(orgId: string, workspaceId: string, actorId: string, positionId: string): void {
    this.state.positions.set(this.posKey(orgId, workspaceId, actorId), positionId)
  }

  setConflict(
    orgId: string,
    workspaceId: string,
    actorId: string,
    resourceId: string,
    action: string,
    conflictOrRecusal: boolean,
  ): void {
    this.state.conflicts.set(
      this.conflictKey(orgId, workspaceId, actorId, resourceId, action),
      conflictOrRecusal,
    )
  }

  async resolveActivePosition(input: {
    orgId: string
    workspaceId: string
    actorId: string
  }): Promise<string | null> {
    return this.state.positions.get(this.posKey(input.orgId, input.workspaceId, input.actorId)) ?? null
  }

  async resolveConflictOrRecusal(input: {
    orgId: string
    workspaceId: string
    actorId: string
    resourceId: string
    action: string
  }): Promise<boolean | null> {
    const key = this.conflictKey(
      input.orgId,
      input.workspaceId,
      input.actorId,
      input.resourceId,
      input.action,
    )
    if (!this.state.conflicts.has(key)) return null
    return this.state.conflicts.get(key)!
  }
}
