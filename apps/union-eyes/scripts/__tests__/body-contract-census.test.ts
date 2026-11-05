/**
 * The request-body census (UE-CONV-H-025): what a screen sends to a route is what the route takes.
 *
 * Three parts. The first pins how the body of a request is read out of a screen (lib/frontend-census/request-body.ts), the second how the body a route takes is
 * read out of its file (lib/frontend-census/route-body.ts), the third how the two are judged. The last runs the census over the real tree and holds the count of
 * mismatches at or below a ceiling that can only fall: a form whose key the route drops saves nothing and says it saved, a form that leaves out a key the route
 * requires fails on every submit, and neither can be seen from a type check. Closing findings means lowering the ceiling; a new mismatch fails here.
 */
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { extractFromSource } from '../lib/frontend-census/client-calls'
import { requestBodyOf, type RequestBody } from '../lib/frontend-census/request-body'
import { RouteBodyReader, type BodyContract, type Requirement } from '../lib/frontend-census/route-body'
import { judgeBody, runCensus } from '../runtime/body-contract-census'

type Presence = 'always' | 'maybe'

const bodiesOf = (code: string) => {
  const source = ts.createSourceFile('x.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  return extractFromSource('x.tsx', source).map((call) => {
    const body = requestBodyOf(call.node)
    return { method: call.method, body: body === undefined ? undefined : body === null ? null : { keys: Object.fromEntries(body.keys), open: body.open } }
  })
}

describe('reading the body a screen sends', () => {
  it('reads the keys of the object a fetch puts in JSON.stringify', () => {
    expect(bodiesOf(`fetch('/api/x', { method: 'POST', body: JSON.stringify({ a: 1, b, 'c-d': 2 }) })`)).toEqual([{ method: 'POST', body: { keys: { a: 'always', b: 'always', 'c-d': 'always' }, open: false } }])
  })

  it('says nothing for a request that sends no body, and nothing it cannot read', () => {
    expect(bodiesOf(`fetch('/api/x')`)).toEqual([{ method: 'GET', body: undefined }])
    expect(bodiesOf(`fetch('/api/x', { method: 'POST', body: formData })`)).toEqual([{ method: 'POST', body: null }])
    expect(bodiesOf(`fetch('/api/x', { method: 'POST', body: JSON.stringify(payloadFromElsewhere) })`)).toEqual([{ method: 'POST', body: null }])
    expect(bodiesOf(`fetch('/api/x', { ...init, method: 'POST' })`)).toEqual([{ method: 'POST', body: null }])
  })

  it('follows an identifier to the object literal it was declared as, and a conditional key is only maybe sent', () => {
    expect(bodiesOf(`const payload = { a, ...(flag ? { b } : {}), ...(other && { c }) }; fetch('/api/x', { method: 'PUT', body: JSON.stringify(payload) })`)).toEqual([
      { method: 'PUT', body: { keys: { a: 'always', b: 'maybe', c: 'maybe' }, open: false } },
    ])
  })

  it('adds the key a later assignment puts on the object, and gives up on one it cannot name', () => {
    expect(bodiesOf(`const payload = { a }; if (x) payload.b = 1; payload['c'] = 2; fetch('/api/x', { method: 'POST', body: JSON.stringify(payload) })`)).toEqual([
      { method: 'POST', body: { keys: { a: 'always', b: 'maybe', c: 'maybe' }, open: false } },
    ])
    expect(bodiesOf(`const payload = { a }; payload[name] = 1; fetch('/api/x', { method: 'POST', body: JSON.stringify(payload) })`)).toEqual([{ method: 'POST', body: { keys: { a: 'always' }, open: true } }])
    expect(bodiesOf(`const payload = { a }; Object.assign(payload, extra); fetch('/api/x', { method: 'POST', body: JSON.stringify(payload) })`)).toEqual([{ method: 'POST', body: { keys: { a: 'always' }, open: true } }])
  })

  it('marks a spread it cannot read, a computed key and a body held in state as open', () => {
    expect(bodiesOf(`fetch('/api/x', { method: 'POST', body: JSON.stringify({ a, ...rest }) })`)).toEqual([{ method: 'POST', body: { keys: { a: 'always' }, open: true } }])
    expect(bodiesOf(`fetch('/api/x', { method: 'POST', body: JSON.stringify({ [key]: 1, a }) })`)).toEqual([{ method: 'POST', body: { keys: { a: 'always' }, open: true } }])
    // A form held in state starts as the literal and the setters add the rest: its initial keys are known, the body is not complete.
    expect(bodiesOf(`const [form, setForm] = useState({ a: '', b: '' }); fetch('/api/x', { method: 'POST', body: JSON.stringify({ ...form, c }) })`)).toEqual([
      { method: 'POST', body: { keys: { a: 'always', b: 'always', c: 'always' }, open: true } },
    ])
    expect(bodiesOf(`const [form] = React.useState({ a: '' }); fetch('/api/x', { method: 'POST', body: JSON.stringify(form) })`)).toEqual([{ method: 'POST', body: { keys: { a: 'always' }, open: true } }])
  })

  it('adds nothing for a spread of false, null, undefined', () => {
    expect(bodiesOf(`fetch('/api/x', { method: 'POST', body: JSON.stringify({ a, ...(flag ? { b } : undefined), ...(null) }) })`)).toEqual([{ method: 'POST', body: { keys: { a: 'always', b: 'maybe' }, open: false } }])
  })

  it('reads the second argument of an axios-style verb and of a helper that serializes the body itself', () => {
    expect(bodiesOf(`api.post('/api/x', { a, b }); client.patch('/api/y', payload)`)).toEqual([
      { method: 'POST', body: { keys: { a: 'always', b: 'always' }, open: false } },
      { method: 'PATCH', body: null },
    ])
    expect(bodiesOf(`apiFetch('/api/x', { method: 'POST', body: { a, b } })`)).toEqual([{ method: 'POST', body: { keys: { a: 'always', b: 'always' }, open: false } }])
    // The native fetch takes a string, so an object there is not a JSON body.
    expect(bodiesOf(`fetch('/api/x', { method: 'POST', body: { a } })`)).toEqual([{ method: 'POST', body: null }])
  })
})

