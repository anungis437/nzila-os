import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash } from './post-w4p-replay'
import { FakeReplayCatalog } from './replay-fake-catalog'
import {
  sourceBoundDjangoTable,
  type SourceBoundDjangoBaseline,
} from './replay-fake-django-baseline'
import {
  inspectPayload,
  readCatalog,
  topologicalOrder,
  type PromotionSpecification,
} from './platform-baseline-promotion'

export const membershipPayloadId = 'UE-W4FR4-PAYLOAD-09ef3aefb86ca556'
export const membershipPayloadHash =
  '86320b5ed5efccf878808112837aa2df58b7a46e151b5faf5c104f71f210d578'
export const membershipUniqueSql =
  'ALTER TABLE "public"."organization_members" ADD CONSTRAINT "unique_org_membership" UNIQUE ("organization_id", "user_id");'
const authorities = new WeakMap<object, string>()

export function buildProspectiveMembershipAuthority(
  baseline: SourceBoundDjangoBaseline,
  specification: PromotionSpecification,
) {
  const table = sourceBoundDjangoTable(baseline, 'organization_members')
  const column = table.columns.find((entry) => entry.name === 'organization_id')
  const foreignKeys = baseline.foreignKeys.filter(
    (key) =>
      key.schema === 'public' &&
      key.table === table.name &&
      key.columns.length === 1 &&
      key.columns[0] === 'organization_id',
  )
  const historical = specification.invariants.find(
    (entry) => entry.payload.PAYLOAD_ID === membershipPayloadId,
  )
  if (
    !historical ||
    historical.payload.SQL_SHA256 !== membershipPayloadHash ||
    replayHash(historical.payload.SQL) !== membershipPayloadHash ||
    column?.type_schema !== 'pg_catalog' ||
    column.type_name !== 'uuid' ||
    !column.not_null ||
    foreignKeys.length !== 1
  )
    throw new ProvisioningError('W5_COMPAT_SOURCE_AND_HISTORICAL_AUTHORITY_REQUIRED')
  const fk = foreignKeys[0]
  if (
    fk.parent_schema !== 'public' ||
    fk.parent_name !== 'organizations' ||
    fk.parent_columns.join(',') !== 'id' ||
    fk.delete_action !== 'a' ||
    fk.update_action !== 'a' ||
    !fk.deferrable ||
    !fk.deferred ||
    !fk.validated
  )
    throw new ProvisioningError('W5_COMPAT_EXACT_SOURCE_FK_REQUIRED')
  const authority = {
    lineage: 'PROSPECTIVE_W5_COMPAT_V1' as const,
    historicalPayloadId: membershipPayloadId,
    historicalPayloadHash: membershipPayloadHash,
    historicalSql: historical.payload.SQL,
    historicalDefinition: 'organization_id text NOT NULL; UNIQUE(organization_id,user_id)',
    prospectiveDefinition:
      'organization_id uuid NOT NULL; source-bound FK public.organizations(id) NO ACTION ON UPDATE/DELETE DEFERRABLE INITIALLY DEFERRED; UNIQUE(organization_id,user_id)',
    sourceColumn: column,
    sourceForeignKey: structuredClone(fk),
    sourceOrigins: baseline.provenance.filter((entry) => entry.table === table.name),
    reasonForSupersession:
      'Explicit human UUID/membership decision reconciles the authenticated Django UUID-backed FK with the exact frozen uncast E048 UUID assignment; only this physical contract is superseded.',
    downstreamEvidence: {
      effectId: 'UE-W5A-MIGRATION-d264f77905daf432:E048',
      effectHash: '32f8b632fb11db40437bd9d9f063e30a7ff54fe7ecdeb938736697e685d6775b',
      targetPayloadId: 'UE-W4FR4-PAYLOAD-c4272febef39d50e',
      targetPayloadHash: 'a6abc624249cb9c960590eb3f285a7bd19f847952866e32900d0aa8f10ba3e9e',
      targetType: 'uuid',
    },
    legacyStateGuard:
      'Require exact source UUID/FK metadata, complete visible row inventory, valid nonnull UUIDs, existing parent identities, and no duplicate organization/user pairs. Partial/ambiguous or text legacy state denies; no conversion, dedupe or identity invention.',
    freshBootstrapBehavior:
      'On the authenticated empty Django UUID-backed FK relation retain its physical column and FK, then interpret the prospective unique SQL. Other W4P payloads remain unchanged; full promotion must fail closed on independent drift or missing prerequisites.',
    uniqueSql: membershipUniqueSql,
    uniqueSqlHash: replayHash(membershipUniqueSql),
    executionAuthorized: false as const,
    catalogSpecification: structuredClone(specification),
    prospectiveInvariant: {
      ...structuredClone(historical),
      columns: historical.columns.map((entry) =>
        entry.name === 'organization_id' ? { ...entry, postgresType: 'uuid' } : { ...entry },
      ),
    },
  }
  authorities.set(authority, replayDigest(authority))
  return authority
}

