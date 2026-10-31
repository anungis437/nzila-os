import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F05 lists and reads are bounded, and a GET writes nothing', () => {
  // DEF-0B10-PEN-PENSION-LIST-READS-HAVE-NO-LIMIT-OR-PAGINATION
  it.each(['plans', 'trustees', 'members', 'benefits', 'contributions', 't4a'])('pension/%s lists at most LIST_LIMIT rows', (route) => {
    const source = read(`app/api/pension/${route}/route.ts`)
    expect(source).toContain('const LIST_LIMIT = 200;')
    expect(source).toContain('.limit(LIST_LIMIT)')
  })

  // DEF-0B4-CBAS-LIST-LIMIT-UNBOUNDED, DEF-0B4-CBAS-DETAIL-GET-WRITES-VIEW-COUNT
  it('the agreement list refuses an invalid or oversized page and the detail read counts no view', () => {
    const list = read('app/api/cbas/route.ts')
    expect(list).toContain("'Invalid pagination: page must be 1..10000 and limit 1..100'")
    expect(list).not.toContain("parseInt(url.searchParams.get('limit')")
    expect(read('app/api/cbas/[id]/route.ts')).toContain('{ countView: false }')
    expect(read('app/api/cbas/[id]/route.ts')).not.toContain('countView: includeAnalytics')
  })

  // DEF-0B6-CMP-COMPLIANCE-LISTS-UNBOUNDED
  it.each(['alerts', 'reports'])('compliance/%s lists at most 500 rows', (route) => {
    expect(read(`app/api/compliance/${route}/route.ts`)).toContain('.limit(500)')
  })

  // DEF-0B11-PRP-PRECEDENT-COLLECTION-GET-TAKES-UNBOUNDED-LIMIT-AND-PAGE-FROM-THE-QUERY-STRING
  it('the precedent collection refuses an invalid page or a limit above 100', () => {
    const source = read('app/api/precedents/route.ts')
    expect(source).toContain('boundedPositiveInt(searchParams.get("limit")')
    expect(source).toContain('limit 1..100')
  })
})
