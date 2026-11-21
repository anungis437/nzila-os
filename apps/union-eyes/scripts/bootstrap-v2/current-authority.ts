import type { StorageAuthorityEntry } from '../../db/rls-storage-authority'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as allocationDeclarations from '../../db/schema/domains/finance/allocation'
import * as ledgerDeclarations from '../../db/schema/domains/finance/platform-ledger'
import * as duesDeclarations from '../../db/schema/domains/finance/dues-assignments'
import type { CurrentModel, SourceTable } from './source'
import { PLATFORM_METADATA_MODEL_OWNERS } from './framework-contract'
import { currentRewardAuthority, currentRewardModelAuthority } from './rewards-storage-contract'
import { currentModuleAdmissionAuthority } from './module-admission-storage-contract'
import { currentExternalSyncLogAuthority } from './external-sync-log-storage-contract'

const evidenceOwner = 'apps/union-eyes/backend/services/evidence_pack/models.py'
const legacyAuthOwner = 'apps/union-eyes/backend/auth_core/models.py'
const billingOwner = 'apps/union-eyes/backend/billing/models.py'

const financialDeclarationGroups = [
  ['apps/union-eyes/db/schema/domains/finance/platform-ledger.ts', ledgerDeclarations],
  ['apps/union-eyes/db/schema/domains/finance/allocation.ts', allocationDeclarations],
  ['apps/union-eyes/db/schema/domains/finance/dues-assignments.ts', duesDeclarations],
] as const

// Derive the complete approved declaration families from their real Drizzle
// exports. Folder placement alone does not classify usage or case workflows.
export const BASE_RELEASE_FINANCIAL_DECLARATION_OWNERS: Readonly<Record<string, string>> =
  (() => {
    const entries = financialDeclarationGroups.flatMap(([source, declarations]) =>
      Object.values(declarations).flatMap(value => {
        if (!is(value, PgTable)) return []
        const config = getTableConfig(value)
        if (config.schema && config.schema !== 'public')
          throw new Error(`UE_V2_FINANCIAL_DECLARATION_SCHEMA_REQUIRED:${config.name}`)
        return [[config.name, source] as const]
      }))
    if (new Set(entries.map(([name]) => name)).size !== entries.length)
      throw new Error('UE_V2_FINANCIAL_DECLARATION_DUPLICATE')
    return Object.freeze(Object.fromEntries(entries))
  })()

function containedFinancialAuthority(table: string, source: string): StorageAuthorityEntry {
  return {
    table,
    classification: 'CONTAINED_NO_AUTHORITY',
    reason:
      'Prospective base-release financial record boundary: current billing models and the explicitly reviewed dues, DAPL and allocation declarations are outside this release. Preserve all schema, rows and historical authority evidence. No ordinary, system, private metadata or invocation authority is inferred from retained records; no positive financial feature is implemented or qualified.',
    supportingCapability: [
      source,
      'apps/union-eyes/backend/billing/views.py',
      'apps/union-eyes/backend/auth_core/mixins.py',
      'apps/union-eyes/scripts/bootstrap-v2/current-authority.ts',
    ],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: 'NONE',
    dbExecutionPrincipal: 'NONE',
    reviewPriority: 'NONE',
  }
}

