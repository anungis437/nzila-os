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

type ReadinessStatus = 'GO_FOR_UX_TESTING' | 'GO_FOR_PILOT' | 'GO_FOR_PRODUCTION' | 'NO_GO'
type ReadinessCategory = 'ux_ready' | 'pilot_ready' | 'production_ready'
type TestedState = 'yes' | 'no' | 'partial'

type StoryRow = {
  storyId: string
  readinessCategory: ReadinessCategory
  expectedDecisionRecord: string
  expectedNarAuditBehavior: string
  testReference: string
  tested: TestedState
  blockerLevel: 'none' | 'visibility' | 'ux_blocker' | 'pilot_blocker' | 'production_blocker'
}

type CoverageStats = {
  total: number
  testedYes: number
  testedPartial: number
  testedNo: number
  percent: number
}

type Summary = {
  generatedAt: string
  target: 'ux' | 'pilot' | 'production'
  readinessStatus: ReadinessStatus
  decision: 'GO' | 'NO-GO'
  userStoryCoveragePercent: number
  uxStoryCoveragePercent: number
  pilotStoryCoveragePercent: number
  productionStoryCoveragePercent: number
  rbacCoveragePercent: number
  auditCoveragePercent: number
  e2eCoveragePercent: number
  aiUxCoveragePercent: number
  aiAuditCoveragePercent: number
  aiBannerPresent: boolean
  aiUsageViewerPresent: boolean
  externalTesterContainmentStatus: 'pass' | 'fail' | 'warning'
  crossOrgLeakStatus: 'pass' | 'fail' | 'unknown'
  narVerificationStatus: 'pass' | 'fail' | 'unknown'
  pipelineHealthStatus: 'healthy' | 'degraded' | 'failed'
  humanReview: {
    requiredForPilot: true
    requiredForProduction: true
    approver: string | null
    approvalDate: string | null
    notes: string | null
  }
  blockers: string[]
  warnings: string[]
  nextActions: string[]
}

function parseArg(name: string): string | undefined {
  const prefixed = `--${name}=`
  const matched = process.argv.find((arg) => arg.startsWith(prefixed))
  return matched ? matched.slice(prefixed.length) : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function safePercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 100)
}

function parseMarkdownTable(content: string): Array<Record<string, string>> {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .map((line) => line.trim())

  if (lines.length < 3) return []

  const headerLine = lines.find((line) => line.toLowerCase().includes('| story_id |'))
  if (!headerLine) return []

  const headerIndex = lines.indexOf(headerLine)
  if (headerIndex < 0 || headerIndex + 2 > lines.length) return []

  const headers = headerLine
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean)

  const bodyLines = lines.slice(headerIndex + 2)
  const rows: Array<Record<string, string>> = []

  for (const line of bodyLines) {
    const cols = line
      .split('|')
      .map((v) => v.trim())
      .filter(Boolean)

    if (cols.length !== headers.length) continue

    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? ''
    })
    rows.push(row)
  }

  return rows
}

function parseStoryRows(content: string): StoryRow[] {
  const tableRows = parseMarkdownTable(content)
  return tableRows
    .map((row) => {
      const readinessCategory = (row.readiness_category ?? '').toLowerCase() as ReadinessCategory
      const tested = (row.tested ?? '').toLowerCase() as TestedState
      const blockerLevel = (row.blocker_level ?? '').toLowerCase() as StoryRow['blockerLevel']

      if (!['ux_ready', 'pilot_ready', 'production_ready'].includes(readinessCategory)) return null
      if (!['yes', 'no', 'partial'].includes(tested)) return null

      return {
        storyId: row.story_id ?? '',
        readinessCategory,
        expectedDecisionRecord: (row.expected_decisionrecord_behavior ?? '').toLowerCase(),
        expectedNarAuditBehavior: (row.expected_nar_audit_behavior ?? '').toLowerCase(),
        testReference: row.test_reference ?? '',
        tested,
        blockerLevel: ['none', 'visibility', 'ux_blocker', 'pilot_blocker', 'production_blocker'].includes(blockerLevel)
          ? blockerLevel
          : 'visibility',
      }
    })
    .filter((row): row is StoryRow => Boolean(row))
}

