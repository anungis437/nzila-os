/**
 * The schema census and the mutation-scope baseline stay ratchets.
 * This checks the prepared batch program covers every remaining entry and does not add one.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSchemaMutationBatches } from '../../scripts/lib/schema-mutation-batches'

const REGISTER = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/register')
const PROGRAM = path.join(REGISTER, 'ue-schema-mutation-batches.json')

describe('schema and mutation batch program', () => {
  const program = buildSchemaMutationBatches()
  const committed = JSON.parse(readFileSync(PROGRAM, 'utf8'))

  it('matches the committed program', () => {
    expect(program).toEqual(committed)
  })

  it('covers the census and the mutation baseline without adding a row', () => {
    const census = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-census.json'), 'utf8')).entries as { table: string }[]
    const disposition = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-disposition.json'), 'utf8')).entries as Record<string, { disposition: string }>
    const baseline = JSON.parse(readFileSync(path.join(REGISTER, 'ue-mutation-scope-baseline.json'), 'utf8')).entries as Record<string, number>
    expect(program.applyNow).toBe(false)
    expect(program.sourceMutationBaselineSum).toBe(13)
    expect(program.mutationLiveSum).toBeLessThanOrEqual(13)
    expect(program.censusCount).toBe(census.length)
    expect(program.schema.map((entry) => entry.table)).toEqual(census.map((entry) => entry.table).sort())
    expect(new Set(program.schema.map((entry) => entry.table)).size).toBe(census.length)
    for (const entry of program.schema) expect(entry.disposition).toBe(disposition[entry.table].disposition)
    expect(program.mutations.map((entry) => entry.key)).toEqual(Object.keys(baseline).sort())
    expect(program.mutationBaselineSum).toBe(Object.values(baseline).reduce((sum, count) => sum + count, 0))
    expect(program.mutations.reduce((sum, entry) => sum + entry.baselineCount, 0)).toBe(program.mutationBaselineSum)
    expect(program.mutationLiveSum).toBeLessThanOrEqual(program.mutationBaselineSum)
    for (const entry of program.mutations) expect(entry.liveCount).toBeLessThanOrEqual(entry.baselineCount)
  })

  it('keeps hold batches from shrinking a ratchet and keeps create-relation equal to the oracle exclusion', () => {
    const holds = new Set(program.batches.filter((batch) => batch.execution === 'hold').map((batch) => batch.id))
    for (const entry of program.schema) {
      if (!holds.has(entry.batchId)) continue
      const batch = program.batches.find((item) => item.id === entry.batchId)
      expect(batch?.shrink).toBe('none')
    }
    const excluded = [...(JSON.parse(readFileSync(path.resolve(__dirname, '../../../../tooling/db/canonical-schema/oracle-binding.json'), 'utf8')).dispositionExcluded as string[])].sort()
    expect(program.schema.filter((entry) => entry.batchId === 'schema-create-relation').map((entry) => entry.table).sort()).toEqual(excluded)
    expect(program.schema.some((entry) => entry.disposition === 'EVOLVE_NEXT_TRANCHE')).toBe(false)
    const finance = program.batches.find((batch) => batch.id === 'mutation-finance-latent')
    expect(finance?.action).toContain('Do not issue a financial mandate')
    expect(finance?.action).toContain('not an approval path')
    expect(finance?.statementCount).toBe(7)
    expect(finance?.liveStatementCount).toBe(0)
    expect(finance?.execution).toBe('implemented')
    expect(finance?.applyNow).toBe(true)
    expect(program.schema.filter((entry) => entry.table === 'grievance_communications').map((entry) => entry.batchId)).toEqual(['schema-django-defined'])
    const clc = program.batches.find((batch) => batch.id === 'mutation-clc-sync-log')
    expect(clc?.action).toContain('Do not drop the relation')
    expect(clc?.statementCount).toBe(1)
    expect(clc?.liveStatementCount).toBe(0)
    expect(clc?.execution).toBe('implemented')
    expect(clc?.applyNow).toBe(true)
    const pilot = program.batches.find((batch) => batch.id === 'mutation-pilot-rebind')
    expect(pilot?.action).toContain('cannot supply an organization token')
    expect(pilot?.statementCount).toBe(1)
    expect(pilot?.liveStatementCount).toBe(0)
    expect(pilot?.execution).toBe('implemented')
    expect(pilot?.applyNow).toBe(true)
    const workbook = program.batches.find((batch) => batch.id === 'mutation-workbook-unclaimed')
    expect(workbook?.action).toContain('READY_FOR_VS_EXECUTION')
    expect(workbook?.statementCount).toBe(2)
    expect(workbook?.liveStatementCount).toBe(0)
    expect(workbook?.execution).toBe('implemented')
    expect(workbook?.applyNow).toBe(true)
  })
})
