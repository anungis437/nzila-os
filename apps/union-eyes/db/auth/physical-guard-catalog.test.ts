import { describe, expect, it } from 'vitest'
import { planPhysicalGuards, type PhysicalGuardContract, type PhysicalSnapshot } from './physical-guard-catalog'

// The WorkAid referral-scope CHECK as the installer creates it, and as pg_dump output reparses it.
const installed =
  "CHECK (((referred_categories IS NULL) OR (((cardinality(referred_categories) >= 1) AND (cardinality(referred_categories) <= 8)) AND (NOT ('*'::text = ANY (referred_categories))))))"
const restored =
  "CHECK (((referred_categories IS NULL) OR ((cardinality(referred_categories) >= 1) AND (cardinality(referred_categories) <= 8) AND (NOT ('*'::text = ANY (referred_categories))))))"

const contract: PhysicalGuardContract = {
  source: 'fixture',
  references: [],
  tables: ['fixture'],
  functions: [],
  constraints: [{ table_name: 'fixture', name: 'fixture_chk', type: 'c', definition: installed }],
  triggers: [],
}
const snapshot = (definition: string): PhysicalSnapshot => ({
  tables: [
    { table_name: 'fixture', oid: '1', owner_name: 'ue_v2_owner', relrowsecurity: true, relforcerowsecurity: true },
  ],
  functions: [],
  constraints: [
    { table_name: 'fixture', name: 'fixture_chk', type: 'c', definition, convalidated: true, condeferrable: false, condeferred: false },
  ],
  triggers: [],
})

describe('physical guard constraint comparison', () => {
  it('accepts the lossless pg_dump reparse of the declared constraint', () => {
    expect(planPhysicalGuards(contract, snapshot(installed)).statements).toEqual([])
    expect(planPhysicalGuards(contract, snapshot(restored)).statements).toEqual([])
  })
  it('still refuses any change in meaning', () => {
    for (const changed of [
      restored.replace('<= 8', '<= 9'),
      restored.replace("'*'::text", "'all'::text"),
      restored.replace('(cardinality(referred_categories) >= 1) AND', '(cardinality(referred_categories) >= 1) OR'),
    ])
      expect(() => planPhysicalGuards(contract, snapshot(changed))).toThrow(/differs; replacement refused/)
  })
})
