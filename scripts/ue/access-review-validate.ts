#!/usr/bin/env tsx
/**
 * access-review-validate.ts — CI governance gate for quarterly access review.
 *
 * A review passes only after it is approved, signed, dated, and backed by
 * referenced review evidence. Pending or framework-only packets always fail.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const ACCESS_REVIEW_DIR = path.join(ROOT, 'reports', 'compliance', 'access-review')

interface AccessReviewJson {
  schemaVersion?: unknown
  quarter?: unknown
  status?: unknown
  preparedBy?: unknown
  reviewer?: unknown
  reviewDate?: unknown
  signoffStatus?: unknown
  approvedBy?: unknown
  approvedAt?: unknown
  evidence?: unknown
  nextReviewDue?: unknown
}

function currentQuarterLabel(): string {
  const d = new Date()
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}-Q${q}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isValidTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

export function validateAccessReview(value: unknown, expectedQuarter: string): string[] {
  if (!isRecord(value)) return ['Review packet must contain a JSON object.']

  const review = value as AccessReviewJson
  const errors: string[] = []

  if (review.schemaVersion !== 1) errors.push('schemaVersion must be 1.')
  if (review.quarter !== expectedQuarter) {
    errors.push(`quarter must be ${expectedQuarter}.`)
  }
  if (review.status !== 'approved') errors.push("status must be 'approved'.")
  if (review.signoffStatus !== 'signed') {
    errors.push("signoffStatus must be 'signed'.")
  }
  if (!nonEmptyString(review.preparedBy))
    errors.push('preparedBy must identify the packet preparer.')
  if (!nonEmptyString(review.reviewer))
    errors.push('reviewer must identify the completed reviewer.')
  if (
    nonEmptyString(review.preparedBy) &&
    nonEmptyString(review.reviewer) &&
    review.preparedBy.trim().toLowerCase() === review.reviewer.trim().toLowerCase()
  ) {
    errors.push('reviewer must be different from the packet preparer.')
  }
  if (!isValidDate(review.reviewDate)) errors.push('reviewDate must be a valid YYYY-MM-DD date.')
  if (!nonEmptyString(review.approvedBy)) errors.push('approvedBy must identify the approver.')
  if (!isValidTimestamp(review.approvedAt)) {
    errors.push('approvedAt must be a valid ISO timestamp.')
  }

  if (!Array.isArray(review.evidence) || review.evidence.length === 0) {
    errors.push('evidence must reference at least one review evidence artifact.')
  } else if (
    !review.evidence.every(
      (artifact) =>
        isRecord(artifact) && nonEmptyString(artifact.kind) && nonEmptyString(artifact.reference),
    )
  ) {
    errors.push('Each evidence artifact must include a non-empty kind and reference.')
  }

  return errors
}

function main(): void {
  const quarter = currentQuarterLabel()
  const jsonPath = path.join(ACCESS_REVIEW_DIR, `${quarter}.json`)

  process.stdout.write(`\n── Access Review Validation ────────────────────────\n`)
  process.stdout.write(`  Current quarter: ${quarter}\n`)

  if (!fs.existsSync(jsonPath)) {
    process.stderr.write(
      `\n  FAIL: No access review packet found for ${quarter}.\n` +
        `  Required file: reports/compliance/access-review/${quarter}.json\n` +
        `  Prepare a packet with: pnpm exec tsx scripts/ue/access-review-generate.ts\n\n`,
    )
    process.exitCode = 1
    return
  }

  let review: unknown
  try {
    review = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as unknown
  } catch (error) {
    process.stderr.write(
      `\n  FAIL: Cannot parse ${quarter}.json: ${
        error instanceof Error ? error.message : String(error)
      }\n\n`,
    )
    process.exitCode = 1
    return
  }

  const errors = validateAccessReview(review, quarter)
  if (errors.length > 0) {
    process.stderr.write('\n  FAIL: Access review is not fully approved.\n')
    for (const error of errors) process.stderr.write(`    - ${error}\n`)
    process.stderr.write('\n  Pending packets do not satisfy this gate.\n\n')
    process.exitCode = 1
    return
  }

  const approvedReview = review as AccessReviewJson
  process.stdout.write(`\n  PASS: Approved access review for ${quarter}.\n`)
  process.stdout.write(`    Prepared by: ${approvedReview.preparedBy}\n`)
  process.stdout.write(`    Reviewer:    ${approvedReview.reviewer}\n`)
  process.stdout.write(`    Review date: ${approvedReview.reviewDate}\n`)
  process.stdout.write(`    Approved by: ${approvedReview.approvedBy}\n`)
  process.stdout.write(`    Approved at: ${approvedReview.approvedAt}\n`)
  process.stdout.write(`    Next due:    ${approvedReview.nextReviewDue ?? '(unset)'}\n\n`)
}

if (require.main === module) main()
