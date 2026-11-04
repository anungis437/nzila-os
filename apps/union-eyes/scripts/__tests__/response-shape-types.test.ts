/**
 * The type checker's part of the response-shape census (UE-CONV-H-027).
 *
 * A route that returns what a service gives it has no keys in its syntax, and a screen that declares what it expects of an answer (`useQuery<Rows>`, a typed state) has no route in
 * its own. The checker knows both, read as the JSON they become (scripts/lib/frontend-census/type-shapes.ts); a screen's declared type is judged against the route's answer by
 * `declaredGaps`. The tests build small programs of their own: the real tree is run by response-shape-census.test.ts.
 */
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { extractFromSource } from '../lib/frontend-census/client-calls'
import { readsOfRequest, type DeclaredAnswer } from '../lib/frontend-census/response-reads'
import { objectOf, RouteResponseReader, type Shape } from '../lib/frontend-census/route-response'
import { TypeShapes } from '../lib/frontend-census/type-shapes'
import { declaredGaps, describeGap, gapsAgainst } from '../runtime/response-shape-census'

const ROOT = path.join(process.cwd(), 'virtual-application')

const describeShape = (shape: Shape): unknown => {
  if (shape === null) return null
  if (shape.kind === 'array') return ['array', describeShape(shape.element)]
  return { keys: Object.fromEntries([...shape.keys].map(([key, value]) => [key, describeShape(value)])), open: shape.open }
}

const PRELUDE = `
interface Row { id: string; title: string; created: Date; note: string | null; tags: string[]; owner: { name: string; email: string | null }; extra?: { score: number }; bag: Record<string, unknown>; callback: () => void }
declare const withApi: any
declare function listRows(): Promise<{ items: Row[]; total: number }>
declare function loadAny(): Promise<any>
declare function loadUnknown(): Promise<unknown>
declare function loadGeneric<T>(value: T): Promise<Awaited<T>>
declare function loadRowList(): Promise<Row[] & { count: number }>
declare function loadMixed(): Promise<{ a: string } | { b: number }>
declare function loadEmpty(): Promise<{}>
declare function loadText(): Promise<string | { a: string }>
declare class NextResponse { static json(body: unknown): NextResponse; status: number; headers: Headers }
declare function loadReply(): Promise<NextResponse>
declare const raw: Row[]
`

const ROUTES: Record<string, string> = {
  rows: `export const GET = withApi({}, async () => listRows())`,
  any: `export const GET = withApi({}, async () => loadAny())`,
  unknown: `export const GET = withApi({}, async () => loadUnknown())`,
  generic: `export const GET = withApi({}, async () => loadGeneric({ a: 1 }))`,
  unresolved: `async function run<T>(work: () => Promise<T>): Promise<T> { const result = await work(); return result }\nexport const GET = withApi({}, async () => run(async () => listRows()))`,
  list: `export const GET = withApi({}, async () => loadRowList())`,
  mixed: `export const GET = withApi({}, async () => loadMixed())`,
  empty: `export const GET = withApi({}, async () => loadEmpty())`,
  text: `export const GET = withApi({}, async () => loadText())`,
  reply: `export const GET = withApi({}, async () => loadReply())`,
  named: `export const GET = withApi({}, async () => loadResponse())`,
  literal: `export const GET = withApi({}, async () => { const rows = await listRows(); return { items: rows.items, total: rows.total, note: 'x' } })`,
  cast: `export const GET = withApi({}, async () => ({ rows: raw as { id: string }[] }))`,
  spread: `export const GET = withApi({}, async () => { const page = await listRows(); return { ...page, generatedAt: 'now' } })`,
  conditional: `export const GET = withApi({}, async () => { if (raw.length === 0) return { clauses: [] }; return { clauses: raw.map((row) => ({ id: row.id })) } })`,
  crud: `declare function crudRoutes(options: { table: unknown; itemRoute?: boolean; omitFromResponse?: string[] }): { GET: unknown; POST: unknown }\ninterface TableRow { id: string; name: string; secret: string | null; createdAt: Date; owner: { id: string } }\ndeclare const things: { $inferSelect: TableRow }\nexport const { GET, POST } = crudRoutes({ table: things, omitFromResponse: ['secret'] })`,
  crudItem: `declare function crudRoutes(options: { table: unknown; itemRoute?: boolean }): { GET: unknown; PATCH: unknown }\ninterface TableRow { id: string; name: string }\ndeclare const things: { $inferSelect: TableRow }\nexport const { GET, PATCH } = crudRoutes({ table: things, itemRoute: true })`,
}