export type ProspectiveMembershipAuthority = ReturnType<typeof buildProspectiveMembershipAuthority>

/** Offline only: retain the authenticated UUID/FK; add the newly authorized unique invariant. */
export async function applyFakeProspectiveMembershipOverlay(
  catalog: FakeReplayCatalog,
  authority: ProspectiveMembershipAuthority,
) {
  if (authorities.get(authority) !== replayDigest(authority))
    throw new ProvisioningError('W5_COMPAT_BOUND_AUTHORITY_REQUIRED')
  await catalog.transaction(async () => {
    const members = catalog.inspectTable('public', 'organization_members')
    const organizations = catalog.inspectTable('public', 'organizations')
    const column = members?.columns.find((entry) => entry.name === 'organization_id')
    const parentColumn = organizations?.columns.find((entry) => entry.name === 'id')
    const fk = catalog.inspectForeignKey(
      'public',
      'organization_members',
      authority.sourceForeignKey.name,
    )
    if (
      !members ||
      !organizations ||
      !members.rowCountVisible ||
      !organizations.rowCountVisible ||
      parentColumn?.type_schema !== 'pg_catalog' ||
      parentColumn.type_name !== 'uuid' ||
      !parentColumn.not_null ||
      organizations.primaryKey.join(',') !== 'id' ||
      column?.type_schema !== 'pg_catalog' ||
      column.type_name !== 'uuid' ||
      !column.not_null ||
      replayDigest(fk) !== replayDigest(authority.sourceForeignKey)
    )
      throw new ProvisioningError('W5_COMPAT_LEGACY_PARTIAL_OR_AMBIGUOUS')
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const row of members.rows) {
      const value = row.organization_id
      if (typeof value !== 'string' || !uuid.test(value))
        throw new ProvisioningError('W5_COMPAT_LEGACY_UUID_OR_NULL_DENIED')
      if (
        !organizations.rows.some(
          (parent) =>
            typeof parent.id === 'string' && parent.id.toLowerCase() === value.toLowerCase(),
        )
      )
        throw new ProvisioningError('W5_COMPAT_LEGACY_FK_DENIED')
      if (typeof row.user_id !== 'string')
        throw new ProvisioningError('W5_COMPAT_LEGACY_USER_DENIED')
    }
    const existing = members.uniqueConstraints?.find(
      (entry) => entry.name === 'unique_org_membership',
    )
    // Recheck populated keys on noop too; fixture row replacement is not a SQL INSERT.
    const pairs = new Set<string>()
    for (const row of members.rows) {
      const pair = JSON.stringify([String(row.organization_id).toLowerCase(), row.user_id])
      if (pairs.has(pair)) throw new ProvisioningError('W5_COMPAT_LEGACY_DUPLICATE_DENIED')
      pairs.add(pair)
    }
    if (!existing) await catalog.applyFrozenUnit(authority.uniqueSql, authority.uniqueSqlHash)
    const native = await readCatalog(catalog, authority.catalogSpecification)
    if (inspectPayload(authority.prospectiveInvariant, native).STATE !== 'PRESENT_MATCHING')
      throw new ProvisioningError('W5_COMPAT_OVERLAY_POSTCONDITION_DENIED')
  })
  return {
    lineage: authority.lineage,
    physicalDigest: catalog.physicalDigest(),
    executionAuthorized: false as const,
    receiptPublished: false as const,
  }
}

export async function promoteFakeProspectiveW4p(
  catalog: FakeReplayCatalog,
  authority: ProspectiveMembershipAuthority,
) {
  await catalog.transaction(async () => {
    await applyFakeProspectiveMembershipOverlay(catalog, authority)
    let native = await readCatalog(catalog, authority.catalogSpecification)
    for (const historical of topologicalOrder(authority.catalogSpecification.invariants)) {
      const invariant =
        historical.payload.PAYLOAD_ID === membershipPayloadId
          ? authority.prospectiveInvariant
          : historical
      const inspection = inspectPayload(invariant, native)
      if (inspection.STATE === 'ABSENT') {
        await catalog.applyFrozenUnit(invariant.payload.SQL, invariant.payload.SQL_SHA256)
        native = await readCatalog(catalog, authority.catalogSpecification)
        if (inspectPayload(invariant, native).STATE !== 'PRESENT_MATCHING')
          throw new ProvisioningError(`W5_COMPAT_W4P_POSTCONDITION:${invariant.payload.PAYLOAD_ID}`)
      } else if (inspection.STATE !== 'PRESENT_MATCHING') {
        throw new ProvisioningError(
          `W5_COMPAT_W4P_INDEPENDENT_DENIAL:${invariant.payload.PAYLOAD_ID}:${inspection.REASONS.join(',')}`,
        )
      }
    }
  })
}