/** Apply after current declarations are assembled; never suppress schema retention. */
export function reconcileCurrentDeclarationAuthority(
  table: Pick<SourceTable, 'name' | 'source'>,
  inherited: StorageAuthorityEntry | null,
): StorageAuthorityEntry | null {
  if (table.name === 'ue_authority_financial_steps') {
    if (table.source !== 'apps/union-eyes/db/schema/domains/ml/authority-kernel.ts')
      throw new Error('UE_V2_FINANCIAL_STEPS_RETENTION_SOURCE_REQUIRED')
    return {
      table: table.name,
      classification: 'CONTAINED_NO_AUTHORITY',
      reason: 'Retain the exact current financial-workflow journal schema, immutable rows and all authority physical guards. Union financial execution is excluded from the base release. Historical account, amount, approval and actor records confer no ordinary, system, private or invocation powers; source entrypoints refuse before financial SQL or effects.',
      supportingCapability: [table.source, 'apps/union-eyes/scripts/bootstrap-v2/current-authority.ts', 'apps/union-eyes/lib/finance/base-release-boundary.ts', 'apps/union-eyes/db/auth/authority-physical-guards.ts'],
      requiredRuntimePrivileges: [],
      requiredSystemPrivileges: [],
      invocationAuthority: 'NONE',
      dbExecutionPrincipal: 'NONE',
      reviewPriority: 'NONE',
    }
  }
  if (table.name === 'ue_authority_workaid_consent_text_proposals') {
    if (table.source !== 'apps/union-eyes/db/schema/domains/ml/authority-kernel.ts')
      throw new Error('UE_V2_WORKAID_PROPOSAL_RETENTION_SOURCE_REQUIRED')
    return {
      table: table.name,
      classification: 'CONTAINED_NO_AUTHORITY',
      reason: 'Current-source retention of the exact released 0036 proposal shape and immutable institutional history. WorkAid wording proposal/adoption is deferred from the base release and its routes return 501 before SQL. No ordinary, system, private or invocation authority is conferred; no wording, rule, consent or customer adoption is created.',
      supportingCapability: [table.source, 'apps/union-eyes/scripts/bootstrap-v2/current-authority.ts', 'apps/union-eyes/db/auth/authority-physical-guards.ts'],
      requiredRuntimePrivileges: [],
      requiredSystemPrivileges: [],
      invocationAuthority: 'NONE',
      dbExecutionPrincipal: 'NONE',
      reviewPriority: 'NONE',
    }
  }
  const syncLog = currentExternalSyncLogAuthority(table,inherited)
  if(syncLog!==undefined) return syncLog
  const admission = currentModuleAdmissionAuthority(table)
  if (admission !== undefined) return admission
  const rewards = currentRewardAuthority(table, inherited)
  if (rewards !== undefined) return rewards
  const owner = BASE_RELEASE_FINANCIAL_DECLARATION_OWNERS[table.name]
  const financialSource = financialDeclarationGroups.some(([source]) => source === table.source)
  if (!owner && !financialSource) return inherited
  if (owner !== table.source)
    throw new Error(`UE_V2_FINANCIAL_DECLARATION_SOURCE_REQUIRED:${table.name}`)
  return containedFinancialAuthority(table.name, table.source)
}

