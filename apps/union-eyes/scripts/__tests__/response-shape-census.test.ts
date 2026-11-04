/**
 * The response-shape census (UE-CONV-H-027): what a screen reads out of an answer is what the route answers with.
 *
 * Three parts. The first pins how the shape of a route's success answer is read out of its file (lib/frontend-census/route-response.ts), the second how a screen's reads of an
 * answer are followed (lib/frontend-census/response-reads.ts), the third how a read is judged. The last runs the census over the real tree and holds the count of reads the
 * route's answer cannot satisfy at or below a ceiling that can only fall: a screen that reads `json.items` from a route that answers `{ success, data: { data } }` shows an
 * empty list and no error, and neither a type check nor a test of the screen on its own can say so. Closing findings means lowering the ceiling; a new one fails here.
 */
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { extractFromSource } from '../lib/frontend-census/client-calls'
import { readsOfRequest } from '../lib/frontend-census/response-reads'
import { RouteResponseReader, type Shape } from '../lib/frontend-census/route-response'
import { judgeRead, runCensus } from '../runtime/response-shape-census'

const describeShape = (shape: Shape): unknown => {
  if (shape === null) return null
  if (shape.kind === 'array') return ['array', describeShape(shape.element)]
  return { keys: Object.fromEntries([...shape.keys].map(([key, value]) => [key, describeShape(value)])), open: shape.open }
}

const shapes = (code: string, method = 'GET') => {
  const file = 'app/api/x/route.ts'
  return new RouteResponseReader({ read: (name) => (name === file ? code : null), resolve: () => null }).shapesOf(file).get(method)
}

const answer = (code: string, method = 'GET') => describeShape(shapes(code, method) ?? null) as { keys: Record<string, unknown>; open: boolean } | null

