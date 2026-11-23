/**
 * Platform Admin — SAGE institutional capacity store wiring (server-only)
 *
 * Live HTTP paths must not default conflict/recusal to clear. Prefer the
 * SQL-backed store constructed with the same transactional client used for
 * mandate FOR UPDATE locking. The unavailable singleton remains for callers
 * that have not yet attached a SQL client (fail closed).
 */
import 'server-only'
import {
  SqlSageInstitutionalCapacityStore,
  type SageInstitutionalCapacityStore,
  type SageSqlClient,
} from '@nzila/sage-core'

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
 * Fail-closed placeholder when no transactional SQL client is available.
 * Prefer {@link createSageInstitutionalCapacityStore}.
 */
export function getSageInstitutionalCapacityStore(): SageInstitutionalCapacityStore {
  return UNAVAILABLE
}

/**
 * Build a capacity store bound to the caller's transactional SQL client.
 */
export function createSageInstitutionalCapacityStore(
  sql: SageSqlClient,
  evaluatedAt?: string,
): SageInstitutionalCapacityStore {
  return new SqlSageInstitutionalCapacityStore(sql, evaluatedAt)
}
