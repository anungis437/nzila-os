import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isReexportAliasOfAcceptedRoute, reexportedSpecifiers } from './route-aliases'

const UE = join(__dirname, '..', '..', 'apps', 'union-eyes')

// The exemption the governance contracts rely on for a route that only re-exports another route: it must be narrow, so that it cannot be reached by
// a route that does anything, and so that an alias is exactly as authorized as the route it names.
describe('re-export aliases are accepted only as far as the route they name', () => {
  let root: string
  const write = (rel: string, content: string) => {
    const file = join(root, rel)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
    return file
  }
  const guarded = (_file: string, text: string) => text.includes('withApi(')
  const check = (file: string, accepts = guarded) => isReexportAliasOfAcceptedRoute(file, readFileSync(file, 'utf-8'), accepts)

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'ue-route-aliases-'))
    write('api/real/route.ts', "export const GET = withApi({}, async () => ({ ok: true }))\n")
    write('api/unguarded/route.ts', 'export async function GET() { return Response.json({}) }\n')
  })
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('reads a file as an alias only when it is nothing but re-exports and route segment configuration', () => {
    expect(reexportedSpecifiers("export { GET } from '../real/route';")).toEqual(['../real/route'])
    expect(reexportedSpecifiers("// an alias\n/* of another route */\nexport const dynamic = 'force-dynamic';\nexport const runtime = 'nodejs';\nexport { GET, POST } from '../real/route';\n")).toEqual(['../real/route'])
    expect(reexportedSpecifiers("export { GET } from '../a/route'\nexport { POST } from '../b/route'")).toEqual(['../a/route', '../b/route'])
    // Anything of its own makes it a route, not an alias.
    expect(reexportedSpecifiers("export { GET } from '../real/route'\nexport async function POST() { return Response.json({}) }")).toBeNull()
    expect(reexportedSpecifiers("import { db } from '@/db/db'\nexport { GET } from '../real/route'")).toBeNull()
    expect(reexportedSpecifiers("export { GET } from '../real/route'\nconst x = 1")).toBeNull()
    expect(reexportedSpecifiers("export const GET = withApi({}, async () => ({}))")).toBeNull()
    expect(reexportedSpecifiers('')).toBeNull()
  })

  it('accepts an alias of a route the contract accepts, and an alias of an alias of one', () => {
    expect(check(write('api/alias-one/route.ts', "export { GET } from '../real/route';\n"))).toBe(true)
    expect(check(write('api/alias-two/route.ts', "export { GET } from '../alias-one/route';\n"))).toBe(true)
    expect(check(write('api/alias-file/route.ts', "export { GET } from '../real/route.ts';\n"))).toBe(true)
  })

  it('refuses an alias of a route the contract would refuse', () => {
    expect(check(write('api/alias-unguarded/route.ts', "export { GET } from '../unguarded/route';\n"))).toBe(false)
    expect(check(write('api/alias-chain-unguarded/route.ts', "export { GET } from '../alias-unguarded/route';\n"))).toBe(false)
  })

  it('refuses an alias that adds behaviour of its own, even to a guarded route', () => {
    expect(check(write('api/extra/route.ts', "export { GET } from '../real/route';\nexport async function POST() { return Response.json({ open: true }) }\n"))).toBe(false)
    expect(check(write('api/side-effect/route.ts', "import '../../side-effect'\nexport { GET } from '../real/route';\n"))).toBe(false)
  })

  it('refuses an alias to a missing route, to anything that is not a route module, to another package, and a cycle', () => {
    expect(check(write('api/missing/route.ts', "export { GET } from '../nowhere/route';\n"))).toBe(false)
    write('lib/guarded.ts', 'export const GET = withApi({}, async () => ({}))\n')
    expect(check(write('api/library/route.ts', "export { GET } from '../../lib/guarded';\n"))).toBe(false)
    expect(check(write('api/package/route.ts', "export { GET } from '@/app/api/real/route';\n"))).toBe(false)
    write('api/cycle-a/route.ts', "export { GET } from '../cycle-b/route';\n")
    expect(check(write('api/cycle-b/route.ts', "export { GET } from '../cycle-a/route';\n"))).toBe(false)
  })

  it('requires every target of a route that re-exports from several', () => {
    expect(check(write('api/both/route.ts', "export { GET } from '../real/route';\nexport { POST } from '../real/route';\n"))).toBe(true)
    expect(check(write('api/half/route.ts', "export { GET } from '../real/route';\nexport { POST } from '../unguarded/route';\n"))).toBe(false)
  })

  it('refuses a chain longer than the bound', () => {
    write('api/hop-0/route.ts', "export { GET } from '../real/route';\n")
    for (let hop = 1; hop <= 6; hop += 1) write(`api/hop-${hop}/route.ts`, `export { GET } from '../hop-${hop - 1}/route';\n`)
    expect(check(join(root, 'api/hop-2/route.ts'))).toBe(true)
    expect(check(join(root, 'api/hop-6/route.ts'))).toBe(false)
  })

  it('treats every alias route of the application as exactly as authorized as the route it names', () => {
    const aliases: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (entry.name === 'route.ts' && reexportedSpecifiers(readFileSync(path, 'utf8'))) aliases.push(path)
      }
    }
    walk(join(UE, 'app', 'api'))
    const accepted = (alias: string) => isReexportAliasOfAcceptedRoute(alias, readFileSync(alias, 'utf8'), () => true)
    const relative = (alias: string) => alias.slice(UE.length + 1).replace(/\\/g, '/')
    const byKind = { routes: aliases.filter(accepted).map(relative).sort(), others: aliases.filter((alias) => !accepted(alias)).map(relative).sort() }

    // The aliases the application keeps for its legacy path names are recognised, each as an alias of a route module that exists.
    expect(byKind.routes).toEqual(expect.arrayContaining([
      'app/api/governance/route.ts',
      'app/api/intelligence/route.ts',
      'app/api/oci/assessment/route.ts',
      'app/api/oci/intake/route.ts',
      'app/api/oci/report/[assessmentId]/route.ts',
      'app/api/oci/results/[id]/route.ts',
    ]))
    // A re-export of a package handler is not an alias of a route: its authorization is read from its own text, as before.
    expect(byKind.others).toContain('app/api/auth/invite/accept/route.ts')
    for (const alias of aliases.filter(accepted)) {
      for (const specifier of reexportedSpecifiers(readFileSync(alias, 'utf8'))!) expect(specifier, alias).toMatch(/^\.{1,2}\//)
    }
  })
})
