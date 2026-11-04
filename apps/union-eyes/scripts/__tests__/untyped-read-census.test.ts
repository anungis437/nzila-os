/**
 * The untyped-read census (UE-CONV-H-028): what a screen reads of a value that neither the compiler nor the response-shape census checks.
 *
 * Two kinds of read escape both, and this holds each at zero:
 *   - ANY_READ: a member of a value the checker can only call `any` (`const data = await res.json(); data.items`);
 *   - READER_KEY_NOT_RETURNED: a key a strict reader takes off a record typed `Record<string, unknown>` that none of the routes its screens request sends.
 * The first block pins what each kind is (and is not), on small programs; the last holds the real tree, with the acceptances that stay as they are listed and justified.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { objectOf, type Shape } from '../lib/frontend-census/route-response'
import { TypeShapes } from '../lib/frontend-census/type-shapes'
import { anyReadsOf, keysOfShape, readerKeysOf } from '../lib/frontend-census/untyped-reads'
import { APP_ROOT } from '../runtime/frontend-api-census'
import { ACCEPTED_ANY, ACCEPTED_KEYS, countByKind, runWithResponseCensus } from '../runtime/untyped-read-census'

const ROOT = path.join(process.cwd(), 'virtual-application')

const treeOf = (code: string) => {
  const tree = TypeShapes.forFiles(ROOT, { 'app/screen.tsx': code }).treeOf('app/screen.tsx')
  if (!tree) throw new Error('the program has no screen')
  return tree
}
const anyReads = (code: string): string[] => {
  const { source, checker } = treeOf(code)
  return anyReadsOf(source, checker).map((read) => read.text)
}
const readerKeys = (code: string): string[] => {
  const { source, checker } = treeOf(code)
  return [...new Set(readerKeysOf(source, checker).map((read) => read.key))].sort()
}

describe('a member of an any', () => {
  it('is read from what response.json() is: nothing says the key is there', () => {
    expect(anyReads('export async function load(res: Response) { const body = await res.json(); return body.data.items }')).toEqual(['body.data.items', 'body.data'])
    expect(anyReads("export async function load(res: Response) { const body = await res.json(); return body['data'] }")).toEqual(["body['data']"])
  })

  it('is not read once the value has the type the route answers with', () => {
    expect(anyReads('export async function load(res: Response) { const body = (await res.json()) as { data: { items: string[] } }; return body.data.items }')).toEqual([])
    expect(anyReads('interface Answer { data?: { items?: string[] } }\nexport async function load(res: Response) { const body: Answer = await res.json(); return body.data?.items }')).toEqual([])
  })

  it('is not read when it is written, or when the checker could not resolve the module it comes from', () => {
    expect(anyReads('export async function load(res: Response) { const body = await res.json(); body.touched = true; body.count += 1; delete body.stale }')).toEqual([])
    expect(anyReads("import { thing } from './missing'\nexport const value = thing.value")).toEqual([])
  })
})

describe('a key a strict reader takes off a record', () => {
  const reader = 'declare function requiredString(row: Record<string, unknown>, key: string): string\ndeclare function isRecord(value: unknown): value is Record<string, unknown>\n'

  it('is read from a row handed to the reader by name, as a member and as an indexed member', () => {
    expect(readerKeys(`${reader}export function fromRow(row: Record<string, unknown>) { return { id: requiredString(row, 'id'), name: row.name, code: row['code'] } }`)).toEqual(['code', 'id', 'name'])
  })

  it('is not read from a record taken out of the row, which is the screen\'s contract with what was stored and not with the route', () => {
    expect(readerKeys(`${reader}export function fromRow(row: Record<string, unknown>) { const stats = isRecord(row.stats) ? row.stats : {}; return stats.count }`)).toEqual(['stats'])
  })

  it('is not read from a record whose type says what it holds (the compiler checks those), or when it is written', () => {
    expect(readerKeys(`${reader}export function typed(row: { id: string }) { return row.id }`)).toEqual([])
    expect(readerKeys(`${reader}export function write(row: Record<string, unknown>) { row.touched = 1 }`)).toEqual([])
  })
})

describe('the keys an answer holds', () => {
  it('are every key at every depth, through lists', () => {
    const list: Shape = { kind: 'array', element: objectOf({ id: null, label: null }) }
    expect([...keysOfShape(objectOf({ data: objectOf({ items: list }), meta: null }))].sort()).toEqual(['data', 'id', 'items', 'label', 'meta'])
    expect([...keysOfShape(null)]).toEqual([])
  })
})

describe('what stays as it is', () => {
  it('is listed with the reason it is right, for a file that exists', () => {
    for (const entry of ACCEPTED_ANY) {
      expect(existsSync(path.join(APP_ROOT, entry.file)), entry.file).toBe(true)
      expect(entry.reads, entry.file).toBeGreaterThan(0)
      expect(entry.reason.length, `${entry.file}: say why the read is right`).toBeGreaterThan(40)
    }
    for (const entry of ACCEPTED_KEYS) {
      expect(existsSync(path.join(APP_ROOT, entry.file)), entry.file).toBe(true)
      expect(entry.reason.length, `${entry.file} ${entry.key}: say why the key is right`).toBeGreaterThan(40)
    }
    const keys = ACCEPTED_KEYS.map((entry) => `${entry.file} ${entry.key}`)
    expect(new Set(keys).size).toBe(keys.length)
    const files = ACCEPTED_ANY.map((entry) => entry.file)
    expect(new Set(files).size).toBe(files.length)
  })
})

const CEILING = 0

describe('the frontend against what nothing checks', () => {
  it('holds both kinds of untyped read at or below the ceiling, and every acceptance is still needed', () => {
    const report = runWithResponseCensus()
    // The census reads the whole application and judges a good part of the reader keys against the routes' answers; a census that read little would hold anything.
    expect(report.files).toBeGreaterThan(1000)
    expect(report.judgedKeys).toBeGreaterThan(600)
    expect(report.anyChecked).toBeGreaterThan(10)
    // An acceptance whose read has been fixed is not counted, so a stale one fails here instead of lingering.
    expect(report.accepted).toBe(ACCEPTED_KEYS.length + ACCEPTED_ANY.reduce((sum, entry) => sum + entry.reads, 0))
    const counts = countByKind(report.findings)
    const over = report.findings.length > CEILING
      ? report.findings.map((finding) => `${finding.kind} ${finding.file}:${finding.line}  ${finding.text}`)
      : []
    expect(over).toEqual([])
    expect(counts.ANY_READ).toBeLessThanOrEqual(CEILING)
    expect(counts.READER_KEY_NOT_RETURNED).toBeLessThanOrEqual(CEILING)
  }, 300_000)
})
