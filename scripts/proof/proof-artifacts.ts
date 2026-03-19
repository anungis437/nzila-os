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

export interface ProofSummary {
  scenario: string
  status: 'pass' | 'fail'
  timestamp: string
  trace_id: string
  actor_id: string | null
  tenant_id: string | null
  governance_decision_id: string | null
  audit_event_id: string | null
  audit_chain_valid: boolean | null
  ai_control_log_id: string | null
  event_contract: string | null
}

export function writeArtifact(scenario: string, filename: string, data: unknown): string {
  const dir = join(ARTIFACT_DIR, scenario)
  mkdirSync(dir, { recursive: true })
  const filepath = join(dir, filename)
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
    tenant_id: null,
    governance_decision_id: null,
    audit_event_id: null,
    audit_chain_valid: null,
    ai_control_log_id: null,
    event_contract: null,
    ...overrides,
  }
}
