/**
 * The mismatch census (UE-CONV-H-013): every statement the application writes, judged against the physical database.
 *
 * The other convergence measurements prove that the declarations, the models and the database agree with one another. None of them covers the places
 * where the application names the database in its own words: a `sql` template, a `client.query` string, a seeder. A module written against a design the
 * database never received fails on every call, silently when its caller catches the error. This reads every such place (sites.ts), enumerates every
 * relation, column, function and type it names that does not exist, every conflict target no unique index backs and every INSERT that leaves out a column
 * nothing fills (analyze.ts), has PostgreSQL itself confirm (judge.ts: PREPARE and a generic-plan EXPLAIN, nothing executes), and says why each absent
 * object is absent (classify.ts). It reports how much it could not judge, and why, so the measurement states its own coverage.
 *
 * Read-only against a database built as the application builds it (Django migrate, then the platform bootstrap). Everything runs in a rolled-back transaction.
 *
 * Usage (from apps/union-eyes):
 *   NODE_OPTIONS=--max-old-space-size=8192 DATABASE_URL=... npx tsx scripts/runtime/mismatch-census.ts [--write=<json>] [--markdown=<md>] [--sites=<cache>] [--write-sites=<cache>] [--quiet]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { loadCatalog, type Catalog } from '../lib/sql-census/catalog'
import { Classifier, type Classification } from '../lib/sql-census/classify'
import { Judge, type JudgedFinding, type SiteJudgment, type Verdict } from '../lib/sql-census/judge'
import { computeLiveness } from '../lib/sql-census/liveness'
import { createAppProgram, extractSites, type SiteOrigin, type SqlSite } from '../lib/sql-census/sites'

export type Reach = 'app' | 'runs' | 'none'

export interface FindingSite {
  id: string
  file: string
  line: number
  origin: SiteOrigin
  reach: Reach
  verdict: Verdict
  definite: boolean
  partial: boolean
  executor: string | null
}

export interface FindingGroup {
  kind: string
  object: string
  relation?: string
  column?: string
  detail?: string
  sites: FindingSite[]
  /** For an absent relation: the columns every statement together asks of it. */
  expectedShape?: string[]
  classification?: Classification
  /** The best reach among its sites: `app` beats `runs` beats `none`. */
  reach: Reach
  /**
   * `informational` when every site is a native test: those run in CI against states they set up themselves (an older migration, a temporary table, a
   * statement that is meant to be refused), so a mismatch there is not a defect, and a real one fails CI.
   */
  scope: 'actionable' | 'informational'
}

export interface CensusReport {
  database: string
  coverage: {
    files: number
    sites: number
    verdicts: Record<string, number>
    byOrigin: Record<string, Record<string, number>>
    judged: number
    unresolved: number
    unresolvedReasons: Array<{ reason: string; count: number }>
    skipped: Record<string, number>
  }
  analyzer: { gaps: number; falsePositives: number }
  findings: FindingGroup[]
  /** Values spliced into SQL text (not bound): where an injection could enter. */
  interpolated: Array<{ file: string; line: number; expressions: string[] }>
  unresolved: Array<{ file: string; line: number; origin: SiteOrigin; reason: string }>
  sessionSettings: { reads: Record<string, string[]>; writes: Record<string, string[]> }
}

const JUDGED: ReadonlySet<Verdict> = new Set(['CLEAN', 'FINDINGS', 'FRAGMENT_CLEAN', 'FRAGMENT_FINDINGS', 'PARTIAL_CLEAN', 'PARTIAL_FINDINGS'])
const REACH_RANK: Record<Reach, number> = { app: 2, runs: 1, none: 0 }

/** The declarations the entry points reach (liveness.ts), as the lists the extraction cache stores. */
export interface LiveSets {
  live: ReadonlySet<string>
  app: ReadonlySet<string>
}

/** `app`: a route, page, middleware or server action reaches the declaration. `runs`: something else that executes does (a script, a worker, a native test). `none`: nothing does. */
export function reachOf(site: SqlSite, sets: LiveSets): Reach {
  if (site.origin === 'native-test' || site.origin === 'e2e') return 'runs'
  if (sets.app.has(site.declaration)) return 'app'
  return sets.live.has(site.declaration) ? 'runs' : 'none'
}

