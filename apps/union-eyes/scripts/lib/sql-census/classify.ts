/**
 * Why an absent object is absent (UE-CONV-H-013). The same statement that names `deadline_alerts.recipient_id` could be written against a design that was never
 * built, against a legacy migration that is not in the applied chain, against a fixture's private schema, against an extension the server lacks, or against
 * the wrong name for something that exists. The remedy differs, so each finding carries the cause the repository's own files show.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Catalog } from './catalog'
import type { JudgedFinding } from './judge'

export type RootCause = 'LEGACY_SQL_ONLY' | 'V2_INSTALLER_ONLY' | 'TEST_DDL_ONLY' | 'EXTENSION' | 'RENAME_CANDIDATE' | 'DJANGO_STUB_SHAPE' | 'NOWHERE' | 'NOT_ABSENCE'

export interface Classification {
  cause: RootCause
  evidence: string[]
  /** For a rename: what exists that resembles the missing name. */
  candidates?: string[]
}

interface DdlIndex {
  /** Relation name, lower case → where it is created. */
  tables: Map<string, string[]>
  /** `relation.column` → where it is added. */
  columns: Map<string, string[]>
  /** View, function and type names → where they are created. */
  objects: Map<string, string[]>
}

const SKIPPED = new Set(['node_modules', '.next', '.git', 'coverage', 'dist', '.turbo'])
const IDENT = '(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)'
const unquote = (value: string): string => value.replace(/"/g, '').split('.').pop()!.toLowerCase()

function walk(dir: string, accept: (path: string) => boolean, out: string[] = []): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (SKIPPED.has(name)) continue
    const path = join(dir, name)
    let stat
    try {
      stat = statSync(path)
    } catch {
      continue
    }
    if (stat.isDirectory()) walk(path, accept, out)
    else if (accept(path)) out.push(path)
  }
  return out
}

