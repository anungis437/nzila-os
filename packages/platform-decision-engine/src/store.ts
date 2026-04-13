/**
 * @nzila/platform-decision-engine — File-backed storage
 *
 * Persists decision records as JSON under ops/decisions/.
 * Pattern matches platform-change-management storage.
 *
 * @module @nzila/platform-decision-engine/store
 */
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { decisionRecordSchema } from './schemas'
import { isValidTransition } from './status'
import type { DecisionRecord, DecisionStatus, DecisionFeedback } from './types'

// ── Repo root detection ─────────────────────────────────────────────────────

function findRepoRoot(): string {
  let dir = import.meta.dirname ?? process.cwd()
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = path.dirname(dir)
  }
  return process.cwd()
}

function decisionsDir(): string {
  return path.join(findRepoRoot(), 'ops', 'decisions')
}

function feedbackDir(): string {
  return path.join(findRepoRoot(), 'ops', 'decision-feedback')
}

// ── Write / Read ────────────────────────────────────────────────────────────

/**
 * Save a decision record to ops/decisions/{decision_id}.json
 */
export function saveDecisionRecord(record: DecisionRecord): void {
  const validated = decisionRecordSchema.parse(record)
  const dir = decisionsDir()
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${validated.decision_id}.json`)
  fs.writeFileSync(filePath, JSON.stringify(validated, null, 2), 'utf-8')
}

/**
 * Load a single decision record by ID.
 */
export function loadDecisionRecord(decisionId: string): DecisionRecord | null {
  const filePath = path.join(decisionsDir(), `${decisionId}.json`)
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf-8')
  return decisionRecordSchema.parse(JSON.parse(content)) as DecisionRecord
}

/**
 * Load all decision records, sorted by generated_at descending.
 */
export function loadAllDecisions(): DecisionRecord[] {
  const dir = decisionsDir()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8')
      return decisionRecordSchema.parse(JSON.parse(content)) as DecisionRecord
    })
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
}

/**
 * List decisions with open statuses (not closed/executed/expired/rejected).
 */
export function listOpenDecisions(): DecisionRecord[] {
  const closed: DecisionStatus[] = ['CLOSED', 'EXECUTED', 'EXPIRED', 'REJECTED']
  return loadAllDecisions().filter((d) => !closed.includes(d.status))
}

/**
 * List decisions for a specific org.
 */
export function listDecisionsByOrg(orgId: string): DecisionRecord[] {
  return loadAllDecisions().filter((d) => d.org_id === orgId)
}

/**
 * Update the status of a decision record.
 */
export function updateDecisionStatus(
  decisionId: string,
  newStatus: DecisionStatus,
  reviewedBy?: string,
  reviewNote?: string,
): DecisionRecord | null {
  const record = loadDecisionRecord(decisionId)
  if (!record) return null
  if (!isValidTransition(record.status, newStatus)) return null

  const updated: DecisionRecord = {
    ...record,
    status: newStatus,
    reviewed_by: reviewedBy
      ? [...(record.reviewed_by ?? []), reviewedBy]
      : record.reviewed_by,
    review_notes: reviewNote
      ? [...(record.review_notes ?? []), reviewNote]
      : record.review_notes,
  }
  saveDecisionRecord(updated)
  return updated
}

/**
 * Append a review entry to a decision.
 */
export function appendDecisionReview(
  decisionId: string,
  reviewer: string,
  note: string,
): DecisionRecord | null {
  const record = loadDecisionRecord(decisionId)
  if (!record) return null

  const updated: DecisionRecord = {
    ...record,
    reviewed_by: [...(record.reviewed_by ?? []), reviewer],
    review_notes: [...(record.review_notes ?? []), note],
  }
  saveDecisionRecord(updated)
  return updated
}

// ── Feedback persistence ────────────────────────────────────────────────────

/**
 * Save decision feedback.
 */
export function saveDecisionFeedback(feedback: DecisionFeedback): void {
  const dir = feedbackDir()
  fs.mkdirSync(dir, { recursive: true })
  const filename = `${feedback.decision_id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.json`
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(feedback, null, 2), 'utf-8')
}

/**
 * Load all feedback for a decision.
 */
export function loadDecisionFeedback(decisionId: string): DecisionFeedback[] {
  const dir = feedbackDir()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(decisionId) && f.endsWith('.json'))
    .map((f) => {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8')
      return JSON.parse(content) as DecisionFeedback
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}
