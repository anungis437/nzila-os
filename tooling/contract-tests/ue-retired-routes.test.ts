import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isRetiredNoOpRoute } from './retired-routes'

const UE = join(__dirname, '..', '..', 'apps', 'union-eyes')
const read = (rel: string) => readFileSync(join(UE, rel), 'utf8')

function routes(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) routes(path, out)
    else if (entry.name === 'route.ts') out.push(path)
  }
  return out
}

describe('retired routes are inert (the exemption the guard contracts rely on)', () => {
  it('retiredHandler answers 501 and imports nothing that reads, writes or authenticates', () => {
    const source = read('lib/api/retired-route.ts')
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
    expect(imports).toEqual(['next/server'])
    expect(source).toContain('status: 501')
  })

  it('retiredFinancialRoute requires an authenticated member, logs the access and answers the 501 helper', () => {
    const source = read('lib/finance/retired-financial-route.ts')
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
    expect(imports.sort()).toEqual(['@/lib/api/deprecation', '@/lib/api/with-api', '@/lib/finance/financial-authority'])
    expect(source).toMatch(/required:\s*true/)
    expect(source).toContain('capabilityNotImplementedResponse(')
    expect(read('lib/finance/financial-authority.ts')).toMatch(/capabilityNotImplementedResponse[^]*?status:\s*501/)
  })

  it('recognises only a retired-helper route with no data access or write', () => {
    expect(isRetiredNoOpRoute("import { retiredHandler } from '@/lib/api/retired-route'\nexport const GET = retiredHandler('x')")).toBe(true)
    expect(isRetiredNoOpRoute("const h = retiredFinancialRoute('a', 'b')\nexport const GET = h")).toBe(true)
    expect(isRetiredNoOpRoute("import { db } from '@/db/db'\nexport const GET = retiredHandler('x')")).toBe(false)
    expect(isRetiredNoOpRoute("export const POST = async () => { await tx.insert(t).values({}); return retiredHandler('x')() }")).toBe(false)
    expect(isRetiredNoOpRoute("export const GET = async () => fetch('https://example.com')")).toBe(false)
    expect(isRetiredNoOpRoute('export const GET = async () => Response.json({})')).toBe(false)
  })

  it('every route the recogniser exempts holds only retired-helper exports', () => {
    const exempt = routes(join(UE, 'app', 'api')).filter((file) => isRetiredNoOpRoute(readFileSync(file, 'utf8')))
    expect(exempt.length).toBeGreaterThan(0)
    for (const file of exempt) {
      const source = readFileSync(file, 'utf8')
      for (const line of source.split('\n').filter((l) => /^export const (GET|POST|PUT|PATCH|DELETE)\b/.test(l))) {
        expect(line, file).toMatch(/retired(?:Handler|FinancialRoute)?|= handler/i)
      }
    }
  })
})
