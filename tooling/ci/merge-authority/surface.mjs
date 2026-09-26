/**
 * Merge-authority surface.
 *
 * Reporting is separate from expensive invariant execution.
 * A context succeeds as NOT_APPLICABLE only when every changed path is
 * proven unable to affect that invariant. Anything else is CODE_OR_UNKNOWN
 * and must execute. Unknown never skips.
 *
 * This module is dependency-free so the GitHub publisher can run it
 * without installing the monorepo.
 */

export const CANONICAL_CONTEXTS = [
  {
    name: 'Merge Authority / Lint & Typecheck',
    ciJob: 'lint-and-typecheck',
    ciDisplayName: 'Lint & Typecheck',
    evidence: 'pnpm lint and pnpm typecheck',
  },
  {
    name: 'Merge Authority / Unit Tests',
    ciJob: 'test',
    ciDisplayName: 'Unit Tests',
    evidence: 'pnpm test:coverage. This does not prove pnpm test:fast is a subset. TEST_FAST_SUBSET remains UNRESOLVED.',
  },
  {
    name: 'Merge Authority / Schema Integrity',
    ciJob: 'schema-drift',
    ciDisplayName: 'Schema Drift Detection',
    evidence: 'schema snapshot, canonical schema, and DB preflight',
  },
  {
    name: 'Merge Authority / PostgreSQL RLS',
    ciJob: 'sage-postgres-concurrency',
    ciDisplayName: 'SAGE PostgreSQL Concurrency and RLS',
    evidence: 'SAGE PostgreSQL concurrency and RLS suite',
  },
  {
    name: 'Merge Authority / Migration Chain',
    ciJob: 'sage-live-postgres',
    ciDisplayName: 'SAGE Live PostgreSQL (records lifecycle)',
    evidence: 'migration immutability manifest and SAGE live PostgreSQL migration chain',
  },
  {
    name: 'Merge Authority / Affected Build',
    ciJob: 'build',
    ciDisplayName: 'Build All',
    evidence:
      'CI job Build All runs pnpm exec turbo run build --affected. This is not a full portfolio build. PORTFOLIO_BUILD_AUTHORITY remains UNRESOLVED.',
  },
]

/** Direct contexts. They already run on every PR to main and are not waived for docs. */
export const SECRET_AUTHORITY_CONTEXTS = ['Gitleaks', 'TruffleHog OSS', 'Docker Secret Policy']

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

/** Markdown under these trees can be imported, tested, or executed. */
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

/** A path segment with these names can influence schema, RLS, or migrations. */
const OPERATIONAL_SEGMENTS = new Set(['migrations', 'migration', 'schema', 'drizzle', 'rls'])

/**
 * Documentation that existing non-authority tooling reads.
 * Presence does not by itself make lint, tests, schema, RLS, migrations,
 * or affected build applicable. The check summary names the consumer
 * so a docs-only pass is not mistaken for those gates having run.
 */
const DOCUMENTATION_CONSUMERS = [
  {
    id: 'governance-gate',
    tool: 'tooling/governance/validate-governance-gate.ts',
    matches: (p) => p.startsWith('docs/categories/platform-and-operations/platform/'),
  },
  {
    id: 'ops-pack',
    tool: 'tooling/ops/validate-ops-pack.ts',
    matches: (p) => p.startsWith('ops/') || p === 'ARCHITECTURE.md' || p === 'SECURITY.md',
  },
  {
    id: 'doc-consistency',
    tool: 'tooling/validation/doc-consistency.ts',
    matches: (p) =>
      p.startsWith('docs/') ||
      p.startsWith('content/') ||
      p.startsWith('governance/') ||
      p.startsWith('plans/') ||
      p === 'README.md' ||
      p === 'ARCHITECTURE.md' ||
      p === 'CONTRIBUTING.md' ||
      p === 'SECURITY.md',
  },
]

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

export function documentationConsumersFor(paths) {
  const found = new Set()
  for (const input of paths) {
    const path = normalizeRepoPath(input)
    if (!path) continue
    for (const consumer of DOCUMENTATION_CONSUMERS) {
      if (consumer.matches(path)) found.add(`${consumer.id}:${consumer.tool}`)
    }
  }
  return [...found].sort()
}