export function reconcileCurrentAuthority(
  model: CurrentModel,
  inherited: StorageAuthorityEntry | null,
): StorageAuthorityEntry | null {
  const rewards = currentRewardModelAuthority(model, inherited)
  if (rewards !== undefined) return rewards
  // Preserve the separately qualified donation shape check before applying
  // the complete current-source billing boundary.
  if (model.table === 'donations') {
    const organization = model.columns.find((column) => column.name === 'organization_id')
    if (
      model.app !== 'billing' ||
      model.source !== billingOwner ||
      organization?.type !== 'uuid' ||
      !organization.notNull ||
      organization.foreignKey?.table !== 'organizations' ||
      organization.foreignKey.column !== 'id'
    )
      throw new Error('UE_V2_DONATION_BASE_BOUNDARY_SOURCE_REQUIRED')
  }
  if (model.app === 'billing' || model.source === billingOwner) {
    if (model.app !== 'billing' || model.source !== billingOwner)
      throw new Error(`UE_V2_BILLING_BASE_BOUNDARY_SOURCE_REQUIRED:${model.table}`)
    return containedFinancialAuthority(model.table, model.source)
  }
  if (PLATFORM_METADATA_MODEL_OWNERS[model.table]) {
    if (
      model.source !== PLATFORM_METADATA_MODEL_OWNERS[model.table] ||
      model.columns.some((column) => ['organization_id', 'org_id', 'user_id'].includes(column.name))
    )
      throw new Error(`UE_V2_PLATFORM_METADATA_SOURCE_REQUIRED:${model.table}`)
    return {
      table: model.table,
      classification: 'SYSTEM_ONLY',
      reason:
        'Prospective V2 current-source decision: global security-event/catalog metadata is private canonical platform administration, not tenant CRUD or legacy system authority. The existing dedicated administrator context independently validates the live canonical bearer and platform-admin flag on every query. Exact current Django metadata only; no financial database, ledger, provider ingestion or tenant authority is inferred.',
      supportingCapability: [
        model.source,
        'backend/auth_core/canonical_context.py',
        'scripts/bootstrap-v2/framework-contract.ts',
      ],
      requiredRuntimePrivileges: [],
      requiredSystemPrivileges: [],
      invocationAuthority: 'PLATFORM_ADMIN',
      dbExecutionPrincipal: 'NONE',
      reviewPriority: 'NONE',
    }
  }
  // Preserve the existing canonical containment decisions. An inherited legacy
  // tenant label cannot manufacture a missing current ownership relationship.
  const containedOwner = model.table === 'arbitration_decisions'
    ? 'apps/union-eyes/backend/bargaining/models.py'
    : model.table === 'signature_audit_trail'
      ? 'apps/union-eyes/backend/content/models.py'
      : null
  if (containedOwner) {
    if (model.source !== containedOwner)
      throw new Error(`UE_V2_CONTAINED_CURRENT_OWNER_REQUIRED:${model.table}`)
    return {
      table: model.table,
      classification: 'CONTAINED_NO_AUTHORITY',
      reason: 'Preserved canonical V2 containment: the current source lacks a separately qualified ownership or parent relationship. Preserve historical rows and deny all ordinary/system access; this does not implement or qualify the unavailable operation.',
      supportingCapability: [model.source, 'apps/union-eyes/scripts/bootstrap-v2/current-authority.ts'],
      requiredRuntimePrivileges: [],
      requiredSystemPrivileges: [],
      invocationAuthority: 'NONE',
      dbExecutionPrincipal: 'NONE',
      reviewPriority: 'NONE',
    }
  }
  if (model.table === 'claim_status_transitions') {
    if (model.source !== 'apps/union-eyes/backend/grievances/models.py' ||
      !model.columns.some(column => column.name === 'transaction_id' && column.type === 'bigint'))
      throw new Error('UE_V2_CASE_JOURNAL_ORIGIN_SOURCE_REQUIRED')
    return {
      table: model.table,
      classification: 'TENANT_RLS_REQUIRED',
      reason: 'The source-owned case transition journal is append-only through its sole trigger writer. Ordinary and system principals may read under their existing tenant policies; neither may insert, amend, delete or replay journal rows. The bounded current-transaction writer has independently inspected column grants and RLS.',
      supportingCapability: [model.source, 'apps/union-eyes/db/auth/case-primary-domain-guards.ts'],
      requiredRuntimePrivileges: ['SELECT'],
      requiredSystemPrivileges: ['SELECT'],
      invocationAuthority: 'MIXED',
      dbExecutionPrincipal: 'MIXED',
      reviewPriority: 'NONE',
    }
  }
  if (['users', 'oauth_providers'].includes(model.table)) {
    if (
      model.source !== legacyAuthOwner ||
      !model.columns.some(
        (column) => column.name === 'user_id' && column.type.startsWith('varchar'),
      )
    )
      throw new Error(`UE_V2_LEGACY_SELF_METADATA_SOURCE_REQUIRED:${model.table}`)
    return {
      table: model.table,
      classification: 'USER_RLS_REQUIRED',
      reason:
        'Prospective V2 decision: the current public Django user/provider records are self-owned legacy metadata only, not canonical identity, session, membership or provider-binding authority. Current ModelViewSet CRUD is limited to the live canonical actor user_id; NULL/foreign ownership is denied. No system authority or lineage to user_management is inferred.',
      supportingCapability: [
        'backend/auth_core/models.py',
        'backend/auth_core/views.py',
        'backend/auth_core/urls.py',
      ],
      requiredRuntimePrivileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      requiredSystemPrivileges: [],
      invocationAuthority: 'TENANT_USER',
      dbExecutionPrincipal: 'TENANT_RUNTIME',
      reviewPriority: 'NONE',
    }
  }
  if (!['evidence_packs', 'evidence_artifacts'].includes(model.table)) return inherited
  if (model.source !== evidenceOwner)
    throw new Error(`UE_V2_EVIDENCE_OWNER_REQUIRED:${model.table}`)
  if (model.table === 'evidence_packs') {
    if (!inherited || inherited.classification !== 'TENANT_RLS_REQUIRED')
      throw new Error('UE_V2_EVIDENCE_PACK_TENANT_AUTHORITY_REQUIRED')
    return {
      ...inherited,
      requiredRuntimePrivileges: ['SELECT', 'INSERT', 'UPDATE'],
      reason: `${inherited.reason} V2 current builder saves the manifest and seals the pack after creation; those source-backed UPDATE operations must remain executable within the authenticated organization.`,
    }
  }
  const parent = model.columns.find((column) => column.name === 'pack_id')?.foreignKey
  if (parent?.table !== 'evidence_packs' || parent.column !== 'id')
    throw new Error('UE_V2_EVIDENCE_ARTIFACT_PARENT_REQUIRED')
  return {
    table: model.table,
    classification: 'PARENT_OWNED_RLS_REQUIRED',
    reason:
      'Current EvidencePackViewSet resolves an organization-scoped pack before listing artifacts. The source builder inserts artifacts under that pack; background verification reads them. Parent visibility and FK WITH CHECK are mandatory; no independent global artifact authority exists.',
    supportingCapability: [
      'backend/services/evidence_pack/models.py',
      'backend/services/evidence_pack/views.py',
      'backend/services/evidence_pack/builder.py',
    ],
    requiredRuntimePrivileges: ['SELECT', 'INSERT'],
    requiredSystemPrivileges: ['SELECT'],
    invocationAuthority: 'MIXED',
    dbExecutionPrincipal: 'MIXED',
    reviewPriority: 'NONE',
  }
}
