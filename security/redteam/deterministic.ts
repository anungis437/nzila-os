/**
 * Red-Team Deterministic Utilities
 *
 * Provides seeded RNG, fixed timestamps, and stable JSON ordering
 * so that red-team test runs are fully reproducible. Two runs with
 * the same seed produce byte-identical evidence artefacts.
 *
 * @security Ensures red-team evidence packs are auditable across CI runs.
 */
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

// ── Seeded RNG ──────────────────────────────────────────────────────────────

/**
 * Simple deterministic PRNG (xorshift128+).
 * Use for test data generation so results are reproducible.
 */
export class SeededRng {
  private s0: number
  private s1: number

  constructor(seed: number) {
    // Initialise state from seed using splitmix64
    let z = (seed + 0x9e3779b97f4a7c15) | 0
    z = Math.imul(z ^ (z >>> 30), 0xbf58476d1ce4e5b9)
    z = Math.imul(z ^ (z >>> 27), 0x94d049bb133111eb)
    this.s0 = z ^ (z >>> 31)
    z = (seed + 0x9e3779b97f4a7c15 * 2) | 0
    z = Math.imul(z ^ (z >>> 30), 0xbf58476d1ce4e5b9)
    z = Math.imul(z ^ (z >>> 27), 0x94d049bb133111eb)
    this.s1 = z ^ (z >>> 31)
  }

  /** Returns a float in [0, 1). */
  next(): number {
    let s1 = this.s0
    const s0 = this.s1
    this.s0 = s0
    s1 ^= s1 << 23
    s1 ^= s1 >>> 17
    s1 ^= s0
    s1 ^= s0 >>> 26
    this.s1 = s1
    return ((this.s0 + this.s1) >>> 0) / 0x100000000
  }

  /** Returns an integer in [min, max). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min))
  }

  /** Returns a deterministic hex string of the given length. */
  hex(length: number): string {
    let result = ''
    while (result.length < length) {
      result += Math.floor(this.next() * 16).toString(16)
    }
    return result.slice(0, length)
  }

  /** Returns a deterministic UUID-v4-like string. */
  uuid(): string {
    return [
      this.hex(8),
      this.hex(4),
      '4' + this.hex(3),
      ((this.int(8, 12)).toString(16)) + this.hex(3),
      this.hex(12),
    ].join('-')
  }
}

// ── Fixed Timestamps ────────────────────────────────────────────────────────

/**
 * Returns a fixed ISO timestamp for deterministic tests.
 * The epoch is 2025-01-01T00:00:00.000Z + offsetMs.
 */
export function fixedTimestamp(offsetMs = 0): string {
  return new Date(1735689600000 + offsetMs).toISOString()
}

// ── Stable JSON ─────────────────────────────────────────────────────────────

/**
 * Serialise an object with keys sorted recursively for stable output.
 */
export function stableJsonStringify(obj: unknown, indent = 2): string {
  return JSON.stringify(sortKeys(obj), null, indent)
}

function sortKeys(val: unknown): unknown {
  if (val === null || typeof val !== 'object') return val
  if (Array.isArray(val)) return val.map(sortKeys)
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(val as Record<string, unknown>).sort()) {
    sorted[key] = sortKeys((val as Record<string, unknown>)[key])
  }
  return sorted
}

// ── Environment Metadata ────────────────────────────────────────────────────

export interface RunEnvironment {
  commitSha: string
  branch: string
  runId: string
  runner: string
  nodeVersion: string
  platform: string
  timestamp: string
}

export function getRunEnvironment(): RunEnvironment {
  return {
    commitSha: tryExec('git rev-parse --short HEAD'),
    branch: tryExec('git rev-parse --abbrev-ref HEAD'),
    runId: process.env.GITHUB_RUN_ID ?? 'local',
    runner: process.env.RUNNER_NAME ?? 'local',
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString(),
  }
}

function tryExec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

// ── Stable Content Hash ─────────────────────────────────────────────────────

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

// ── Default Seed ────────────────────────────────────────────────────────────

/**
 * Default seed for red-team tests. Override via REDTEAM_SEED env var.
 */
export function getDefaultSeed(): number {
  const envSeed = process.env.REDTEAM_SEED
  if (envSeed) {
    const parsed = parseInt(envSeed, 10)
    if (!Number.isNaN(parsed)) return parsed
  }
  return 42
}
