/**
 * Every entry of the canonical-schema census must carry a disposition with a reason, and the disposition register must
 * not keep entries the census no longer has. This runs without a database, so it holds in every CI run.
 * A disposition classifies an entry; it never removes it from the census (UE-CONV-H-007).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REGISTER = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/register')
const census = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-census.json'), 'utf8')).entries as { table: string }[]
const disposition = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-disposition.json'), 'utf8')).entries as Record<string, { disposition: string; reason: string; registryClass: string }>

const ALLOWED = new Set([
  'RETIRE_DECLARATION', 'VERIFY_UNREACHABLE_THEN_RETIRE', 'CONTAINED_DENY_ALL', 'GLOBAL_REFERENCE_SHAPE', 'SYSTEM_ONLY_SHAPE',
  'SEPARATE_DATABASE', 'REGISTRY_GAP', 'CREATE_RELATION_REQUIRED', 'INDIVIDUAL_DECISION', 'LIVE_UNREFERENCED', 'EVOLVE_NEXT_TRANCHE',
])

describe('canonical schema disposition register', () => {
  it('classifies every census entry with a known disposition and a reason', () => {
    const missing = census.filter((e) => !disposition[e.table]).map((e) => e.table)
    expect(missing).toEqual([])
    for (const e of census) {
      const d = disposition[e.table]
      expect(ALLOWED.has(d.disposition), `${e.table}: ${d.disposition}`).toBe(true)
      expect(d.reason.length, e.table).toBeGreaterThan(10)
    }
  })

  it('keeps no disposition for a relation the census no longer lists', () => {
    const listed = new Set(census.map((e) => e.table))
    expect(Object.keys(disposition).filter((t) => !listed.has(t))).toEqual([])
  })

  it('has no live, referenced relation waiting for a generated tranche', () => {
    expect(Object.entries(disposition).filter(([, d]) => d.disposition === 'EVOLVE_NEXT_TRANCHE').map(([t]) => t)).toEqual([])
  })
})
