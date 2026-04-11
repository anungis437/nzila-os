/**
 * tooling/ml/lib/ueFeatureEngineering.ts
 *
 * Pure feature-engineering functions for UnionEyes case-level ML datasets.
 * No PII fields (member names, contact info) are included in the output.
 *
 * Exported helpers:
 *   buildUECaseFeatures  — returns one feature row per case
 *   toCsv                — serialise rows to CSV string
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Raw case row pulled from DB — only structured metadata, no PII */
export interface RawUECase {
  caseId: string
  orgId: string
  createdAt: Date
  updatedAt: Date | null
  /** e.g., "billing" | "hr" | "general" | "grievance" */
  category: string | null
  /** e.g., "email" | "portal" | "phone" | "chat" */
  channel: string | null
  currentStatus: string | null
  /** Queue-level identifier (team/department queue, not individual) */
  assignedQueue: string | null
  /** Current priority as set by staff — ground-truth label for priority model */
  priority: string | null
  /** Boolean: whether the SLA deadline was breached — ground-truth for SLA model */
  slaBreached: boolean | null
  reopenCount: number | null
  messageCount: number | null
  attachmentCount: number | null
  /** Snapshot timestamp used when computing ageHoursAtSnapshot */
  snapshotAt?: Date
}

/** One row in the engineered feature dataset */
export interface UECaseFeatureRow {
  caseId: string
  createdAt: string
  updatedAt: string
  category: string
  channel: string
  currentStatus: string
  assignedQueue: string
  reopenCount: number
  messageCount: number
  attachmentCount: number
  dayOfWeek: number      // 0=Sun … 6=Sat
  hourOfDay: number      // 0..23
  ageHoursAtSnapshot: number
  /** Ground-truth label for priority model */
  y_priority: string
  /** Ground-truth label for SLA model (0 or 1) */
  y_sla_breached: number
  /** Deterministic split key: hash(caseId) % 10 — 0-7 train, 8 val, 9 test */
  split_key: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Simple deterministic hash of a string → non-negative integer.
 * Uses the djb2 algorithm so the result is stable across runs.
 */
function djb2Hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0   // keep 32-bit unsigned
  }
  return h
}

function splitKey(caseId: string): number {
  return djb2Hash(caseId) % 10
}

// ── Core builder ──────────────────────────────────────────────────────────────

/**
 * Transform raw DB case rows into a flat feature matrix.
 *
 * Rules:
 * - Rows without a priority label are dropped (no ground truth).
 * - slaBreached null is treated as 0 (not breached) to keep rows; callers
 *   can pre-filter if SLA dataset should only include resolved cases.
 * - All categorical nulls are normalised to "unknown".
 * - ageHoursAtSnapshot uses snapshotAt if provided, otherwise updatedAt,
 *   then createdAt, clamped to ≥ 0.
 */
export function buildUECaseFeatures(cases: RawUECase[]): UECaseFeatureRow[] {
  const rows: UECaseFeatureRow[] = []

  for (const c of cases) {
    // Skip rows with no priority label — they cannot be supervised training rows
    if (!c.priority) continue

    const createdAt = c.createdAt
    const updatedAt = c.updatedAt ?? createdAt
    const snapshotAt = c.snapshotAt ?? updatedAt

    const ageMs = snapshotAt.getTime() - createdAt.getTime()
    const ageHours = Math.max(0, ageMs / (1000 * 3600))

    rows.push({
      caseId: c.caseId,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      category: (c.category ?? 'unknown').toLowerCase().trim(),
      channel: (c.channel ?? 'unknown').toLowerCase().trim(),
      currentStatus: (c.currentStatus ?? 'unknown').toLowerCase().trim(),
      assignedQueue: (c.assignedQueue ?? 'unknown').toLowerCase().trim(),
      reopenCount: c.reopenCount ?? 0,
      messageCount: c.messageCount ?? 0,
      attachmentCount: c.attachmentCount ?? 0,
      dayOfWeek: createdAt.getUTCDay(),
      hourOfDay: createdAt.getUTCHours(),
      ageHoursAtSnapshot: Math.round(ageHours * 100) / 100,
      y_priority: c.priority.toLowerCase().trim(),
      y_sla_breached: c.slaBreached ? 1 : 0,
      split_key: splitKey(c.caseId),
    })
  }

  return rows
}

// ── CSV serialiser ────────────────────────────────────────────────────────────

const COLUMNS: (keyof UECaseFeatureRow)[] = [
  'caseId',
  'createdAt',
  'updatedAt',
  'category',
  'channel',
  'currentStatus',
  'assignedQueue',
  'reopenCount',
  'messageCount',
  'attachmentCount',
  'dayOfWeek',
  'hourOfDay',
  'ageHoursAtSnapshot',
  'y_priority',
  'y_sla_breached',
  'split_key',
]

function escapeCell(v: unknown): string {
  const s = String(v ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv(rows: UECaseFeatureRow[]): string {
  const lines: string[] = [COLUMNS.join(',')]
  for (const r of rows) {
    lines.push(COLUMNS.map((col) => escapeCell(r[col])).join(','))
  }
  return lines.join('\n') + '\n'
}

/** Schema descriptor for mlDatasets.schemaJson */
export const UE_CASE_SCHEMA_JSON: Record<string, string> = {
  caseId: 'string',
  createdAt: 'datetime',
  updatedAt: 'datetime',
  category: 'string',
  channel: 'string',
  currentStatus: 'string',
  assignedQueue: 'string',
  reopenCount: 'int',
  messageCount: 'int',
  attachmentCount: 'int',
  dayOfWeek: 'int',
  hourOfDay: 'int',
  ageHoursAtSnapshot: 'float',
  y_priority: 'string',
  y_sla_breached: 'int',
  split_key: 'int',
}
