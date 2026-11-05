import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { analyzeAmbientHandle, needsOf, type AmbientReport, type Mode, type TableAuthority, type TablePrivileges } from '../lib/tenant-context/analysis'

/**
 * The tenant-context analysis (UE-CONV-H-019) on small programs held in memory: what counts as a context, what a route is handed by its wrapper, how a
 * context travels through a call, and what a statement is judged to touch; and the privilege census over the same graph: which role runs a statement and
 * whether it was granted what the statement does. The real application is judged by scripts/runtime/tenant-context-census.ts.
 */
const ROOT = '/virtual-app'

const SCAFFOLD: Record<string, string> = {
  // A drizzle-shaped handle: what makes `tx` (the parameter a wrapper hands its callback) a database handle is its type, as in the application.
  'db/db.ts': `
    export type Handle = {
      select: (...args: any[]) => any
      selectDistinct: (...args: any[]) => any
      insert: (table: any) => any
      update: (table: any) => any
      delete: (table: any) => any
      execute: (statement: any) => any
      transaction: <T>(work: (tx: Handle) => Promise<T>) => Promise<T>
      query: Record<string, { findMany: (...args: any[]) => any; findFirst: (...args: any[]) => any }>
    }
    export const db: Handle = {} as Handle`,
  'db/index.ts': `export { db } from './db'`,
  'db/schema.ts': `
    type Table<N extends string> = { _: { name: N; columns: {} } }
    type SchemaTable<N extends string, S extends string> = { _: { name: N; schema: S; columns: {} } }
    export const things = {} as Table<'things'>
    export const parts = {} as Table<'parts'>
    export const secrets = {} as Table<'secrets'>
    export const lookups = {} as Table<'lookups'>
    export const authThings = {} as SchemaTable<'things', 'user_management'>
    export const publicThings = {} as SchemaTable<'things', 'public'>`,
  'lib/db/with-rls-context.ts': `
    import { db, type Handle } from '@/db/db'
    export async function withRLSContext<T>(context: unknown, work: (tx: Handle) => Promise<T>): Promise<T> { return db.transaction(work) }
    export async function withSystemContext<T>(work: (tx: Handle) => Promise<T>): Promise<T> { return db.transaction(work) }`,
  'lib/api/framework.ts': `export function withApi(config: unknown, handler: (ctx: any) => unknown) { return handler }`,
  'lib/sql.ts': `
    export type SQL = { fragment: true }
    export const sql = (strings: TemplateStringsArray, ...values: unknown[]): SQL => ({ fragment: true })`,
}

const AUTHORITY: Record<string, TableAuthority> = {
  things: { classification: 'TENANT_RLS_REQUIRED', principal: 'TENANT_RUNTIME' },
  parts: { classification: 'PARENT_OWNED_RLS_REQUIRED', principal: 'TENANT_RUNTIME' },
  secrets: { classification: 'SYSTEM_ONLY', principal: 'SYSTEM_RUNTIME' },
  lookups: { classification: 'GLOBAL_REFERENCE_DATA', principal: 'NONE' },
}

// What the manifest grants each role. `things` is the tenant's to read, write and update; `parts` it may only read; `secrets` belongs to the system role.
const PRIVILEGES: Record<string, TablePrivileges> = {
  things: { runtime: new Set(['SELECT', 'INSERT', 'UPDATE']), system: new Set() },
  parts: { runtime: new Set(['SELECT']), system: new Set(['SELECT']) },
  secrets: { runtime: new Set(), system: new Set(['SELECT', 'INSERT']) },
  lookups: { runtime: new Set(['SELECT']), system: new Set(['SELECT']) },
}

function analyze(files: Record<string, string>, mode: Mode = 'v2', withPrivileges = false): AmbientReport {
  const all = { ...SCAFFOLD, ...files }
  const absolute = new Map(Object.entries(all).map(([name, text]) => [`${ROOT}/${name}`, text]))
  const options: ts.CompilerOptions = {
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: ROOT,
    paths: { '@/*': ['./*'] },
    types: [],
    lib: ['lib.es2022.d.ts'],
  }
  const host = ts.createCompilerHost(options)
  const original = {
    fileExists: host.fileExists.bind(host),
    readFile: host.readFile.bind(host),
    getSourceFile: host.getSourceFile.bind(host),
    directoryExists: host.directoryExists!.bind(host),
    realpath: host.realpath!.bind(host),
  }
  const normalize = (file: string) => file.replace(/\\/g, '/')
  // Module resolution probes a file's directory on the host before the file: without these, no import of a virtual file would ever resolve.
  const directories = new Set<string>()
  for (const file of absolute.keys()) for (let directory = path.posix.dirname(file); !directories.has(directory); directory = path.posix.dirname(directory)) directories.add(directory)
  host.directoryExists = (directory) => directories.has(normalize(directory)) || original.directoryExists(directory)
  host.realpath = (file) => (absolute.has(normalize(file)) ? file : original.realpath(file))
  host.fileExists = (file) => absolute.has(normalize(file)) || original.fileExists(file)
  host.readFile = (file) => absolute.get(normalize(file)) ?? original.readFile(file)
  host.getSourceFile = (file, languageVersion, ...rest) => {
    const text = absolute.get(normalize(file))
    return text === undefined ? original.getSourceFile(file, languageVersion, ...rest) : ts.createSourceFile(file, text, languageVersion, true)
  }
  const program = ts.createProgram([...absolute.keys()], options, host)
  return analyzeAmbientHandle(program, path.posix.normalize(ROOT), (table) => AUTHORITY[table], mode, withPrivileges ? (table) => PRIVILEGES[table] : undefined)
}