function coverageForStories(stories: StoryRow[]): CoverageStats {
  const total = stories.length
  const testedYes = stories.filter((story) => story.tested === 'yes').length
  const testedPartial = stories.filter((story) => story.tested === 'partial').length
  const testedNo = stories.filter((story) => story.tested === 'no').length
  return {
    total,
    testedYes,
    testedPartial,
    testedNo,
    percent: safePercent(testedYes, total),
  }
}

function countE2eFlows(e2eDir: string): { total: number; requiredPresent: number; percent: number } {
  if (!fs.existsSync(e2eDir)) return { total: 0, requiredPresent: 0, percent: 0 }

  const required = [
    'member-intake.spec.ts',
    'steward-review.spec.ts',
    'admin-assignment.spec.ts',
    'case-escalation.spec.ts',
    'case-resolution.spec.ts',
    'auditor-readonly.spec.ts',
    'cross-org-block.spec.ts',
    'external-ux-tester.spec.ts',
  ]

  const files = fs.readdirSync(e2eDir)
  const requiredPresent = required.filter((file) => files.includes(file)).length

  return {
    total: required.length,
    requiredPresent,
    percent: safePercent(requiredPresent, required.length),
  }
}

function parseReadinessTarget(): 'ux' | 'pilot' | 'production' {
  const eqTarget = parseArg('target')
  if (eqTarget) {
    const normalized = eqTarget.toLowerCase()
    if (normalized === 'pilot' || normalized === 'production') return normalized
    return 'ux'
  }

  const flagIndex = process.argv.indexOf('--target')
  if (flagIndex >= 0) {
    const next = process.argv[flagIndex + 1]?.toLowerCase()
    if (next === 'pilot' || next === 'production') return next
  }

  return 'ux'
}