describe('reading the answer of a route', () => {
  it('wraps what a withApi handler returns under data, as the framework does', () => {
    expect(answer(`export const GET = withApi({ auth: { required: true } }, async () => { return { items: [], total: 0 } })`)).toEqual({
      keys: { success: null, data: { keys: { items: ['array', null], total: null }, open: false }, timestamp: null },
      open: false,
    })
  })

  it('sees that a handler returning { data } is wrapped twice', () => {
    const shape = answer(`export const GET = withApi({}, async () => { const result = await load(); return { data: result } })`)
    expect(shape?.keys.data).toEqual({ keys: { data: null }, open: false })
  })

  it('reads the NextResponse.json of a plain handler as the answer itself, and leaves out the answers that are not a success', () => {
    expect(
      answer(`
        export async function GET(request) {
          if (!ok) return NextResponse.json({ error: 'no' }, { status: 403 })
          if (!found) return standardErrorResponse(ErrorCode.NOT_FOUND, 'missing')
          return NextResponse.json({ organizations: rows, total })
        }`),
    ).toEqual({ keys: { organizations: null, total: null }, open: false })
  })

  it('reads standardSuccessResponse as the envelope with its meta', () => {
    expect(answer(`export const GET = withRoleAuth('member', async () => standardSuccessResponse({ rows }, { total: 1 }))`)).toEqual({
      keys: { success: null, data: { keys: { rows: null }, open: false }, meta: null, timestamp: null },
      open: false,
    })
  })

  it('reads a handler wrapped by another wrapper, and an export made through an export list', () => {
    expect(answer(`const handler = async () => NextResponse.json({ a: 1 })\nconst GET = withOrganizationAuth(handler)\nexport { GET }`)).toEqual({ keys: { a: null }, open: false })
  })

  it('reads what the generic CRUD writer answers: a list is { data, pagination } and an item is { data }, both under data', () => {
    const collection = answer(`const { GET, POST } = crudRoutes({ table: t, writableFields: ['a'] })\nexport { GET, POST }`)
    expect(collection?.keys.data).toEqual({ keys: { data: ['array', null], pagination: null }, open: false })
    expect(answer(`const { GET, POST } = crudRoutes({ table: t })\nexport { GET, POST }`, 'POST')?.keys.data).toEqual({ keys: { data: null }, open: false })
    expect(answer(`export const { GET, PATCH, DELETE } = crudRoutes({ table: t, itemRoute: true })`, 'GET')?.keys.data).toEqual({ keys: { data: null }, open: false })
  })

  it('reads what a cognition route answers: the engine payload under data, which is not read, and the rest of its envelope under meta', () => {
    expect(answer(`export const GET = cognitionRoute(cascadeRisksEngine)`)).toEqual({
      keys: { success: null, data: null, meta: { keys: { explainability: null }, open: false }, timestamp: null },
      open: false,
    })
  })

  it('follows a const, a helper of the same file and a map callback to the object a handler returns', () => {
    expect(answer(`export const GET = withApi({}, async () => { const payload = { a: 1, b: 2 }; return payload })`)?.keys.data).toEqual({ keys: { a: null, b: null }, open: false })
    expect(answer(`function build() { return { c: 3 } }\nexport const GET = withApi({}, async () => build())`)?.keys.data).toEqual({ keys: { c: null }, open: false })
    expect(answer(`export const GET = withApi({}, async () => ({ data: rows.map((row) => ({ id: row.id })) }))`)?.keys.data).toEqual({ keys: { data: ['array', { keys: { id: null }, open: false }] }, open: false })
  })

  it('does not guess: a service result is unknown data, a spread leaves the keys open, a call that builds a response makes the answer unknown', () => {
    expect(answer(`export const GET = withApi({}, async () => listThings())`)?.keys.data).toBeNull()
    expect(answer(`export const GET = withApi({}, async () => ({ a: 1, ...more }))`)?.keys.data).toEqual({ keys: { a: null }, open: true })
    expect(answer(`export const GET = withApi({}, async () => jsonResponse(thing))`)).toBeNull()
    expect(answer(`export const GET = () => handle()`)).toBeNull()
  })

  it('reads through a context wrapper to what its callback returns', () => {
    expect(answer(`export async function GET() { return withRLSContext({ organizationId }, async () => { if (!row) return NextResponse.json({ error: 'x' }, { status: 404 }); return NextResponse.json({ id: row.id }) }) }`)).toMatchObject({ keys: { id: null } })
    expect(answer(`export const GET = withApi({}, async () => withSystemContext(async (tx) => { return { rows: [] } }))`)?.keys.data).toEqual({ keys: { rows: ['array', null] }, open: false })
    expect(answer(`export const GET = withApi({}, async () => withSystemContext((tx) => listThings(tx)))`)?.keys.data).toBeNull()
  })

  it('does not take a refusal for an answer: a guard\'s response, a name that says it denies, a const holding an error response', () => {
    expect(answer(`export async function POST(req) { const intake = await read(req); if (!intake.ok) return intake.response; if (!allowed) return denied; const refused = NextResponse.json({ error: 'no' }, { status: 403 }); if (!ok) return refused; return NextResponse.json({ done: true }) }`, 'POST')).toMatchObject({ keys: { done: null } })
    expect(answer(`export async function POST(req) { const answer = NextResponse.json({ done: true }); if (!ok) return answer; return other }`, 'POST')).toBeNull()
  })

  it('reads a handler the route file imports from another file of the application', () => {
    const files: Record<string, string> = {
      'app/api/x/route.ts': `import { list } from '@/lib/handlers'\nexport const GET = withApi({}, list)`,
      'lib/handlers.ts': `export async function list() { return { items: [] } }`,
    }
    const reader = new RouteResponseReader({ read: (name) => files[name] ?? null, resolve: (_from, specifier) => (specifier === '@/lib/handlers' ? 'lib/handlers.ts' : null) })
    expect(describeShape(reader.shapesOf('app/api/x/route.ts').get('GET') ?? null)).toMatchObject({ keys: { success: null, data: { keys: { items: ['array', null] }, open: false } } })
  })
})