const findings = (report: AmbientReport) => report.findings.map((finding) => `${finding.file}:${finding.method}:${finding.tables.join(',')}:${finding.needs}`)
const denied = (report: AmbientReport) => report.privilegeFindings.map((finding) => `${finding.file}:${finding.principal}:${finding.table}:${finding.operation}:${finding.via}`)

describe('a route', () => {
  it('that reads a tenant table on the ambient handle with no context is a finding, with the table it touches', () => {
    const report = analyze({
      'app/api/things/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { db } from '@/db/db'
        import { things } from '@/db/schema'
        export const GET = withApi({}, async () => db.select().from(things))`,
    }, 'legacy')
    expect(findings(report)).toEqual(['app/api/things/route.ts:select:things:TENANT'])
    expect(report.findings[0].witness).toEqual(['app/api/things/route.ts#GET'])
  })

  it('is not one when the statement is inside a context wrapper, however the handle reaches it', () => {
    const report = analyze({
      'app/api/things/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { db } from '@/db'
        import { things } from '@/db/schema'
        import { withRLSContext } from '@/lib/db/with-rls-context'
        export const GET = withApi({}, async ({ organizationId }) => withRLSContext({ organizationId }, async () => db.select().from(things)))`,
    }, 'legacy')
    expect(findings(report)).toEqual([])
  })

  it('is handed a tenant transaction by withApi when it asks (rlsOrgContext), in both states', () => {
    const files = {
      'app/api/things/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { db } from '@/db/db'
        import { things } from '@/db/schema'
        export const GET = withApi({ rlsOrgContext: true }, async () => db.select().from(things))`,
    }
    expect(findings(analyze(files, 'legacy'))).toEqual([])
    expect(findings(analyze(files, 'v2'))).toEqual([])
  })

  it('is handed one by every authenticated route that requires an organization in the canonical state, and only then', () => {
    const files = {
      'app/api/things/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { db } from '@/db/db'
        import { things } from '@/db/schema'
        export const GET = withApi({ auth: { required: true, minRole: 'member' } }, async () => db.select().from(things))`,
    }
    expect(findings(analyze(files, 'v2'))).toEqual([])
    expect(findings(analyze(files, 'legacy'))).toEqual(['app/api/things/route.ts:select:things:TENANT'])
  })

  it('is not handed one when it is public, a machine route, a cron route or asks for no organization', () => {
    for (const config of ['{ auth: { required: false } }', '{ auth: { machine: verify } }', '{ auth: { cron: true } }', '{ requireOrg: false }']) {
      const report = analyze({
        'app/api/things/route.ts': `
          import { withApi } from '@/lib/api/framework'
          import { db } from '@/db/db'
          import { things } from '@/db/schema'
          const verify = async () => ({})
          export const POST = withApi(${config}, async () => db.insert(things).values({}))`,
      })
      expect(findings(report), config).toEqual(['app/api/things/route.ts:insert:things:TENANT'])
    }
  })

  it('judges what the statement touches: a join names every table, reference data needs nothing, a system table needs the system context', () => {
    const report = analyze({
      'app/api/mixed/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { db } from '@/db/db'
        import { things, parts, secrets, lookups } from '@/db/schema'
        export const GET = withApi({}, async () => {
          await db.select().from(things).innerJoin(parts, {} as any)
          await db.select().from(lookups)
          await db.select().from(secrets)
          await db.execute({} as any)
        })`,
    }, 'legacy')
    expect(findings(report)).toEqual([
      'app/api/mixed/route.ts:select:things,parts:TENANT',
      'app/api/mixed/route.ts:select:secrets:SYSTEM',
      'app/api/mixed/route.ts:execute::UNCLASSIFIED',
    ])
  })

  it('reads the table of a relational query from the schema export it names', () => {
    const report = analyze({
      'app/api/things/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { db } from '@/db/db'
        export const GET = withApi({}, async () => {
          await db.query.things.findMany()
          await db.query.lookups.findFirst()
          await db.query.nothingByThatName.findFirst()
        })`,
    }, 'legacy')
    expect(findings(report)).toEqual([
      'app/api/things/route.ts:query:things:TENANT',
      'app/api/things/route.ts:query::UNCLASSIFIED',
    ])
  })

  it('judges the statements run on a transaction opened on the ambient handle, not the transaction', () => {
    const report = analyze({
      'app/api/things/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { db } from '@/db/db'
        import { things, lookups } from '@/db/schema'
        export const GET = withApi({}, async () => db.transaction(async (tx) => {
          await tx.select().from(lookups)
          await tx.insert(things).values({})
        }))`,
    }, 'legacy')
    expect(findings(report)).toEqual(['app/api/things/route.ts:insert:things:TENANT'])
  })

  it('does not judge a transaction opened inside a context by its own handle', () => {
    const report = analyze({
      'app/api/things/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { db } from '@/db/db'
        import { things } from '@/db/schema'
        import { withRLSContext } from '@/lib/db/with-rls-context'
        export const GET = withApi({}, async () => withRLSContext({ organizationId: 'x' }, async () => db.transaction(async (tx) => tx.select().from(things))))`,
    }, 'legacy')
    expect(findings(report)).toEqual([])
  })

  it('reads a raw statement: static text that names no relation touches nothing, a bound parameter is not part of it, a spliced fragment is not read', () => {
    const report = analyze({
      'app/api/raw/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { db } from '@/db/db'
        import { things } from '@/db/schema'
        import { sql, type SQL } from '@/lib/sql'
        export const GET = withApi({}, async (ctx: { id: string; where: SQL }) => {
          await db.execute(sql\`select 1\`)
          await db.execute(sql\`select * from things where id = \${ctx.id}\`)
          await db.execute(sql\`select * from \${things}\`)
          await db.execute(sql\`select 1 where \${ctx.where}\`)
        })`,
    }, 'legacy')
    expect(findings(report)).toEqual([
      'app/api/raw/route.ts:execute:things:TENANT',
      'app/api/raw/route.ts:execute:things:TENANT',
      'app/api/raw/route.ts:execute::UNCLASSIFIED',
    ])
  })

  it('does not count the handle named in a type, but does count it handed on', () => {
    const report = analyze({
      'app/api/things/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { db } from '@/db/db'
        type Handle = typeof db
        const use = (handle: Handle) => handle
        export const GET = withApi({}, async () => use(db))`,
    }, 'legacy')
    expect(findings(report)).toEqual(['app/api/things/route.ts:passed::UNCLASSIFIED'])
  })
})

describe('a call', () => {
  const helper = `
    import { db } from '@/db/db'
    import { things } from '@/db/schema'
    export const listThings = async () => db.select().from(things)`

  it('carries the context into a helper only when every reference to the helper is inside a wrapper', () => {
    const inside = analyze({
      'lib/things.ts': helper,
      'app/api/things/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { withRLSContext } from '@/lib/db/with-rls-context'
        import { listThings } from '@/lib/things'
        export const GET = withApi({}, async ({ organizationId }) => withRLSContext({ organizationId }, async () => listThings()))`,
    }, 'legacy')
    expect(findings(inside)).toEqual([])

    const outside = analyze({
      'lib/things.ts': helper,
      'app/api/things/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { listThings } from '@/lib/things'
        export const GET = withApi({}, async () => listThings())`,
    }, 'legacy')
    expect(findings(outside)).toEqual(['lib/things.ts:select:things:TENANT'])
    expect(outside.findings[0].witness).toEqual(['app/api/things/route.ts#GET', 'lib/things.ts#listThings'])
  })

  it('is a finding as soon as one route reaches the helper with no context, though another reaches it with one', () => {
    const report = analyze({
      'lib/things.ts': helper,
      'app/api/safe/route.ts': `
        import { withApi } from '@/lib/api/framework'
        import { listThings } from '@/lib/things'
        export const GET = withApi({ rlsOrgContext: true }, async () => listThings())`,
      'app/api/unsafe/route.ts': `
        import { listThings } from '@/lib/things'
        export async function GET() { return listThings() }`,
    }, 'legacy')
    expect(findings(report)).toEqual(['lib/things.ts:select:things:TENANT'])
    expect(report.findings[0].witness[0]).toBe('app/api/unsafe/route.ts#GET')
  })

  it('reaches everything a module exports through a dynamic import, which names the module and not the export', () => {
    const report = analyze({
      'lib/things.ts': helper,
      'app/api/things/route.ts': `
        export async function GET() {
          const { listThings } = await import('@/lib/things')
          return listThings()
        }`,
    }, 'legacy')
    expect(findings(report)).toEqual(['lib/things.ts:select:things:TENANT'])
    expect(report.findings[0].witness).toEqual(['app/api/things/route.ts#GET', 'lib/things.ts#*', 'lib/things.ts#listThings'])
  })

  it('does not reach a helper the module does not export through a namespace or dynamic import', () => {
    const report = analyze({
      'lib/things.ts': `
        import { db } from '@/db/db'
        import { things } from '@/db/schema'
        const privateRead = async () => db.select().from(things)
        export const publicRead = async () => 1`,
      'app/api/things/route.ts': `
        import * as things from '@/lib/things'
        export async function GET() { return things.publicRead() }`,
    }, 'legacy')
    expect(findings(report)).toEqual([])
  })

  it('does not treat the context wrappers\' own use of the handle as a statement outside a context', () => {
    const report = analyze({
      'app/api/things/route.ts': `
        import { withRLSContext } from '@/lib/db/with-rls-context'
        export async function GET() { return withRLSContext({ organizationId: 'x' }, async () => 1) }`,
    }, 'legacy')
    expect(findings(report)).toEqual([])
  })
})

describe('a class', () => {
  const service = `
    import { db } from '@/db/db'
    import { things, parts } from '@/db/schema'
    export class ThingService {
      private readonly seed = db.select().from(parts)
      constructor() { void db.select().from(parts) }
      async readThings() { return db.select().from(things) }
      async readParts() { return this.helper() }
      private async helper() { return db.select().from(parts) }
      static async create() { return new ThingService() }
    }`
  const callRoute = (call: string) => ({
    'lib/service.ts': service,
    'app/api/things/route.ts': `
      import { ThingService } from '@/lib/service'
      export async function GET() { return ${call} }`,
  })

  it('is reached by the method a call names, not by every statement the class holds', () => {
    const report = analyze(callRoute('new ThingService().readThings()'), 'legacy')
    expect(findings(report)).toEqual([
      'lib/service.ts:select:parts:TENANT',
      'lib/service.ts:select:parts:TENANT',
      'lib/service.ts:select:things:TENANT',
    ])
    expect(report.findings.map((finding) => finding.declaration).sort()).toEqual(['lib/service.ts#ThingService.constructor', 'lib/service.ts#ThingService.seed', 'lib/service.ts#ThingService.readThings'].sort())
  })

  it('does not reach a method nothing calls', () => {
    const report = analyze(callRoute('ThingService.create()'), 'legacy')
    expect(report.findings.some((finding) => finding.tables.includes('things'))).toBe(false)
    expect(report.findings.some((finding) => finding.declaration.endsWith('.helper'))).toBe(false)
  })

  it('reaches what a method calls on `this`, with the way in as the witness', () => {
    const report = analyze(callRoute('new ThingService().readParts()'), 'legacy')
    const helper = report.findings.find((finding) => finding.declaration === 'lib/service.ts#ThingService.helper')
    expect(helper?.witness).toEqual(['app/api/things/route.ts#GET', 'lib/service.ts#ThingService.readParts', 'lib/service.ts#ThingService.helper'])
    expect(report.findings.some((finding) => finding.tables.includes('things'))).toBe(false)
  })

  it('runs its constructor and the fields it initialises when it is named, and not the methods', () => {
    const report = analyze(callRoute('new ThingService()'), 'legacy')
    expect(report.findings.map((finding) => finding.declaration).sort()).toEqual(['lib/service.ts#ThingService.constructor', 'lib/service.ts#ThingService.seed'])
  })

  it('is judged in the role of the wrapper a call is made in, per method', () => {
    const privileged = analyze(
      {
        'lib/service.ts': `
          import { db, type Handle } from '@/db/db'
          import { things, secrets } from '@/db/schema'
          export class Jobs {
            async mayRun(tx: Handle) { return tx.select().from(secrets) }
            async neverRun(tx: Handle) { return tx.delete(things) }
          }`,
        'app/api/jobs/route.ts': `
          import { withSystemContext } from '@/lib/db/with-rls-context'
          import { Jobs } from '@/lib/service'
          export async function GET() { return withSystemContext((tx) => new Jobs().mayRun(tx)) }`,
      },
      'legacy',
      true,
    )
    expect(denied(privileged)).toEqual([])
  })

  it('reaches, through an interface, the method of each class that implements it and no other', () => {
    const report = analyze(
      {
        'lib/adapters.ts': `
          import { db } from '@/db/db'
          import { things, parts } from '@/db/schema'
          export interface Adapter { sync(): Promise<unknown> }
          export class First implements Adapter { async sync() { return db.select().from(things) } }
          export class Second implements Adapter { async sync() { return db.select().from(parts) } }
          export class Unrelated { async sync() { return db.select().from(things).where(undefined) } async other() { return 1 } }
          export const adapters: Adapter[] = [new First(), new Second()]`,
        'app/api/adapters/route.ts': `
          import { adapters } from '@/lib/adapters'
          export async function GET() { for (const adapter of adapters) await adapter.sync(); return 1 }`,
      },
      'legacy',
    )
    expect(report.findings.map((finding) => finding.declaration).sort()).toEqual(['lib/adapters.ts#First.sync', 'lib/adapters.ts#Second.sync'])
  })

  it('reaches the override a subclass declares when a call is made on its base', () => {
    const report = analyze(
      {
        'lib/base.ts': `
          import { db } from '@/db/db'
          import { things } from '@/db/schema'
          export class Base { async run() { return 1 } }
          export class Derived extends Base { async run() { return db.select().from(things) } }
          export const make = (): Base => new Derived()`,
        'app/api/base/route.ts': `
          import { make } from '@/lib/base'
          export async function GET() { return make().run() }`,
      },
      'legacy',
    )
    expect(report.findings.map((finding) => finding.declaration)).toEqual(['lib/base.ts#Derived.run'])
  })

  it('reaches every member of the name when the receiver is typed `any`, because nothing else can be said', () => {
    const report = analyze(
      {
        'lib/service.ts': service,
        'app/api/things/route.ts': `
          export async function GET(untyped: any) { return untyped.readThings() }`,
      },
      'legacy',
    )
    expect(report.findings.map((finding) => finding.declaration)).toEqual(['lib/service.ts#ThingService.readThings'])
  })

  it('does not reach a method of the same name when an `any` value only has a property of that name read', () => {
    const report = analyze(
      {
        'lib/service.ts': service,
        'app/api/things/route.ts': `
          export async function POST(request: { json: () => Promise<any> }) {
            const body = await request.json()
            return body.readThings || ''
          }`,
      },
      'legacy',
    )
    expect(report.findings).toEqual([])
  })
})

describe('a namespace import', () => {
  it('reads a member that is itself a module (`export * as inner`) without taking it for a value member', () => {
    const report = analyze({
      'lib/ns/inner.ts': `export const value = 1`,
      'lib/ns/index.ts': `export * as inner from './inner'`,
      'app/api/ns/route.ts': `
        import * as lib from '@/lib/ns'
        export async function GET() { return lib.inner.value }`,
    }, 'legacy')
    expect(findings(report)).toEqual([])
  })

  it('reaches the one export it names, through a barrel that only re-exports', () => {
    const files = {
      'lib/things.ts': `
        import { db } from '@/db/db'
        import { things, parts } from '@/db/schema'
        export const listThings = async () => db.select().from(things)
        export const listParts = async () => db.select().from(parts)`,
      'lib/barrel.ts': `export * from './things'`,
      'app/api/things/route.ts': `
        import * as service from '@/lib/barrel'
        export async function GET() { return service.listThings() }`,
    }
    const report = analyze(files, 'legacy')
    expect(report.findings.map((finding) => finding.declaration)).toEqual(['lib/things.ts#listThings'])
  })

  it('reaches everything the module exports when it is handed on as a value, or loaded dynamically', () => {
    const report = analyze(
      {
        'lib/things.ts': `
          import { db } from '@/db/db'
          import { things, parts } from '@/db/schema'
          export const listThings = async () => db.select().from(things)
          export const listParts = async () => db.select().from(parts)`,
        'lib/barrel.ts': `export * from './things'`,
        'app/api/things/route.ts': `
          export async function GET() { const service = await import('@/lib/barrel'); return Object.values(service) }`,
      },
      'legacy',
    )
    expect(report.findings.map((finding) => finding.declaration).sort()).toEqual(['lib/things.ts#listParts', 'lib/things.ts#listThings'])
  })
})

describe('a workbook-style wrapper that opens a tenant transaction for one caller and a system one for another', () => {
  it('judges its callback as both roles', () => {
    const report = analyze(
      {
        'lib/workbook.ts': `
          import type { Handle } from '@/db/db'
          export async function withClaimedWorkbookAccess<T>(args: { id: string }, callback: (authority: { tx: Handle }) => Promise<T>): Promise<T> { return callback({ tx: undefined as never }) }`,
        'app/api/workbook/route.ts': `
          import { withClaimedWorkbookAccess } from '@/lib/workbook'
          import { things } from '@/db/schema'
          export async function GET() { return withClaimedWorkbookAccess({ id: 'x' }, async ({ tx }) => tx.select().from(things)) }`,
      },
      'legacy',
      true,
    )
    expect(denied(report)).toEqual(['app/api/workbook/route.ts:SYSTEM:things:SELECT:lexical'])
  })
})

describe('a helper that hands its callback to a context wrapper', () => {
  const things = `
    import { db } from '@/db/db'
    import { things } from '@/db/schema'
    export const listThings = async () => db.select().from(things)`
  const tenant = `
    import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context'
    export const inTenant = <T>(organizationId: string, work: () => Promise<T>) => withRLSContext({ organizationId }, work)
    export const inSystem = <T>(work: () => Promise<T>) => withSystemContext(async () => work())
    export const inOrganization = <T>(organizationId: string, work: () => Promise<T>) => inTenant(organizationId, work)
    export async function loadThing(organizationId: string) { return withRLSContext({ organizationId }, async () => organizationId) }`

  it('is a wrapper too: the callback it is given runs in the context behind it', () => {
    const report = analyze({
      'lib/things.ts': things,
      'lib/tenant.ts': tenant,
      'app/api/things/route.ts': `
        import { inTenant } from '@/lib/tenant'
        import { listThings } from '@/lib/things'
        export async function GET() { return inTenant('x', () => listThings()) }`,
    }, 'legacy')
    expect(findings(report)).toEqual([])
  })

  it('is one through another helper, to any depth', () => {
    const report = analyze({
      'lib/things.ts': things,
      'lib/tenant.ts': tenant,
      'app/api/things/route.ts': `
        import { inOrganization } from '@/lib/tenant'
        import { listThings } from '@/lib/things'
        export async function GET() { return inOrganization('x', () => listThings()) }`,
    }, 'legacy')
    expect(findings(report)).toEqual([])
  })

  it('runs the callback in the role of the wrapper behind it, for the privilege census', () => {
    const report = analyze({
      'lib/tenant.ts': tenant,
      'app/api/secrets/route.ts': `
        import { db } from '@/db/db'
        import { secrets } from '@/db/schema'
        import { inSystem, inTenant } from '@/lib/tenant'
        export async function GET() {
          await inSystem(() => db.select().from(secrets))
          return inTenant('x', () => db.select().from(secrets))
        }`,
    }, 'legacy', true)
    expect(denied(report)).toEqual(['app/api/secrets/route.ts:RUNTIME:secrets:SELECT:lexical'])
  })

  it('is one when it is a function that calls the work inside the wrapper\'s own callback and never returns it (a transaction that is always rolled back)', () => {
    const report = analyze({
      'lib/things.ts': things,
      'lib/rolled-back.ts': `
        import { withSystemContext } from '@/lib/db/with-rls-context'
        class RolledBack<T> extends Error { constructor(readonly result: T) { super('rolled back') } }
        export async function inRolledBackTransaction<T>(work: () => Promise<T>): Promise<T> {
          try {
            await withSystemContext(async () => {
              throw new RolledBack(await work())
            })
          } catch (error) {
            if (error instanceof RolledBack) return error.result as T
            throw error
          }
          throw new Error('committed')
        }`,
      'app/api/things/route.ts': `
        import { inRolledBackTransaction } from '@/lib/rolled-back'
        import { listThings } from '@/lib/things'
        async function runOne() { return listThings() }
        async function runTwo() { return listThings() }
        export async function POST(request: Request) {
          const which = request.url
          return inRolledBackTransaction(async () => (which === 'a' ? runOne() : runTwo()))
        }`,
    }, 'legacy')
    expect(findings(report)).toEqual([])
  })

  it('is not reached again by reading a property of what it returned: a property of an object literal holds data, not code', () => {
    const report = analyze({
      'lib/tenant.ts': tenant,
      'app/api/things/route.ts': `
        import { db } from '@/db/db'
        import { things } from '@/db/schema'
        import { inTenant } from '@/lib/tenant'
        async function build() { await db.select().from(things); return { passed: true, count: 1 } }
        export async function POST() {
          const result = await inTenant('x', () => build())
          return { ...result, ok: result.passed }
        }`,
    }, 'legacy')
    expect(findings(report)).toEqual([])
  })

  it('is not reached again by reading a member of the type it returns: an anonymous return type is a description, not code', () => {
    const report = analyze({
      'lib/tenant.ts': tenant,
      'app/api/things/route.ts': `
        import { db, type Handle } from '@/db/db'
        import { things } from '@/db/schema'
        import { inTenant } from '@/lib/tenant'
        async function list(tx: Handle = db): Promise<{ rows: unknown[]; total: number }> { return { rows: await tx.select().from(things), total: 0 } }
        export async function GET() {
          const result = await inTenant('x', () => list())
          return result.rows.length + result.total
        }`,
    }, 'legacy')
    expect(findings(report)).toEqual([])
  })

  it('is still reached by calling a function-valued property of what it returned: that is code run outside the context', () => {
    const report = analyze({
      'lib/tenant.ts': tenant,
      'app/api/things/route.ts': `
        import { db } from '@/db/db'
        import { things } from '@/db/schema'
        import { inTenant } from '@/lib/tenant'
        async function build() { return { run: async () => db.select().from(things) } }
        export async function POST() {
          const service = await inTenant('x', () => build())
          return service.run()
        }`,
    }, 'legacy')
    expect(findings(report)).toEqual(['app/api/things/route.ts:select:things:TENANT'])
  })

  it('is not one for a parameter that is only data: what is passed in that position is still outside the context', () => {
    const report = analyze({
      'lib/things.ts': things,
      'lib/tenant.ts': tenant,
      'app/api/things/route.ts': `
        import { loadThing } from '@/lib/tenant'
        import { listThings } from '@/lib/things'
        export async function GET() { return loadThing(String((await listThings()).length)) }`,
    }, 'legacy')
    expect(findings(report)).toEqual(['lib/things.ts:select:things:TENANT'])
  })
})

describe('the privilege census', () => {
  const route = (name: string, body: string, imports = '') => ({
    [`app/api/${name}/route.ts`]: `
      import { withApi } from '@/lib/api/framework'
      import { db } from '@/db/db'
      import { sql } from '@/lib/sql'
      import { things, parts, secrets, lookups } from '@/db/schema'
      import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context'
      ${imports}
      export const GET = withApi({ rlsOrgContext: true }, async () => { ${body} })`,
  })

  it('judges a statement by the role of the wrapper around it: the runtime role in a tenant transaction, the system role in the system context', () => {
    const report = analyze(
      {
        ...route('mixed', `
          await withRLSContext({ organizationId: 'x' }, async (tx) => { await tx.select().from(things); await tx.select().from(secrets); await tx.delete(things) })
          await withSystemContext(async (tx) => { await tx.select().from(secrets); await tx.select().from(things); await tx.insert(secrets).values({}) })`),
      },
      'legacy',
      true,
    )
    expect(denied(report)).toEqual([
      'app/api/mixed/route.ts:RUNTIME:secrets:SELECT:lexical',
      'app/api/mixed/route.ts:RUNTIME:things:DELETE:lexical',
      'app/api/mixed/route.ts:SYSTEM:things:SELECT:lexical',
    ])
  })

  it('knows what else a statement needs: a WHERE or RETURNING reads, ON CONFLICT DO UPDATE updates, a join reads the joined table', () => {
    const report = analyze(
      {
        ...route('needs', `
          await withRLSContext({ organizationId: 'x' }, async (tx) => {
            await tx.update(parts).set({}).where({})
            await tx.insert(parts).values({}).returning()
            await tx.insert(parts).values({}).onConflictDoUpdate({})
            await tx.delete(parts).where({})
            await tx.select().from(things).innerJoin(secrets, {})
            await tx.update(things).set({}).where({}).returning()
            await tx.insert(things).values({}).onConflictDoUpdate({})
          })`),
      },
      'legacy',
      true,
    )
    expect(denied(report)).toEqual([
      'app/api/needs/route.ts:RUNTIME:parts:UPDATE:lexical',
      'app/api/needs/route.ts:RUNTIME:parts:INSERT:lexical',
      'app/api/needs/route.ts:RUNTIME:parts:INSERT:lexical',
      'app/api/needs/route.ts:RUNTIME:parts:UPDATE:lexical',
      'app/api/needs/route.ts:RUNTIME:parts:DELETE:lexical',
      'app/api/needs/route.ts:RUNTIME:secrets:SELECT:lexical',
    ])
  })

  it('reads the verb of a raw statement, and does not mistake `do update set` for a table', () => {
    const report = analyze(
      {
        ...route('raw', `
          await withRLSContext({ organizationId: 'x' }, async (tx) => {
            await tx.execute(sql\`update things set a = 1 where id = 2\`)
            await tx.execute(sql\`delete from things where id = 2\`)
            await tx.execute(sql\`insert into parts (a) values (1) on conflict (a) do update set a = 2\`)
            await tx.execute(sql\`select * from lookups join secrets on true\`)
          })`),
      },
      'legacy',
      true,
    )
    expect(denied(report)).toEqual([
      'app/api/raw/route.ts:RUNTIME:things:DELETE:lexical',
      'app/api/raw/route.ts:RUNTIME:parts:INSERT:lexical',
      'app/api/raw/route.ts:RUNTIME:secrets:SELECT:lexical',
    ])
  })

  it('reads a raw statement kept in a named constant where it is written, instead of leaving it unjudged', () => {
    const report = analyze(
      {
        'lib/queries.ts': `
          import { sql } from '@/lib/sql'
          export const listSecrets = sql\`select * from things join secrets on true\`
          export const text = 'delete from parts where true'`,
        ...route('named', `
          await withRLSContext({ organizationId: 'x' }, async (tx) => {
            await tx.execute(listSecrets)
            await tx.execute(text)
          })`, `import { listSecrets, text } from '@/lib/queries'`),
      },
      'legacy',
      true,
    )
    expect(denied(report)).toEqual([
      'app/api/named/route.ts:RUNTIME:secrets:SELECT:lexical',
      'app/api/named/route.ts:RUNTIME:parts:DELETE:lexical',
    ])
  })

  it('reads a relational query as a read of the table its schema export names', () => {
    const report = analyze({ ...route('query', `await withSystemContext(async (tx) => { await tx.query.things.findMany(); await tx.query.secrets.findFirst() })`) }, 'legacy', true)
    expect(denied(report)).toEqual(['app/api/query/route.ts:SYSTEM:things:SELECT:lexical'])
  })

  it('follows a helper into the roles that reach it: it is denied only in the role that lacks the privilege, and the witness names the way in', () => {
    const report = analyze(
      {
        'lib/things.ts': `
          import { db } from '@/db/db'
          import { things } from '@/db/schema'
          export const listThings = async () => db.select().from(things)`,
        ...route('tenant', `await withRLSContext({ organizationId: 'x' }, async () => listThings())`, `import { listThings } from '@/lib/things'`),
        ...route('system', `await withSystemContext(async () => listThings())`, `import { listThings } from '@/lib/things'`),
      },
      'legacy',
      true,
    )
    expect(denied(report)).toEqual(['lib/things.ts:SYSTEM:things:SELECT:reached'])
    expect(report.privilegeFindings[0].witness).toEqual(['app/api/system/route.ts#GET', 'lib/things.ts#listThings'])
  })

  it('judges a statement on the ambient handle outside any context as the runtime role, which is the role the pooled connection has', () => {
    const report = analyze({ 'app/api/ambient/route.ts': `
      import { db } from '@/db/db'
      import { parts } from '@/db/schema'
      export async function GET() { await db.insert(parts).values({}) }` }, 'legacy', true)
    expect(denied(report)).toEqual(['app/api/ambient/route.ts:RUNTIME:parts:INSERT:reached'])
  })

  it('says nothing of a statement that nothing runs, and counts what it could not judge', () => {
    const report = analyze(
      {
        'lib/dead.ts': `
          import { db } from '@/db/db'
          import { secrets } from '@/db/schema'
          export const unused = async () => db.delete(secrets)`,
        ...route('unknown', `await withRLSContext({ organizationId: 'x' }, async (tx) => { await tx.execute(sql\`select * from not_in_the_manifest\`); await tx.select().from(things) })`),
      },
      'legacy',
      true,
    )
    expect(denied(report)).toEqual([])
    expect(report.statements).toBe(2)
    expect(report.unjudged).toBe(1)
  })

  it('does not mistake a table of another schema for the public table of the same name', () => {
    const report = analyze(
      {
        ...route('schema', `await withSystemContext(async (tx) => { await tx.select().from(authThings); await tx.select().from(publicThings); await tx.select().from(things) })`, `import { authThings, publicThings } from '@/db/schema'`),
      },
      'legacy',
      true,
    )
    // user_management.things is not public.things: only the public reads are judged (one finding, the system role holds no privilege on public things).
    expect(denied(report)).toEqual(['app/api/schema/route.ts:SYSTEM:things:SELECT:lexical'])
    expect(report.statements).toBe(3)
    expect(report.unjudged).toBe(1)
  })

  it('is off unless the caller supplies the privileges', () => {
    const report = analyze({ ...route('off', `await withRLSContext({ organizationId: 'x' }, async (tx) => { await tx.delete(things) })`) }, 'legacy', false)
    expect(report.privilegeFindings).toEqual([])
    expect(report.statements).toBe(0)
  })
})

describe('what a table needs', () => {
  it('is decided by the storage-authority classification', () => {
    expect(needsOf({ classification: 'TENANT_RLS_REQUIRED', principal: 'TENANT_RUNTIME' })).toBe('TENANT')
    expect(needsOf({ classification: 'PARENT_OWNED_RLS_REQUIRED', principal: 'TENANT_RUNTIME' })).toBe('TENANT')
    expect(needsOf({ classification: 'MIXED_GLOBAL_TENANT_RLS_REQUIRED', principal: 'MIXED' })).toBe('TENANT')
    expect(needsOf({ classification: 'SYSTEM_ONLY', principal: 'SYSTEM_RUNTIME' })).toBe('SYSTEM')
    expect(needsOf({ classification: 'GLOBAL_REFERENCE_DATA', principal: 'NONE' })).toBe('OPEN')
    expect(needsOf(undefined)).toBe('UNCLASSIFIED')
  })
})
