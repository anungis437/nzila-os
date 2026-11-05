import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..', '..')

const affected = [
  'app/api/organizations/[id]/access-logs/route.ts',
  'app/api/organizations/[id]/sharing-settings/route.ts',
]

describe('Gate 0B.9 organization-row facade containment', () => {
  for (const route of affected) {
    it(`${route} refuses unrelated organization rows and mutations`, () => {
      const source = readFileSync(join(root, route), 'utf8')
      expect(source).toMatch(/minRole:\s*'admin'/)
      expect(source).toMatch(/params\.id\s*!==\s*organizationId/)
      expect(source).toMatch(/status:\s*403/)
      expect(source).toMatch(/status:\s*501/)
      expect(source).toMatch(/Cache-Control['"]?:\s*['"]private, no-store['"]/)
      expect(source).not.toMatch(/crudRoutes|from ['"]@\/db\/schema['"]/)
      expect(source).not.toMatch(/export const (PATCH|PUT|DELETE)\b/)
    })
  }

  it('identifies the missing canonical access-log and sharing-settings journeys explicitly', () => {
    const logs = readFileSync(join(root, affected[0]), 'utf8')
    const settings = readFileSync(join(root, affected[1]), 'utf8')
    expect(logs).toContain('CROSS_ORG_ACCESS_LOG_NOT_IMPLEMENTED')
    expect(settings).toContain('GOVERNED_SHARING_SETTINGS_NOT_IMPLEMENTED')
  })
})
