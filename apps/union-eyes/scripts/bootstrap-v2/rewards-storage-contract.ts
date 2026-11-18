/** Current-source base-release reward boundary. Exact reviewed declarations,
 * never a folder-wide entitlement or a reinterpretation of historical rows. */
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as declarations from '../../db/schema/domains/infrastructure/rewards'
import type { StorageAuthorityEntry } from '../../db/rls-storage-authority'
import type { CurrentModel, SourceTable } from './source'

const unions = 'apps/union-eyes/backend/unions/models.py'
const core = 'apps/union-eyes/backend/core/models.py'
const content = 'apps/union-eyes/backend/content/models.py'
export const REWARDS_DECLARATION_SOURCE =
  'apps/union-eyes/db/schema/domains/infrastructure/rewards.ts'
const owner = (app: string, model: string, source: string) => ({ app, model, source })
export const CURRENT_REWARDS_MODEL_OWNERS: Readonly<
  Record<string, { app: string; model: string; source: string }>
> = Object.freeze({
  recognition_programs: owner('unions', 'RecognitionPrograms', unions),
  recognition_award_types: owner('unions', 'RecognitionAwardTypes', unions),
  recognition_awards: owner('unions', 'RecognitionAwards', unions),
  reward_wallet_ledger: owner('unions', 'RewardWalletLedger', unions),
  reward_budget_envelopes: owner('unions', 'RewardBudgetEnvelopes', unions),
  reward_redemptions: owner('unions', 'RewardRedemptions', unions),
  budget_pool: owner('unions', 'BudgetPool', unions),
  budget_reservations: owner('unions', 'BudgetReservations', unions),
  award_templates: owner('unions', 'AwardTemplates', unions),
  award_history: owner('unions', 'AwardHistory', unions),
  automation_rules: owner('core', 'AutomationRules', core),
  automation_execution_log: owner('core', 'AutomationExecutionLog', core),
  shopify_config: owner('content', 'ShopifyConfig', content),
  webhook_receipts: owner('content', 'WebhookReceipts', content),
})
const reviewedDeclarations = [
  'recognition_programs',
  'recognition_award_types',
  'recognition_awards',
  'reward_wallet_ledger',
  'reward_budget_envelopes',
  'reward_redemptions',
  'automation_rules',
  'shopify_config',
  'shopify_webhook_secret_versions',
  'webhook_receipts',
].sort()
export const CURRENT_REWARDS_DECLARATION_OWNERS: Readonly<Record<string, string>> = (() => {
  const names = Object.values(declarations)
    .filter((value) => is(value, PgTable))
    .map((table) => {
      const config = getTableConfig(table)
      if (config.schema && config.schema !== 'public')
        throw new Error('UE_V2_REWARDS_DECLARATION_SCHEMA_REQUIRED')
      return config.name
    })
    .sort()
  if (
    new Set(names).size !== names.length ||
    JSON.stringify(names) !== JSON.stringify(reviewedDeclarations)
  )
    throw new Error('UE_V2_REWARDS_DECLARATION_CENSUS_REQUIRED')
  return Object.freeze(Object.fromEntries(names.map((name) => [name, REWARDS_DECLARATION_SOURCE])))
})()

export interface RewardRuntimeColumnContract {
  select: readonly string[]
  insert?: readonly string[]
}
export const REWARD_RUNTIME_COLUMN_CONTRACTS: Readonly<
  Record<string, RewardRuntimeColumnContract>
> = Object.freeze({
  recognition_programs: {
    select: ['id', 'org_id', 'name', 'description', 'status', 'created_at', 'updated_at'],
  },
  recognition_award_types: {
    select: ['id', 'org_id', 'program_id', 'name', 'kind', 'created_at', 'updated_at'],
  },
  recognition_awards: {
    select: [
      'id',
      'org_id',
      'program_id',
      'award_type_id',
      'recipient_user_id',
      'issuer_user_id',
      'reason',
      'status',
      'created_at',
      'updated_at',
    ],
    insert: [
      'id',
      'org_id',
      'program_id',
      'award_type_id',
      'recipient_user_id',
      'issuer_user_id',
      'reason',
      'status',
      'metadata_json',
      'created_at',
      'updated_at',
    ],
  },
})
/** HMAC routing/verification only. These are secret references, never secret
 * material, credit records, fulfillment decisions or callback write powers. */
export const REWARD_SIGNATURE_COLUMN_CONTRACTS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    shopify_config: ['org_id', 'shop_domain'],
    shopify_webhook_secret_versions: [
      'org_id',
      'secret_ref',
      'status',
      'valid_from',
      'valid_until',
    ],
  })
export const CURRENT_REWARDS_TABLES = Object.freeze(
  [
    ...new Set([
      ...Object.keys(CURRENT_REWARDS_MODEL_OWNERS),
      ...Object.keys(CURRENT_REWARDS_DECLARATION_OWNERS),
    ]),
  ].sort(),
)

