/**
 * Public DB API for @nzila/staging-seed.
 *
 * Phase 3A.0 ships a generic JSONB persistence store
 * (`staging_seed_artifacts`) plus a tamper-evident audit log
 * (`staging_seed_runs`). Per-app native-table writers (Phase 3B) will
 * read from these tables and migrate payload fields into native columns
 * incrementally without touching the seeders.
 */
export {
  STAGING_ENV_FLAG,
  DATABASE_URL_ENV,
  URL_ALLOWLIST_ENV,
  evaluateSafety,
  isSafeStagingOrgId,
  assertSafeStagingOrgId,
  type SafetyDecision,
  type SafetyEnv,
} from './safety'

export {
  createInMemoryAdapter,
  type DbAdapter,
  type DbTx,
  type StagingSeedArtifactRow,
  type StagingSeedRunRow,
} from './adapter'

export {
  persistAppPlan,
  resetForOrgs,
  type AppPlanEntity,
  type AppPlanSnapshot,
  type PersistOptions,
  type PersistResult,
} from './persister'

export { createPostgresAdapter, type PostgresAdapterOptions } from './postgres-adapter'
