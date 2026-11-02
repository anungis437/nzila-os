/**
 * Judges each assembled statement against the database (UE-CONV-H-013): the analyzer lists every absent object, PostgreSQL itself confirms (PREPARE
 * analyses, EXPLAIN of the prepared statement plans it, nothing executes), and the two are compared. A statement the server rejects for a reason the
 * analyzer did not name is an `ANALYZER_GAP`; a name the analyzer reports that the server accepts is an `ANALYZER_FALSE_POSITIVE`. Both are counted, so the
 * measurement states its own reliability.
 */
import type pg from 'pg'
import { Analyzer, type Analysis, type Finding } from './analyze'
import type { Catalog } from './catalog'
import { findFunctions } from './catalog'
import { parseSql, type ParseNode } from './parse'
import { HOLE, type SqlSite, type Variant } from './sites'

export type Verdict =
  | 'CLEAN'
  | 'FINDINGS'
  | 'FRAGMENT_CLEAN'
  | 'FRAGMENT_FINDINGS'
  | 'PARTIAL_CLEAN'
  | 'PARTIAL_FINDINGS'
  | 'UNRESOLVED'
  | 'NOT_SQL'
  | 'EXTERNAL'
  | 'LOCAL_SCHEMA'
  | 'V2_WORLD'
  | 'OTHER_DIALECT'

export type JudgedKind =
  | Finding['kind']
  | 'ORACLE_SYNTAX'
  | 'ORACLE_TYPE'
  | 'ORACLE_LITERAL'
  | 'ORACLE_AMBIGUOUS'
  | 'ORACLE_PLAN'
  | 'ORACLE_ENVIRONMENT'
  | 'ORACLE_FUNCTION_SIGNATURE'
  | 'PARAM_IN_LITERAL'
  | 'ANALYZER_GAP'
  | 'ANALYZER_FALSE_POSITIVE'

export interface JudgedFinding {
  kind: JudgedKind
  object: string
  relation?: string
  column?: string
  columns?: string[]
  detail?: string
  clause?: string
  /** The statement is incomplete (holes) or a fragment judged inside a wrapper: the finding holds for the text that was resolved. */
  partial: boolean
  /** Present in every variant of the site (a conditional statement may differ by branch). */
  definite: boolean
  sqlstate?: string
}

export interface SiteJudgment {
  site: SqlSite
  verdict: Verdict
  findings: JudgedFinding[]
  /** Why the site could not be judged, or what limited the judgment. */
  note?: string
  /** Relations (that exist) and the absent relations' expected shape, merged across variants. */
  relations: string[]
  expectedShape: Record<string, string[]>
  writes: Array<{ operation: string; relation: string }>
  gucReads: string[]
  gucWrites: string[]
  /** A short rendering of the first variant for the report. */
  snippet: string
}

interface OracleOutcome {
  prepared: boolean
  planned: boolean
  code?: string
  message?: string
  phase?: 'prepare' | 'plan'
}

const ABSENT_CODES = new Set(['42P01', '42703', '42883', '42704'])
const TYPE_CODES = new Set(['42804', '42846', '42809'])
const AMBIGUOUS_CODES = new Set(['42725', '42702', '42803', '42P08'])
const LITERAL_CODES = new Set(['22P02'])
const NEVER_FINDING_CODES = new Set(['42P18', '22007', '22008', '22003', '22001', '22023', '42P02', '22P05'])

const quoteIdentifier = (name: string): string => `"${name.replace(/"/g, '""')}"`