export function assertCurrentRewardSource(table: Pick<SourceTable, 'name' | 'source'>): boolean {
  const model = CURRENT_REWARDS_MODEL_OWNERS[table.name]
  const declaration = CURRENT_REWARDS_DECLARATION_OWNERS[table.name]
  if (!model && !declaration) {
    if (table.source === REWARDS_DECLARATION_SOURCE)
      throw new Error(`UE_V2_REWARDS_CURRENT_SOURCE_REQUIRED:${table.name}`)
    return false
  }
  if (table.source !== model?.source && table.source !== declaration)
    throw new Error(`UE_V2_REWARDS_CURRENT_SOURCE_REQUIRED:${table.name}`)
  return true
}

export function currentRewardAuthority(
  table: Pick<SourceTable, 'name' | 'source'>,
  inherited: StorageAuthorityEntry | null,
): StorageAuthorityEntry | null | undefined {
  if (!assertCurrentRewardSource(table)) return undefined
  const runtime = REWARD_RUNTIME_COLUMN_CONTRACTS[table.name]
  const signature = REWARD_SIGNATURE_COLUMN_CONTRACTS[table.name]
  // These exact retained tables already have no authority. Preserve their
  // original containment/latent disposition instead of manufacturing a feature.
  if (
    !runtime &&
    !signature &&
    inherited &&
    ['CONTAINED_NO_AUTHORITY', 'LATENT_UNREACHABLE'].includes(inherited.classification) &&
    Array.isArray(inherited.requiredRuntimePrivileges) &&
    inherited.requiredRuntimePrivileges.length === 0 &&
    Array.isArray(inherited.requiredSystemPrivileges) &&
    inherited.requiredSystemPrivileges.length === 0
  )
    return {
      ...inherited,
      reason: 'Prospective retained reward/provider/automation boundary: preserve the historical containment or latent classification and every row, with zero ordinary, system, private or invocation powers. Retained endpoint names do not confer base-release SQL authority; unavailable operations must deny before database/provider effects.',
      supportingCapability: [table.source, 'apps/union-eyes/scripts/bootstrap-v2/rewards-storage-contract.ts'],
      invocationAuthority: 'NONE',
      dbExecutionPrincipal: 'NONE',
      reviewPriority: 'NONE',
    }
  return {
    table: table.name,
    classification: runtime
      ? 'TENANT_RLS_REQUIRED'
      : signature
        ? 'SYSTEM_ONLY'
        : 'CONTAINED_NO_AUTHORITY',
    reason: runtime
      ? 'Prospective nonfinancial peer recognition only: exact source-column selectors and pending-text nomination INSERT. Canonical actor, organization, current recipient, active peer program/type and immutable pending/approval-free state are enforced physically. No credit, approval, issuance, provider or budget authority.'
      : signature
        ? 'Prospective signature authentication only: exact system column SELECT routes an existing shop and resolves its versioned env:// secret reference before HMAC verification and excluded-feature denial. No runtime access, secret material, receipt/provider/credit mutation or fulfillment authority.'
        : 'Prospective base-release reward credit/provider/automation boundary: preserve current schema and all historical records, with zero ordinary, system, private or invocation authority. No credit, budget, redemption, automation or provider feature is implemented or qualified.',
    supportingCapability: [
      table.source,
      'apps/union-eyes/scripts/bootstrap-v2/rewards-storage-contract.ts',
      runtime
        ? 'apps/union-eyes/db/auth/reward-nomination-guards.ts'
        : 'apps/union-eyes/lib/services/rewards/webhook-service.ts',
    ],
    requiredRuntimePrivileges: runtime
      ? ['SELECT', ...(runtime.insert ? (['INSERT'] as const) : [])]
      : [],
    requiredSystemPrivileges: signature ? ['SELECT'] : [],
    invocationAuthority: runtime ? 'TENANT_USER' : signature ? 'WEBHOOK' : 'NONE',
    dbExecutionPrincipal: runtime ? 'TENANT_RUNTIME' : signature ? 'SYSTEM_RUNTIME' : 'NONE',
    reviewPriority: 'NONE',
  }
}

export function currentRewardModelAuthority(
  model: CurrentModel,
  inherited: StorageAuthorityEntry | null,
): StorageAuthorityEntry | null | undefined {
  const expected = CURRENT_REWARDS_MODEL_OWNERS[model.table]
  if (!expected) return undefined
  if (
    model.app !== expected.app ||
    model.model !== expected.model ||
    model.source !== expected.source
  )
    throw new Error(`UE_V2_REWARDS_CURRENT_MODEL_REQUIRED:${model.table}`)
  return currentRewardAuthority({ name: model.table, source: model.source }, inherited)
}