export function classifyChangedPaths(paths) {
  const list = Array.isArray(paths) ? paths : []
  const normalized = list.map((path) => normalizeRepoPath(path))
  const unproven = normalized.filter((path) => path == null || !isDocumentationOnlyPath(path))
  const classification = list.length > 0 && unproven.length === 0 ? 'DOC_ONLY' : 'CODE_OR_UNKNOWN'
  const contexts = {}
  for (const context of CANONICAL_CONTEXTS) {
    contexts[context.name] = classification === 'DOC_ONLY' ? 'NOT_APPLICABLE' : 'REQUIRES_EXECUTION'
  }
  return {
    classification,
    contexts,
    secretSafety: 'APPLICABLE',
    documentationConsumers: documentationConsumersFor(list),
    ciSkippedByPathsIgnore: ciWillSkip(list),
  }
}

function unresolvedEvidence(result) {
  if (result == null || result === '') return 'MISSING'
  if (result === 'success') return 'PASS'
  if (result === 'failure') return 'FAILURE'
  return 'UNRESOLVED'
}

export function evaluateCiResults(results) {
  const source = results && typeof results === 'object' ? results : {}
  return CANONICAL_CONTEXTS.map((context) => {
    const evidence = unresolvedEvidence(source[context.ciJob])
    return {
      name: context.name,
      ciJob: context.ciJob,
      classifier: 'CODE_OR_UNKNOWN',
      applicability: 'REQUIRES_EXECUTION',
      evidence,
      conclusion: evidence === 'PASS' ? 'success' : 'failure',
      detail: context.evidence,
    }
  })
}

export function evaluateDocumentationOnly(classification) {
  if (!classification || classification.classification !== 'DOC_ONLY') {
    throw new Error('NOT_APPLICABLE requires classification DOC_ONLY')
  }
  const consumers = classification.documentationConsumers ?? []
  const consumerLine =
    consumers.length === 0
      ? 'No known non-authority documentation consumer matched these paths.'
      : `Known non-authority documentation consumers were not executed by this surface: ${consumers.join(', ')}.`
  return CANONICAL_CONTEXTS.map((context) => ({
    name: context.name,
    ciJob: context.ciJob,
    classifier: 'DOC_ONLY',
    applicability: 'NOT_APPLICABLE',
    evidence: 'NOT_APPLICABLE',
    conclusion: 'success',
    detail: `${context.evidence} Secret safety remains APPLICABLE (${SECRET_AUTHORITY_CONTEXTS.join(', ')}). ${consumerLine}`,
  }))
}

/**
 * Fast path, before CI has a chance to run.
 * DOC_ONLY publishes successful NOT_APPLICABLE contexts.
 * CODE_OR_UNKNOWN that CI will not run publishes failure (unresolved), never success.
 * CODE_OR_UNKNOWN that CI will run publishes nothing here; the CI reporter does.
 */
export function planFastPath(paths) {
  const list = Array.isArray(paths) ? paths : []
  const classification = classifyChangedPaths(list)
  if (list.length === 0) {
    const verdicts = CANONICAL_CONTEXTS.map((context) => ({
      name: context.name,
      ciJob: context.ciJob,
      classifier: 'CODE_OR_UNKNOWN',
      applicability: 'REQUIRES_EXECUTION',
      evidence: 'UNRESOLVED',
      conclusion: 'failure',
      detail: 'Empty change set is unknown. Unknown does not skip and does not pass.',
    }))
    return { action: 'PUBLISH', verdicts, classification }
  }
  if (classification.classification === 'DOC_ONLY') {
    return { action: 'PUBLISH', verdicts: evaluateDocumentationOnly(classification), classification }
  }
  if (classification.ciSkippedByPathsIgnore) {
    const verdicts = CANONICAL_CONTEXTS.map((context) => ({
      name: context.name,
      ciJob: context.ciJob,
      classifier: 'CODE_OR_UNKNOWN',
      applicability: 'REQUIRES_EXECUTION',
      evidence: 'UNRESOLVED',
      conclusion: 'failure',
      detail:
        'Classifier could not prove the invariant is unaffected, and CI paths-ignore will not execute it. Unknown does not skip and does not pass.',
    }))
    return { action: 'PUBLISH', verdicts, classification }
  }
  return { action: 'DEFER_TO_CI', verdicts: [], classification }
}

export function verdictToCheckRun(verdict, headSha) {
  if (!headSha || typeof headSha !== 'string') {
    throw new Error('head SHA is required')
  }
  if (verdict.evidence === 'NOT_APPLICABLE') {
    if (verdict.classifier !== 'DOC_ONLY' || verdict.applicability !== 'NOT_APPLICABLE') {
      throw new Error(`NOT_APPLICABLE requires a DOC_ONLY classifier for ${verdict.name}`)
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
        `ciJob: ${verdict.ciJob}`,
        verdict.detail,
      ].join('\n\n'),
    },
  }
}
