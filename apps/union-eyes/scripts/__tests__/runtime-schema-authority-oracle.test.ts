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
  }, 180_000)

  it('records the f60040 baseline as partial runtime-schema proof, with full creation-lineage closure but bootstrap-execution gaps remaining', () => {
    expect(oracle.status).toMatchObject({
      f60040Schema: 'PARTIAL_RUNTIME_SCHEMA',
      previousRuntimeContractCompleteness: 'INSUFFICIENT',
      // The platform-0059 through 0071 convergence batches (and the Drizzle/Django
      // reconciliation tranches alongside them) created governed migrations for every
      // table that previously had no creation lineage at all, closing the no-owner set
      // from 23 (2026-09-23) to 10 (2026-10-17) to 0. This closure is about LINEAGE
      // ONLY ("some governed migration creates this table somewhere in history") - it
      // is not a claim that the fresh-bootstrap script actually runs all of them; that
      // separate, still-open gap is what bootstrapMissingCreationTables tracks below.
      canonicalSchemaAuthorityClosure: 'READY_FOR_BOOTSTRAP_PROOF',
      preCompleteRuntimeSchemaDigest: FROZEN_DJANGO_DIGEST,
    })
    expect(oracle.counts.runtimeUniverseTables).toBeGreaterThan(300)
    expect(oracle.counts.runtimeTablesWithoutSchemaOwner).toBe(0)
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
    expect(billingPeriods?.activeRuntimeReaders.length).toBeGreaterThan(0)
  }, 60_000)

  it('assigns billing_subscriptions to post-freeze PLATFORM_SQL lineage (0001)', () => {
    const billingSubscriptions = oracle.records.find(
      (record) => record.table === 'billing_subscriptions',
    )

    expect(billingSubscriptions).toBeDefined()
    expect(billingSubscriptions).toMatchObject({
      schemaOwner: 'PLATFORM_SQL_OWNED',
      creationLineage: 'ACTIVE_SQL_PLATFORM_LINEAGE',
      canonicalRequirement: 'REQUIRED',
      sqlCreatingMigration:
        'apps/union-eyes/db/migrations-platform/0001_billing_subscriptions.sql',
    })
    expect(
      billingSubscriptions?.creationEvidence.some(
        (evidence) =>
          evidence.file ===
            'apps/union-eyes/db/migrations-platform/0001_billing_subscriptions.sql' &&
          evidence.currentBootstrapStatus === 'EXECUTED_BY_FRESH_BOOTSTRAP',
      ),
    ).toBe(true)
    expect(billingSubscriptions?.activeRuntimeReaders.length).toBeGreaterThan(0)
  }, 60_000)
})
