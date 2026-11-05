import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  definitionRegion, evidenceItemProblems, handlerRegion, importsOf, memberRegion, recordProvenanceProblems, resolveExportDefinitions,
} from './ue-gate0b4-provenance.mjs'
import { loadContext } from './ue-gate0-scope-lock.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const APP = 'apps/union-eyes/'
const ROUTE = 'widgets/route.ts'
const ROUTE_FILE = `${APP}app/api/${ROUTE}`

const ROUTE_TEXT = `import { withApi } from '@/lib/api/guard'
import { loadWidgets } from '@/lib/services/widget-service'
import { widgets } from '@/db/schema'
import { unusedHelper } from '@/lib/services/unused'

const sharedLocal = () => 'sibling-only-marker'

export const GET = withApi(async (request) => {
  const rows = await loadWidgets(request)
  return rows
})

export const POST = withApi(async (request) => {
  sharedLocal()
  await request.writeAuditMarker()
  return { ok: true }
})
`

const files = {
  [ROUTE_FILE]: ROUTE_TEXT,
  [`${APP}lib/api/guard.ts`]: 'export function withApi(handler) {\n  return (request) => handler(request)\n}\n',
  [`${APP}lib/services/widget-service.ts`]: "import { widgetRows } from './widget-rows'\nexport async function loadWidgets(request) {\n  const tenant = request.organizationId\n  return widgetRows(tenant)\n}\nexport function otherThing() {\n  return 'other-function-marker'\n}\n",
  [`${APP}lib/services/widget-rows.ts`]: 'export function widgetRows(tenant) {\n  return tenant\n}\n',
  [`${APP}lib/services/unused.ts`]: 'export function unusedHelper() {\n  return 1\n}\n',
  [`${APP}lib/services/island.ts`]: 'export function island() {\n  return "island-marker"\n}\n',
  [`${APP}db/schema/index.ts`]: "export * from './widgets-schema'\nexport * from './widgets-duplicate'\n",
  [`${APP}db/schema/widgets-schema.ts`]: "export const widgets = pgTable('widgets', {\n  id: uuid('id'),\n  organizationId: uuid('organization_id'),\n})\nexport const gadgets = pgTable('gadgets', {\n  id: uuid('id'),\n  ownerUserId: uuid('owner_user_id'),\n})\n",
  [`${APP}db/schema/widgets-duplicate.ts`]: "export const widgets = pgTable('widgets_copy', {\n  id: uuid('id'),\n})\n",
  [`${APP}app/api/widgets/sibling/route.ts`]: "export const GET = async () => 'sibling-route-marker'\n",
}

const exists = (file) => file in files
const readText = (file) => files[file]
const ctx = (method = 'GET', overrides = {}) => ({ route: ROUTE, method, exists, readText, ...overrides })
const direct = (overrides = {}) => ({ provenance: 'ROUTE_HANDLER_DIRECT', claim: 'behavior', method: 'GET', ref: ROUTE_FILE, quote: 'await loadWidgets(request)', ...overrides })
const problems = (item, method = 'GET') => evidenceItemProblems(item, ctx(method), 'record')
const has = (list, pattern) => list.some((problem) => pattern.test(problem))

test('a quote inside the classified handler is accepted as route-direct evidence', () => {
  assert.deepEqual(problems(direct()), [])
})

test('NEGATIVE: a quote from a sibling route is not route-direct evidence', () => {
  const item = direct({ ref: `${APP}app/api/widgets/sibling/route.ts`, quote: "'sibling-route-marker'" })
  assert.ok(has(problems(item), /is not the classified route file/))
})

test('NEGATIVE: a quote from another method of the same route file is not evidence for this method', () => {
  assert.ok(has(problems(direct({ quote: 'await request.writeAuditMarker()' })), /not inside the GET handler of the route/))
  assert.ok(has(problems(direct({ method: 'POST' })), /is tagged for POST but the record is GET/))
})

test('NEGATIVE: module-scope text that no handler contains is not route-direct evidence', () => {
  assert.ok(has(problems(direct({ quote: "const sharedLocal = () => 'sibling-only-marker'" })), /not inside the GET handler/))
})