const reads = (code: string): string[] => {
  const source = ts.createSourceFile('x.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const [call] = extractFromSource('x.tsx', source)
  return readsOfRequest(call.node).map((read) => read.alternatives.map(({ level, key }) => `${level}.${key}`).join(' | '))
}

describe('following what a screen reads from the answer', () => {
  it('reads the keys taken off the JSON a response is turned into', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); setItems(json.items); setTotal(json['total']) }`)).toEqual(['root.items', 'root.total'])
    expect(reads(`async function f() { const json = await (await fetch('/api/x')).json(); use(json.items) }`)).toEqual(['root.items'])
    expect(reads(`async function f() { const { items, total } = await (await fetch('/api/x')).json() }`)).toEqual(['root.items', 'root.total'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const { items, total: count } = await res.json() }`)).toEqual(['root.items', 'root.total'])
  })

  it('follows a promise chain, a cast, and a catch', () => {
    expect(reads(`fetch('/api/x').then((r) => r.json()).then((json) => { show(json.items) })`)).toEqual(['root.items'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = (await res.json().catch(() => null)) as { items: string[] } | null; use(json?.items) }`)).toEqual(['root.items'])
  })

  it('reads what is under data, however it is reached: a member, a name it was given, a destructuring', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); use(json.data.items); use(json?.data?.total) }`)).toEqual(['data.items', 'data.total'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); const rows = json.data; use(rows.items) }`)).toEqual(['data.items'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); const { items } = json.data }`)).toEqual(['data.items'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const { data } = await res.json(); use(data.items) }`)).toEqual(['data.items'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const { data: { items } } = await res.json() }`)).toEqual(['data.items'])
  })

  it('reads data itself only when nothing is taken out of it', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); setRows(json.data) }`)).toEqual(['root.data'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); const rows = json.data; setRows(rows) }`)).toEqual(['root.data'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const { data } = await res.json(); setRows(data) }`)).toEqual(['root.data'])
  })

  it('counts alternatives written with ?? or || as one read', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); const rows = json.items ?? json.data?.items ?? [] }`)).toEqual(['root.items | data.items'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); const id = json.id || json.data?.id }`)).toEqual(['root.id | data.id'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); setRows(json.data || json.organizations || []) }`)).toEqual(['root.data | root.organizations'])
  })

  it('counts the idiom that takes the data or the answer itself as a read at either level', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); const payload = json?.data ?? json; use(payload.items) }`)).toEqual(['data.items | root.items'])
  })

  it('counts a read inside what a chain falls back on as an alternative of that chain', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); const value = await res.json(); const sector = value.sector ?? (Array.isArray(value.sectors) ? value.sectors[0] : undefined) }`)).toEqual(['root.sector | root.sectors'])
    // a read in a function the fallback calls is not one of the chain's
    expect(reads(`async function f() { const res = await fetch('/api/x'); const value = await res.json(); const rows = value.rows ?? [].map(() => value.other) }`)).toEqual(['root.rows', 'root.other'])
  })

  it('does not read an answer that is an error, a value it cannot follow, or a name a nested function takes for itself', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); if (!res.ok) { const err = await res.json(); throw new Error(err.reason) } }`)).toEqual([])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); rows.forEach((json) => use(json.items)) }`)).toEqual([])
    expect(reads(`async function f() { const res = await fetch('/api/x'); await helper(res) }`)).toEqual([])
  })

  it('does not read what is read where the status says the answer is a failure', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); const data = await res.json(); if (res.status === 409 && data.tierId) { reload() } use(data.url) }`)).toEqual(['root.url'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const data = await res.json(); if (res.status >= 400) { use(data.reason) } else { use(data.url) } }`)).toEqual(['root.url'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const data = await res.json(); use(res.ok || data.reason, res.ok && data.url) }`)).toEqual(['root.url'])
  })

  it('reads an array method on the answer or its data as the screen expecting a list', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); json.data.map(show) }`)).toEqual(['data.[]'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); json.filter(show) }`)).toEqual(['root.[]'])
  })
})

/** The reads of the first request in the code, with the modules the code imports given as { specifier: code }. */
const readsAcross = (code: string, modules: Record<string, string> = {}): string[] => {
  const source = ts.createSourceFile('x.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const loaded = new Map<string, ts.SourceFile>()
  const loader = {
    load: (_from: string, specifier: string) => {
      if (!(specifier in modules)) return null
      if (!loaded.has(specifier)) loaded.set(specifier, ts.createSourceFile(`${specifier}.ts`, modules[specifier], ts.ScriptTarget.Latest, true, ts.ScriptKind.TS))
      return loaded.get(specifier) ?? null
    },
  }
  const [call] = extractFromSource('x.tsx', source)
  return readsOfRequest(call.node, loader).map((read) => `${read.file}: ${read.alternatives.map(({ level, key }) => `${level}.${key}`).join(' | ')}`)
}

describe('following the answer into the helpers, the state and the queries of a screen', () => {
  it('reads what the envelope helpers need of the answer, and what is taken out of what they hand back', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); const rows = envelopeRows(await res.json()) }`)).toEqual(['data.data.[]'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const row = envelopeRow(await res.json()); use(row.name) }`)).toEqual(['data.data.{}', 'data.data.name'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); const data = envelopeData(json); use(data.items) }`)).toEqual(['data.{}', 'data.items'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); use(envelopeData(await res.json()).items) }`)).toEqual(['data.{}', 'data.items'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const pages = envelopePages(await res.json()) }`)).toEqual(['data.pagination.totalPages'])
    expect(reads(`async function f() { const res = await fetch('/api/x'); const { items } = envelopeData(await res.json()) }`)).toEqual(['data.{}', 'data.items'])
  })

  it('follows the answer into a function of the same file, at the level it was handed', () => {
    expect(reads(`function readAccount(body) { return { id: body.data.id } }\nasync function f() { const res = await fetch('/api/x'); use(readAccount(await res.json())) }`)).toEqual(['data.id'])
    expect(reads(`const readAccount = (body) => { const d = envelopeData(body); return d.id }\nasync function f() { const res = await fetch('/api/x'); const json = await res.json(); use(readAccount(json)) }`)).toEqual(['data.{}', 'data.id'])
    expect(reads(`const show = ({ items }) => items\nasync function f() { const res = await fetch('/api/x'); const json = await res.json(); show(json.data) }`)).toEqual(['data.items'])
    expect(reads(`function a(body) { return b(body) }\nfunction b(body) { return body.items }\nasync function f() { const res = await fetch('/api/x'); use(a(await res.json())) }`)).toEqual(['root.items'])
  })

  it('follows into a function of another file, and through a re-export, and reports the read where it is written', () => {
    const imported = `import { readAccount } from './reader'\nasync function f() { const res = await fetch('/api/x'); use(readAccount(await res.json())) }`
    expect(readsAcross(imported, { './reader': `export function readAccount(body: unknown) { return (body as any).data.id }` })).toEqual(['reader.ts: data.id'])
    expect(readsAcross(imported.replace('./reader', './barrel'), { './barrel': `export { readAccount } from './reader'`, './reader': `export const readAccount = (body: any) => body.data.id` })).toEqual(['reader.ts: data.id'])
    expect(readsAcross(imported, { './reader': `export { readAccount as other } from './elsewhere'` })).toEqual([])
  })

  it('does not follow what it cannot find, and stops after a few functions', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); use(somethingImported(await res.json())) }`)).toEqual([])
    expect(reads(`function a(b) { return b.x }\nfunction c(d) { return a(d) }\nfunction e(f) { return c(f) }\nfunction g(h) { return e(h) }\nfunction i(j) { return g(j) }\nasync function k() { const res = await fetch('/api/x'); use(i(await res.json())) }`)).toEqual([])
  })

  it('follows the answer into the state a screen keeps it in, when that is the one place the state is set from', () => {
    const screen = (setters: string) => `function C() { const [rows, setRows] = useState(null); async function load() { const res = await fetch('/api/x'); const json = await res.json(); ${setters} } return rows.items }`
    expect(reads(screen(`setRows(json.data)`))).toEqual(['data.items'])
    expect(reads(screen(`setRows(json.data ?? [])`))).toEqual(['data.items'])
    expect(reads(screen(`setRows(json)`))).toEqual(['root.items'])
    // a reset to a literal is not another source; a second answer is, and then it is not known which answer a member belongs to
    expect(reads(screen(`setRows(json.data); setRows(null)`))).toEqual(['data.items'])
    expect(reads(screen(`setRows(json.data); setRows(other.data)`))).toEqual(['root.data'])
    expect(reads(screen(`setRows((previous) => ({ ...previous, ...json.data }))`))).toEqual(['root.data'])
  })

  it('follows the data of a query, where a screen takes it out of the hook', () => {
    expect(reads(`function C() { const { data } = useQuery({ queryKey: ['x'], queryFn: () => fetch('/api/x').then((r) => r.json()) }); return data?.data?.items }`)).toEqual(['data.items'])
    expect(reads(`function C() { const { data: report, isLoading } = useQuery<R>({ queryKey: ['x'], queryFn: () => fetch('/api/x').then((r) => r.json()) }); return report.data.items }`)).toEqual(['data.items'])
    expect(reads(`function C() { const { isLoading } = useQuery({ queryKey: ['x'], queryFn: () => fetch('/api/x').then((r) => r.json()) }); return isLoading }`)).toEqual([])
  })

  it('takes a fallback such as ?? [] as part of the value, and the chain that tolerates both levels as either', () => {
    expect(reads(`async function f() { const res = await fetch('/api/x'); const json = await res.json(); const rows = json.data ?? []; use(rows.map(show)) }`)).toEqual(['data.[]'])
    expect(reads(`function C() { const [rows, setRows] = useState([]); async function load() { const res = await fetch('/api/x'); const json = await res.json(); setRows(json.data ?? json) } return rows.items }`)).toEqual(['data.items | root.items'])
  })

  it('follows a response whose JSON is taken only when it is ok', () => {
    expect(reads(`fetch('/api/x').then((res) => (res.ok ? res.json() : null)).then((payload) => use(payload?.user))`)).toEqual(['root.user'])
  })

  it('follows the answers of requests made together, by the name the slot of each is given', () => {
    expect(reads(`async function f() { const [a, b] = await Promise.all([fetch('/api/x'), fetch('/api/y')]); const json = await a.json(); use(json.items); use((await b.json()).rows) }`)).toEqual(['root.items'])
    expect(reads(`async function f() { const [a, b] = await Promise.all([fetch('/api/x').then((r) => r.json()), fetch('/api/y').then((r) => r.json())]); use(a.items, b.rows) }`)).toEqual(['root.items'])
    expect(reads(`async function f() { const [a, b] = await Promise.all([fetch('/api/x'), fetch('/api/y')]); if (a.ok) { use((await a.json()).items) } }`)).toEqual(['root.items'])
    expect(reads(`async function f() { const results = await Promise.all([fetch('/api/x'), fetch('/api/y')]); use(results) }`)).toEqual([])
  })
})

const failureReads = (code: string): string[] => {
  const source = ts.createSourceFile('x.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const [call] = extractFromSource('x.tsx', source)
  return readsOfRequest(call.node, undefined, true).map((read) => read.alternatives.map(({ level, key }) => `${level}.${key}`).join(' | '))
}

describe('following what a screen reads from a failed answer', () => {
  it('reads the keys taken off the body of a failure, wherever the body was parsed', () => {
    expect(failureReads(`async function f() { const res = await fetch('/api/x'); if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'x') } }`)).toEqual(['root.error'])
    expect(failureReads(`async function f() { const res = await fetch('/api/x'); const data = await res.json(); if (!res.ok) { setError(data.message) } }`)).toEqual(['root.message'])
    expect(failureReads(`async function f() { const res = await fetch('/api/x'); const data = await res.json().catch(() => null); if (res.status >= 400) { use(data?.error) } }`)).toEqual(['root.error'])
    expect(failureReads(`async function f() { const res = await fetch('/api/x'); const { message } = await res.json(); if (!res.ok) { use(message) } }`)).toEqual([])
  })

  it('does not read a success path, or a catch, as a failure', () => {
    expect(failureReads(`async function f() { const res = await fetch('/api/x'); const data = await res.json(); if (res.ok) { use(data.message) } }`)).toEqual([])
    expect(failureReads(`async function f() { try { const res = await fetch('/api/x'); const data = await res.json(); use(data.message) } catch (e) { use(e) } }`)).toEqual([])
    expect(failureReads(`async function f() { const res = await fetch('/api/x'); const data = await res.json(); use(data.message) }`)).toEqual([])
  })

  it('does not count what apiErrorMessage does with the body, nor what a function it handed the body to reads', () => {
    expect(failureReads(`async function f() { const res = await fetch('/api/x'); const data = await res.json().catch(() => null); if (!res.ok) { setError(apiErrorMessage(data, 'x')) } }`)).toEqual([])
    expect(failureReads(`function say(body) { return body.message }\nasync function f() { const res = await fetch('/api/x'); const data = await res.json(); if (!res.ok) { setError(say(data)) } }`)).toEqual([])
  })

  it('keeps the success reads apart from the failure reads of the same answer', () => {
    const code = `async function f() { const res = await fetch('/api/x'); const data = await res.json(); if (!res.ok) { throw new Error(data.message) } use(data.items) }`
    expect(reads(code)).toEqual(['root.items'])
    expect(failureReads(code)).toEqual(['root.message'])
  })
})

describe('judging a read against the answer', () => {
  const read = (...alternatives: string[]) => ({ alternatives: alternatives.map((a) => ({ level: a.split('.')[0], key: a.split('.').slice(1).join('.') })), line: 1, text: '', file: 'x.tsx' })
  const readAt = (level: string, key: string) => ({ alternatives: [{ level, key }], line: 1, text: '', file: 'x.tsx' })
  const route = (code: string, method = 'GET') => [shapes(code, method) ?? null]

  it('is satisfied by a key the answer has, and by any one of the alternatives', () => {
    const shape = route(`export const GET = withApi({}, async () => ({ items: [] }))`)
    expect(judgeRead(read('data.items'), shape)).toBeNull()
    expect(judgeRead(read('data.rows', 'data.items'), shape)).toBeNull()
    expect(judgeRead(read('root.success'), shape)).toBeNull()
  })

  it('says a key is not returned when the answer is closed and has none of them', () => {
    const shape = route(`export const GET = withApi({}, async () => ({ items: [] }))`)
    expect(judgeRead(read('data.rows'), shape)).toBe('DATA_KEY_NOT_RETURNED')
    expect(judgeRead(read('root.items'), shape)).toBe('ROOT_KEY_NOT_RETURNED')
    expect(judgeRead(read('root.items', 'data.rows'), shape)).toBe('KEY_NOT_RETURNED_EITHER')
  })

  it('catches the double envelope and the screen that expects a list where there is an object', () => {
    expect(judgeRead(read('data.degradationTimeline'), route(`export const POST = withApi({}, async () => ({ data: result }))`, 'POST'))).toBe('DATA_KEY_NOT_RETURNED')
    expect(judgeRead(read('data.[]'), route(`export const GET = withApi({}, async () => ({ data: rows, pagination }))`))).toBe('DATA_KEY_NOT_RETURNED')
    expect(judgeRead(read('data.[]'), route(`export const GET = withApi({}, async () => rows.map((row) => ({ id: row.id })))`))).toBeNull()
  })

  it('does not judge what the syntax cannot place: an unknown or open answer, and the keys of a failed answer', () => {
    expect(judgeRead(read('data.anything'), route(`export const GET = withApi({}, async () => listThings())`))).toBeNull()
    expect(judgeRead(read('data.anything'), route(`export const GET = withApi({}, async () => ({ a: 1, ...rest }))`))).toBeNull()
    expect(judgeRead(read('root.error'), route(`export const GET = withApi({}, async () => ({ a: 1 }))`))).toBeNull()
    expect(judgeRead(read('data.message'), route(`export const GET = withApi({}, async () => ({ a: 1 }))`))).toBeNull()
  })

  it('asks every route a computed URL can reach: satisfied by one, not returned only when none has it', () => {
    const both = [shapes(`export const GET = withApi({}, async () => ({ a: 1 }))`) ?? null, shapes(`export const GET = withApi({}, async () => ({ b: 1 }))`) ?? null]
    expect(judgeRead(read('data.a'), both)).toBeNull()
    expect(judgeRead(read('data.c'), both)).toBe('DATA_KEY_NOT_RETURNED')
  })

  it('judges the members below data that the envelope helpers need: a list or a record at data.data, a count of pages at data.pagination', () => {
    // a handler that returns { data: rows, pagination } is what envelopeRows and envelopePages take; one that returns its rows under another name is not
    const listing = route(`export const GET = withApi({}, async () => ({ data: rows, pagination }))`)
    expect(judgeRead(readAt('data.data', '[]'), listing)).toBeNull()
    expect(judgeRead(readAt('data.pagination', 'totalPages'), route(`export const GET = withApi({}, async () => ({ data: rows, pagination: { totalPages: 3 } }))`))).toBeNull()
    expect(judgeRead(readAt('data.data', '[]'), route(`export const GET = withApi({}, async () => ({ items: [] }))`))).toBe('DATA_KEY_NOT_RETURNED')
    expect(judgeRead(readAt('data.pagination', 'totalPages'), route(`export const GET = withApi({}, async () => ({ data: rows }))`))).toBe('DATA_KEY_NOT_RETURNED')
    // what is inside a nested value is read too, when the handler writes it out: a pagination without a page count does not satisfy the helper that needs one
    expect(judgeRead(readAt('data.pagination', 'totalPages'), route(`export const GET = withApi({}, async () => ({ data: rows, pagination: { page: 1 } }))`))).toBe('DATA_KEY_NOT_RETURNED')
    expect(judgeRead(readAt('data.pagination', 'totalPages'), route(`export const GET = withApi({}, async () => ({ data: rows, pagination: { page: 1, ...rest } }))`))).toBeNull()
    // a record where the handler returned a list, or a list where it returned a record
    expect(judgeRead(readAt('data', '{}'), route(`export const GET = withApi({}, async () => rows.map((row) => ({ id: row.id })))`))).toBe('DATA_KEY_NOT_RETURNED')
    expect(judgeRead(readAt('data', '{}'), route(`export const GET = withApi({}, async () => ({ id: 1 }))`))).toBeNull()
    expect(judgeRead(readAt('data.data', '{}'), route(`export const GET = withApi({}, async () => ({ data: { id: 1 } }))`))).toBeNull()
    expect(judgeRead(readAt('data.data', '{}'), route(`export const GET = withApi({}, async () => ({ id: 1 }))`))).toBe('DATA_KEY_NOT_RETURNED')
    // a handler that returns a list has no data of its own to look into
    expect(judgeRead(readAt('data.data', '{}'), route(`export const GET = withApi({}, async () => rows.map((row) => ({ id: row.id })))`))).toBe('DATA_KEY_NOT_RETURNED')
    // what the syntax cannot place is not judged
    expect(judgeRead(readAt('data.data', '[]'), route(`export const GET = withApi({}, async () => listThings())`))).toBeNull()
    expect(judgeRead(readAt('data.data', '[]'), route(`export const GET = withApi({}, async () => ({ data: rows(), ...rest }))`))).toBeNull()
  })
})

// Reads of an answer that the route's answer cannot satisfy, and the types a screen declares of an answer that the route's answer does not have (UE-CONV-H-027). Closed: every read and
// every declared key the census can place is satisfied. The ceiling can only fall, and it is zero.
const CEILING = 0

describe('the frontend against the routes it reads', () => {
  it('holds the reads the answer cannot satisfy at or below the ceiling', () => {
    const report = runCensus()
    expect(report.files).toBeGreaterThan(1000)
    // The requests whose answer the syntax can follow, against what the routes answer with; a following that stops working shows here before it shows as a screen that reads nothing.
    expect(report.judgedCalls).toBeGreaterThan(130)
    expect(report.judgedReads).toBeGreaterThan(500)
    // The requests whose screen declares the type of the answer, judged against the types of the routes' answers: those screens must not fall out of the census.
    expect(report.judged.filter((request) => request.declared > 0).length).toBeGreaterThan(130)
    const over = report.findings.length > CEILING ? report.findings.map((finding) => `${finding.kind} ${finding.method} ${finding.pattern.replace(/\u0001/g, '{…}')} ${finding.kind === 'DECLARED_KEY_NOT_RETURNED' ? 'declares' : 'reads'} ${finding.keys.join(' | ')}  ${finding.sites[0].file}:${finding.sites[0].line}`) : []
    expect(over).toEqual([])
  }, 300_000)
})
