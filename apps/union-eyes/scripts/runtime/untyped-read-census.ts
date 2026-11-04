/**
 * The untyped-read census (UE-CONV-H-028): what a screen reads of a value that neither the compiler nor the response-shape census checks (see lib/frontend-census/untyped-reads.ts for the
 * two kinds). A finding is fixed by giving the value the type the route answers with (a declared type, a `Wire<…>` of the route's own type, a strict reader), so the compiler checks the
 * read and the response-shape census checks the type; a read that must stay as it is is accepted by file in ACCEPTED_ANY and by file and key in ACCEPTED_KEYS, with the reason.
 * Read-only: it reads source files and the routes' answers and needs no database. It builds the TypeScript program of the application: about a minute.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/untyped-read-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { resolveSpecifier } from '../lib/env-census/collect'
import { appSourceFiles } from '../lib/env-census/scope'
import { extractFromSource } from '../lib/frontend-census/client-calls'
import { RouteResponseReader, type Shape } from '../lib/frontend-census/route-response'
import { judgeCall, type RouteEntry } from '../lib/frontend-census/route-match'
import { TypeShapes } from '../lib/frontend-census/type-shapes'
import { anyReadsOf, keysOfShape, readerKeysOf } from '../lib/frontend-census/untyped-reads'
import { runCensus as runResponseCensus } from './response-shape-census'
import { APP_ROOT, NOT_REQUESTS, loadRoutes, sourceFiles } from './frontend-api-census'

export type UntypedKind = 'ANY_READ' | 'READER_KEY_NOT_RETURNED'

/** Reads of an `any` that are true as written: how many in the file, and why. The count is held, so a new one fails. */
export const ACCEPTED_ANY: ReadonlyArray<{ file: string; reads: number; reason: string }> = []

/** A key a reader takes that no route its screens request sends, and why it is right anyway. */
export const ACCEPTED_KEYS: ReadonlyArray<{ file: string; key: string; reason: string }> = []

export interface UntypedFinding {
  kind: UntypedKind
  file: string
  line: number
  key: string
  text: string
}

export interface UntypedReport {
  files: number
  /** Reads of an `any` that nothing checks: the ones the response-shape census has not placed against a route's answer. */
  anyReads: number
  /** Reads of an `any` that the response-shape census checks against a route's answer. */
  anyChecked: number
  readerKeys: number
  /** Reader keys that could be held against the answers of the routes the screens request. */
  judgedKeys: number
  accepted: number
  findings: UntypedFinding[]
}

/** The files whose members the `any` reads are counted in: the screens and what they use to read. */
const UI_FILE = /^(?:app|components|contexts|lib\/hooks)\//
/** A module that reads records with the strict readers of lib/client (row-fields, api-envelope): its keys are judged wherever it lives. */
const USES_STRICT_READERS = /from\s+['"]@\/lib\/client\/(?:row-fields|api-envelope)['"]/
/** How far up the files that use a module its screens are followed to find the routes it reads. */
const MAX_IMPORT_DEPTH = 3
/** The reader of a failed answer reads what a success answer does not have: a message, a code. */
const FAILURE_READERS = new Set(['lib/client/api-envelope.ts'])

function importsOf(root: string, files: string[], known: Set<string>): Map<string, Set<string>> {
  const importers = new Map<string, Set<string>>()
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, false, /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    for (const statement of source.statements) {
      const specifier = ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement) ? statement.moduleSpecifier : undefined
      if (!specifier || !ts.isStringLiteralLike(specifier)) continue
      const target = resolveSpecifier(file, specifier.text, known)
      if (!target) continue
      const set = importers.get(target) ?? new Set<string>()
      set.add(file)
      importers.set(target, set)
    }
  }
  return importers
}