/** `$n` placeholders that sit inside a single-quoted literal are text, not parameters: the driver never binds them. */
export function parametersInsideLiterals(text: string): string[] {
  const found: string[] = []
  let index = 0
  while (index < text.length) {
    const character = text[index]
    if (character === "'") {
      index += 1
      let literal = ''
      while (index < text.length) {
        if (text[index] === "'") {
          if (text[index + 1] === "'") {
            literal += "''"
            index += 2
            continue
          }
          break
        }
        literal += text[index]
        index += 1
      }
      for (const match of literal.matchAll(/\$\d+/g)) found.push(match[0])
      index += 1
    } else if (character === '"') {
      const end = text.indexOf('"', index + 1)
      index = end === -1 ? text.length : end + 1
    } else if (character === '-' && text[index + 1] === '-') {
      const end = text.indexOf('\n', index)
      index = end === -1 ? text.length : end + 1
    } else if (character === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end === -1 ? text.length : end + 2
    } else if (character === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(text.slice(index))
      if (tag && !/^\$\d/.test(tag[0])) {
        const end = text.indexOf(tag[0], index + tag[0].length)
        index = end === -1 ? text.length : end + tag[0].length
      } else index += 1
    } else index += 1
  }
  return found
}

export class Judge {
  private readonly analyzer: Analyzer
  private sequence = 0

  constructor(
    private readonly client: Pick<pg.Client, 'query'>,
    private readonly catalog: Catalog,
  ) {
    this.analyzer = new Analyzer(catalog)
  }

  async begin(): Promise<void> {
    await this.client.query('BEGIN')
    await this.client.query('SET LOCAL plan_cache_mode = force_generic_plan')
    await this.client.query("SET LOCAL statement_timeout = '15s'")
  }

  async end(): Promise<void> {
    await this.client.query('ROLLBACK')
  }

  private async oracle(text: string, parameters: number): Promise<OracleOutcome> {
    const name = `census_${++this.sequence}`
    await this.client.query('SAVEPOINT census')
    let outcome: OracleOutcome
    try {
      await this.client.query(`PREPARE ${name} AS ${text}`)
      try {
        await this.client.query(`EXPLAIN (COSTS OFF) EXECUTE ${name}${parameters ? `(${Array(parameters).fill('NULL').join(', ')})` : ''}`)
        outcome = { prepared: true, planned: true }
      } catch (error) {
        const failure = error as { code?: string; message: string }
        outcome = { prepared: true, planned: false, code: failure.code, message: failure.message, phase: 'plan' }
      }
    } catch (error) {
      const failure = error as { code?: string; message: string }
      outcome = { prepared: false, planned: false, code: failure.code, message: failure.message, phase: 'prepare' }
    }
    // A failed statement aborts the transaction: return to the savepoint before anything else is sent.
    if (outcome.code) await this.client.query('ROLLBACK TO SAVEPOINT census')
    await this.client.query('DEALLOCATE ALL')
    await this.client.query('RELEASE SAVEPOINT census')
    return outcome
  }

  /** Splits a parsed text into its statements, each with the text the server needs to PREPARE it. */
  private async statements(text: string): Promise<{ ok: true; items: Array<{ statement: ParseNode; text: string }> } | { ok: false; message: string }> {
    const parsed = await parseSql(text)
    if (!parsed.ok) return { ok: false, message: parsed.message }
    return { ok: true, items: parsed.statements.map((statement, index) => ({ statement, text: parsed.texts[index] ?? text })) }
  }

