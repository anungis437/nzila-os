import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..', '..')
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('DEF-0B1-DOCS-UNAUTH-API-SURFACE: privileged OpenAPI exposure', () => {
  it('requires administrator authorization on both documentation entrypoints', () => {
    const canonical = source('app/api/docs/route.ts')
    const alias = source('app/api/docs/openapi.json/route.ts')
    expect(canonical).toMatch(/GET\\s*=\\s*withRoleAuth\\('admin'/)
    expect(alias).toMatch(/GET\\s*=\\s*withRoleAuth\\('admin'/)
    expect(alias).toMatch(/generateOpenAPISpec\\(\\)/)
    expect(alias).not.toMatch(/openApiConfig/)
  })

  it('excludes the operation inventory from both public-route registries', () => {
    const proxy = source('lib/public-routes.ts')
    const registry = source('config/public-api-routes.ts')
    expect(proxy).not.toMatch(/^\\s*'\\/api\\/docs\\/openapi\\.json'\\s*,/m)
    expect(registry).not.toMatch(/pattern:\\s*['"]\\/api\\/docs\\/openapi\\.json['"]/)
  })

  it('does not permit a shared cache to retain either response', () => {
    for (const route of ['app/api/docs/route.ts', 'app/api/docs/openapi.json/route.ts']) {
      expect(source(route)).toMatch(/Cache-Control['"]?:\\s*['"]private, no-store['"]/)
    }
  })
})