export function runCensus(root: string = APP_ROOT, routes: RouteEntry[] = loadRoutes(), types: TypeShapes = TypeShapes.forProject(root), placed: ReadonlySet<string> = new Set()): UntypedReport {
  const known = new Set(appSourceFiles(root))
  const files = sourceFiles(root)
  const reader = new RouteResponseReader({
    read: (file) => (existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), 'utf8') : null),
    resolve: (from, specifier) => resolveSpecifier(from, specifier, known),
  }, types)

  // The answers each file's requests have: what its screens can be given to read.
  const answers = new Map<string, { shapes: Shape[]; complete: boolean }>()
  for (const file of files) {
    if (file in NOT_REQUESTS) continue
    const text = readFileSync(path.join(root, file), 'utf8')
    if (!/\/api\//.test(text)) continue
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const held = { shapes: [] as Shape[], complete: true }
    for (const call of extractFromSource(file, source)) {
      const verdict = judgeCall(call, routes)
      if (verdict.kind || verdict.routes.length === 0) continue
      for (const entry of verdict.routes) {
        const shapes = reader.shapesOf(`app/api/${entry.route}`)
        // A URL handed to a helper has no method of its own: every method the route has stands for it.
        const wanted = call.method ? [call.method] : [...shapes.keys()]
        let readable = false
        for (const method of wanted) {
          const shape = shapes.get(method)
          if (shape) {
            held.shapes.push(shape)
            readable = true
          }
        }
        if (!readable) held.complete = false
      }
    }
    if (held.shapes.length > 0 || !held.complete) answers.set(file, held)
  }

  const importers = importsOf(root, [...known], known)
  const universe = (file: string): { keys: Set<string>; complete: boolean } | null => {
    const keys = new Set<string>()
    let complete = true
    let found = false
    const seen = new Set<string>([file])
    let layer = [file]
    for (let depth = 0; depth <= MAX_IMPORT_DEPTH && layer.length > 0; depth += 1) {
      const next: string[] = []
      for (const member of layer) {
        const held = answers.get(member)
        if (held) {
          found = true
          if (!held.complete) complete = false
          for (const shape of held.shapes) keysOfShape(shape, keys)
        }
        for (const importer of importers.get(member) ?? []) {
          if (!seen.has(importer)) {
            seen.add(importer)
            next.push(importer)
          }
        }
      }
      layer = next
    }
    return found ? { keys, complete } : null
  }

  const findings: UntypedFinding[] = []
  const acceptedAny = new Map(ACCEPTED_ANY.map((entry) => [entry.file, entry.reads]))
  let anyReads = 0
  let anyChecked = 0
  let readerKeys = 0
  let judgedKeys = 0
  let accepted = 0
  for (const file of files) {
    const tree = types.treeOf(file)
    if (!tree) continue
    if (UI_FILE.test(file)) {
      // A read the response-shape census has placed against the route's answer is checked, whatever its type says.
      const reads = anyReadsOf(tree.source, tree.checker).filter((read) => {
        const checked = placed.has(`${file}:${read.line}:${read.key}`)
        if (checked) anyChecked += 1
        return !checked
      })
      anyReads += reads.length
      const allowed = acceptedAny.get(file) ?? 0
      accepted += Math.min(allowed, reads.length)
      for (const read of reads.slice(allowed)) findings.push({ kind: 'ANY_READ', file, line: read.line, key: read.key, text: read.text })
    }
    if (FAILURE_READERS.has(file)) continue
    if (!UI_FILE.test(file) && !USES_STRICT_READERS.test(readFileSync(path.join(root, file), 'utf8'))) continue
    const keys = readerKeysOf(tree.source, tree.checker)
    readerKeys += keys.length
    if (keys.length === 0) continue
    const known = universe(file)
    if (!known || !known.complete) continue
    for (const read of keys) {
      judgedKeys += 1
      if (known.keys.has(read.key)) continue
      if (ACCEPTED_KEYS.some((entry) => entry.file === file && entry.key === read.key)) accepted += 1
      else findings.push({ kind: 'READER_KEY_NOT_RETURNED', file, line: read.line, key: read.key, text: read.text })
    }
  }
  findings.sort((a, b) => a.kind.localeCompare(b.kind) || a.file.localeCompare(b.file) || a.line - b.line)
  return { files: files.length, anyReads, anyChecked, readerKeys, judgedKeys, accepted, findings }
}

export function countByKind(findings: UntypedFinding[]): Record<UntypedKind, number> {
  const counts: Record<UntypedKind, number> = { ANY_READ: 0, READER_KEY_NOT_RETURNED: 0 }
  for (const finding of findings) counts[finding.kind] += 1
  return counts
}

export function toMarkdown(report: UntypedReport): string {
  const lines = ['# Untyped-read census (UE-CONV-H-028)', '', `${report.files} frontend files, ${report.anyReads} reads of an \`any\` that nothing checks (${report.anyChecked} more that the response-shape census checks), ${report.judgedKeys} of ${report.readerKeys} reader keys held against the routes' answers; ${report.findings.length} findings, ${report.accepted} accepted.`, '']
  for (const kind of ['ANY_READ', 'READER_KEY_NOT_RETURNED'] as const) {
    const group = report.findings.filter((finding) => finding.kind === kind)
    if (!group.length) continue
    lines.push(`## ${kind}`, '')
    for (const finding of group) lines.push(`- ${finding.file}:${finding.line}  \`${finding.text}\``)
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

/** The census over the real tree, with the program of the application built once for it and for the response-shape census whose placed reads it needs. */
export function runWithResponseCensus(root: string = APP_ROOT): UntypedReport {
  const routes = loadRoutes()
  const types = TypeShapes.forProject(root)
  return runCensus(root, routes, types, new Set(runResponseCensus(root, routes, types).placed))
}

function main(): void {
  const args = process.argv.slice(2)
  const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const report = runWithResponseCensus()
  if (option('write')) writeFileSync(option('write')!, `${JSON.stringify(report, null, 2)}\n`)
  if (option('markdown')) writeFileSync(option('markdown')!, toMarkdown(report))
  if (!args.includes('--quiet')) {
    console.log(`${report.files} files; ${report.anyReads} reads of an any that nothing checks (${report.anyChecked} more the response-shape census checks), ${report.judgedKeys} of ${report.readerKeys} reader keys held against the routes' answers; ${report.findings.length} findings (${report.accepted} accepted)`)
    const counts = countByKind(report.findings)
    for (const [kind, count] of Object.entries(counts)) console.log(`  ${kind.padEnd(26)} ${String(count).padStart(4)}`)
    for (const finding of report.findings) console.log(`  ${finding.kind.padEnd(26)} ${finding.file}:${finding.line}  ${finding.text}`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
