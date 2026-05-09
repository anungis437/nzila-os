/**
 * Rollout Governance — server-only data accessors (console copy).
 *
 * This module mirrors apps/control-plane/lib/rollout-governance.ts so
 * the console can render its executive rollout briefing without
 * importing across app boundaries.
 *
 * Authority: docs/nzila-rollout-governance/master-rollout-governance-index.md
 */

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export type Tier = 'local' | 'dev' | 'staging' | 'demo' | 'pilot' | 'prod'

export interface EnvironmentRecord {
  tier: Tier
  topology: string
  secret_topology: string
  shared_secret_topology_exception?: string
  promotion: { promotes_to: Tier[]; promotes_from: Tier[] }
  continuity_window_minutes: number
}

export interface EnvironmentRegistry {
  environments: Record<Tier, EnvironmentRecord>
}

export interface AttestationRecord {
  attestation_id: string
  attestation_type: string
  timestamp: string
  actor: string
  subject: { tier?: Tier; from_tier?: Tier; release_id?: string; scope?: string }
  outcome: string
  payload: Record<string, unknown>
  lineage: { parent_attestation_id: string | null }
}

const REPO_ROOT_CANDIDATES = [
  path.resolve(process.cwd(), '..', '..'),
  path.resolve(process.cwd(), '..'),
  process.cwd(),
]

async function resolveRepoRoot(): Promise<string> {
  for (const candidate of REPO_ROOT_CANDIDATES) {
    try {
      await fs.access(path.join(candidate, 'governance', 'rollout', 'environments.json'))
      return candidate
    } catch {
      // try next
    }
  }
  throw new Error('rollout governance: cannot locate repo root from ' + process.cwd())
}

export async function loadEnvironmentRegistry(): Promise<EnvironmentRegistry> {
  const root = await resolveRepoRoot()
  const raw = await fs.readFile(
    path.join(root, 'governance', 'rollout', 'environments.json'),
    'utf8',
  )
  return JSON.parse(raw) as EnvironmentRegistry
}

async function readJsonl(filePath: string): Promise<AttestationRecord[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const out: AttestationRecord[] = []
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        out.push(JSON.parse(line) as AttestationRecord)
      } catch {
        // skip malformed line
      }
    }
    return out
  } catch {
    return []
  }
}

export interface LedgerSnapshot {
  promotions: AttestationRecord[]
  rollbacks: AttestationRecord[]
  readiness: AttestationRecord[]
}

export async function loadAttestationLedger(months = 3): Promise<LedgerSnapshot> {
  const root = await resolveRepoRoot()
  const dir = path.join(root, 'proof-artifacts', 'rollout-attestations')
  const now = new Date()
  const monthKeys: string[] = []
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    monthKeys.push(d.toISOString().slice(0, 7))
  }

  const out: LedgerSnapshot = { promotions: [], rollbacks: [], readiness: [] }
  for (const month of monthKeys) {
    out.promotions.push(...(await readJsonl(path.join(dir, `promotions-${month}.jsonl`))))
    out.rollbacks.push(...(await readJsonl(path.join(dir, `rollbacks-${month}.jsonl`))))
    out.readiness.push(...(await readJsonl(path.join(dir, `readiness-${month}.jsonl`))))
  }
  out.promotions.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  out.rollbacks.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  out.readiness.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  return out
}

export interface ExecutivePosture {
  tier: Tier
  releaseId: string | null
  attested: boolean
  stabilizing: boolean
  stabilizingMinutesRemaining: number
}

export function buildExecutivePostures(
  registry: EnvironmentRegistry,
  ledger: LedgerSnapshot,
): ExecutivePosture[] {
  const tiers: Tier[] = ['staging', 'demo', 'pilot', 'prod']
  const now = Date.now()
  return tiers.map((tier) => {
    const env = registry.environments[tier]
    const last = ledger.promotions.find((p) => p.subject?.tier === tier) ?? null
    let stabilizingMinutesRemaining = 0
    if (last && env.continuity_window_minutes > 0) {
      const remainingMs =
        Date.parse(last.timestamp) + env.continuity_window_minutes * 60_000 - now
      if (remainingMs > 0) stabilizingMinutesRemaining = Math.ceil(remainingMs / 60_000)
    }
    return {
      tier,
      releaseId: last?.subject?.release_id ?? null,
      attested: Boolean(last),
      stabilizing: stabilizingMinutesRemaining > 0,
      stabilizingMinutesRemaining,
    }
  })
}
