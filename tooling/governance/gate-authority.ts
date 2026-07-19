/**
 * Gate Authority Runner (Phase 5 — gate taxonomy + CI authority)
 *
 * Reads governance/gates/gate-authority-registry.json and makes gate authority
 * EXPLICIT and ENFORCEABLE:
 *   - blocking   (pr-/release-/pilot-/production-blocking) -> failure fails CI
 *   - advisory   -> runs & is reported (::warning::) but NEVER fails CI
 *   - experimental -> runs report-only (non-blocking)
 *   - deprecated -> EXCLUDED from canonical execution
 *
 * `classification` is the ENFORCED authority. `targetClassification` /
 * `promotionCondition` are aspirational ONLY and never change CI behavior.
 *
 * This module is intentionally split into a pure, importable core (so the
 * blocking-vs-advisory semantics can be unit-tested without spawning processes)
 * and a thin CLI.
 *
 * CLI:
 *   tsx tooling/governance/gate-authority.ts --validate    # registry integrity (BLOCKING)
 *   tsx tooling/governance/gate-authority.ts --report      # print authority map + artifact (never fails)
 *   tsx tooling/governance/gate-authority.ts --self-test   # prove advisory!=fail, blocking=fail (BLOCKING)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

// ── Taxonomy constants ──────────────────────────────────────────────────────

export type Classification =
  | 'pr-blocking'
  | 'release-blocking'
  | 'pilot-blocking'
  | 'production-blocking'
  | 'advisory'
  | 'deprecated'
  | 'experimental'

export type Enforcement = 'blocking' | 'report-only' | 'excluded'

export const VALID_CLASSIFICATIONS: readonly Classification[] = [
  'pr-blocking',
  'release-blocking',
  'pilot-blocking',
  'production-blocking',
  'advisory',
  'deprecated',
  'experimental',
]

/** Default enforcement mapping (used when a registry omits taxonomy metadata). */
export const DEFAULT_ENFORCEMENT: Record<Classification, Enforcement> = {
  'pr-blocking': 'blocking',
  'release-blocking': 'blocking',
  'pilot-blocking': 'blocking',
  'production-blocking': 'blocking',
  advisory: 'report-only',
  experimental: 'report-only',
  deprecated: 'excluded',
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface GateEntry {
  id: string
  name?: string
  command?: string
  script?: string
  path?: string
  purpose?: string
  classification: Classification
  scope?: string
  owner?: string
  targetClassification?: string | null
  promotionCriteria?: string[]
  demotionCriteria?: string[]
  knownLimitations?: string[]
  lastVerified?: string
  [k: string]: unknown
}

export interface AuthorityRegistry {
  $schema?: string
  version?: string
  taxonomy?: {
    categories?: Record<string, { enforcement?: Enforcement }>
  }
  gates: GateEntry[]
  [k: string]: unknown
}

export interface GateOutcome {
  ok: boolean
  detail?: string
}

export type GateExecutor = (gate: GateEntry) => GateOutcome | Promise<GateOutcome>

export interface GateRunRecord {
  id: string
  classification: Classification
  enforcement: Enforcement
  action: 'ran' | 'skipped'
  ok: boolean | null
  blocking: boolean
  detail?: string
}

export interface AuthorityRunResult {
  exitCode: 0 | 1
  blockingFailures: number
  advisoryFailures: number
  skipped: number
  records: GateRunRecord[]
}

// ── Pure core ───────────────────────────────────────────────────────────────

export const REGISTRY_PATH = join(
  __dirname,
  '..',
  '..',
  'governance',
  'gates',
  'gate-authority-registry.json',
)

export function loadRegistry(path: string = REGISTRY_PATH): AuthorityRegistry {
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw) as AuthorityRegistry
}

/** Resolve the enforcement mode for a classification, preferring registry taxonomy. */
export function enforcementFor(
  classification: string,
  registry?: AuthorityRegistry,
): Enforcement {
  const fromRegistry = registry?.taxonomy?.categories?.[classification]?.enforcement
  if (fromRegistry === 'blocking' || fromRegistry === 'report-only' || fromRegistry === 'excluded') {
    return fromRegistry
  }
  const fallback = DEFAULT_ENFORCEMENT[classification as Classification]
  if (!fallback) throw new Error(`Unknown classification: ${classification}`)
  return fallback
}

export interface RegistryIntegrity {
  ok: boolean
  errors: string[]
}

/**
 * Registry integrity check. BLOCKING in CI: a malformed authority registry is
 * itself an authority defect.
 */