function writeMarkdownReport(summary: Summary, outPath: string): void {
  const lines = [
    '# Union Eyes QA Readiness Report',
    '',
    `- Generated: ${summary.generatedAt}`,
    `- Target: ${summary.target}`,
    `- Readiness: ${summary.readinessStatus}`,
    `- Decision: ${summary.decision}`,
    '',
    '## Coverage',
    `- User story coverage: ${summary.userStoryCoveragePercent}%`,
    `- UX story coverage: ${summary.uxStoryCoveragePercent}%`,
    `- Pilot story coverage: ${summary.pilotStoryCoveragePercent}%`,
    `- Production story coverage: ${summary.productionStoryCoveragePercent}%`,
    `- RBAC coverage: ${summary.rbacCoveragePercent}%`,
    `- Audit coverage: ${summary.auditCoveragePercent}%`,
    `- E2E coverage: ${summary.e2eCoveragePercent}%`,
    `- AI UX coverage: ${summary.aiUxCoveragePercent}%`,
    `- AI audit coverage: ${summary.aiAuditCoveragePercent}%`,
    `- AI banner present: ${summary.aiBannerPresent}`,
    `- AI usage viewer present: ${summary.aiUsageViewerPresent}`,
    '',
    '## Status',
    `- External tester containment: ${summary.externalTesterContainmentStatus}`,
    `- Cross-org leak: ${summary.crossOrgLeakStatus}`,
    `- NAR verification: ${summary.narVerificationStatus}`,
    `- Pipeline health: ${summary.pipelineHealthStatus}`,
    '',
    '## Human Review',
    '- requiredForPilot: true',
    '- requiredForProduction: true',
    `- approver: ${summary.humanReview.approver ?? 'not-recorded'}`,
    `- approvalDate: ${summary.humanReview.approvalDate ?? 'not-recorded'}`,
    `- notes: ${summary.humanReview.notes ?? 'not-recorded'}`,
    '',
    '## Blockers',
    ...(summary.blockers.length > 0 ? summary.blockers.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Warnings',
    ...(summary.warnings.length > 0 ? summary.warnings.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Next Actions',
    ...(summary.nextActions.length > 0 ? summary.nextActions.map((item) => `- ${item}`) : ['- none']),
    '',
  ]

  fs.writeFileSync(outPath, `${lines.join('\n')}\n`)
}

function determineReadiness(
  uxReady: boolean,
  pilotReady: boolean,
  productionReady: boolean,
  blockers: string[],
): ReadinessStatus {
  if (blockers.length > 0) return 'NO_GO'
  if (productionReady) return 'GO_FOR_PRODUCTION'
  if (pilotReady) return 'GO_FOR_PILOT'
  if (uxReady) return 'GO_FOR_UX_TESTING'
  return 'NO_GO'
}

function statusMeetsTarget(status: ReadinessStatus, target: 'ux' | 'pilot' | 'production'): boolean {
  if (target === 'ux') {
    return ['GO_FOR_UX_TESTING', 'GO_FOR_PILOT', 'GO_FOR_PRODUCTION'].includes(status)
  }
  if (target === 'pilot') {
    return ['GO_FOR_PILOT', 'GO_FOR_PRODUCTION'].includes(status)
  }
  return status === 'GO_FOR_PRODUCTION'
}

function main(): void {
  const repoRoot = process.cwd()
  const enforce = hasFlag('enforce')
  const target = parseReadinessTarget()
  const requestedResultsPath = parseArg('results')
  const defaultResultsPath = path.join(repoRoot, 'artifacts', 'ue-qa', 'latest-results.json')
  const resultsPath = requestedResultsPath
    ? path.resolve(requestedResultsPath) === path.resolve(defaultResultsPath)
      ? defaultResultsPath
      : defaultResultsPath
    : defaultResultsPath

  const rbacMapPath = path.join(repoRoot, 'docs', 'union-eyes', 'qa', 'rbac-reality-map.md')
  const matrixPath = path.join(repoRoot, 'docs', 'union-eyes', 'qa', 'user-story-coverage-matrix.md')
  const e2eDir = path.join(repoRoot, 'apps', 'union-eyes', 'tests', 'e2e')
  const externalContainmentSpecPath = path.join(
    repoRoot,
    'apps',
    'union-eyes',
    'tests',
    'api',
    'external-tester-containment.spec.ts',
  )

  const blockers: string[] = []
  const warnings: string[] = []

  const gateResults = fs.existsSync(resultsPath)
    ? (JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as GateResults)
    : null
  if (!gateResults) {
    warnings.push('Gate results file missing; report derived from repository state only.')
  }

  if (gateResults?.failures.length) {
    blockers.push(...gateResults.failures.map((failure) => `Execution failure: ${failure}`))
  }

  const rbacContent = fs.existsSync(rbacMapPath) ? fs.readFileSync(rbacMapPath, 'utf8') : ''
  if (!rbacContent) {
    blockers.push('RBAC reality map missing.')
  }

  const rbacUnknownCount = (rbacContent.match(/\bUNKNOWN\b/g) ?? []).length
  const rbacCriticalBlockers = (rbacContent.match(/critical blocker/gi) ?? []).length
  if (rbacUnknownCount > 0) blockers.push(`RBAC map contains UNKNOWN entries: ${rbacUnknownCount}`)
  if (rbacCriticalBlockers > 0) warnings.push('RBAC map declares critical blockers that require human resolution.')

  const matrixContent = fs.existsSync(matrixPath) ? fs.readFileSync(matrixPath, 'utf8') : ''
  const stories = parseStoryRows(matrixContent)
  if (stories.length === 0) {
    blockers.push('User story coverage matrix missing or malformed.')
  }

  const overallCoverage = coverageForStories(stories)
  const uxStories = stories.filter((story) => story.readinessCategory === 'ux_ready')
  const pilotStories = stories.filter((story) => story.readinessCategory === 'pilot_ready')
  const productionStories = stories.filter((story) => story.readinessCategory === 'production_ready')

  const uxCoverage = coverageForStories(uxStories)
  const pilotCoverage = coverageForStories(pilotStories)
  const productionCoverage = coverageForStories(productionStories)

  const crossOrgStory = stories.find((story) => story.storyId === 'NEG-WRONG-ORG-ACCESS')
  const narVerificationStory = stories.find((story) => story.storyId === 'AUDIT-NAR-VERIFY')

  const mutationStories = stories.filter(
    (story) =>
      story.expectedDecisionRecord === 'required' ||
      story.expectedDecisionRecord === 'delegated' ||
      story.expectedNarAuditBehavior === 'required' ||
      story.expectedNarAuditBehavior === 'delegated',
  )

  const mutationStoriesTested = mutationStories.filter((story) => story.tested === 'yes').length
  const auditCoveragePercent = safePercent(mutationStoriesTested, mutationStories.length)

  const missingDecisionExpectation = mutationStories.filter(
    (story) =>
      !['required', 'delegated', 'not_required'].includes(story.expectedDecisionRecord) ||
      !['required', 'delegated', 'not_required'].includes(story.expectedNarAuditBehavior),
  )

  if (missingDecisionExpectation.length > 0) {
    blockers.push(
      `Pilot-critical mutation stories missing DecisionRecord/NAR expectation: ${missingDecisionExpectation
        .map((story) => story.storyId)
        .join(', ')}`,
    )
  }

  const pilotBlockers = stories.filter((story) => story.blockerLevel === 'pilot_blocker')
  const productionBlockers = stories.filter((story) => story.blockerLevel === 'production_blocker')
  const uxBlockers = stories.filter((story) => story.blockerLevel === 'ux_blocker')

  if (uxBlockers.length > 0) {
    blockers.push(`UX blockers present: ${uxBlockers.map((story) => story.storyId).join(', ')}`)
  }
  if (pilotBlockers.length > 0) {
    warnings.push(`Pilot blockers present: ${pilotBlockers.map((story) => story.storyId).join(', ')}`)
  }
  if (productionBlockers.length > 0) {
    warnings.push(`Production blockers present: ${productionBlockers.map((story) => story.storyId).join(', ')}`)
  }

  const e2eCoverage = countE2eFlows(e2eDir)
  if (e2eCoverage.requiredPresent === 0) {
    blockers.push('No required Union Eyes E2E maturity flows found.')
  }

  const aiBannerPresent = fs.existsSync(
    path.join(repoRoot, 'apps', 'union-eyes', 'components', 'ai', 'AIBanner.tsx'),
  )
  const aiUsageViewerPresent = fs.existsSync(
    path.join(repoRoot, 'apps', 'union-eyes', 'app', '[locale]', 'dashboard', 'admin', 'ai-usage', 'page.tsx'),
  )

  const aiStories = stories.filter((story) => story.storyId.startsWith('AI-'))
  const aiUxCoverage = coverageForStories(aiStories)
  const aiUxCoveragePercent = aiStories.length > 0 ? aiUxCoverage.percent : 0

  const aiMutationStories = mutationStories.filter((story) => story.storyId.startsWith('AI-'))
  const aiMutationTested = aiMutationStories.filter((story) => story.tested === 'yes').length
  const aiAuditCoveragePercent =
    aiMutationStories.length > 0 ? safePercent(aiMutationTested, aiMutationStories.length) : 0

  if (!aiBannerPresent) {
    blockers.push('AI disclosure banner component is missing.')
  }
  if (!aiUsageViewerPresent) {
    blockers.push('AI usage audit viewer page is missing.')
  }

  const externalContainmentSpecExists = fs.existsSync(externalContainmentSpecPath)
  if (!externalContainmentSpecExists) {
    blockers.push('External tester containment API test is missing.')
  }

  const pipelineFailed =
    gateResults?.steps.some((step) => step.name.toLowerCase().includes('pipeline') && !step.passed) ?? false
  const narFailed =
    gateResults?.steps.some((step) => step.name.toLowerCase().includes('nar') && !step.passed) ?? false

  const crossOrgLeakStatus: Summary['crossOrgLeakStatus'] = crossOrgStory
    ? crossOrgStory.tested === 'yes'
      ? 'pass'
      : 'fail'
    : 'unknown'

  if (crossOrgLeakStatus !== 'pass') {
    blockers.push('Cross-org leakage protections are not fully verified.')
  }

  const narVerificationStatus: Summary['narVerificationStatus'] = narFailed
    ? 'fail'
    : narVerificationStory?.tested === 'yes'
      ? 'pass'
      : 'unknown'

  if (narVerificationStatus === 'fail') {
    blockers.push('NAR verification path failed during QA execution.')
  }

  const pipelineHealthStatus: Summary['pipelineHealthStatus'] = pipelineFailed ? 'failed' : 'healthy'

  const externalTesterContainmentStatus: Summary['externalTesterContainmentStatus'] = externalContainmentSpecExists
    ? 'pass'
    : 'fail'

  const unauthDeniedStory = stories.find((story) => story.storyId === 'AUTH-UNAUTHENTICATED-ACCESS-DENIED')

  const uxReady =
    rbacUnknownCount === 0 &&
    crossOrgLeakStatus === 'pass' &&
    uxCoverage.percent === 100 &&
    externalTesterContainmentStatus === 'pass' &&
    unauthDeniedStory?.tested === 'yes'

  const pilotReady =
    uxReady &&
    pilotCoverage.percent >= 95 &&
    auditCoveragePercent >= 80 &&
    narVerificationStatus === 'pass' &&
    !stories.some((story) =>
      story.readinessCategory === 'pilot_ready' &&
      (story.expectedDecisionRecord === '' || story.expectedNarAuditBehavior === ''),
    )

  const productionReady =
    pilotReady &&
    productionCoverage.percent === 100 &&
    auditCoveragePercent === 100 &&
    e2eCoverage.percent === 100 &&
    !stories.some((story) => story.tested !== 'yes' && story.readinessCategory === 'production_ready') &&
    !stories.some((story) => story.blockerLevel === 'production_blocker')

  const readinessStatus = determineReadiness(uxReady, pilotReady, productionReady, blockers)

  if (!statusMeetsTarget(readinessStatus, target)) {
    blockers.push(`Requested target '${target}' not met by readiness '${readinessStatus}'.`)
  }

  const summary: Summary = {
    generatedAt: new Date().toISOString(),
    target,
    readinessStatus,
    decision: blockers.length > 0 ? 'NO-GO' : 'GO',
    userStoryCoveragePercent: overallCoverage.percent,
    uxStoryCoveragePercent: uxCoverage.percent,
    pilotStoryCoveragePercent: pilotCoverage.percent,
    productionStoryCoveragePercent: productionCoverage.percent,
    rbacCoveragePercent: rbacUnknownCount === 0 ? 100 : Math.max(0, 100 - rbacUnknownCount * 10),
    auditCoveragePercent,
    e2eCoveragePercent: e2eCoverage.percent,
    aiUxCoveragePercent,
    aiAuditCoveragePercent,
    aiBannerPresent,
    aiUsageViewerPresent,
    externalTesterContainmentStatus,
    crossOrgLeakStatus,
    narVerificationStatus,
    pipelineHealthStatus,
    humanReview: {
      requiredForPilot: true,
      requiredForProduction: true,
      approver: parseArg('approver') ?? null,
      approvalDate: parseArg('approvalDate') ?? null,
      notes: parseArg('approvalNotes') ?? null,
    },
    blockers,
    warnings,
    nextActions: [
      readinessStatus === 'GO_FOR_UX_TESTING'
        ? 'Run pnpm ue:qa:gate -- --target pilot and close all pilot blockers.'
        : 'Maintain evidence freshness and keep deterministic fixtures in sync.',
      'Record human approver evidence before pilot or production promotion.',
      'Review artifacts/ue-qa/readiness-summary.md before release decision.',
    ],
  }

  const outDir = path.join(repoRoot, 'artifacts', 'ue-qa')
  fs.mkdirSync(outDir, { recursive: true })

  const jsonPath = path.join(outDir, 'qa-report.json')
  const markdownPath = path.join(outDir, 'qa-report.md')
  const summaryPath = path.join(outDir, 'readiness-summary.md')

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2))
  writeMarkdownReport(summary, markdownPath)
  writeMarkdownReport(summary, summaryPath)

  console.log('UNION EYES QA REPORT')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Readiness: ${summary.readinessStatus}`)

  if (enforce && blockers.length > 0) {
    process.exit(1)
  }
}

main()
