/**
 * Merge-authority surface.
 *
 * Reporting is separate from expensive invariant execution.
 * NOT_APPLICABLE is decided per invariant. A documentation path can waive
 * compilation while governance, inventory, or another family still executes.
 * Unknown never skips.
 *
 * This module is dependency-free so the GitHub publisher can run it
 * without installing the monorepo.
 */

export const CANONICAL_CONTEXTS = [
  {
    name: 'Merge Authority / Lint & Typecheck',
    ciJob: 'lint-and-typecheck',
    family: 'engineering',
    evidence: 'pnpm lint and pnpm typecheck',
  },
  {
    name: 'Merge Authority / Unit Tests',
    ciJob: 'test',
    family: 'engineering',
    evidence:
      'pnpm test:coverage. This does not prove pnpm test:fast is a subset. TEST_FAST_SUBSET remains UNRESOLVED.',
  },
  {
    name: 'Merge Authority / Schema Integrity',
    ciJob: 'schema-drift',
    family: 'engineering',
    evidence: 'schema snapshot, canonical schema, and DB preflight',
  },
  {
    name: 'Merge Authority / PostgreSQL RLS',
    ciJob: 'sage-postgres-concurrency',
    family: 'engineering',
    evidence:
      'Database row-access enforcement via the SAGE PostgreSQL concurrency and RLS suite. This is not application or platform auth-authority validation.',
  },
  {
    name: 'Merge Authority / Migration Chain',
    ciJob: 'sage-live-postgres',
    family: 'engineering',
    evidence: 'migration immutability manifest and SAGE live PostgreSQL migration chain',
  },
  {
    name: 'Merge Authority / Affected Build',
    ciJob: 'build',
    family: 'engineering',
    evidence:
      'CI job Build All runs pnpm exec turbo run build --affected. This is not a full portfolio build. PORTFOLIO_BUILD_AUTHORITY remains UNRESOLVED.',
  },
  {
    name: 'Merge Authority / Architectural Contracts',
    ciJob: 'contract-tests',
    family: 'contracts',
    evidence:
      'Standalone CI job Contract Tests (Architectural Invariants) runs pnpm contract-tests. The copy inside Governance Gates is not this authority source.',
  },
  {
    name: 'Merge Authority / Repository Inventory',
    ciJob: 'repository-inventory',
    family: 'inventory',
    evidence:
      'pnpm inventory:generate followed by the committed inventory lock. Date stamps are ignored. This job does not collect DORA, cost, scorecards, or release evidence.',
  },
  {
    name: 'Merge Authority / Governance Integrity',
    ciJob: 'governance-integrity',
    family: 'governance',
    evidence:
      'Source-tree governance validators, including auth-authority validation. Auth authority is the application and platform authorization-truth invariant. It is not PostgreSQL row-level security.',
  },
  {
    name: 'Merge Authority / Hash Chain Integrity',
    ciJob: 'hash-chain-drift',
    family: 'hash-chain',
    evidence: 'CI job Hash Chain Drift runs tooling/contract-tests/hash-chain-drift.test.ts.',
  },
  {
    name: 'Merge Authority / Operating Layer',
    ciJob: 'operating-layer-gate',
    family: 'operating-layer',
    evidence: 'CI job Operating Layer Gate runs pnpm test:operating-layer.',
  },
]

/** Direct contexts. They already run on every PR to main and are not waived for docs. */
export const SECRET_AUTHORITY_CONTEXTS = ['Gitleaks', 'TruffleHog OSS', 'Docker Secret Policy']

/**
 * Conditional jobs that are not canonical in this remediation.
 * Ruleset activation stays blocked while this residual remains.
 */
export const CONDITIONAL_AUTHORITY_RESIDUAL = [
  'IaC Security Scan',
  'ML Tooling Gates',
  'Ops Documentation Pack',
  'AI Eval Gate',
]

/**
 * Must stay identical to pull_request.paths-ignore in .github/workflows/ci.yml.
 * The contract test fails if the workflow list drifts.
 */
export const CI_PATHS_IGNORE = [
  '**/*.md',
  'docs/**',
  '.github/CODEOWNERS',
  '.gitignore',
  '.editorconfig',
  'LICENSE',
]

const EXACT_DOCUMENTATION_PATHS = new Set([
  'LICENSE',
  'LICENSE.md',
  '.gitignore',
  '.editorconfig',
  '.github/CODEOWNERS',
])

const CODE_TREE_PREFIXES = [
  'apps/',
  'packages/',
  'services/',
  'tooling/',
  'scripts/',
  '.github/',
  'migrations/',
  'db/',
  'supabase/',
]

const OPERATIONAL_SEGMENTS = new Set(['migrations', 'migration', 'schema', 'drizzle', 'rls'])

/** Markdown and policy trees read by the extracted governance validators. */
const GOVERNANCE_DOC_PREFIXES = [
  'docs/categories/platform-and-operations/',
  'governance/',
  'tooling/governance/',
]

