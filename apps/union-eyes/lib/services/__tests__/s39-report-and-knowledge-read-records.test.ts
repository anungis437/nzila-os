import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B95: durable records for report execution and knowledge-base reads', () => {
  it('records a report execution before the rows are returned, without the rows', () => {
    const route = src('app/api/reports/execute/route.ts')
    const audit = route.indexOf("action: 'report.execute'")
    expect(audit).toBeGreaterThan(-1)
    expect(audit).toBeLessThan(route.indexOf('data: result.data'))
    expect(route.slice(audit, route.indexOf('rowCount: result.rowCount', audit))).not.toContain('result.data')
  })

  it('applies the access columns to a parent organization\'s knowledge-base rows and audits a document read', () => {
    for (const file of ['app/api/knowledge-base/route.ts', 'app/api/knowledge-base/[id]/route.ts']) {
      const route = src(file)
      // F06 R5: the list goes through the entitlement-aware scope, which itself applies the access-column condition; the item keeps the
      // full condition and then checks the entitlement for a parent's row.
      expect(route).toMatch(/knowledgeBaseOrganizationCondition\(orgId, parentId\)|knowledgeBaseReadScope\(orgId, parentId, hasSuite\)/)
      expect(src('lib/knowledge-transfer/governance/kb-entitlement.ts')).toContain('knowledgeBaseOrganizationCondition(orgId, parentId)')
      expect(route).not.toContain('inArray(knowledgeBase.organizationId, orgIds)')
    }
    const item = src('app/api/knowledge-base/[id]/route.ts')
    expect(item.indexOf("action: 'knowledge_base.read'")).toBeLessThan(item.indexOf('return NextResponse.json({ data: visible })'))
    expect(src('app/api/knowledge-base/route.ts')).not.toContain('ilike(knowledgeBase.content, pattern)')
  })
})

