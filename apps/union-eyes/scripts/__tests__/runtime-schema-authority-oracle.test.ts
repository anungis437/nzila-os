import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildRuntimeSchemaOracle,
  FROZEN_DJANGO_DIGEST,
  type RuntimeSchemaOracle,
} from '../generate-runtime-schema-authority-oracle'

describe('runtime schema authority oracle', () => {
  let oracle: RuntimeSchemaOracle

  beforeAll(() => {
    oracle = buildRuntimeSchemaOracle()
  }, 60_000)

  it('records the f60040 baseline as partial instead of complete runtime-schema proof', () => {
    expect(oracle.status).toMatchObject({
      f60040Schema: 'PARTIAL_RUNTIME_SCHEMA',
      previousRuntimeContractCompleteness: 'INSUFFICIENT',
      canonicalSchemaAuthorityClosure: 'BLOCKED',
      preCompleteRuntimeSchemaDigest: FROZEN_DJANGO_DIGEST,
    })
    expect(oracle.counts.runtimeUniverseTables).toBeGreaterThan(300)
    expect(oracle.counts.runtimeTablesWithoutSchemaOwner).toBeGreaterThan(0)
    expect(oracle.counts.bootstrapMissingCreationTables).toBeGreaterThan(0)
  }, 60_000)

  it('finds governed SQL creation lineage for billing_periods without assigning it to Django', () => {
    const billingPeriods = oracle.records.find((record) => record.table === 'billing_periods')

    expect(billingPeriods).toBeDefined()
    expect(billingPeriods).toMatchObject({
      schemaOwner: 'PLATFORM_SQL_OWNED',
      creationLineage: 'ACTIVE_SQL_PLATFORM_LINEAGE',
      sqlCreatingMigration: 'apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql',
    })
    expect(billingPeriods?.djangoCreatingMigration).toBeNull()
    expect(
      billingPeriods?.creationEvidence.some(
        (evidence) => evidence.currentBootstrapStatus === 'EXECUTED_BY_FRESH_BOOTSTRAP',
      ),
    ).toBe(false)
    expect(billingPeriods?.activeRuntimeReaders.length).toBeGreaterThan(0)
  }, 60_000)

  it('keeps runtime-projected tables without creation lineage unresolved until explicit evidence is added', () => {
    const billingSubscriptions = oracle.records.find(
      (record) => record.table === 'billing_subscriptions',
    )

    expect(billingSubscriptions).toBeDefined()
    expect(billingSubscriptions).toMatchObject({
      schemaOwner: 'UNKNOWN',
      creationLineage: 'PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE',
      canonicalRequirement: 'UNRESOLVED',
    })
    expect(billingSubscriptions?.creationEvidence).toEqual([])
    expect(billingSubscriptions?.activeRuntimeReaders.length).toBeGreaterThan(0)
  }, 60_000)
})