const files = Object.fromEntries(Object.entries(ROUTES).map(([name, code]) => [`app/api/${name}/route.ts`, `${PRELUDE}\n${code}`]))

const oracle = TypeShapes.forFiles(ROOT, files)
const reader = new RouteResponseReader({ read: (name) => files[name] ?? null, resolve: () => null }, oracle)
const answerOf = (name: string): { keys: Record<string, unknown>; open: boolean } | null => describeShape(reader.shapesOf(`app/api/${name}/route.ts`).get('GET') ?? null) as { keys: Record<string, unknown>; open: boolean } | null
const dataOf = (name: string): unknown => (answerOf(name)?.keys as Record<string, unknown> | undefined)?.data

const ROW = {
  keys: {
    id: null,
    title: null,
    created: null,
    note: null,
    tags: ['array', null],
    owner: { keys: { name: null, email: null }, open: false },
    extra: { keys: { score: null }, open: false },
    bag: { keys: {}, open: true },
  },
  open: false,
}

describe('reading the answer of a route from the types of what it returns', () => {
  it('knows the keys of what a service returns, which the syntax of the handler does not say', () => {
    expect(dataOf('rows')).toEqual({ keys: { items: ['array', ROW], total: null }, open: false })
  })

  it('reads a date, a nullable, a text and a function as no object: a date is a string in JSON and a function is dropped', () => {
    const item = (dataOf('rows') as { keys: { items: [string, { keys: Record<string, unknown> }] } }).keys.items[1].keys
    expect(item.created).toBeNull()
    expect(item.note).toBeNull()
    expect('callback' in item).toBe(false)
  })

  it('leaves unknown what a type does not say: any, unknown, a value that is an object or a text, a type with no members', () => {
    expect(dataOf('any')).toBeNull()
    expect(dataOf('unknown')).toBeNull()
    expect(dataOf('text')).toBeNull()
    expect(dataOf('empty')).toBeNull()
  })

  it('reads the type a generic function is given as what it hands back', () => {
    expect(dataOf('generic')).toEqual({ keys: { a: null }, open: false })
  })

  it('does not take a generic wrapper for an empty object: what it hands back is read where it is given', () => {
    // `Awaited<T> & {}` is what the non-nullable form of an unresolved type is; it has no members and would read as an object with no keys
    expect(dataOf('unresolved')).toEqual({ keys: { items: ['array', ROW], total: null }, open: false })
  })

  it('reads a list with something added to it (a database result) as a list, and a union of objects as the keys of both', () => {
    expect(dataOf('list')).toEqual(['array', ROW])
    expect(dataOf('mixed')).toEqual({ keys: { a: null, b: null }, open: false })
  })

  it('does not read the members of a response object as what it answers, and does not read at all what a call named for a response builds', () => {
    expect(dataOf('reply')).toBeNull()
    expect(answerOf('named')).toBeNull()
  })

  it('reads the values of the keys a handler writes out, not only data: what is read is a key of a key', () => {
    expect(dataOf('literal')).toEqual({ keys: { items: ['array', ROW], total: null, note: null }, open: false })
  })

  it('takes the type of a cast as what the author says the value is', () => {
    expect(dataOf('cast')).toEqual({ keys: { rows: ['array', { keys: { id: null }, open: false }] }, open: false })
  })

  it('knows the keys of a spread of something it can type', () => {
    expect(dataOf('spread')).toEqual({ keys: { items: ['array', ROW], total: null, generatedAt: null }, open: false })
  })

  it('keeps the element of a list across the answers of a handler, where one answer is an empty list', () => {
    expect(dataOf('conditional')).toEqual({ keys: { clauses: ['array', { keys: { id: null }, open: false }] }, open: false })
  })

  it('reads the row a CRUD route lists and returns off the table it is mounted on, without the columns it leaves out of the response', () => {
    const row = { keys: { id: null, name: null, createdAt: null, owner: { keys: { id: null }, open: false } }, open: false }
    expect(dataOf('crud')).toEqual({ keys: { data: ['array', row], pagination: { keys: { page: null, limit: null, total: null, totalPages: null }, open: false } }, open: false })
    expect(dataOf('crudItem')).toEqual({ keys: { data: { keys: { id: null, name: null }, open: false } }, open: false })
  })

  it('does nothing without the checker: the syntax alone reads no more than it did', () => {
    const plain = new RouteResponseReader({ read: (name) => files[name] ?? null, resolve: () => null })
    expect(describeShape((plain.shapesOf('app/api/rows/route.ts').get('GET') as Shape) ?? null)).toMatchObject({ keys: { data: null } })
  })

  it('finds the types across the files of a program: a route imports what a service declares', () => {
    const program = {
      'lib/service.ts': `export interface Item { id: string; label: string }\nexport declare function load(): Promise<{ items: Item[] }>`,
      'app/api/imported/route.ts': `import { load } from '../../../lib/service'\ndeclare const withApi: any\nexport const GET = withApi({}, async () => load())`,
    }
    const imported = new RouteResponseReader({ read: (name) => program[name as keyof typeof program] ?? null, resolve: (_from, specifier) => (specifier.endsWith('lib/service') ? 'lib/service.ts' : null) }, TypeShapes.forFiles(ROOT, program))
    expect(describeShape(imported.shapesOf('app/api/imported/route.ts').get('GET') ?? null)).toMatchObject({ keys: { data: { keys: { items: ['array', { keys: { id: null, label: null }, open: false }] }, open: false } } })
  })
})