test('NEGATIVE: a method the route file does not export has no handler to quote', () => {
  assert.ok(has(evidenceItemProblems(direct({ method: 'DELETE' }), ctx('DELETE'), 'record'), /exports no DELETE handler/))
})

test('NEGATIVE: a local helper that the classified handler never calls proves nothing about it', () => {
  const item = direct({ symbol: 'sharedLocal', quote: "() => 'sibling-only-marker'" })
  assert.ok(has(problems(item), /GET handler does not call sharedLocal/))
  assert.deepEqual(problems({ ...item, method: 'POST' }, 'POST').filter((problem) => /does not call/.test(problem)), [])
})

test('NEGATIVE: evidence without a stated provenance, or with an unknown one, is not evidence', () => {
  assert.ok(has(problems({ ...direct(), provenance: undefined }), /without a valid provenance/))
  assert.ok(has(problems({ ...direct(), provenance: 'LOOKS_RIGHT' }), /without a valid provenance/))
})

test('NEGATIVE: a quote that is not in the cited file, or a missing file, is refused', () => {
  assert.ok(has(problems(direct({ quote: 'text that is not in the route file' })), /quoted text is not in the file/))
  assert.ok(has(problems(direct({ ref: `${APP}app/api/missing/route.ts` })), /cites a missing file/))
})

test('an imported helper is accepted only when the route imports it, calls it in the method and the quote is in its definition', () => {
  const item = { provenance: 'ROUTE_IMPORTED_HELPER', claim: 'tenantScope', method: 'GET', ref: `${APP}lib/services/widget-service.ts`, symbol: 'loadWidgets', quote: 'const tenant = request.organizationId' }
  assert.deepEqual(problems(item), [])
  assert.ok(has(problems({ ...item, quote: "return 'other-function-marker'" }), /not inside the definition of loadWidgets|quoted text is not in the file/))
})

test('NEGATIVE: a helper the route file imports but the classified method does not use is refused', () => {
  const item = { provenance: 'ROUTE_IMPORTED_HELPER', claim: 'behavior', method: 'GET', ref: `${APP}lib/services/unused.ts`, symbol: 'unusedHelper', quote: 'return 1' }
  assert.ok(has(problems(item), /unusedHelper is not used inside the GET handler/))
})

test('NEGATIVE: a helper the route file does not import is refused', () => {
  const item = { provenance: 'ROUTE_IMPORTED_HELPER', claim: 'behavior', method: 'GET', ref: `${APP}lib/services/island.ts`, symbol: 'island', quote: 'island-marker' }
  assert.ok(has(problems(item), /does not import island/))
})

test('NEGATIVE: a quote from another function of the imported module is not the helper definition', () => {
  const item = { provenance: 'ROUTE_IMPORTED_HELPER', claim: 'behavior', method: 'GET', ref: `${APP}lib/services/widget-service.ts`, symbol: 'loadWidgets', quote: "return 'other-function-marker'" }
  assert.ok(has(problems(item), /not inside the definition of loadWidgets/))
})

test('NEGATIVE: an imported helper cited from a file the route does not import it from is refused', () => {
  const item = { provenance: 'ROUTE_IMPORTED_HELPER', claim: 'behavior', method: 'GET', ref: `${APP}lib/services/widget-rows.ts`, symbol: 'loadWidgets', quote: 'return tenant' }
  assert.ok(has(problems(item), /neither the module the route imports loadWidgets from nor the file that defines it/))
})

test('a service file is accepted only when the route reaches it through imports', () => {
  const reachable = { provenance: 'SERVICE_IMPLEMENTATION', claim: 'behavior', ref: `${APP}lib/services/widget-rows.ts`, quote: 'return tenant' }
  assert.deepEqual(problems(reachable), [])
  assert.deepEqual(problems({ ...reachable, symbol: 'widgetRows' }), [])
})

test('NEGATIVE: a service file the route cannot reach through imports supports nothing', () => {
  const item = { provenance: 'SERVICE_IMPLEMENTATION', claim: 'behavior', ref: `${APP}lib/services/island.ts`, quote: 'island-marker' }
  assert.ok(has(problems(item), /not reachable from the route through imports/))
})