const reader = (files: Record<string, string>) =>
  new RouteBodyReader({
    read: (file) => files[file] ?? null,
    resolve: (_from, specifier) => (specifier.startsWith('@/') ? `${specifier.slice(2)}.ts` : null),
  })

const contractOf = (files: Record<string, string>, method = 'POST', file = 'app/api/x/route.ts') => {
  const contract = reader(files).contractsOf(file).get(method)
  return contract ? { keys: Object.fromEntries(contract.keys), open: contract.open, via: contract.via } : contract
}

describe('reading the body a route takes', () => {
  it('reads a Zod object passed to withApi, with what is required and what is not', () => {
    expect(
      contractOf({
        'app/api/x/route.ts': `
          const schema = z.object({ title: z.string().min(1), note: z.string().optional(), count: z.number().default(1), anything: z.unknown(), either: z.union([z.string(), z.number()]) })
          export const POST = withApi({ auth: { required: true }, body: schema }, async () => ({}))
        `,
      }),
    ).toMatchObject({ keys: { title: 'required', note: 'optional', count: 'optional', anything: 'unknown', either: 'unknown' }, open: false })
  })

  it('reads the methods that change the keys of an object', () => {
    const files = (chain: string) => ({
      'app/api/x/route.ts': `
        const base = z.object({ a: z.string(), b: z.string() })
        export const POST = withApi({ body: ${chain} }, async () => ({}))
      `,
    })
    expect(contractOf(files('base.extend({ c: z.string() })'))?.keys).toEqual({ a: 'required', b: 'required', c: 'required' })
    expect(contractOf(files('base.partial()'))?.keys).toEqual({ a: 'optional', b: 'optional' })
    expect(contractOf(files('base.pick({ a: true })'))?.keys).toEqual({ a: 'required' })
    expect(contractOf(files('base.omit({ a: true })'))?.keys).toEqual({ b: 'required' })
    expect(contractOf(files('base.strict().refine((v) => v.a !== v.b)'))?.keys).toEqual({ a: 'required', b: 'required' })
    expect(contractOf(files('base.passthrough()'))).toMatchObject({ open: true })
  })

  it('follows a schema imported from another module', () => {
    expect(
      contractOf({
        'app/api/x/route.ts': `import { createSchema } from '@/lib/x/schema'\nexport const POST = withApi({ body: createSchema }, async () => ({}))`,
        'lib/x/schema.ts': `export const createSchema = z.object({ name: z.string() })`,
      }),
    ).toMatchObject({ keys: { name: 'required' } })
  })

  it('reads the one schema a handler parses, and the names a handler takes out of request.json()', () => {
    expect(
      contractOf({
        'app/api/x/route.ts': `
          const bodySchema = z.object({ clauseId: z.string() })
          export async function POST(request) { const parsed = bodySchema.safeParse(await request.json()); return parsed }
        `,
      }),
    ).toMatchObject({ keys: { clauseId: 'required' }, via: 'bodySchema.safeParse' })
    expect(contractOf({ 'app/api/x/route.ts': `export async function PATCH(request) { const { a, b: renamed, ...rest } = await request.json(); return [a, renamed, rest] }` }, 'PATCH')).toMatchObject({
      keys: { a: 'unknown', b: 'unknown' },
      open: true,
    })
  })

  it('reads the fields a generic writer accepts', () => {
    expect(contractOf({ 'app/api/x/route.ts': `const FIELDS = ['a', 'b']\nexport const { GET, POST } = crudRoutes({ table: t, writableFields: ['a', ...FIELDS, 'c'] })` })).toMatchObject({
      keys: { a: 'unknown', b: 'unknown', c: 'unknown' },
      open: false,
      via: 'writableFields',
    })
  })

  it('does not guess for a route it cannot read, and says nothing for one that takes no body', () => {
    expect(contractOf({ 'app/api/x/route.ts': `export async function POST(request) { return handle(await request.json()) }` })).toBeNull()
    expect(contractOf({ 'app/api/x/route.ts': `export async function POST() { return Response.json({}) }` })).toBeUndefined()
    expect(contractOf({ 'app/api/x/route.ts': `export const POST = withApi({ body: someUnknownSchema }, async () => ({}))` })).toBeNull()
  })

  it('counts the key a guard takes out of the body before the route reads it', () => {
    expect(
      contractOf({
        'app/api/x/route.ts': `
          const schema = z.object({ email: z.string() })
          export const POST = async (request) => { const intake = await guardPublicIntake(request, { bucket: 'write' }); return schema.safeParse(intake.json) }
        `,
      }),
    ).toMatchObject({ keys: { email: 'required', turnstileToken: 'optional' } })
  })
})