export function buildReport(
  database: string,
  extraction: { files: number; skipped: Record<string, number> },
  judgments: SiteJudgment[],
  reach: LiveSets,
  classifier: Classifier,
): CensusReport {
  const verdicts: Record<string, number> = {}
  const byOrigin: Record<string, Record<string, number>> = {}
  for (const judgment of judgments) {
    verdicts[judgment.verdict] = (verdicts[judgment.verdict] ?? 0) + 1
    const origin = (byOrigin[judgment.site.origin] ??= {})
    origin[judgment.verdict] = (origin[judgment.verdict] ?? 0) + 1
  }

  const groups = new Map<string, FindingGroup>()
  const expected = new Map<string, Set<string>>()
  let gaps = 0
  let falsePositives = 0
  for (const judgment of judgments) {
    for (const [relation, columns] of Object.entries(judgment.expectedShape)) {
      const set = expected.get(relation) ?? new Set<string>()
      columns.forEach((column) => set.add(column))
      expected.set(relation, set)
    }
    for (const finding of judgment.findings) {
      if (finding.kind === 'ANALYZER_GAP') gaps += 1
      if (finding.kind === 'ANALYZER_FALSE_POSITIVE') falsePositives += 1
      const key = `${finding.kind}|${finding.object}`
      const group = groups.get(key) ?? { kind: finding.kind, object: finding.object, relation: finding.relation, column: finding.column, detail: finding.detail, sites: [], reach: 'none' as Reach, scope: 'actionable' as const }
      const siteReach = reachOf(judgment.site, reach)
      group.sites.push({ id: judgment.site.id, file: judgment.site.file, line: judgment.site.line, origin: judgment.site.origin, reach: siteReach, verdict: judgment.verdict, definite: finding.definite, partial: finding.partial, executor: judgment.site.executor })
      if (REACH_RANK[siteReach] > REACH_RANK[group.reach]) group.reach = siteReach
      groups.set(key, group)
    }
  }
  for (const group of groups.values()) {
    group.scope = group.sites.every((site) => site.origin === 'native-test') ? 'informational' : 'actionable'
    if (group.kind === 'RELATION_ABSENT') group.expectedShape = [...(expected.get(group.object) ?? [])].sort()
    group.classification = classifier.classify({ kind: group.kind as JudgedFinding['kind'], object: group.object, relation: group.relation, column: group.column, partial: false, definite: true })
  }

  const reasons = new Map<string, number>()
  const unresolved: CensusReport['unresolved'] = []
  for (const judgment of judgments) {
    if (judgment.verdict !== 'UNRESOLVED') continue
    const reason = (judgment.note ?? 'unknown').replace(/__hole__/g, '').replace(/\b(?:dynamic|call|expression|substitution|sql|interpolated):[^,;]*/g, (match) => match.split(':')[0] + ':…').slice(0, 90)
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    unresolved.push({ file: judgment.site.file, line: judgment.site.line, origin: judgment.site.origin, reason: judgment.note ?? 'unknown' })
  }

  const interpolated = judgments.filter((judgment) => judgment.site.interpolated.length).map((judgment) => ({ file: judgment.site.file, line: judgment.site.line, expressions: judgment.site.interpolated }))
  const reads: Record<string, string[]> = {}
  const writes: Record<string, string[]> = {}
  for (const judgment of judgments) {
    for (const name of judgment.gucReads) (reads[name] ??= []).push(`${judgment.site.file}:${judgment.site.line}`)
    for (const name of judgment.gucWrites) (writes[name] ??= []).push(`${judgment.site.file}:${judgment.site.line}`)
  }

  const judged = judgments.filter((judgment) => JUDGED.has(judgment.verdict)).length
  return {
    database,
    coverage: {
      files: extraction.files,
      sites: judgments.length,
      verdicts,
      byOrigin,
      judged,
      unresolved: verdicts.UNRESOLVED ?? 0,
      unresolvedReasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      skipped: extraction.skipped,
    },
    analyzer: { gaps, falsePositives },
    findings: [...groups.values()].sort((a, b) => REACH_RANK[b.reach] - REACH_RANK[a.reach] || a.kind.localeCompare(b.kind) || a.object.localeCompare(b.object)),
    interpolated,
    unresolved,
    sessionSettings: { reads, writes },
  }
}

