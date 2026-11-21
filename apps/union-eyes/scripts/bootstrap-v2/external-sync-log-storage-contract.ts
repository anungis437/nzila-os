/** Prospective source-only least-privilege correction; historical registry is immutable. */
import { getTableConfig } from 'drizzle-orm/pg-core'
import { externalDataSyncLog } from '../../db/schema/domains/data/benchmarks'
import { SYNC_LOG_OVERVIEW_COLUMNS } from '../../lib/dashboard-reads/data-source-contract'
import type { StorageAuthorityEntry } from '../../db/rls-storage-authority'
import type { SourceTable } from './source'
export const EXTERNAL_SYNC_LOG_DECLARATION_SOURCE =
  'apps/union-eyes/db/schema/domains/data/benchmarks.ts'
export const EXTERNAL_SYNC_LOG_MODEL_SOURCE = 'apps/union-eyes/backend/analytics/models.py'
export const EXTERNAL_SYNC_LOG_CONTRACT_SOURCE =
  'apps/union-eyes/scripts/bootstrap-v2/external-sync-log-storage-contract.ts'
export const EXTERNAL_SYNC_LOG_SYSTEM_READ_COLUMNS = SYNC_LOG_OVERVIEW_COLUMNS
const config = getTableConfig(externalDataSyncLog)
if (
  config.name !== 'external_data_sync_log' ||
  (config.schema && config.schema !== 'public') ||
  new Set(SYNC_LOG_OVERVIEW_COLUMNS).size !== 13 ||
  SYNC_LOG_OVERVIEW_COLUMNS.some((name) => !config.columns.some((column) => column.name === name))
)
  throw new Error('UE_V2_SYNC_LOG_DECLARATION_COLUMNS_REQUIRED')
export function assertCurrentExternalSyncLogSource(
  table: Pick<SourceTable, 'name' | 'source'>,
): boolean {
  if (table.name !== 'external_data_sync_log') return false
  if (
    ![EXTERNAL_SYNC_LOG_DECLARATION_SOURCE, EXTERNAL_SYNC_LOG_MODEL_SOURCE].includes(table.source)
  )
    throw new Error('UE_V2_SYNC_LOG_DECLARATION_SOURCE_REQUIRED')
  return true
}
const same = (actual: readonly string[] | string, expected: readonly string[]) =>
  Array.isArray(actual) &&
  JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
export function currentExternalSyncLogAuthority(
  table: Pick<SourceTable, 'name' | 'source'>,
  inherited: StorageAuthorityEntry | null,
): StorageAuthorityEntry | undefined {
  if (!assertCurrentExternalSyncLogSource(table)) return undefined
  if (
    !inherited ||
    inherited.classification !== 'GLOBAL_REFERENCE_DATA' ||
    !same(inherited.requiredRuntimePrivileges, ['INSERT', 'UPDATE']) ||
    !(
      same(inherited.requiredSystemPrivileges, ['SELECT', 'INSERT', 'UPDATE']) ||
      same(inherited.requiredSystemPrivileges, ['INSERT', 'UPDATE'])
    ) ||
    inherited.invocationAuthority !== 'SYSTEM_SCHEDULE' ||
    inherited.dbExecutionPrincipal !== 'MIXED' ||
    ![
      'lib/services/external-data/wage-enrichment-service.ts',
      'lib/dashboard-reads/data-source.ts',
    ].every((caller) => inherited.supportingCapability.includes(caller))
  )
    throw new Error('UE_V2_SYNC_LOG_SOURCE_WRITE_AUTHORITY_REQUIRED')
  return {
    ...inherited,
    reason:
      'Prospective current-source operational sync-log projection: preserve the actual overview thirteen fields and cron sync_id predicate under exact SYSTEM column SELECT, with unchanged source INSERT/UPDATE and caller authority. No table SELECT, diagnostic details, initiator, arbitrary parameters, retained extra columns or ordinary read authority. Historical registry, schema and rows remain intact.',
    supportingCapability: [
      ...new Set([
        ...inherited.supportingCapability,
        EXTERNAL_SYNC_LOG_DECLARATION_SOURCE,
        EXTERNAL_SYNC_LOG_MODEL_SOURCE,
        EXTERNAL_SYNC_LOG_CONTRACT_SOURCE,
        'apps/union-eyes/lib/dashboard-reads/data-source-contract.ts',
      ]),
    ],
    requiredSystemPrivileges: ['INSERT', 'UPDATE'],
  }
}
export function assertExternalSyncLogColumnAuthority(
  table: Pick<SourceTable, 'name' | 'source'>,
  runtime: readonly string[],
  system: readonly string[],
) {
  if (!assertCurrentExternalSyncLogSource(table)) return false
  if (!same(runtime, ['INSERT', 'UPDATE']) || !same(system, ['INSERT', 'UPDATE']))
    throw new Error('UE_V2_SYNC_LOG_COLUMN_AUTHORITY_REQUIRED')
  return true
}
