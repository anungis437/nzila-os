/**
 * Nzila OS — GA Gate v2 Types
 *
 * Shared type definitions for the GA readiness gate.
 * Used by the checker, report formatter, and contract tests.
 */

// ── Gate Result ─────────────────────────────────────────────────────────────

export type GateStatus = 'PASS' | 'FAIL'

export interface GateResult {
  /** Unique check ID, e.g. "ORG-ISOLATION" */
  id: string
  /** Human-readable check name */
  name: string
  /** Whether the check passed */
  status: GateStatus
  /** Human-readable explanation */
  details: string
  /** Optional list of violations / supporting evidence */
  violations?: string[]
  /** Milliseconds taken to run this check */
  durationMs: number
}

// ── Report ──────────────────────────────────────────────────────────────────

export interface GaCheckReport {
  /** ISO-8601 timestamp of the run */
  timestamp: string
  /** Git commit SHA (short) */
  commitSha: string
  /** Overall status, FAIL if any check FAIL */
  overall: GateStatus
  /** Total checks, passed, failed */
  summary: {
    total: number
    passed: number
    failed: number
  }
  /** Individual gate results */
  gates: GateResult[]
  /** Metadata about the run environment */
  environment: {
    nodeVersion: string
    platform: string
    ci: boolean
    cwd: string
  }
  /** Duration of entire run in ms */
  totalDurationMs: number
}

// ── Check Categories ────────────────────────────────────────────────────────

export type GateCategory =
  | 'org-boundary'
  | 'audited-writes'
  | 'evidence'
  | 'ci-gates'
  | 'red-team'

export interface GateCheck {
  id: string
  name: string
  category: GateCategory
  run: () => GateResult
}
