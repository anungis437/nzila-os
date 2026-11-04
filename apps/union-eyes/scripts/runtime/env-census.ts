/**
 * The environment census (UE-CONV-H-024): every environment variable Union Eyes reads, held against the registry, the deployment and `.env.example`.
 *
 * The code-to-database census proves the SQL is valid and the frontend censuses prove every screen reaches something real. This proves the other seam a
 * deployment can fail at: a variable the code reads that nobody declared (so nobody provisions it, documents it or checks it), a variable declared that
 * nothing reads, a secret the deployment never supplies, an example file that has drifted. It reads the application's production code and the workspace
 * packages that code loads as syntax (scripts/lib/env-census/reads.ts), the Django backend's settings, the deployment files and `.env.example`. Read-only, no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/env-census.ts [--write-example] [--write=<json>] [--markdown=<md>] [--names] [--reach] [--strict] [--quiet]
 * `pnpm census:env` runs it with --strict: it fails when a kind of finding is above its ceiling (scripts/lib/env-census/ceiling.ts: zero for everything that is code,
 * and the owner's named deferral for the keys provisioned after stabilization). `--reach` also proves, over the whole program, which reads nothing can reach (several GB, minutes).
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { ENV_PATTERNS, ENV_REGISTRY } from '../../lib/config/env-registry'
import { collectReads, type Collected, type SourceText } from '../lib/env-census/collect'
import { overCeiling } from '../lib/env-census/ceiling'
import { checkDeadModules, isDeadModule } from '../lib/env-census/dead'
import { isDjangoSource, scanPythonEnv } from '../lib/env-census/django'
import { generateExample } from '../lib/env-census/example'
import { countBy, judge, type EnvFinding, type FindingKind } from '../lib/env-census/judge'
import { parseBicep, parseDockerfile, parseWorkflow } from '../lib/env-census/provision'
import { appSourceFiles, packageClosure, posix } from '../lib/env-census/scope'
import { validatorKeys } from '../lib/env-census/validator'
import { computeLiveness, declarationKeyOf } from '../lib/sql-census/liveness'
import { createAppProgram } from '../lib/sql-census/sites'

export const APP_ROOT = path.resolve(__dirname, '..', '..')
export const REPO_ROOT = path.resolve(APP_ROOT, '..', '..')

const BICEP = 'infrastructure/bicep/ue-v2/modules/apps.bicep'
const WORKFLOW = '.github/workflows/deploy-union-eyes.yml'
const DOCKERFILE = 'Dockerfile'
const EXAMPLE = '.env.example'
const VALIDATOR = 'lib/config/env-validation.ts'

/** Files whose reads only validate, probe or declare variables: a variable read nowhere else is validated and never used. */
export const CHECK_FILES: ReadonlySet<string> = new Set(['lib/config/env-validation.ts', 'lib/runtime/fail-closed.ts', 'lib/config/env-readiness.ts', 'app/api/ready/route.ts', 'app/api/health/route.ts', 'lib/pilot-admin-operational.ts', 'instrumentation.ts'])
export const CHECK_HELPERS: ReadonlySet<string> = new Set(['probeSecretPresence'])

export interface EnvCensusReport {
  files: number
  packages: string[]
  packageFiles: number
  names: number
  djangoNames: number
  helpers: number
  wholeUses: number
  collected: Collected
  findings: EnvFinding[]
  counts: Record<FindingKind, number>
  exampleText: string
  expectedExample: string
}

const readRepo = (relative: string): string | null => {
  const full = path.join(REPO_ROOT, relative)
  return existsSync(full) ? readFileSync(full, 'utf8') : null
}

/** A path as the registry writes it: relative to the application (lib/..., app/...) or to the repository (packages/...). */
const readProof = (relative: string): string | null => {
  const full = path.join(APP_ROOT, relative)
  return existsSync(full) ? readFileSync(full, 'utf8') : readRepo(relative)
}

