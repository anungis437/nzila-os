import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { iterateRuntimeSecurityReports } from './runtime-security'
import { compileSecurity } from './security'
import { folder, type V2Plan } from './source'
import { systemMutationContracts, systemMutationRules } from './system-mutation-contracts'

const native = process.env.UE_V2_NATIVE_MANIFEST === '1' ? describe : describe.skip
native('source-authorized native SYSTEM mutation SQL components (not whole caller mapping)', () => {
  const plan: V2Plan = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
  )
  const rules = systemMutationRules(plan)
  const contracts = systemMutationContracts(plan)
  let fixture: Awaited<ReturnType<typeof openNativeRuntimeFixture>>
  let iterator: ReturnType<typeof iterateRuntimeSecurityReports>
  const reports: { table: string; status: string; failure?: string }[] = []
  beforeAll(async () => {
    fixture = await openNativeRuntimeFixture(plan)
    iterator = iterateRuntimeSecurityReports(
      fixture.seed,
      fixture.runtime,
      fixture.system,
      plan,
      compileSecurity(plan).rules,
      undefined,
      contracts,
      fixture.systemWriter,
    )
  }, 600000)
  afterAll(async () => {
    if (fixture) await fixture.dispose()
  })

  for (const rule of rules) {
    it(`${rule.table}: every source-authorized mutation, caller-compatible SQL shape and denied extra grants`, async () => {
      const next = await iterator.next()
      if (next.done) throw new Error(`UE_V2_SYSTEM_NATIVE_TABLE_PROOF_MISSING:${rule.table}`)
      const report = next.value
      reports.push(report)
      expect(report.table).toBe(rule.table)
      expect(report.status, report.failure).toBe('PASS')
      for (const privilege of rule.systemPrivileges.filter((value) =>
        ['INSERT', 'UPDATE', 'DELETE'].includes(value),
      )) {
        const proof = {
          INSERT:
            rule.table === 'fee_adjustments'
              ? 'SOURCE_AUTHORIZED_INSERT_WRITE_OWNED_COMPLETE_RESULT_AND_CONSTRAINTS'
              : 'SOURCE_AUTHORIZED_INSERT_RETURNING_SHAPE_AND_CONSTRAINTS',
          UPDATE: 'SOURCE_AUTHORIZED_UPDATE_CALLER_SELECTOR_RETURNING_SHAPE_AND_CONSTRAINTS',
          DELETE: 'SOURCE_AUTHORIZED_DELETE_CALLER_SELECTOR_AND_CONSTRAINTS',
        }[privilege]
        expect(report.cases).toContain(proof)
      }
      expect(report.cases).toContain('SYSTEM_MUTATIONS_ROLLED_BACK_WITH_EXACT_ROW_SNAPSHOT')
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'SELECT']) {
        if (!rule.systemPrivileges.includes(privilege))
          expect(report.cases).toContain(`SYSTEM_SOURCE_UNAUTHORIZED_${privilege}_DENIED`)
      }
      expect(report.cases).toContain('ORDINARY_LOGIN_CANNOT_ESCALATE_TO_SYSTEM_OR_OWNER')
      if (rule.table === 'fee_adjustments') {
        for (const proof of [
          'FEE_CANONICAL_DEFAULTS_NO_GENERATED_IDENTITY_USER_TRIGGER_OR_REWRITE',
          'FEE_EXACT_ELEVEN_FIELD_OWNER_PERSISTED_RESULT_AND_NULL_DEFAULTS',
          'FEE_ZERO_NEGATIVE_ZERO_ROUNDING_AND_NUMERIC14_2_PRECISION',
          'FEE_DATABASE_AUTHORITATIVE_FULL_PRECISION_TRANSACTION_TIME',
          'FEE_APPROVAL_EMPTY_REFUND_UUID_AND_JSONB_DATABASE_NORMALIZATION',
          'FEE_NUMERIC_OVERFLOW_INVALID_AMOUNT_FOREIGN_KEY_AND_LENGTH_ERRORS_NO_RESULT_OR_RESIDUE',
          'FEE_POST_INSERT_DOWNSTREAM_FAILURE_TRANSACTION_ROLLBACK',
          'FEE_PRODUCTION_HELPER_NO_RETURNING_NO_TABLE_READ_FULL_RETURNING_DENIED',
          'FEE_PRODUCTION_POSTGRES_JS_DRIVER_EXACT_PERSISTED_RESULT_AND_ROLLBACK',
        ])
          expect(report.cases).toContain(proof)
      }
    }, 120000)
  }
  it('finishes the exact 53-table source-bound component census with no inferred caller mapping', async () => {
    const next = await iterator.next()
    expect(next.done).toBe(true)
    if (!next.done) throw new Error('UE_V2_SYSTEM_NATIVE_EXTRA_TABLE')
    console.info(
      'UE_V2_SYSTEM_MUTATION_QUALIFICATION',
      JSON.stringify({
        ...next.value.nativeSystemMutationQualification,
        callerContracts: undefined,
        failures: reports.filter((report) => report.status !== 'PASS'),
      }),
    )
    expect(reports.map((report) => report.table)).toEqual(rules.map((rule) => rule.table))
    expect(reports.filter((report) => report.status !== 'PASS')).toEqual([])
    expect(reports).toHaveLength(53)
    expect(next.value.qualified).toBe(53)
    expect(next.value.applicationActorMapping).toBe('NOT_PROVEN')
    expect(next.value.wholeSecurityQualification).toBe('NOT_PROVEN')
    expect(next.value.nativeSystemMutationQualification).toMatchObject({
      result: 'PASS',
      denominator: 53,
      qualified: 53,
      actualCallerExecution: 'NOT_PROVEN',
      wholeSecurityQualification: 'NOT_PROVEN',
    })
  })
})
