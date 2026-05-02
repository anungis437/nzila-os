import fs from 'node:fs'
import path from 'node:path'

type GateStep = {
  name: string
  passed: boolean
  exitCode: number
}

type GateResults = {
  timestamp: string
  steps: GateStep[]
  failures: string[]
}

type Summary = {
  generatedAt: string
  userStoryCoveragePercent: number
  rbacCoveragePercent: number
  apiCoverage: number
  e2eCoverage: number
  auditCoverage: number
  pipelineHealth: 'healthy' | 'degraded' | 'failed'
  failures: string[]
  decision: 'GO' | 'NO-GO'
}

function parseArg(name: string): string | undefined {
  const prefixed = `--${name}=`
  const matched = process.argv.find((arg) => arg.startsWith(prefixed))
  return matched ? matched.slice(prefixed.length) : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function readIfExists(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
}

function parseStoryCoverage(matrixPath: string): {
  total: number
  testedYes: number
  testedNo: number
  criticalUnknown: number
} {
  const content = readIfExists(matrixPath)
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .filter((line) => !line.includes('---'))

  const body = lines.slice(1)
  let total = 0
  let testedYes = 0
  let testedNo = 0
  let criticalUnknown = 0

  for (const line of body) {
    const cols = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)

    if (cols.length < 13) continue
    total += 1
    const tested = cols[11]?.toLowerCase()
    if (tested === 'yes') testedYes += 1

    if (tested === 'no') testedNo += 1

    const expectedDecisionRecord = cols[8]?.toLowerCase()
    const expectedNarProof = cols[9]?.toLowerCase()
    if (expectedDecisionRecord === 'unknown' || expectedNarProof === 'unknown') {
      criticalUnknown += 1
    }
  }

  return { total, testedYes, testedNo, criticalUnknown }
}

function safePercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 100)
}

function countFiles(dirPath: string, suffix: string): number {
  if (!fs.existsSync(dirPath)) return 0
  const walk = (dir: string): string[] => {
    const out: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...walk(full))
      else out.push(full)
    }
    return out
  }
  return walk(dirPath).filter((file) => file.endsWith(suffix)).length
}

function main(): void {
  const repoRoot = process.cwd()
  const resultsPath = parseArg('results')
  const enforce = hasFlag('enforce')

  const rbacMapPath = path.join(repoRoot, 'docs', 'union-eyes', 'qa', 'rbac-reality-map.md')
  const matrixPath = path.join(repoRoot, 'docs', 'union-eyes', 'qa', 'user-story-coverage-matrix.md')
  const apiTestsDir = path.join(repoRoot, 'apps', 'union-eyes', 'tests', 'api')
  const e2eTestsDir = path.join(repoRoot, 'apps', 'union-eyes', 'tests', 'e2e')

  const failures: string[] = []

  const rbacContent = readIfExists(rbacMapPath)
  if (!rbacContent) failures.push('Missing RBAC reality map')
  const unknownCount = (rbacContent.match(/\bUNKNOWN\b/g) ?? []).length
  const notImplementedCount = (rbacContent.match(/\bNOT_IMPLEMENTED\b/g) ?? []).length

  const storyCoverage = parseStoryCoverage(matrixPath)
  if (!storyCoverage.total) failures.push('Coverage matrix is missing or empty')

  const apiSpecs = countFiles(apiTestsDir, '.spec.ts')
  const e2eSpecs = countFiles(e2eTestsDir, '.spec.ts')

  if (apiSpecs === 0) failures.push('No API QA specs found')
  if (e2eSpecs === 0) failures.push('No E2E QA specs found')

  let gateResults: GateResults | null = null
  if (resultsPath && fs.existsSync(resultsPath)) {
    gateResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as GateResults
    if (gateResults.failures.length > 0) {
      failures.push(...gateResults.failures)
    }
  }

  if (unknownCount > 0) failures.push(`RBAC map contains UNKNOWN entries: ${unknownCount}`)
  if (storyCoverage.criticalUnknown > 0) {
    failures.push(`Coverage matrix has unknown critical expectations: ${storyCoverage.criticalUnknown}`)
  }

  const summary: Summary = {
    generatedAt: new Date().toISOString(),
    userStoryCoveragePercent: safePercent(storyCoverage.testedYes, storyCoverage.total),
    rbacCoveragePercent: unknownCount === 0 ? 100 : Math.max(0, 100 - unknownCount * 10),
    apiCoverage: apiSpecs,
    e2eCoverage: e2eSpecs,
    auditCoverage: notImplementedCount === 0 ? 100 : 0,
    pipelineHealth:
      gateResults && gateResults.steps.some((s) => s.name.includes('Pipeline') && !s.passed)
        ? 'failed'
        : 'healthy',
    failures,
    decision: failures.length === 0 ? 'GO' : 'NO-GO',
  }

  const outDir = path.join(repoRoot, 'artifacts', 'ue-qa')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'qa-report.json')
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2))

  console.log('UE QA REPORT')
  console.log(JSON.stringify(summary, null, 2))

  if (enforce && summary.decision !== 'GO') {
    process.exit(1)
  }
}

main()