function djangoSources(): SourceText[] {
  const base = path.join(APP_ROOT, 'backend')
  const out: SourceText[] = []
  if (!existsSync(base)) return out
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) {
        if (name !== 'node_modules' && name !== '.venv' && name !== 'venv') walk(full)
      } else {
        const relative = posix(path.relative(APP_ROOT, full))
        if (isDjangoSource(relative)) out.push({ file: relative, text: readFileSync(full, 'utf8') })
      }
    }
  }
  walk(base)
  return out
}

export function runCensus(): EnvCensusReport {
  const appFiles = appSourceFiles(APP_ROOT)
  const everything = appFiles.map((file) => ({ file, text: readFileSync(path.join(APP_ROOT, file), 'utf8') }))
  // Modules nothing runs are not configuration the application has (scripts/lib/env-census/dead.ts).
  const app = everything.filter((source) => !isDeadModule(source.file))
  const closure = packageClosure(REPO_ROOT, app)
  const collected = collectReads([...app, ...closure.sources])

  const djangoReads = new Set<string>()
  for (const source of djangoSources()) {
    const facts = scanPythonEnv(source.text)
    for (const site of facts.reads) djangoReads.add(site.name)
    for (const site of facts.unresolved) collected.unresolved.push({ file: source.file, ...site })
  }
  const exampleText = readFileSync(path.join(APP_ROOT, EXAMPLE), 'utf8')
  const findings = judge({
    registry: ENV_REGISTRY,
    patterns: ENV_PATTERNS,
    collected,
    checkFiles: CHECK_FILES,
    checkHelpers: CHECK_HELPERS,
    djangoReads,
    exampleText,
    validatorKeys: new Set(validatorKeys(readFileSync(path.join(APP_ROOT, VALIDATOR), 'utf8'))),
    bicep: parseBicep(readRepo(BICEP) ?? ''),
    workflow: parseWorkflow(readRepo(WORKFLOW) ?? ''),
    dockerfile: parseDockerfile(readRepo(DOCKERFILE) ?? ''),
    fileText: readProof,
  })
  for (const dead of checkDeadModules(everything)) findings.push(dead)
  return {
    files: app.length,
    packages: closure.packages,
    packageFiles: closure.sources.length,
    names: collected.reads.size,
    djangoNames: djangoReads.size,
    helpers: collected.helpers.length,
    wholeUses: collected.whole.length,
    collected,
    findings,
    counts: countBy(findings),
    exampleText,
    expectedExample: generateExample(ENV_REGISTRY),
  }
}

/**
 * The proof behind DEAD_MODULES, over the whole program (this type-checks the application: minutes, not seconds, and several GB). For every top-level
 * declaration it asks whether a route, a page, a layout, middleware, instrumentation, a server action or a script reaches it, and reports a read that nothing
 * reaches (outside the registered modules), and a registered module that has a declaration something does reach.
 */
export function reachFindings(report: EnvCensusReport): EnvFinding[] {
  const program = createAppProgram(APP_ROOT)
  const liveness = computeLiveness(program, APP_ROOT)
  const prefix = `${APP_ROOT.replace(/\\/g, '/')}/`
  const sources = new Map<string, ts.SourceFile>()
  for (const source of program.getSourceFiles()) {
    const name = source.fileName.replace(/\\/g, '/')
    if (name.startsWith(prefix) && !name.includes('/node_modules/')) sources.set(name.slice(prefix.length), source)
  }
  const statementAt = (source: ts.SourceFile, line: number): ts.Statement | undefined => {
    let position = source.getPositionOfLineAndCharacter(line - 1, 0)
    while (position < source.text.length && /\s/.test(source.text[position])) position += 1
    return source.statements.find((statement) => statement.getStart(source) <= position && statement.getEnd() > position)
  }
  // Build, test and tooling configuration runs outside the application server.
  const configuration = /^(?:[^/]+\.config\.(?:ts|mjs|js)|next\.config\.ts|db\/test-db\.ts)$/
  const findings: EnvFinding[] = []
  for (const [name, sites] of report.collected.reads) {
    const own = sites.filter((site) => !site.file.startsWith('packages/'))
    if (own.length === 0 || own.length < sites.length) continue
    const reached = own.some((site) => {
      if (configuration.test(site.file)) return true
      const source = sources.get(site.file)
      const statement = source ? statementAt(source, site.line) : undefined
      return !statement || liveness.live.has(declarationKeyOf(statement, site.file))
    })
    if (!reached) findings.push({ kind: 'DEAD_READ', name, detail: 'read only by declarations that no route, page, middleware, server action or script reaches: delete the code, or register the module in DEAD_MODULES with what blocks deleting it', sites: own })
  }
  for (const source of sources.values()) {
    const relative = posix(path.relative(APP_ROOT, source.fileName))
    if (!isDeadModule(relative)) continue
    for (const statement of source.statements) {
      if (liveness.live.has(declarationKeyOf(statement, relative))) findings.push({ kind: 'DEAD_MODULE_IMPORTED', name: relative, detail: 'has a declaration a route, page or script reaches: it is not dead; remove it from DEAD_MODULES' })
    }
  }
  return findings
}

