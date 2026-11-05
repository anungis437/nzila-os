import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(fileURLToPath(new URL('../../../', import.meta.url)), path), 'utf8')

describe('B49 regulatory records are retained, not deleted through the generic route (DEF-0B4-OHS-REGULATORY-RECORD-HARD-DELETE, DEF-0B5-OHS-REFUSAL-EVENT-HARD-DELETE)', () => {
  it('refuses the generic DELETE with a conflict before any lookup or write', () => {
    const factory = read('lib/api/crud-factory.ts')
    const deleteSection = factory.slice(factory.indexOf('const DELETE = withApi('))
    const refusal = deleteSection.indexOf('if (opts.retainOnDelete)')
    expect(refusal).toBeGreaterThan(0)
    expect(deleteSection.slice(refusal, refusal + 260)).toContain('ApiError.conflict(')
    expect(refusal).toBeLessThan(deleteSection.indexOf('audited('))
    expect(refusal).toBeLessThan(deleteSection.indexOf('tx.delete(table)'))
  })

  it.each([
    'app/api/cnesst/anti-scab/[id]/route.ts',
    'app/api/cnesst/right-of-refusal/[id]/route.ts',
    'app/api/cnesst/hs-committees/[id]/route.ts',
  ])('declares %s as retained', (route) => {
    expect(read(route)).toContain('retainOnDelete: true')
  })
})
