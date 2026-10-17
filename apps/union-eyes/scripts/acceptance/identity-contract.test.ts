import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { folder, type V2Plan } from '../bootstrap-v2/source'
import { finalizeIdentityContract } from './identity-census'

const plan: V2Plan = JSON.parse(
  readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
)
const baseline = JSON.parse(
  readFileSync(path.join(folder, 'UE_APPLICATION_IDENTITY_CENSUS_BASELINE.json'), 'utf8'),
)

describe('APPLICATION_USER_ID = TEXT identity contract', () => {
  const contract = finalizeIdentityContract(plan, baseline)

  it('classifies every current identity-looking uuid column', () => {
    expect(contract.unclassifiedCurrentIdentityColumns).toBe(0)
    expect(contract.unclassifiedColumns).toEqual([])
  })

  it('has no contract violations: user-id columns are text, entity uuids stay uuid', () => {
    expect(contract.contractViolations).toEqual([])
  })

  it('proves the originally defective columns are converted', () => {
    for (const column of [
      'document_access_grants.user_id',
      'grievance_case_access_assignments.user_id',
      'member_dues_ledger.user_id',
      'member_arrears.user_id',
    ]) {
      const [table, name] = column.split('.')
      const type = plan.tables
        .find((entry) => entry.name === table)
        ?.columns.find((entry) => entry.name === name)?.type
      expect(type, column).not.toBe('uuid')
    }
  })

  it('enforces organization-scoped claim number uniqueness in the canonical plan', () => {
    const statements = plan.statements.map((entry) => entry.sql).join('\n')
    expect(statements).toMatch(/claims_org_claim_number_uniq[^;]*organization_id[^;]*claim_number/s)
    expect(statements).not.toMatch(/claims_claim_number_unique/)
    const claims = plan.statements.find((entry) => /^CREATE TABLE \"claims\"/.test(entry.sql))!.sql
    expect(claims).not.toMatch(/\"claim_number\" varchar\(50\)[^,]*UNIQUE/)
  })
})
