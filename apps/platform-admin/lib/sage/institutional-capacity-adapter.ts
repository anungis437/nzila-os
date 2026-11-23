/**
 * Platform Admin — SAGE institutional capacity store wiring (server-only)
 *
 * Live HTTP paths must not default conflict/recusal to clear. Until a durable
 * institutional capacity/recusal repository is attached, this adapter returns
 * null answers so admission fails closed (CONFLICT_DATA_UNAVAILABLE /
 * CAPACITY_DATA_UNAVAILABLE).
 */
import 'server-only'
import type { SageInstitutionalCapacityStore } from '@nzila/sage-core'

class UnavailableSageInstitutionalCapacityStore implements SageInstitutionalCapacityStore {
  async resolveActivePosition(): Promise<string | null> {
    return null
  }

  async resolveConflictOrRecusal(): Promise<boolean | null> {
    return null
  }
}

const UNAVAILABLE = new UnavailableSageInstitutionalCapacityStore()

/**
 * Returns the capacity store for consequential institutional actions.
 * Currently fail-closed (unavailable) until a verified production store exists.
 */
export function getSageInstitutionalCapacityStore(): SageInstitutionalCapacityStore {
  return UNAVAILABLE
}
