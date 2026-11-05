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
    // F06 R5: a parent's row is another organization's row, which a tenant transaction cannot see. The list and the item read it as the system role,
    // only under the condition that applies the access columns (public, or naming the reading organization), and the entitlement then decides
    // whether those rows are released at all.
    const visibility = src('lib/knowledge-transfer/governance/kb-visibility.ts')
    expect(visibility).toContain('eq(knowledgeBase.organizationId, parentId)')
    expect(visibility).toContain('or(eq(knowledgeBase.isPublic, true), sql`${knowledgeBase.allowedOrganizations} @> ${JSON.stringify([orgId])}::jsonb`)')
    expect(visibility).toContain('return or(own, knowledgeBaseParentSharedCondition(orgId, parentId))!')
    expect(src('lib/knowledge-transfer/governance/kb-entitlement.ts')).toContain('knowledgeBaseOrganizationCondition(orgId, parentId)')
    for (const file of ['app/api/knowledge-base/route.ts', 'app/api/knowledge-base/[id]/route.ts']) {
      const route = src(file)
      expect(route).toMatch(/withSystemContext\([\s\S]*?knowledgeBaseParentSharedCondition\(orgId, parentId!?\)/)
      expect(route).not.toContain('inArray(knowledgeBase.organizationId, orgIds)')
    }
    expect(src('app/api/knowledge-base/route.ts')).toContain('knowledgeBaseReadScope(orgId, parentId, hasSuite)')
    const item = src('app/api/knowledge-base/[id]/route.ts')
    expect(item).toContain('KNOWLEDGE_READ_POLICY.parentSharedRowsRequireSuite && !(await readerHasKnowledgeSuite(orgId))')
    expect(item.indexOf("action: 'knowledge_base.read'")).toBeLessThan(item.indexOf('return NextResponse.json({ data: visible })'))
    expect(src('app/api/knowledge-base/route.ts')).not.toContain('ilike(knowledgeBase.content, pattern)')
  })
})