const GOVERNANCE_SCRIPT_PATHS = new Set([
  'tooling/scripts/check-script-alias-regression.mjs',
  'tooling/governance/validate-governance-gate.ts',
  'scripts/validate-evidence-lifecycle-policy.ts',
  'scripts/validate-truth-authority.ts',
  'scripts/validate-auth-authority.ts',
  'scripts/validate-ga-state.ts',
  'scripts/validate-workspace-links.ts',
  'tooling/governance/validate-control-manifests.ts',
])

export function normalizeRepoPath(input) {
  if (typeof input !== 'string') return null
  let path = input.replace(/\\/g, '/').trim()
  if (path.startsWith('./')) path = path.slice(2)
  if (path.startsWith('/')) return null
  if (path.includes('\0')) return null
  if (!path || path.endsWith('/')) return null
  return path
}

export function matchesCiPathsIgnore(input) {
  const path = normalizeRepoPath(input)
  if (!path) return false
  if (
    path === '.github/CODEOWNERS' ||
    path === '.gitignore' ||
    path === '.editorconfig' ||
    path === 'LICENSE'
  ) {
    return true
  }
  if (path === 'docs' || path.startsWith('docs/')) return true
  if (path.endsWith('.md')) return true
  return false
}

export function ciWillSkip(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return false
  return paths.every((path) => matchesCiPathsIgnore(path))
}

function hasOperationalSegment(path) {
  return path.split('/').some((segment) => {
    const bare = segment.toLowerCase().replace(/\.(md|markdown)$/i, '')
    return OPERATIONAL_SEGMENTS.has(bare)
  })
}

/**
 * True only when this path cannot affect lint, typecheck, unit tests,
 * schema integrity, PostgreSQL RLS, the migration chain, or affected build.
 */
export function isDocumentationOnlyPath(input) {
  const path = normalizeRepoPath(input)
  if (!path) return false
  if (path.split('/').includes('..')) return false
  if (EXACT_DOCUMENTATION_PATHS.has(path)) return true
  if (!path.endsWith('.md') && !path.endsWith('.markdown')) return false
  if (CODE_TREE_PREFIXES.some((prefix) => path.startsWith(prefix))) return false
  if (hasOperationalSegment(path)) return false
  return true
}

function knownPath(input) {
  const path = normalizeRepoPath(input)
  if (!path || path.split('/').includes('..')) return null
  return path
}

function requiresEngineering(path) {
  return !isDocumentationOnlyPath(path)
}

function requiresGovernance(path) {
  if (GOVERNANCE_DOC_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  if (GOVERNANCE_SCRIPT_PATHS.has(path)) return true
  if (isDocumentationOnlyPath(path)) return false
  return true
}

function requiresInventory(path) {
  if (
    path.startsWith('apps/') ||
    path.startsWith('packages/') ||
    path.startsWith('services/') ||
    path.startsWith('tooling/') ||
    path.startsWith('.github/workflows/')
  ) {
    return true
  }
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path) || /(^|\/)test_[^/]*\.py$/.test(path)) return true
  if (isDocumentationOnlyPath(path)) return false
  return true
}

function requiresContracts(path) {
  if (path.startsWith('tooling/contract-tests/')) return true
  if (isDocumentationOnlyPath(path)) return false
  return true
}

function requiresHashChain(path) {
  if (path.startsWith('packages/db/') || path.startsWith('migrations/') || path.includes('hash-chain')) return true
  if (isDocumentationOnlyPath(path)) return false
  if (path.startsWith('docs/') || path.startsWith('ops/') || path.startsWith('apps/')) return false
  return true
}

function requiresOperatingLayer(path) {
  if (
    path.startsWith('apps/console/') ||
    path.startsWith('apps/control-plane/') ||
    path.startsWith('apps/orchestrator-api/') ||
    path.startsWith('tooling/contract-tests/operating-layer')
  ) {
    return true
  }
  if (isDocumentationOnlyPath(path)) return false
  if (path.startsWith('apps/') || path.startsWith('packages/') || path.startsWith('services/')) return true
  return true
}

const FAMILY_REQUIRES = {
  engineering: requiresEngineering,
  governance: requiresGovernance,
  inventory: requiresInventory,
  contracts: requiresContracts,
  'hash-chain': requiresHashChain,
  'operating-layer': requiresOperatingLayer,
}

export function classifyChangedPaths(paths) {
  const list = Array.isArray(paths) ? paths.map((path) => knownPath(path)) : []
  const contexts = {}
  for (const context of CANONICAL_CONTEXTS) {
    const requires = FAMILY_REQUIRES[context.family]
    const applicable =
      list.length === 0 || list.some((path) => path == null || requires(path))
    contexts[context.name] = applicable ? 'REQUIRES_EXECUTION' : 'NOT_APPLICABLE'
  }
  const values = Object.values(contexts)
  let classification = 'MIXED'
  if (values.every((value) => value === 'NOT_APPLICABLE')) classification = 'ALL_NOT_APPLICABLE'
  if (values.every((value) => value === 'REQUIRES_EXECUTION')) classification = 'CODE_OR_UNKNOWN'
  return {
    classification,
    contexts,
    secretSafety: 'APPLICABLE',
    ciSkippedByPathsIgnore: ciWillSkip(Array.isArray(paths) ? paths : []),
    conditionalAuthorityResidual: CONDITIONAL_AUTHORITY_RESIDUAL,
  }
}

