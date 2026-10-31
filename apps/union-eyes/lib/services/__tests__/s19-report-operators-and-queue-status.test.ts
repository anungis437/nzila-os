import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B75: report filter operators and queue status', () => {
  it('validates report filters against the executor\'s own operators and translates the earlier names', () => {
    const route = src('app/api/reports/execute/route.ts')
    expect(route).toContain("const ALLOWED_OPERATORS = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike', 'in', 'not_in', 'is_null', 'is_not_null', 'between']")
    expect(route).toContain("equals: 'eq'")
    expect(route).toContain("contains: 'ilike'")
    expect(route).toContain('needs ${filter.operator')
  })

  it('refuses an operator the executor does not know instead of skipping the filter and returning every row', () => {
    const executor = src('lib/report-executor.ts')
    expect(executor).toContain('Unsupported filter operator')
    expect(executor).not.toMatch(/default:\n\s+continue;\n\s+\}\n\n\s+\/\/ Handle logical operator transitions/)
  })

  it('verified: queue status needs the service key (constant-time) or a platform administrator, answers 401 for no session and returns no error text', () => {
    const route = src('app/api/union-eyes/queue-status/route.ts')
    expect(route).toContain('timingSafeEqual')
    expect(route).toContain('await requireSystemAdmin()')
    expect(route).toContain("{ error: 'Authentication required' }, { status: 401 }")
    expect(route).toContain("error: 'Queue status unavailable'")
    expect(route).not.toContain('detail: String(err)')
  })
})