test('NEGATIVE: a service quote outside the named symbol, or a symbol the file does not define, is refused', () => {
  const base = { provenance: 'SERVICE_IMPLEMENTATION', claim: 'behavior', ref: `${APP}lib/services/widget-service.ts` }
  assert.ok(has(problems({ ...base, symbol: 'loadWidgets', quote: "return 'other-function-marker'" }), /not inside the definition of loadWidgets/))
  assert.ok(has(problems({ ...base, symbol: 'doesNotExist', quote: 'const tenant = request.organizationId' }), /no top-level definition of doesNotExist/))
})

test('a schema file is accepted only when it is the file the route import path resolves the export to', () => {
  const item = { provenance: 'SCHEMA_OR_POLICY', claim: 'tenantScope', ref: `${APP}db/schema/widgets-schema.ts`, resolvesExport: 'gadgets', quote: "ownerUserId: uuid('owner_user_id')" }
  assert.ok(has(problems(item), /neither the route nor a file it reaches imports gadgets/))
})

test('NEGATIVE: an export defined in two schema files is ambiguous and supports no schema claim', () => {
  const item = { provenance: 'SCHEMA_OR_POLICY', claim: 'tenantScope', ref: `${APP}db/schema/widgets-schema.ts`, resolvesExport: 'widgets', quote: "organizationId: uuid('organization_id')" }
  assert.ok(has(problems(item), /resolves to more than one definition/))
})

test('NEGATIVE: a schema quote from a different table than the named export is refused', () => {
  const single = { ...files, [`${APP}db/schema/index.ts`]: "export * from './widgets-schema'\n" }
  const local = (item) => evidenceItemProblems(item, { route: ROUTE, method: 'GET', exists: (file) => file in single, readText: (file) => single[file] }, 'record')
  const accepted = { provenance: 'SCHEMA_OR_POLICY', claim: 'tenantScope', ref: `${APP}db/schema/widgets-schema.ts`, resolvesExport: 'widgets', quote: "organizationId: uuid('organization_id')" }
  assert.deepEqual(local(accepted), [])
  assert.ok(has(local({ ...accepted, quote: "ownerUserId: uuid('owner_user_id')" }), /not inside the definition of widgets/))
})

test('NEGATIVE: a claim that a column is absent fails when the table definition contains it', () => {
  const single = { ...files, [`${APP}db/schema/index.ts`]: "export * from './widgets-schema'\n" }
  const local = (item) => evidenceItemProblems(item, { route: ROUTE, method: 'GET', exists: (file) => file in single, readText: (file) => single[file] }, 'record')
  const item = { provenance: 'SCHEMA_OR_POLICY', claim: 'tenantScope', ref: `${APP}db/schema/widgets-schema.ts`, resolvesExport: 'widgets', quote: "id: uuid('id')", absentColumns: ['organizationId'] }
  assert.ok(has(local(item), /the table definition contains organizationId/))
  assert.deepEqual(local({ ...item, absentColumns: ['ownerUserId'] }), [])
})

test('NEGATIVE: a schema provenance on a file that is not a schema, migration or governance file is refused', () => {
  const item = { provenance: 'SCHEMA_OR_POLICY', claim: 'behavior', ref: `${APP}lib/services/island.ts`, quote: 'island-marker' }
  assert.ok(has(problems(item), /is not a schema, migration or governance file/))
})

test('record level: authentication and authorization need route-near evidence and a service quote alone is refused', () => {
  const record = {
    id: `${ROUTE}|GET`, route: ROUTE, method: 'GET', status: 'CLASSIFIED', mutationAudit: 'NOT_MUTATING', inferences: [],
    evidence: ['authentication', 'authorization', 'tenantScope', 'mutation'].map((claim) => ({
      provenance: 'SERVICE_IMPLEMENTATION', claim, ref: `${APP}lib/services/widget-rows.ts`, quote: 'return tenant',
    })),
  }
  const result = recordProvenanceProblems(record, { exists, readText })
  assert.ok(has(result, /supports its authentication claim only from outside the route handler and its imports/))
  assert.ok(has(result, /supports its authorization claim only from outside the route handler and its imports/))
  assert.ok(!has(result, /tenantScope claim only/))
})