function unresolvedEvidence(result) {
  if (result == null || result === '') return 'MISSING'
  if (result === 'success') return 'PASS'
  if (result === 'failure') return 'FAILURE'
  return 'UNRESOLVED'
}

function verdictFor(context, fields) {
  const evidence = fields.evidence
  return {
    name: context.name,
    ciJob: context.ciJob,
    family: context.family,
    classifier: fields.classifier,
    applicability: fields.applicability,
    evidence,
    conclusion: evidence === 'PASS' || evidence === 'NOT_APPLICABLE' ? 'success' : 'failure',
    detail: fields.detail ?? context.evidence,
  }
}

export function evaluateCiResults(results) {
  const source = results && typeof results === 'object' ? results : {}
  return CANONICAL_CONTEXTS.map((context) => {
    const evidence = unresolvedEvidence(source[context.ciJob])
    return verdictFor(context, {
      classifier: 'CODE_OR_UNKNOWN',
      applicability: 'REQUIRES_EXECUTION',
      evidence,
      detail: `${context.evidence} Secret safety remains APPLICABLE (${SECRET_AUTHORITY_CONTEXTS.join(', ')}).`,
    })
  })
}

/**
 * Overlay real executions onto a fast-path plan.
 * A skipped job becomes NOT_APPLICABLE only when that invariant was already proven irrelevant.
 */
export function applyExecution(verdicts, execution) {
  const source = execution && typeof execution === 'object' ? execution : {}
  return verdicts.map((verdict) => {
    const result = source[verdict.ciJob]
    const ran = result != null && result !== '' && result !== 'skipped'
    if (verdict.applicability === 'NOT_APPLICABLE' && !ran) return verdict
    if (verdict.applicability === 'NOT_APPLICABLE' && result === 'success') return verdict
    const evidence = unresolvedEvidence(ran ? result : result === 'skipped' ? 'skipped' : null)
    return {
      ...verdict,
      classifier: 'CODE_OR_UNKNOWN',
      applicability: 'REQUIRES_EXECUTION',
      evidence: evidence === 'PASS' ? 'PASS' : evidence,
      conclusion: evidence === 'PASS' ? 'success' : 'failure',
      detail:
        evidence === 'PASS'
          ? `${verdict.ciJob} completed with ${result}.`
          : `${verdict.detail} Execution result: ${result || 'missing'}.`,
    }
  })
}

export function planFastPath(paths) {
  const list = Array.isArray(paths) ? paths : []
  const classification = classifyChangedPaths(list)
  const verdicts = CANONICAL_CONTEXTS.map((context) => {
    const applicability = classification.contexts[context.name]
    if (applicability === 'NOT_APPLICABLE') {
      return verdictFor(context, {
        classifier: 'PROVEN_IRRELEVANT',
        applicability,
        evidence: 'NOT_APPLICABLE',
        detail: `${context.evidence} Secret safety remains APPLICABLE (${SECRET_AUTHORITY_CONTEXTS.join(', ')}).`,
      })
    }
    return verdictFor(context, {
      classifier: 'CODE_OR_UNKNOWN',
      applicability,
      evidence: 'UNRESOLVED',
      detail:
        'This invariant is applicable and CI paths-ignore will not execute it. Unknown does not skip and does not pass.',
    })
  })

  if (list.length === 0) {
    return { action: 'PUBLISH', verdicts, classification }
  }
  const anyRequired = Object.values(classification.contexts).some((value) => value === 'REQUIRES_EXECUTION')
  if (anyRequired && !classification.ciSkippedByPathsIgnore) {
    return { action: 'DEFER_TO_CI', verdicts: [], classification }
  }
  return { action: 'PUBLISH', verdicts, classification }
}

export function verdictToCheckRun(verdict, headSha) {
  if (!headSha || typeof headSha !== 'string') {
    throw new Error('head SHA is required')
  }
  if (verdict.evidence === 'NOT_APPLICABLE') {
    if (verdict.classifier !== 'PROVEN_IRRELEVANT' || verdict.applicability !== 'NOT_APPLICABLE') {
      throw new Error(`NOT_APPLICABLE requires a PROVEN_IRRELEVANT classifier for ${verdict.name}`)
    }
  }
  const success = verdict.evidence === 'PASS' || verdict.evidence === 'NOT_APPLICABLE'
  if (success !== (verdict.conclusion === 'success')) {
    throw new Error(`verdict conclusion does not match evidence for ${verdict.name}`)
  }
  return {
    name: verdict.name,
    head_sha: headSha,
    status: 'completed',
    conclusion: verdict.conclusion,
    output: {
      title: verdict.evidence,
      summary: [
        `evidence: ${verdict.evidence}`,
        `classifier: ${verdict.classifier}`,
        `applicability: ${verdict.applicability}`,
        `family: ${verdict.family}`,
        `ciJob: ${verdict.ciJob}`,
        verdict.detail,
      ].join('\n\n'),
    },
  }
}