describe('judging what a screen declares of an answer against what the route answers', () => {
  const server = objectOf({ success: null, data: objectOf({ items: { kind: 'array', element: objectOf({ id: null, employer: null }) }, total: null }), timestamp: null })
  const declared = (value: Shape) => declaredGaps(value, server, 'root').map(describeGap)

  it('has no gap where the screen declares only what the route returns', () => {
    expect(declared(objectOf({ success: null, data: objectOf({ items: { kind: 'array', element: objectOf({ id: null }) }, total: null }) }))).toEqual([])
  })

  it('names a key the screen declares that the closed object the route answers with does not have, at the path it is at', () => {
    expect(declared(objectOf({ data: objectOf({ items: { kind: 'array', element: objectOf({ id: null, unionName: null }) } }) }))).toEqual(['data.items[].unionName'])
    expect(declared(objectOf({ data: objectOf({ pages: null }) }))).toEqual(['data.pages'])
  })

  it('names a list declared where the route answers an object, and an object declared where it answers a list', () => {
    expect(declared(objectOf({ data: { kind: 'array', element: null } }))).toEqual(['data declared as a list'])
    expect(declared(objectOf({ data: objectOf({ items: objectOf({ id: null }) }) }))).toEqual(['data.items declared as an object'])
  })

  it('does not judge what either side cannot say: an unknown, an open object, and the vocabulary of a failed answer', () => {
    expect(declaredGaps(objectOf({ anything: null }), objectOf({ a: null }, true), 'data')).toEqual([])
    expect(declaredGaps(objectOf({ anything: null }), null, 'data')).toEqual([])
    expect(declaredGaps(null, server, 'root')).toEqual([])
    expect(declared(objectOf({ error: null, message: null, success: null, data: objectOf({ error: null, total: null }) }))).toEqual([])
    // a key that is not the vocabulary of a failure is judged where the screen declares it deeper
    expect(declared(objectOf({ data: objectOf({ items: { kind: 'array', element: objectOf({ error: null }) } }) }))).toEqual(['data.items[].error'])
  })

  it('does not take a declared type with no members for one that declares something', () => {
    expect(declaredGaps(objectOf({}), { kind: 'array', element: null }, 'data')).toEqual([])
    expect(declaredGaps(objectOf({ a: null }), { kind: 'array', element: null }, 'data').map(describeGap)).toEqual(['data declared as an object'])
  })

  it('judges a gap only when every route the request can reach has it, at one level', () => {
    const other = objectOf({ success: null, data: objectOf({ items: { kind: 'array', element: objectOf({ unionName: null }) } }) })
    const screen = objectOf({ data: objectOf({ items: { kind: 'array', element: objectOf({ unionName: null }) } }) })
    expect(gapsAgainst(screen, [server], ['root']).map(describeGap)).toEqual(['data.items[].unionName'])
    expect(gapsAgainst(screen, [server, other], ['root'])).toEqual([])
    expect(gapsAgainst(screen, [server], ['data', 'root'])).toEqual([])
    // at the level of a list a declared object is not the list; at the level of the whole data it is judged by its keys
    expect(gapsAgainst(objectOf({ employer: null }), [server], ['data.items']).map(describeGap)).toEqual(['data.items declared as an object'])
    expect(gapsAgainst(objectOf({ total: null, missing: null }), [server], ['data']).map(describeGap)).toEqual(['data.missing'])
  })
})

