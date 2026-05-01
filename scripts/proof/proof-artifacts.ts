/**
 * Proof artifact writer — shared utility for all proof scenarios.
 *
 * Writes structured JSON evidence files to proof-artifacts/<scenario>/.
 * Used by both the test harness and the proof runner scripts.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename2 = fileURLToPath(import.meta.url)
const __dirname2 = dirname(__filename2)
const ROOT = join(__dirname2, '..', '..')
const ARTIFACT_DIR = join(ROOT, 'proof-artifacts')

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

function canonicalPath(value: string): string {
  const normalized = normalizePath(value)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function isWithinBase(candidate: string, base: string): boolean {
  const candidateCanonical = canonicalPath(candidate)
  const baseCanonical = canonicalPath(base)
  return candidateCanonical === baseCanonical || candidateCanonical.startsWith(`${baseCanonical}/`)
}

function safeJoinUnder(base: string, ...parts: string[]): string | null {
  if (parts.some((part) => part.includes('\0') || /(^|[\\/])\.\.([\\/]|$)/.test(part))) return null
  const candidate = normalizePath([base, ...parts].join('/'))
  return isWithinBase(candidate, base) ? candidate : null
}

function assertSafeArtifactName(value: string, label: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(value) || value.includes('..')) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return value
}

export interface ProofSummary {
  scenario: string
  status: 'pass' | 'fail'
  timestamp: string
  trace_id: string
  actor_id: string | null
  org_id: string | null
  governance_decision_id: string | null
  audit_event_id: string | null
  audit_chain_valid: boolean | null
  ai_control_log_id: string | null
  event_contract: string | null
}

export function writeArtifact(scenario: string, filename: string, data: unknown): string {
  const safeScenario = assertSafeArtifactName(scenario, 'scenario')
  const safeFilename = assertSafeArtifactName(filename, 'filename')
  const dir = safeJoinUnder(ARTIFACT_DIR, safeScenario)
  if (!dir) {
    throw new Error(`Unsafe proof artifact directory: ${scenario}`)
  }
  mkdirSync(dir, { recursive: true })
  const filepath = safeJoinUnder(dir, safeFilename)
  if (!filepath) {
    throw new Error(`Unsafe proof artifact file: ${filename}`)
  }
  writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n')
  return filepath
}

export function writeProofBundle(
  scenario: string,
  artifacts: Record<string, unknown>,
): string[] {
  const paths: string[] = []
  for (const [name, data] of Object.entries(artifacts)) {
    paths.push(writeArtifact(scenario, `${name}.json`, data))
  }
  return paths
}

export function buildSummary(
  scenario: string,
  overrides: Partial<ProofSummary>,
): ProofSummary {
  return {
    scenario,
    status: 'pass',
    timestamp: new Date().toISOString(),
    trace_id: '',
    actor_id: null,
    org_id: null,
    governance_decision_id: null,
    audit_event_id: null,
    audit_chain_valid: null,
    ai_control_log_id: null,
    event_contract: null,
    ...overrides,
  }
}