export function renderMarkdown(report: CensusReport): string {
  const lines: string[] = []
  lines.push(`# Mismatch census`, '')
  lines.push(`Database \`${report.database}\`. ${report.coverage.files} files, ${report.coverage.sites} statement sites.`, '')
  lines.push('## Coverage', '', '| Verdict | Sites |', '|---|---:|')
  for (const [verdict, count] of Object.entries(report.coverage.verdicts).sort((a, b) => b[1] - a[1])) lines.push(`| ${verdict} | ${count} |`)
  lines.push('', `Judged ${report.coverage.judged} of ${report.coverage.sites}; unresolved ${report.coverage.unresolved}. Analyzer self-check: ${report.analyzer.gaps} gap(s), ${report.analyzer.falsePositives} false positive(s).`, '')
  const byKind = new Map<string, number>()
  for (const group of report.findings) byKind.set(group.kind, (byKind.get(group.kind) ?? 0) + 1)
  lines.push('## Findings by kind', '', '| Kind | Objects |', '|---|---:|')
  for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) lines.push(`| ${kind} | ${count} |`)
  lines.push('', '## Findings', '')
  for (const group of report.findings) {
    const where = group.sites.slice(0, 4).map((site) => `${site.file}:${site.line}${site.definite ? '' : ' (branch)'}`).join(', ')
    const cause = group.classification ? ` [${group.classification.cause}${group.classification.candidates ? ` → ${group.classification.candidates.join(', ')}` : ''}]` : ''
    lines.push(`- **${group.kind}** \`${group.object}\` (${group.reach}, ${group.sites.length} site${group.sites.length === 1 ? '' : 's'})${cause}: ${where}${group.sites.length > 4 ? ', …' : ''}`)
    if (group.expectedShape?.length) lines.push(`  - the code expects columns: ${group.expectedShape.join(', ')}`)
  }
  return `${lines.join('\n')}\n`
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL must name a database built as the application builds it (Django migrate, then the platform bootstrap).')
  const appRoot = process.cwd()
  const started = Date.now()
  const log = (message: string): void => {
    if (!args.includes('--quiet')) console.error(`[${Math.round((Date.now() - started) / 1000)}s] ${message}`)
  }

  let extraction: { files: number; sites: SqlSite[]; skipped: Record<string, number>; liveness: { live: string[]; app: string[] } }
  const cache = option('sites')
  if (cache) {
    extraction = JSON.parse(readFileSync(cache, 'utf8'))
    log(`loaded ${extraction.sites.length} sites from ${cache}`)
  } else {
    log('reading the program')
    const program = createAppProgram(appRoot)
    log('extracting statements')
    const extracted = extractSites(program, appRoot)
    log(`${extracted.sites.length} sites in ${extracted.files} files; resolving who calls what`)
    const liveness = computeLiveness(program, appRoot)
    log(`${liveness.declarations} declarations, ${liveness.edges} references, ${liveness.live.size} live`)
    extraction = { ...extracted, liveness: { live: [...liveness.live], app: [...liveness.app] } }
    const write = option('write-sites')
    if (write) writeFileSync(write, JSON.stringify(extraction))
  }

  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const catalog: Catalog = await loadCatalog(client)
    log(`catalog: ${catalog.relations.size} relations, ${[...catalog.functions.values()].flat().length} functions`)
    const judge = new Judge(client, catalog)
    const judgments: SiteJudgment[] = []
    await judge.begin()
    let done = 0
    for (const site of extraction.sites) {
      judgments.push(await judge.judge(site))
      done += 1
      if (done % 500 === 0) log(`judged ${done}/${extraction.sites.length}`)
    }
    await judge.end()
    const reach: LiveSets = { live: new Set(extraction.liveness.live), app: new Set(extraction.liveness.app) }
    const report = buildReport(new URL(url).pathname.replace(/^\//, ''), extraction, judgments, reach, new Classifier(appRoot, catalog))
    const out = option('write')
    if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`)
    const judgmentsOut = option('write-judgments')
    if (judgmentsOut) writeFileSync(judgmentsOut, JSON.stringify(judgments.map((judgment) => ({ id: judgment.site.id, file: judgment.site.file, line: judgment.site.line, origin: judgment.site.origin, form: judgment.site.form, executor: judgment.site.executor, context: judgment.site.context, chain: judgment.site.chainTables, verdict: judgment.verdict, note: judgment.note, snippet: judgment.snippet, variants: judgment.site.variants.length, findings: judgment.findings, shape: judgment.expectedShape }))))
    const markdown = option('markdown')
    if (markdown) writeFileSync(markdown, renderMarkdown(report))
    if (args.includes('--json')) console.log(JSON.stringify(report, null, 2))
    else {
      console.log(renderMarkdown(report).split('\n').slice(0, 60).join('\n'))
      console.log(`\n${report.findings.length} finding group(s). Full report: ${out ?? '(use --write=<file>)'}`)
    }
  } finally {
    await client.end()
  }
}

if (require.main === module || process.argv[1]?.endsWith('mismatch-census.ts')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

export { path }