describe('the names a screen gives an answer, with the types it declares of it', () => {
  const declaredOf = (code: string): { levels: string[]; text: string }[] => {
    const source = ts.createSourceFile('app/screen.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const [call] = extractFromSource('app/screen.tsx', source)
    const declared: DeclaredAnswer[] = []
    readsOfRequest(call.node, undefined, false, declared)
    return declared.map((answer) => ({ levels: answer.levels, text: answer.node.getText() }))
  }

  it('names the data of a typed query, a typed variable, and a typed state set from the answer', () => {
    expect(declaredOf(`function S() { const { data } = useQuery<Rows>({ queryFn: () => fetch('/api/x').then((r) => r.json()) }) }`)).toEqual([{ levels: ['root'], text: 'data' }])
    expect(declaredOf(`async function f() { const res = await fetch('/api/x'); const json: Rows = await res.json(); use(json) }`)).toEqual([{ levels: ['root'], text: 'json' }])
    expect(declaredOf(`function S() { const [rows, setRows] = useState<Row[]>([]); async function f() { const res = await fetch('/api/x'); const json = await res.json(); setRows(json.data) } }`)).toEqual(
      expect.arrayContaining([{ levels: ['root'], text: 'json' }, { levels: ['data'], text: 'rows' }]),
    )
  })

  it('does not name what is bound where the answer is a failure', () => {
    expect(declaredOf(`async function f() { const res = await fetch('/api/x'); if (!res.ok) { const err: Failure = await res.json(); show(err) } }`)).toEqual([])
  })
})

describe('the declared type of a screen against the route it asks, end to end', () => {
  const screens: Record<string, string> = {
    'app/ok.tsx': `declare function useQuery<T>(options: { queryFn: () => Promise<T> }): { data: T | undefined }\ninterface Rows { success: boolean; data: { items: { id: string; title: string }[]; total: number } }\nexport function S() { const { data } = useQuery<Rows>({ queryFn: () => fetch('/api/rows').then((r) => r.json()) }) }`,
    'app/invented.tsx': `declare function useQuery<T>(options: { queryFn: () => Promise<T> }): { data: T | undefined }\ninterface Rows { success: boolean; data: { items: { id: string; employer: string }[]; total: number } }\nexport function S() { const { data } = useQuery<Rows>({ queryFn: () => fetch('/api/rows').then((r) => r.json()) }) }`,
  }
  const program = TypeShapes.forFiles(ROOT, { ...files, ...screens })
  const readerOf = new RouteResponseReader({ read: (name) => files[name] ?? null, resolve: () => null }, program)
  const gaps = (screen: string): string[] => {
    const source = ts.createSourceFile(screen, screens[screen], ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const [call] = extractFromSource(screen, source)
    const declared: DeclaredAnswer[] = []
    readsOfRequest(call.node, undefined, false, declared)
    const route = readerOf.shapesOf('app/api/rows/route.ts').get('GET') ?? null
    return declared.flatMap((answer) => gapsAgainst(program.shapeOfNode(answer.node), [route], answer.levels)).map(describeGap)
  }

  it('finds no gap where the screen declares what the service returns', () => {
    expect(gaps('app/ok.tsx')).toEqual([])
  })

  it('finds the key a screen declares that the service never returns', () => {
    expect(gaps('app/invented.tsx')).toEqual(['data.items[].employer'])
  })
})