const contract = (keys: Record<string, Requirement>, open = false): BodyContract => ({ keys: new Map(Object.entries(keys)), open, via: 'test' })
const sent = (keys: Record<string, Presence>, open = false): RequestBody => ({ keys: new Map(Object.entries(keys)), open })
const verdicts = (body: RequestBody, contracts: BodyContract[]) => judgeBody(body, contracts).map(({ kind, key }) => `${kind} ${key}`)

describe('judging a body against what the route takes', () => {
  it('finds the key the route drops and the key it requires and never gets (a "Link" button that sends linkClauseId to a route that reads clauseId)', () => {
    expect(verdicts(sent({ linkClauseId: 'always' }), [contract({ clauseId: 'required' })])).toEqual(['KEY_IGNORED linkClauseId', 'FIELD_MISSING clauseId'])
  })

  it('does not call a key ignored when the route takes any key, or missing when the body may carry more than it lists', () => {
    expect(verdicts(sent({ a: 'always' }), [contract({}, true)])).toEqual([])
    expect(verdicts(sent({}, true), [contract({ a: 'required' })])).toEqual([])
  })

  it('counts a key sent only sometimes as sent, and does not call a key missing that the route does not require', () => {
    expect(verdicts(sent({ a: 'maybe' }), [contract({ a: 'required' })])).toEqual([])
    expect(verdicts(sent({}), [contract({ a: 'optional', b: 'unknown' })])).toEqual([])
  })

  it('asks every route a computed URL can reach: ignored when none takes the key, missing when all require it', () => {
    expect(verdicts(sent({ a: 'always' }), [contract({ a: 'optional' }), contract({ b: 'optional' })])).toEqual([])
    expect(verdicts(sent({ c: 'always' }), [contract({ a: 'optional' }), contract({ b: 'optional' })])).toEqual(['KEY_IGNORED c'])
    expect(verdicts(sent({}), [contract({ a: 'required' }), contract({ a: 'optional' })])).toEqual([])
    expect(verdicts(sent({}), [contract({ a: 'required' }), contract({ a: 'required' })])).toEqual(['FIELD_MISSING a'])
  })
})

// Calls whose body carries a key the route does not take, or lacks a key it requires. The ceiling can only fall; the end is zero.
const CEILING = 0

describe('the frontend against the routes', () => {
  it('holds the body mismatches at or below the ceiling', () => {
    const report = runCensus()
    expect(report.files).toBeGreaterThan(1000)
    expect(report.judged).toBeGreaterThan(30)
    expect(report.routesWithContract).toBeGreaterThan(30)
    const over = report.findings.length > CEILING ? report.findings.map((finding) => `${finding.kind} ${finding.method} ${finding.pattern.replace(/\u0001/g, '{…}')} key ${finding.key}  ${finding.sites[0].file}:${finding.sites[0].line}`) : []
    expect(over).toEqual([])
  }, 120_000)
})