export function toMarkdown(report: EnvCensusReport): string {
  const lines = [
    '# Environment census (UE-CONV-H-024)',
    '',
    `${report.files} application files and ${report.packageFiles} files of ${report.packages.length} workspace packages read; ${report.names} variables read by the TypeScript code (${report.helpers} read helpers resolved), ${report.djangoNames} by the Django backend; ${ENV_REGISTRY.length} registry entries.`,
    '',
    ...Object.entries(report.counts).map(([kind, count]) => `- ${kind}: ${count}`),
    '',
  ]
  for (const finding of report.findings) {
    lines.push(`- **${finding.kind}** \`${finding.name}\`: ${finding.detail}`)
    for (const site of (finding.sites ?? []).slice(0, 4)) lines.push(`  - ${site.file}:${site.line} (${site.via})`)
  }
  return `${lines.join('\n')}\n`
}

function main(): void {
  const args = process.argv.slice(2)
  const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  if (args.includes('--write-example')) {
    writeFileSync(path.join(APP_ROOT, EXAMPLE), generateExample(ENV_REGISTRY))
    console.log(`wrote ${EXAMPLE} from ${ENV_REGISTRY.length} registry entries`)
  }
  const report = runCensus()
  if (args.includes('--reach')) {
    for (const finding of reachFindings(report)) report.findings.push(finding)
    report.counts = countBy(report.findings)
  }
  const json = option('write')
  if (json) writeFileSync(json, `${JSON.stringify({ ...report, collected: undefined, exampleText: undefined, expectedExample: undefined }, null, 2)}\n`)
  const markdown = option('markdown')
  if (markdown) writeFileSync(markdown, toMarkdown(report))
  if (!args.includes('--quiet')) {
    console.log(`${report.files} application files + ${report.packageFiles} package files (${report.packages.length} packages): ${report.names} variables read (${report.helpers} read helpers, ${report.wholeUses} whole-environment uses), ${report.djangoNames} read by Django; ${ENV_REGISTRY.length} registry entries`)
    for (const [kind, count] of Object.entries(report.counts)) console.log(`  ${kind.padEnd(22)} ${String(count).padStart(4)}`)
    if (args.includes('--names')) for (const [name, sites] of [...report.collected.reads].sort(([a], [b]) => a.localeCompare(b))) console.log(`${name}\t${sites.length}\t${sites.slice(0, 3).map((site) => `${site.file}:${site.line}(${site.via})`).join(' | ')}`)
    for (const finding of report.findings) {
      const first = finding.sites?.[0]
      console.log(`  ${finding.kind.padEnd(20)} ${finding.name}  ${finding.detail}${first ? `  [${first.file}:${first.line}${(finding.sites?.length ?? 0) > 1 ? ` +${(finding.sites?.length ?? 0) - 1}` : ''}]` : ''}`)
    }
  }
  if (args.includes('--strict')) {
    const over = overCeiling(report)
    if (over.length > 0) {
      console.error(`\nThe environment census is over its ceiling (scripts/lib/env-census/ceiling.ts):\n${over.join('\n')}`)
      process.exit(1)
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
