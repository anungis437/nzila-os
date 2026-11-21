/** Existing SaaS module admission needs contract state, never prices or a
 * tenant's power to issue, amend or revoke its own commercial terms. */
import { getTableConfig } from 'drizzle-orm/pg-core'
import { commercialContracts, contractLineItems, orgEntitlements } from '../../db/schema/domains/finance/contracts'
import { contractCoveredOrgs } from '../../db/schema/domains/finance/contract-amendments'
import type { StorageAuthorityEntry } from '../../db/rls-storage-authority'
import type { SourceTable } from './source'

const contractsSource = 'apps/union-eyes/db/schema/domains/finance/contracts.ts'
const coverageSource = 'apps/union-eyes/db/schema/domains/finance/contract-amendments.ts'
export const MODULE_ADMISSION_DECLARATION_OWNERS: Readonly<Record<string, string>> = Object.freeze({
  commercial_contracts: contractsSource,
  contract_line_items: contractsSource,
  org_entitlements: contractsSource,
  contract_covered_orgs: coverageSource,
})
export const MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS: Readonly<Record<string, { select: readonly string[]; insert?: never }>> = Object.freeze({
  commercial_contracts: { select: ['id', 'organization_id', 'status', 'expiration_date'] },
  contract_line_items: { select: ['id', 'contract_id'] },
  org_entitlements: { select: ['id', 'organization_id', 'contract_line_item_id', 'feature_key', 'status', 'expires_at', 'usage_limit', 'current_usage'] },
  contract_covered_orgs: { select: ['contract_id', 'organization_id', 'deactivated_at'] },
})
for (const declaration of [commercialContracts, contractLineItems, orgEntitlements, contractCoveredOrgs]) {
  const config = getTableConfig(declaration)
  const projection = MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS[config.name]
  if ((config.schema && config.schema !== 'public') || !projection ||
    projection.select.some(name => !config.columns.some(column => column.name === name)))
    throw new Error('UE_V2_MODULE_ADMISSION_DECLARATION_REQUIRED')
}

export function assertCurrentModuleAdmissionSource(table: Pick<SourceTable, 'name' | 'source'>): boolean {
  const owner = MODULE_ADMISSION_DECLARATION_OWNERS[table.name]
  if (!owner) return false
  if (table.source !== owner) throw new Error(`UE_V2_MODULE_ADMISSION_SOURCE_REQUIRED:${table.name}`)
  return true
}

export function currentModuleAdmissionAuthority(table: Pick<SourceTable, 'name' | 'source'>): StorageAuthorityEntry | undefined {
  if (!assertCurrentModuleAdmissionSource(table)) return undefined
  return {
    table: table.name,
    classification: table.name === 'contract_line_items' ? 'PARENT_OWNED_RLS_REQUIRED' : 'TENANT_RLS_REQUIRED',
    reason: 'Existing canonical module-admission metadata only: exact runtime SELECT columns under the original live organization/parent RLS and verified session. Preserve active, expiry, usage and backing-contract checks and all stored records. No monetary fields, commercial mutation, entitlement issuance, system or private powers are granted.',
    supportingCapability: [table.source, 'apps/union-eyes/services/platform-economics/entitlement-guard.ts', 'apps/union-eyes/scripts/bootstrap-v2/module-admission-storage-contract.ts'],
    requiredRuntimePrivileges: ['SELECT'], requiredSystemPrivileges: [],
    invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', reviewPriority: 'NONE',
  }
}