export function validateRegistry(registry: AuthorityRegistry): RegistryIntegrity {
  const errors: string[] = []

  if (!Array.isArray(registry.gates) || registry.gates.length === 0) {
    errors.push('Registry has no gates[].')
    return { ok: false, errors }
  }

  const seen = new Set<string>()
  for (const gate of registry.gates) {
    const id = gate.id || '(missing id)'
    if (!gate.id) errors.push('A gate is missing its id.')
    if (gate.id && seen.has(gate.id)) errors.push(`Duplicate gate id: ${gate.id}`)
    if (gate.id) seen.add(gate.id)

    if (!gate.classification) {
      errors.push(`Gate ${id}: missing classification.`)
    } else if (!VALID_CLASSIFICATIONS.includes(gate.classification)) {
      errors.push(`Gate ${id}: invalid classification "${gate.classification}".`)
    }
    if (!gate.scope) errors.push(`Gate ${id}: missing scope.`)
    if (!gate.owner) errors.push(`Gate ${id}: missing owner.`)
    if (!gate.command && !gate.script && !gate.path) {
      errors.push(`Gate ${id}: missing command/script/path.`)
    }

    // Honesty rule: a gate whose target is production-blocking must NOT already
    // be classified blocking unless it has truly been certified. Keep advisory.
    if (
      gate.targetClassification === 'production-blocking' &&
      enforcementFor(gate.classification, registry) === 'blocking'
    ) {
      errors.push(
        `Gate ${id}: targetClassification=production-blocking but classification is already blocking — production certification must be earned, not assumed.`,
      )
    }
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Run gates according to their authority. `executor` decides pass/fail per gate.
 * Deprecated gates are EXCLUDED (never executed). Advisory/experimental failures
 * are reported but do NOT affect exitCode. Only blocking failures fail CI.
 */
export async function runAuthority(
  registry: AuthorityRegistry,
  executor: GateExecutor,
): Promise<AuthorityRunResult> {
  const records: GateRunRecord[] = []
  let blockingFailures = 0
  let advisoryFailures = 0
  let skipped = 0

  for (const gate of registry.gates) {
    const enforcement = enforcementFor(gate.classification, registry)

    if (enforcement === 'excluded') {
      skipped++
      records.push({
        id: gate.id,
        classification: gate.classification,
        enforcement,
        action: 'skipped',
        ok: null,
        blocking: false,
      })
      continue
    }

    const outcome = await executor(gate)
    const blocking = enforcement === 'blocking'
    if (!outcome.ok) {
      if (blocking) blockingFailures++
      else advisoryFailures++
    }
    records.push({
      id: gate.id,
      classification: gate.classification,
      enforcement,
      action: 'ran',
      ok: outcome.ok,
      blocking,
      detail: outcome.detail,
    })
  }

  return {
    exitCode: blockingFailures > 0 ? 1 : 0,
    blockingFailures,
    advisoryFailures,
    skipped,
    records,
  }
}

/** Group gates by classification for a human-readable authority map. */
export function renderAuthorityMap(registry: AuthorityRegistry): string {
  const groups = new Map<string, GateEntry[]>()
  for (const c of VALID_CLASSIFICATIONS) groups.set(c, [])
  for (const gate of registry.gates) {
    if (!groups.has(gate.classification)) groups.set(gate.classification, [])
    groups.get(gate.classification)!.push(gate)
  }

  const lines: string[] = []
  lines.push('=== Nzila Gate Authority Map ===')
  lines.push(`registry: ${registry.$schema ?? '(unknown schema)'} @ ${registry.version ?? '?'}`)
  lines.push('')
  for (const c of VALID_CLASSIFICATIONS) {
    const gates = groups.get(c) ?? []
    const enforcement = enforcementFor(c, registry)
    lines.push(`[${c}] (${enforcement}) — ${gates.length} gate(s)`)
    for (const g of gates) {
      const target = g.targetClassification ? ` -> target:${g.targetClassification}` : ''
      const repair = g.repairRequired ? ' [REPAIR-REQUIRED]' : ''
      lines.push(`  • ${g.id} (${g.scope ?? 'unscoped'})${target}${repair}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

// ── Self-test: proves advisory!=fail-CI while blocking=fail-CI ───────────────

/** Synthetic registry used to prove enforcement semantics in CI. */
export function syntheticSemanticsRegistry(): AuthorityRegistry {
  return {
    $schema: 'gate-authority-registry/self-test',
    version: 'self-test',
    taxonomy: {
      categories: {
        'pr-blocking': { enforcement: 'blocking' },
        advisory: { enforcement: 'report-only' },
        experimental: { enforcement: 'report-only' },
        deprecated: { enforcement: 'excluded' },
      },
    },
    gates: [
      { id: 'fake-blocking', classification: 'pr-blocking', scope: 'self-test', owner: 'self-test', command: 'noop' },
      { id: 'fake-advisory', classification: 'advisory', scope: 'self-test', owner: 'self-test', command: 'noop' },
      { id: 'fake-experimental', classification: 'experimental', scope: 'self-test', owner: 'self-test', command: 'noop' },
      { id: 'fake-deprecated', classification: 'deprecated', scope: 'self-test', owner: 'self-test', command: 'noop' },
    ],
  }
}

/**
 * Returns { ok, failures } proving the two core authority invariants:
 *  (1) an advisory gate that FAILS does NOT fail CI (exitCode 0)
 *  (2) a blocking gate that FAILS DOES fail CI (exitCode 1)
 *  (3) a deprecated gate is never executed
 */
export async function runSelfTest(): Promise<{ ok: boolean; failures: string[] }> {
  const failures: string[] = []
  const registry = syntheticSemanticsRegistry()
  const executed = new Set<string>()

  // Case A: only the advisory + experimental gates fail; blocking passes.
  const a = await runAuthority(registry, (g) => {
    executed.add(g.id)
    if (g.id === 'fake-advisory' || g.id === 'fake-experimental') return { ok: false, detail: 'synthetic advisory failure' }
    return { ok: true }
  })
  if (a.exitCode !== 0) failures.push('Advisory/experimental failure incorrectly failed CI (expected exitCode 0).')
  if (a.advisoryFailures < 2) failures.push('Advisory/experimental failures were not recorded.')
  if (executed.has('fake-deprecated')) failures.push('Deprecated gate was executed (must be excluded).')
  if (a.skipped !== 1) failures.push('Deprecated gate was not skipped exactly once.')

  // Case B: the blocking gate fails.
  const b = await runAuthority(registry, (g) => {
    if (g.id === 'fake-blocking') return { ok: false, detail: 'synthetic blocking failure' }
    return { ok: true }
  })
  if (b.exitCode !== 1) failures.push('Blocking failure did NOT fail CI (expected exitCode 1).')
  if (b.blockingFailures !== 1) failures.push('Blocking failure was not recorded.')

  return { ok: failures.length === 0, failures }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const GH = process.env.GITHUB_ACTIONS === 'true'
function warn(msg: string): void {
  console.log(GH ? `::warning::${msg}` : `⚠ ${msg}`)
}
function error(msg: string): void {
  console.log(GH ? `::error::${msg}` : `❌ ${msg}`)
}

async function cliValidate(): Promise<number> {
  const registry = loadRegistry()
  const { ok, errors } = validateRegistry(registry)
  if (!ok) {
    error('Gate authority registry FAILED integrity validation:')
    for (const e of errors) error(`  - ${e}`)
    return 1
  }
  console.log(`✅ Gate authority registry OK — ${registry.gates.length} gates, all classified.`)
  return 0
}

async function cliReport(): Promise<number> {
  const registry = loadRegistry()
  const map = renderAuthorityMap(registry)
  console.log(map)

  // Annotate advisory + repair-required gates so they stay VISIBLE in CI logs.
  for (const g of registry.gates) {
    const enforcement = enforcementFor(g.classification, registry)
    if (g.repairRequired) warn(`Gate ${g.id} is REPAIR-REQUIRED (advisory): ${(g.knownLimitations as string[] | undefined)?.[0] ?? ''}`)
    if (g.targetClassification === 'production-blocking' && enforcement !== 'blocking') {
      warn(`Gate ${g.id} targets production-blocking but is advisory-only (evidence not yet achieved).`)
    }
  }

  const outDir = join(__dirname, '..', '..', 'reports', 'governance')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const artifact = {
    generatedAt: new Date().toISOString(),
    schema: registry.$schema,
    version: registry.version,
    summary: registry.summary ?? null,
    gates: registry.gates.map((g) => ({
      id: g.id,
      classification: g.classification,
      enforcement: enforcementFor(g.classification, registry),
      scope: g.scope,
      owner: g.owner,
      targetClassification: g.targetClassification ?? null,
      repairRequired: g.repairRequired ?? false,
      lastVerified: g.lastVerified ?? null,
    })),
  }
  const outPath = join(outDir, 'gate-authority-map.json')
  writeFileSync(outPath, JSON.stringify(artifact, null, 2))
  console.log(`Authority map artifact written: ${outPath}`)
  return 0
}

async function cliSelfTest(): Promise<number> {
  const { ok, failures } = await runSelfTest()
  if (!ok) {
    error('Gate authority self-test FAILED — enforcement semantics are broken:')
    for (const f of failures) error(`  - ${f}`)
    return 1
  }
  console.log('✅ Gate authority self-test passed: advisory failure does NOT fail CI; blocking failure DOES; deprecated excluded.')
  return 0
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? '--report'
  let code = 0
  if (mode === '--validate') code = await cliValidate()
  else if (mode === '--report') code = await cliReport()
  else if (mode === '--self-test') code = await cliSelfTest()
  else {
    error(`Unknown mode "${mode}". Use --validate | --report | --self-test.`)
    code = 1
  }
  process.exit(code)
}

// Run only when invoked directly (not when imported by tests).
const invokedDirectly =
  typeof require !== 'undefined' && require.main === module
if (invokedDirectly) {
  main().catch((err) => {
    error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