  async judge(site: SqlSite): Promise<SiteJudgment> {
    const base = { site, findings: [] as JudgedFinding[], relations: [] as string[], expectedShape: {} as Record<string, string[]>, writes: [] as SiteJudgment['writes'], gucReads: [] as string[], gucWrites: [] as string[] }
    const first = site.variants[0]
    const snippet = (first?.text ?? '').replace(/\s+/g, ' ').slice(0, 200)
    if (site.localSchema) return { ...base, verdict: 'LOCAL_SCHEMA', snippet, note: 'the file builds its own schema in an embedded database' }
    // The Canonical-V2 installer builds and probes its own database (roles, the user_management schema, its functions): it is judged by its own native proofs.
    if (/^scripts\/bootstrap-v2\//.test(site.file)) return { ...base, verdict: 'V2_WORLD', snippet, note: 'judged against the database the Canonical-V2 installer builds' }
    if (site.executor && /platform/i.test(site.executor)) return { ...base, verdict: 'EXTERNAL', snippet, note: `executed through ${site.executor}, a different database` }
    if (site.dialect) return { ...base, verdict: 'OTHER_DIALECT', snippet, note: `written for ${site.dialect}, in a branch that tests for it` }
    if (!site.variants.length) return { ...base, verdict: 'UNRESOLVED', snippet, note: 'no text resolved' }

    const variantResults: Array<{ variant: Variant; kind: 'statement' | 'fragment' | 'none'; findings: JudgedFinding[]; analysis?: Analysis; note?: string }> = []
    for (const variant of site.variants) variantResults.push(await this.judgeVariant(site, variant))

    const judged = variantResults.filter((result) => result.kind !== 'none')
    if (!judged.length) {
      const notes = [...new Set(variantResults.map((result) => result.note).filter(Boolean))]
      const verdict: Verdict = variantResults.every((result) => result.note === 'not-sql' || result.note === 'empty') ? 'NOT_SQL' : 'UNRESOLVED'
      return { ...base, verdict, snippet, note: notes.join('; ') || undefined }
    }

    const merged = new Map<string, JudgedFinding>()
    judged.forEach((result) => {
      for (const finding of result.findings) {
        const key = `${finding.kind}|${finding.object}|${finding.clause ?? ''}`
        const existing = merged.get(key)
        if (existing) existing.definite = existing.definite && true
        else merged.set(key, { ...finding, definite: judged.length === 1 })
      }
    })
    const counts = new Map<string, number>()
    judged.forEach((result) => {
      for (const key of new Set(result.findings.map((finding) => `${finding.kind}|${finding.object}|${finding.clause ?? ''}`))) counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    for (const [key, finding] of merged) finding.definite = (counts.get(key) ?? 0) === judged.length
    const findings = [...merged.values()]

    const partial = judged.some((result) => result.variant.holes.length > 0)
    const fragment = judged.some((result) => result.kind === 'fragment')
    const verdict: Verdict = findings.length ? (partial ? 'PARTIAL_FINDINGS' : fragment ? 'FRAGMENT_FINDINGS' : 'FINDINGS') : partial ? 'PARTIAL_CLEAN' : fragment ? 'FRAGMENT_CLEAN' : 'CLEAN'
    const relations = new Set<string>()
    const expected = new Map<string, Set<string>>()
    const writes: SiteJudgment['writes'] = []
    const gucReads = new Set<string>()
    const gucWrites = new Set<string>()
    for (const result of judged) {
      if (!result.analysis) continue
      result.analysis.relations.forEach((relation) => relations.add(relation))
      for (const [name, columns] of Object.entries(result.analysis.expectedShape)) {
        const set = expected.get(name) ?? new Set<string>()
        columns.forEach((column) => set.add(column))
        expected.set(name, set)
      }
      for (const write of result.analysis.writes) if (!writes.some((existing) => existing.operation === write.operation && existing.relation === write.relation)) writes.push(write)
      result.analysis.gucReads.forEach((name) => gucReads.add(name))
      result.analysis.gucWrites.forEach((name) => gucWrites.add(name))
    }
    return {
      site,
      verdict,
      findings,
      relations: [...relations].sort(),
      expectedShape: Object.fromEntries([...expected].map(([name, columns]) => [name, [...columns].sort()])),
      writes,
      gucReads: [...gucReads].sort(),
      gucWrites: [...gucWrites].sort(),
      snippet,
      note: variantResults.find((result) => result.note && result.kind !== 'none')?.note,
    }
  }

  private async judgeVariant(site: SqlSite, variant: Variant): Promise<{ variant: Variant; kind: 'statement' | 'fragment' | 'none'; findings: JudgedFinding[]; analysis?: Analysis; note?: string }> {
    const partial = variant.holes.length > 0
    if (!variant.text.trim()) return { variant, kind: 'none', findings: [], note: 'empty' }
    const parsed = await this.statements(variant.text)
    if (parsed.ok) {
      const findings: JudgedFinding[] = []
      let analysis: Analysis | undefined
      for (const item of parsed.items) {
        const result = this.analyzer.analyze(item.statement)
        analysis = analysis ? mergeAnalyses(analysis, result) : result
        // A hole may be a FROM or JOIN clause that defines the alias, and a template that no query executes directly is spliced into one that does (a correlated
        // subquery names the outer query's aliases): what such a reference would resolve to cannot be judged from the text alone.
        const outerScopeUnknown = partial || (site.form === 'sql-template' && site.executor === null)
        const reliable = result.findings.filter((finding) => !(outerScopeUnknown && (finding.kind === 'ALIAS_UNRESOLVED' || (finding.kind === 'COLUMN_ABSENT' && finding.unqualified))))
        findings.push(...reliable.map((finding): JudgedFinding => ({ ...finding, partial, definite: true })))
        if (!partial && ['SelectStmt', 'InsertStmt', 'UpdateStmt', 'DeleteStmt', 'MergeStmt'].includes(result.statementKind)) {
          const outcome = await this.oracle(item.text, result.parameters)
          findings.push(...this.reconcile(result, outcome, site, variant, false))
        }
      }
      for (const literal of parametersInsideLiterals(variant.text)) {
        findings.push({ kind: 'PARAM_IN_LITERAL', object: literal, detail: `${literal} is inside a quoted literal: the driver does not bind it, the server receives the text "${literal}"`, partial, definite: true })
      }
      return { variant, kind: 'statement', findings: dedupeFindings(findings), analysis }
    }
    return this.judgeFragment(site, variant, parsed.message)
  }

  /** A template that is a clause rather than a statement: wrap it in the smallest statement that parses, naming the tables it belongs to. */
  private async judgeFragment(site: SqlSite, variant: Variant, syntaxMessage: string): Promise<{ variant: Variant; kind: 'statement' | 'fragment' | 'none'; findings: JudgedFinding[]; analysis?: Analysis; note?: string }> {
    const text = variant.text.trim()
    if (!text) return { variant, kind: 'none', findings: [], note: 'empty' }
    // `AND`, `OR` and `,` on their own are the glue between two fragments.
    if (/^[\s,]*(?:AND|OR)?[\s,]*$/i.test(text)) return { variant, kind: 'none', findings: [], note: 'empty' }
    const qualified = [...text.matchAll(/"([A-Za-z0-9_]+)"\."[A-Za-z0-9_]+"/g)].map((match) => match[1])
    const tables = [...new Set([...site.chainTables, ...qualified])]
    const from = tables.length ? ` FROM ${tables.map(quoteIdentifier).join(', ')}` : ''
    // The smallest statement each kind of clause fits in: an expression, a sort list, a predicate, a predicate that continues one (AND ...), the right of a comparison (> now()), a list that continues one (, col = $1).
    const wrappers = [`SELECT ${text}${from}`, `SELECT 1${from} ORDER BY ${text}`, `SELECT 1${from} WHERE ${text}`, `SELECT 1${from} WHERE TRUE ${text}`, `SELECT 1${from} WHERE ${HOLE} ${text}`, `SELECT ${HOLE} ${text}${from}`]
    for (const [index, wrapper] of wrappers.entries()) {
      const parsed = await this.statements(wrapper)
      if (!parsed.ok) continue
      const partial = variant.holes.length > 0
      const analysis = this.analyzer.analyze(parsed.items[0].statement)
      // An alias or an unqualified column a fragment uses is defined by the query around it, which this does not see: a limit of the judgment, not a finding.
      const unattributed = analysis.findings.filter((finding) => finding.kind === 'ALIAS_UNRESOLVED' || (finding.kind === 'COLUMN_ABSENT' && finding.unqualified))
      const findings = analysis.findings.filter((finding) => !unattributed.includes(finding)).map((finding): JudgedFinding => ({ ...finding, partial: true, definite: true }))
      // Only the wrappers that stand for the fragment's own shape ask the server: the others invent a context (`WHERE TRUE ...`) whose type errors say nothing about the fragment.
      if (index < 3 && !partial && !unattributed.length) {
        const outcome = await this.oracle(wrapper, analysis.parameters)
        findings.push(...this.reconcile(analysis, outcome, site, variant, true))
      }
      for (const literal of parametersInsideLiterals(variant.text)) {
        findings.push({ kind: 'PARAM_IN_LITERAL', object: literal, detail: `${literal} is inside a quoted literal: the driver does not bind it`, partial: true, definite: true })
      }
      const note = unattributed.length ? `${unattributed.length} reference(s) to an alias or an unqualified column defined outside this fragment were not judged` : undefined
      return { variant, kind: 'fragment', findings: dedupeFindings(findings), analysis, note }
    }
    const reason = variant.holes.length ? `holes: ${variant.holes.slice(0, 3).join(', ')}` : `syntax: ${syntaxMessage}`
    // A string that begins like a statement but is English (a label, a message) is not SQL.
    const prose = site.form === 'string-literal' && variant.holes.length === 0
    return { variant, kind: 'none', findings: [], note: prose || (!/^\s*(WITH|SELECT|INSERT|UPDATE|DELETE|MERGE)\b/i.test(text) && site.form !== 'sql-template') ? 'not-sql' : reason }
  }

  /** Compares what the server said with what the analyzer enumerated. */
  private reconcile(analysis: Analysis, outcome: OracleOutcome, site: SqlSite, variant: Variant, fragment: boolean): JudgedFinding[] {
    const out: JudgedFinding[] = []
    const code = outcome.code
    if (!code) {
      // The server accepts it: anything the analyzer reported about absence is a false positive of the analyzer (an operator, a function range, a composite).
      for (const finding of analysis.findings) {
        if (['RELATION_ABSENT', 'COLUMN_ABSENT', 'ALIAS_UNRESOLVED', 'FUNCTION_ABSENT', 'FUNCTION_ARITY', 'TYPE_ABSENT'].includes(finding.kind)) {
          out.push({ kind: 'ANALYZER_FALSE_POSITIVE', object: `${finding.kind}:${finding.object}`, detail: 'the server accepted a statement the analyzer reported as referencing something absent', partial: false, definite: true })
        }
      }
      return out
    }
    const message = outcome.message ?? ''
    const detail = `${outcome.phase === 'plan' ? 'planning' : 'analysis'}: ${message}`
    if (ABSENT_CODES.has(code)) {
      if (/^operator does not exist/.test(message)) {
        out.push({ kind: 'ORACLE_TYPE', object: message.slice(0, 160), detail, sqlstate: code, partial: fragment, definite: true })
        return out
      }
      if (/^(role|schema|extension|tablespace|database) "/.test(message)) {
        out.push({ kind: 'ORACLE_ENVIRONMENT', object: message.slice(0, 160), detail, sqlstate: code, partial: fragment, definite: true })
        return out
      }
      // The function exists under that name, but not for those argument types: the statement passes a type it does not take.
      const signature = /^function ([\w$.]+)\(([^)]*)\) does not exist/.exec(message)
      if (signature && !explainedByAnalysis(message, analysis)) {
        const parts = signature[1].split('.')
        if (findFunctions(this.catalog, parts.length > 1 ? parts[parts.length - 2] : undefined, parts[parts.length - 1]).length) {
          out.push({ kind: 'ORACLE_FUNCTION_SIGNATURE', object: `${signature[1]}(${signature[2]})`, detail, sqlstate: code, partial: fragment, definite: true })
          return out
        }
      }
      if (!explainedByAnalysis(message, analysis)) out.push({ kind: 'ANALYZER_GAP', object: `${code}: ${message}`.slice(0, 160), detail, sqlstate: code, partial: false, definite: true })
      return out
    }
    if (outcome.phase === 'plan' && code === '42P10') {
      if (!analysis.findings.some((finding) => finding.kind === 'ON_CONFLICT_NO_ARBITER')) out.push({ kind: 'ORACLE_PLAN', object: message.slice(0, 160), detail, sqlstate: code, partial: false, definite: true })
      return out
    }
    if (NEVER_FINDING_CODES.has(code)) return out
    if (code === '42601') {
      if (!fragment && variant.holes.length === 0 && site.form !== 'sql-template') out.push({ kind: 'ORACLE_SYNTAX', object: message.slice(0, 160), detail, sqlstate: code, partial: false, definite: true })
      return out
    }
    if (LITERAL_CODES.has(code)) out.push({ kind: 'ORACLE_LITERAL', object: message.slice(0, 160), detail, sqlstate: code, partial: fragment, definite: true })
    else if (TYPE_CODES.has(code)) out.push({ kind: 'ORACLE_TYPE', object: message.slice(0, 160), detail, sqlstate: code, partial: fragment, definite: true })
    else if (AMBIGUOUS_CODES.has(code)) out.push({ kind: 'ORACLE_AMBIGUOUS', object: message.slice(0, 160), detail, sqlstate: code, partial: fragment, definite: true })
    else out.push({ kind: outcome.phase === 'plan' ? 'ORACLE_PLAN' : 'ORACLE_TYPE', object: `${code}: ${message}`.slice(0, 160), detail, sqlstate: code, partial: fragment, definite: true })
    return out
  }
}

/** Whether the analyzer already named what the server's first error complains of. PostgreSQL quotes a relation, a type and an alias, but not a column or a function. */
function explainedByAnalysis(message: string, analysis: Analysis): boolean {
  const column = /^column (?:"?([\w$]+)"?\.)?"?([\w$]+)"?(?: of relation "[^"]+")? does not exist/.exec(message)
  if (column) {
    const name = column[2]
    return (
      analysis.findings.some((finding) => (finding.kind === 'COLUMN_ABSENT' || finding.kind === 'ALIAS_UNRESOLVED') && finding.column === name) ||
      Object.values(analysis.expectedShape).some((columns) => columns.includes(name)) ||
      analysis.findings.some((finding) => finding.kind === 'RELATION_ABSENT')
    )
  }
  const relation = /^relation "([^"]+)" does not exist/.exec(message)
  if (relation) return analysis.findings.some((finding) => finding.kind === 'RELATION_ABSENT' && (finding.object === relation[1] || finding.object.endsWith(`.${relation[1]}`)))
  const fn = /^function ([\w$.]+)\(/.exec(message)
  if (fn) return analysis.findings.some((finding) => (finding.kind === 'FUNCTION_ABSENT' || finding.kind === 'FUNCTION_ARITY') && finding.object.replace(/\/\d+$/, '').split('.').pop() === fn[1].split('.').pop())
  const type = /^type "([^"]+)" does not exist/.exec(message)
  if (type) return analysis.findings.some((finding) => finding.kind === 'TYPE_ABSENT' && finding.object.split('.').pop() === type[1].split('.').pop())
  const alias = /^missing FROM-clause entry for table "([^"]+)"/.exec(message)
  if (alias) return analysis.findings.some((finding) => finding.kind === 'ALIAS_UNRESOLVED' && finding.relation === alias[1])
  return false
}

function dedupeFindings(findings: JudgedFinding[]): JudgedFinding[] {
  const seen = new Set<string>()
  return findings.filter((finding) => {
    const key = `${finding.kind}|${finding.object}|${finding.clause ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mergeAnalyses(left: Analysis, right: Analysis): Analysis {
  return {
    statementKind: left.statementKind,
    findings: [...left.findings, ...right.findings],
    relations: [...new Set([...left.relations, ...right.relations])],
    expectedShape: { ...left.expectedShape, ...right.expectedShape },
    writes: [...left.writes, ...right.writes],
    gucReads: [...new Set([...left.gucReads, ...right.gucReads])],
    gucWrites: [...new Set([...left.gucWrites, ...right.gucWrites])],
    parameters: Math.max(left.parameters, right.parameters),
  }
}

export { HOLE }
