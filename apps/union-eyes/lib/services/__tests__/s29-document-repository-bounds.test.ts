import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listPage } from '@/lib/api/list-page'

const route = readFileSync(join(process.cwd(), 'app/api/documents/repository/route.ts'), 'utf8')

describe('Gate 0B.6 repository list cannot fan out over the entire tenant', () => {
  it('limits the number of case-access decisions before mapping candidates', () => {
    expect(route).toContain('listPage(request, 100, 50)')
    const query = route.slice(route.indexOf('const rows = await db'), route.indexOf('// Representative-level role'))
    expect(query).toContain('.limit(limit)')
    expect(query).toContain('.offset(offset)')
    expect(query).toContain('desc(documents.updatedAt), desc(documents.id)')
    expect(route.indexOf('.limit(limit)')).toBeLessThan(route.indexOf('rows.map(async'))
  })

  it('pushes linkedCase into SQL and refuses a malformed case id', () => {
    expect(route).toContain('z.guid().safeParse(linkedCase).success')
    expect(route).toContain('conditions.push(eq(documentLinks.linkedEntityId, linkedCase))')
    expect(route).not.toContain('row.linkedEntityId !== linkedCase')
  })

  it('keeps the existing array response and exposes candidate-offset pagination', () => {
    expect(route).toContain('standardSuccessResponse(visible.filter(Boolean), {')
    expect(route).toContain('nextOffset: offset + limit')
    expect(route).toContain('hasMore: rows.length === limit')
  })

  it('bounds pagination without changing the shared list helper', () => {
    expect(listPage({ url: 'https://app.example/api/documents/repository' }, 100, 50))
      .toEqual({ limit: 50, offset: 0 })
    expect(listPage({ url: 'https://app.example/api/documents/repository?limit=1000&offset=34' }, 100, 50))
      .toEqual({ limit: 100, offset: 34 })
    expect(listPage({ url: 'https://app.example/api/documents/repository?limit=0&offset=-9' }, 100, 50))
      .toEqual({ limit: 1, offset: 0 })
  })
})
