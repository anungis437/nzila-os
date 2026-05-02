import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { listDecisionTypes } from '../packages/decision-core/src/index'
import { evaluateStrictCoverageFailures } from '../packages/decision-core/src/coverage-gate'

type CriticalRoute = {
  route: string
  decisionType: string
  surface: string
}

type CoverageException = {
  decisionType: string
  reason: string
  expiresOn?: string
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const criticalRoutes: CriticalRoute[] = [
  {
    route: 'apps/control-plane/app/api/control-plane/authority/authorize-workflow/route.ts',
    decisionType: 'platform.workflow.authorized',
    surface: 'control-plane',
  },
  {
    route: 'apps/control-plane/app/api/control-plane/governance/actions/route.ts',
    decisionType: 'platform.governance.action.executed',
    surface: 'control-plane',
  },
  {
    route: 'apps/orchestrator-api/src/routes/execute.ts',
    decisionType: 'platform.workflow.executed',
    surface: 'orchestrator',
  },
  {
    route: 'apps/union-eyes/app/api/cases/intake/route.ts',
    decisionType: 'union.grievance.intake.submitted',
    surface: 'union-eyes',
  },
  {
    route: 'apps/union-eyes/app/api/cases/[caseId]/escalate/route.ts',
    decisionType: 'union.case.escalated',
    surface: 'union-eyes',
  },
  {
    route: 'apps/abr/app/api/abr/incidents/route.ts',
    decisionType: 'faircase.case.classified',
    surface: 'faircase',
  },
  {
    route: 'apps/flow/app/api/quotes/route.ts',
    decisionType: 'flow.quote.created',
    surface: 'flow',
  },
  {
    route: 'apps/zonga/app/api/payouts/route.ts',
    decisionType: 'zonga.payout.approved',
    surface: 'zonga',
  },
  {
    route: 'apps/platform-admin/app/api/admin/org/route.ts',
    decisionType: 'platform.org.entitlement.checked',
    surface: 'platform-admin',
  },
]

const documentedExceptions: CoverageException[] = [
  {
    decisionType: 'flow.vendor.selected',
    reason: 'No mutation route exists for vendor selection in apps/flow as of this phase.',
    expiresOn: '2026-09-30',
  },
  {
    decisionType: 'zonga.rights.validated',
    reason: 'Current rights endpoint is read-only (GET/terms acceptance); no separate validation mutation route is present.',
    expiresOn: '2026-09-30',
  },
]

const strictMode = process.argv.includes('--strict')

function walk(dir: string, accumulator: string[]) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.turbo' || entry === 'dist' || entry === 'coverage') {
      continue
    }

    const resolved = path.join(dir, entry)
    const stats = statSync(resolved)

    if (stats.isDirectory()) {
      walk(resolved, accumulator)
      continue
    }

    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry)) {
      accumulator.push(resolved)
    }
  }
}

function findTestFiles(): string[] {
  const files: string[] = []
  for (const folder of ['apps', 'packages', 'tests', 'tooling']) {
    const resolved = path.join(ROOT, folder)
    if (existsSync(resolved)) {
      walk(resolved, files)
    }
  }
  return files
}

const registeredDecisionTypes = listDecisionTypes()
const registeredSet = new Set(registeredDecisionTypes.map((decision) => decision.type))
const blockDecisions = registeredDecisionTypes.filter((decision) => (decision.enforcementLevel ?? 'block') === 'block')
const exceptionSet = new Set(documentedExceptions.map((entry) => entry.decisionType))
const testFiles = findTestFiles()

const coveredRoutes = criticalRoutes.filter((route) => registeredSet.has(route.decisionType))
const missingRouteRegistrations = criticalRoutes.filter((route) => !registeredSet.has(route.decisionType))
const missingRouteFiles = criticalRoutes.filter((route) => !existsSync(path.join(ROOT, route.route)))
const criticalWithoutRouteMapping = blockDecisions.filter(
  (decision) => !criticalRoutes.some((route) => route.decisionType === decision.type) && !exceptionSet.has(decision.type),
)
const blockWithoutProof = blockDecisions.filter((decision) => decision.proofRequired !== true)

const registeredWithoutTests = registeredDecisionTypes.filter((decision) => {
  return !testFiles.some((file) => readFileSync(file, 'utf8').includes(decision.type))
})

const score = Math.round((coveredRoutes.length / criticalRoutes.length) * 100)

console.log(`Decision coverage score: ${score}% (${coveredRoutes.length}/${criticalRoutes.length} critical routes mapped)`)
console.log('')
console.log('Registered decision types:')
for (const decision of registeredDecisionTypes) {
  console.log(`- ${decision.type} [${decision.domain}]`)
}

console.log('')
if (missingRouteRegistrations.length > 0) {
  console.warn('Critical routes missing decision registration:')
  for (const route of missingRouteRegistrations) {
    console.warn(`- ${route.route} (${route.surface})`)
  }
} else {
  console.log('All inventoried critical routes have a decision registration.')
}

console.log('')
if (registeredWithoutTests.length > 0) {
  console.warn('Registered decisions without tests:')
  for (const decision of registeredWithoutTests) {
    console.warn(`- ${decision.type}`)
  }
} else {
  console.log('Every registered decision type has at least one test reference.')
}

if (missingRouteFiles.length > 0) {
  console.log('')
  console.warn('Inventory entries whose route file was not found:')
  for (const route of missingRouteFiles) {
    console.warn(`- ${route.route}`)
  }
}

console.log('')
if (criticalWithoutRouteMapping.length > 0) {
  console.warn('Registered block-level decisions missing critical route mapping:')
  for (const decision of criticalWithoutRouteMapping) {
    console.warn(`- ${decision.type}`)
  }
}

if (blockWithoutProof.length > 0) {
  console.warn('Block-level decisions missing proofRequired=true:')
  for (const decision of blockWithoutProof) {
    console.warn(`- ${decision.type}`)
  }
}

if (documentedExceptions.length > 0) {
  console.log('Documented temporary exceptions:')
  for (const item of documentedExceptions) {
    const expiry = item.expiresOn ? ` (expires ${item.expiresOn})` : ''
    console.log(`- ${item.decisionType}: ${item.reason}${expiry}`)
  }
  console.log('')
}

if (strictMode) {
  const strictFailures = evaluateStrictCoverageFailures({
    score,
    missingRouteRegistrationsCount: missingRouteRegistrations.length,
    missingRouteFilesCount: missingRouteFiles.length,
    criticalWithoutRouteMappingCount: criticalWithoutRouteMapping.length,
    blockWithoutProofCount: blockWithoutProof.length,
  })

  if (strictFailures.length > 0) {
    console.error('Mode: strict (blocking)')
    for (const failure of strictFailures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log('Mode: strict (blocking)')
  console.log('Strict coverage gate passed.')
} else {
  console.log('Mode: warn-only (non-blocking)')
}