test('record level: a missing claim, a missing audit on a mutation, and a missing inference list are refused', () => {
  const record = { id: `${ROUTE}|POST`, route: ROUTE, method: 'POST', status: 'CLASSIFIED', mutationAudit: 'ATOMIC_AUDIT', evidence: [] }
  const result = recordProvenanceProblems(record, { exists, readText })
  for (const claim of ['authentication', 'authorization', 'tenantScope', 'mutation', 'audit']) assert.ok(has(result, new RegExp(`makes the ${claim} claim without non-inference evidence`)), claim)
  assert.ok(has(result, /must list its inferences/))
})

test('NEGATIVE: an authentication claim that rests only on an inference is refused', () => {
  const record = {
    id: `${ROUTE}|GET`, route: ROUTE, method: 'GET', status: 'CLASSIFIED', mutationAudit: 'NOT_MUTATING',
    evidence: [direct({ claim: 'tenantScope' }), direct({ claim: 'mutation' })],
    inferences: [{ claim: 'authentication', statement: 'The wrapper probably authenticates every caller before the handler runs.' }],
  }
  const result = recordProvenanceProblems(record, { exists, readText })
  assert.ok(has(result, /rests the authentication claim on an inference; INFERENCE_UNVERIFIED cannot support a material claim/))
  assert.ok(has(result, /makes the authentication claim without non-inference evidence/))
  const loose = { ...record, inferences: [{ claim: 'behavior', statement: 'x' }] }
  assert.ok(has(recordProvenanceProblems(loose, { exists, readText }), /malformed inference/))
  const unknown = { ...record, inferences: [{ claim: 'astrology', statement: 'An inference about a claim nobody defined for this route.' }] }
  assert.ok(has(recordProvenanceProblems(unknown, { exists, readText }), /unknown claim/))
})

test('region finders: class members, overloads and destructured crud handlers are located by their own text', () => {
  const classText = 'export class Service {\n  async read(id) {\n    return "read-body"\n  }\n  async write(id) {\n    return "write-body"\n  }\n}\n'
  assert.ok(memberRegion(classText, 'Service', 'read').includes('read-body'))
  assert.ok(!memberRegion(classText, 'Service', 'read').includes('write-body'))
  assert.equal(memberRegion(classText, 'Service', 'missing'), null)
  const overloads = 'export function pick(a: string): string\nexport function pick(a: number): number\nexport function pick(a) {\n  return a\n}\nconst other = 1\n'
  assert.ok(definitionRegion(overloads, 'pick').includes('return a'))
  assert.ok(!definitionRegion(overloads, 'pick').includes('const other'))
  const crud = "const { GET, POST } = crudRoutes({ table: 'x' })\nexport { GET, POST }\n"
  assert.ok(handlerRegion(crud, 'GET').includes('crudRoutes'))
  assert.equal(handlerRegion(crud, 'DELETE'), null)
  const notExported = "const { GET } = crudRoutes({ table: 'x' })\n"
  assert.equal(handlerRegion(notExported, 'GET'), null)
})

test('import parsing: aliases, defaults, dynamic imports and re-exports are all seen', () => {
  const parsed = importsOf("import def, { a as b, type T } from './m'\nimport type { Only } from './types'\nconst { c } = await import('./dyn')\nexport * from './re'\n")
  assert.deepEqual(parsed.find((item) => item.spec === './m').names, [{ imported: 'a', local: 'b' }, { imported: 'T', local: 'T' }, { imported: 'default', local: 'def' }])
  assert.ok(!parsed.some((item) => item.spec === './types'))
  assert.ok(parsed.some((item) => item.spec === './dyn' && item.dynamic))
  assert.ok(parsed.some((item) => item.spec === './re' && item.reexport))
  assert.deepEqual(resolveExportDefinitions(`${APP}db/schema/index.ts`, 'gadgets', readText, exists), [`${APP}db/schema/widgets-schema.ts`])
})

test('the committed Gate 0B.4 records satisfy the provenance rules against the live source', () => {
  const base = loadContext(ROOT)
  const live = { exists: (file) => existsSync(join(ROOT, file)), readText: (file) => readFileSync(join(ROOT, file), 'utf8') }
  const out = []
  for (const record of base.classification0b4.operations) out.push(...recordProvenanceProblems(record, live))
  assert.deepEqual(out, [])
  assert.equal(base.classification0b4.operations.length, 100)
})