function indexDdl(files: string[], root: string): DdlIndex {
  const index: DdlIndex = { tables: new Map(), columns: new Map(), objects: new Map() }
  const add = (map: Map<string, string[]>, key: string, where: string): void => {
    const list = map.get(key) ?? []
    if (list.length < 3 && !list.includes(where)) list.push(where)
    map.set(key, list)
  }
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const where = relative(root, file).replace(/\\/g, '/')
    for (const match of text.matchAll(new RegExp(`CREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${IDENT}(?:\\s*\\.\\s*${IDENT})?)\\s*\\(([\\s\\S]*?)\\n?\\)\\s*(?:;|PARTITION|WITH|INHERITS|TABLESPACE|USING|$)`, 'gi'))) {
      const table = unquote(match[1])
      add(index.tables, table, where)
      for (const line of match[2].split(/,\s*\n|\n/)) {
        const column = /^\s*("?[A-Za-z_][A-Za-z0-9_]*"?)\s+[A-Za-z]/.exec(line)
        if (column && !/^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE|LIKE)$/i.test(column[1].replace(/"/g, ''))) add(index.columns, `${table}.${unquote(column[1])}`, where)
      }
    }
    for (const match of text.matchAll(new RegExp(`ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(${IDENT}(?:\\s*\\.\\s*${IDENT})?)\\s+([\\s\\S]*?);`, 'gi'))) {
      for (const add1 of match[2].matchAll(new RegExp(`ADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${IDENT})`, 'gi'))) add(index.columns, `${unquote(match[1])}.${unquote(add1[1])}`, where)
    }
    for (const match of text.matchAll(new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:MATERIALIZED\\s+VIEW|VIEW|FUNCTION|TYPE|PROCEDURE)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${IDENT}(?:\\s*\\.\\s*${IDENT})?)`, 'gi'))) add(index.objects, unquote(match[1]), where)
  }
  return index
}

const EXTENSION_OBJECTS: Array<{ extension: string; pattern: RegExp }> = [
  { extension: 'vector', pattern: /^(vector|halfvec|sparsevec|cosine_distance|l2_distance|inner_product|vector_dims|ivfflat|hnsw)/i },
  { extension: 'postgis', pattern: /^(st_|geography$|geometry$|box2d|box3d|postgis)/i },
  { extension: 'pg_trgm', pattern: /^(similarity|word_similarity|show_trgm|gin_trgm_ops|gist_trgm_ops)/i },
  { extension: 'pg_stat_statements', pattern: /^pg_stat_statements/i },
  { extension: 'uuid-ossp', pattern: /^uuid_generate_/i },
  { extension: 'pgcrypto', pattern: /^(crypt|gen_salt|pgp_|digest|hmac|encrypt|decrypt)$/i },
]

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

/** A word without its plural, so `holidays` and `holiday` are the same word. */
const stem = (word: string): string => (word.endsWith('ies') ? `${word.slice(0, -3)}y` : word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word)
const tokens = (name: string): string[] => name.toLowerCase().split(/[_\W]+/).filter(Boolean).map(stem)

/** Names that resemble `name`: the same words in another order or form, a suffix that differs (`_cad`), or a few characters apart. */
export function similarNames(name: string, pool: Iterable<string>, limit = 3): string[] {
  const wanted = name.toLowerCase()
  const wantedTokens = new Set(tokens(wanted))
  const scored: Array<{ name: string; score: number }> = []
  for (const candidate of pool) {
    const lower = candidate.toLowerCase()
    if (lower === wanted) continue
    const candidateTokens = new Set(tokens(lower))
    const shared = [...wantedTokens].filter((token) => candidateTokens.has(token)).length
    const jaccard = shared / new Set([...wantedTokens, ...candidateTokens]).size
    const edits = distance(wanted, lower)
    const close = edits <= Math.max(2, Math.floor(Math.max(wanted.length, lower.length) * 0.25))
    const contained = wanted.length >= 4 && (lower.includes(wanted) || wanted.includes(lower)) && Math.min(wanted.length, lower.length) >= 4
    if (close || jaccard >= 0.5 || contained) scored.push({ name: candidate, score: (close ? 2 : 0) + jaccard + (contained ? 0.5 : 0) - edits / 100 })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((entry) => entry.name)
}

const STUB_COLUMNS = new Set(['id', 'created_at', 'updated_at', 'organization_id', 'deleted_at', 'tenant_id', 'org_id'])

export class Classifier {
  private readonly legacy: DdlIndex
  private readonly v2: DdlIndex
  private readonly testDdl: DdlIndex

  constructor(
    private readonly appRoot: string,
    private readonly catalog: Catalog,
  ) {
    this.legacy = indexDdl(walk(join(appRoot, 'db', 'migrations'), (path) => path.endsWith('.sql')), appRoot)
    this.v2 = indexDdl(walk(join(appRoot, 'scripts', 'bootstrap-v2'), (path) => /\.(sql|ts)$/.test(path) && !/\.test\./.test(path)), appRoot)
    this.testDdl = indexDdl(walk(appRoot, (path) => /\.test\.tsx?$/.test(path) && /(pglite|PGlite|CREATE TABLE)/.test(readFileSync(path, 'utf8'))), appRoot)
  }

  classify(finding: JudgedFinding): Classification {
    const object = finding.object
    if (finding.kind === 'RELATION_ABSENT') return this.relation(object.split('.').pop()!.toLowerCase())
    if (finding.kind === 'COLUMN_ABSENT' && finding.relation && finding.column) return this.column(finding.relation.split('|'), finding.column.toLowerCase())
    if (finding.kind === 'FUNCTION_ABSENT' || finding.kind === 'TYPE_ABSENT') return this.object(object.replace(/\/\d+$/, '').split('.').pop()!.toLowerCase(), finding.kind === 'FUNCTION_ABSENT')
    if (finding.kind === 'ALIAS_UNRESOLVED') return { cause: 'NOWHERE', evidence: ['the alias is not defined by any FROM clause in the statement: a defect in the statement'] }
    return { cause: 'NOT_ABSENCE', evidence: [] }
  }

  private evidence(index: DdlIndex, key: string, map: 'tables' | 'columns' | 'objects'): string[] {
    return index[map].get(key) ?? []
  }

  private relation(name: string): Classification {
    const extension = EXTENSION_OBJECTS.find((entry) => entry.pattern.test(name))
    if (extension && !this.catalog.extensions.has(extension.extension)) return { cause: 'EXTENSION', evidence: [`${extension.extension} is not installed`] }
    const legacy = this.evidence(this.legacy, name, 'tables').concat(this.evidence(this.legacy, name, 'objects'))
    if (legacy.length) return { cause: 'LEGACY_SQL_ONLY', evidence: legacy }
    const v2 = this.evidence(this.v2, name, 'tables').concat(this.evidence(this.v2, name, 'objects'))
    if (v2.length) return { cause: 'V2_INSTALLER_ONLY', evidence: v2 }
    const test = this.evidence(this.testDdl, name, 'tables')
    if (test.length) return { cause: 'TEST_DDL_ONLY', evidence: test }
    const names = [...this.catalog.relations.values()].filter((relation) => relation.schema === 'public' && ['r', 'v', 'm', 'p'].includes(relation.kind)).map((relation) => relation.name)
    const candidates = similarNames(name, names)
    return candidates.length ? { cause: 'RENAME_CANDIDATE', evidence: ['no definition of it exists anywhere in the repository'], candidates } : { cause: 'NOWHERE', evidence: ['no definition of it exists anywhere in the repository'] }
  }

  private column(relations: string[], column: string): Classification {
    const evidence: string[] = []
    for (const relation of relations) {
      const key = `${relation.toLowerCase()}.${column}`
      evidence.push(...this.evidence(this.legacy, key, 'columns').map((where) => `${where} (legacy)`))
      evidence.push(...this.evidence(this.v2, key, 'columns').map((where) => `${where} (bootstrap-v2)`))
    }
    if (evidence.some((where) => where.endsWith('(legacy)'))) return { cause: 'LEGACY_SQL_ONLY', evidence }
    if (evidence.length) return { cause: 'V2_INSTALLER_ONLY', evidence }
    for (const relation of relations) {
      const physical = this.catalog.relations.get(`public.${relation}`)
      if (!physical) continue
      const candidates = similarNames(column, physical.columns.keys())
      if (candidates.length) return { cause: 'RENAME_CANDIDATE', evidence: [`${relation} has similarly named columns`], candidates: candidates.map((name) => `${relation}.${name}`) }
      if (physical.columns.size <= 8 && [...physical.columns.keys()].every((name) => STUB_COLUMNS.has(name) || name.endsWith('_id'))) {
        return { cause: 'DJANGO_STUB_SHAPE', evidence: [`${relation} has only ${[...physical.columns.keys()].join(', ')}`] }
      }
    }
    return { cause: 'NOWHERE', evidence: ['no migration, installer or fixture adds this column'] }
  }

  private object(name: string, isFunction: boolean): Classification {
    const extension = EXTENSION_OBJECTS.find((entry) => entry.pattern.test(name))
    if (extension && !this.catalog.extensions.has(extension.extension)) return { cause: 'EXTENSION', evidence: [`${extension.extension} is not installed`] }
    const legacy = this.evidence(this.legacy, name, 'objects')
    if (legacy.length) return { cause: 'LEGACY_SQL_ONLY', evidence: legacy }
    const v2 = this.evidence(this.v2, name, 'objects')
    if (v2.length) return { cause: 'V2_INSTALLER_ONLY', evidence: v2 }
    const pool = isFunction ? [...this.catalog.functions.values()].flat().filter((fn) => fn.schema === 'public').map((fn) => fn.name) : []
    const candidates = similarNames(name, pool)
    return candidates.length ? { cause: 'RENAME_CANDIDATE', evidence: [], candidates } : { cause: 'NOWHERE', evidence: ['no definition of it exists anywhere in the repository'] }
  }
}
