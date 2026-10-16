import type { StorageAuthorityEntry } from '../../db/rls-storage-authority'
import type { CurrentModel } from './source'
import { PLATFORM_METADATA_MODEL_OWNERS } from './framework-contract'

const evidenceOwner = 'apps/union-eyes/backend/services/evidence_pack/models.py'
const legacyAuthOwner = 'apps/union-eyes/backend/auth_core/models.py'
const billingOwner = 'apps/union-eyes/backend/billing/models.py'

export function reconcileCurrentAuthority(
  model: CurrentModel,
  inherited: StorageAuthorityEntry | null,
): StorageAuthorityEntry | null {
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
  if (model.table === 'donations') {
    const organization = model.columns.find((column) => column.name === 'organization_id')
    if (
      model.source !== billingOwner ||
      organization?.type !== 'uuid' ||
      !organization.notNull ||
      organization.foreignKey?.table !== 'organizations' ||
      organization.foreignKey.column !== 'id'
    )
      throw new Error('UE_V2_DONATION_METADATA_ORGANIZATION_SOURCE_REQUIRED')
    return {
      table: model.table,
      classification: 'TENANT_RLS_REQUIRED',
      reason:
        'Prospective V2 decision: the current Django Donations model is operational organization-owned metadata with an indispensable UUID organization FK. Its authenticated ModelViewSet CRUD uses live canonical membership and organization-scoped RLS. This does not merge or qualify the separate financial database, payment processing, ledgers or the historical caller projection.',
      supportingCapability: [
        'backend/billing/models.py',
        'backend/billing/views.py',
        'backend/billing/serializers.py',
        'backend/auth_core/mixins.py',
      ],
      requiredRuntimePrivileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      requiredSystemPrivileges: [],
      invocationAuthority: 'TENANT_USER',
      dbExecutionPrincipal: 'TENANT_RUNTIME',
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
