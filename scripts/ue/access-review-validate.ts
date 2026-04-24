#!/usr/bin/env tsx
/**
 * ue:access-review:validate — CI governance gate for quarterly access review.
 *
 * Validates that the current quarter's access review attestation exists and
 * is in a signed/attested state.
 *
 * FAIL build if:
 *   - No attestation JSON exists for the current quarter
 *   - Attestation JSON has signoffStatus = 'unsigned' or 'missing'
 *
 * BYPASS: Set ACCESS_REVIEW_BYPASS=true environment variable.
 *         This logs loudly and exits 0 (with a warning record).
 *
 * Usage:
 *   pnpm ue:access-review:validate
 *   ACCESS_REVIEW_BYPASS=true pnpm ue:access-review:validate
 *
 * Exit codes:
 *   0 = attestation present and valid (or bypass active)
 *   1 = attestation missing or unsigned
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const ACCESS_REVIEW_DIR = path.join(ROOT, 'reports', 'compliance', 'access-review')

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccessReviewJson {
  schemaVersion?: number
  quarter?: string
  reviewDate?: string
  reviewer?: string
  status?: string
  signoffStatus?: string
  nextReviewDue?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentQuarterLabel(): string {
  const d = new Date()
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}-Q${q}`
}

const VALID_SIGNOFF_STATUSES = new Set([
  'signed',
  'attestation-framework-active',
  'live-enumeration',
  'pending-review',
])

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const quarter = currentQuarterLabel()
  const bypass = process.env['ACCESS_REVIEW_BYPASS'] === 'true'

  process.stdout.write(`\n── Access Review Validation ────────────────────────\n`)
  process.stdout.write(`  Current quarter: ${quarter}\n`)

  if (bypass) {
    process.stdout.write('\n')
    process.stdout.write('  ⚠ ⚠ ⚠ ACCESS_REVIEW_BYPASS=true IS ACTIVE ⚠ ⚠ ⚠\n')
    process.stdout.write('  This bypass skips the access review governance gate.\n')
    process.stdout.write('  This action is logged and must be reviewed by the CISO.\n')
    process.stdout.write('  BYPASS REASON REQUIRED: set ACCESS_REVIEW_BYPASS_REASON env var.\n')
    const reason = process.env['ACCESS_REVIEW_BYPASS_REASON'] ?? '(no reason provided)'
    process.stdout.write(`  Reason: ${reason}\n\n`)
    process.exit(0)
  }

  const jsonPath = path.join(ACCESS_REVIEW_DIR, `${quarter}.json`)

  if (!fs.existsSync(jsonPath)) {
    process.stdout.write('\n')
    process.stdout.write(`  ✗ FAIL: No access review attestation found for ${quarter}.\n`)
    process.stdout.write(`\n  Required file: reports/compliance/access-review/${quarter}.json\n`)
    process.stdout.write('\n  To generate:\n')
    process.stdout.write(`    pnpm ue:access-review:generate\n`)
    process.stdout.write('\n  To bypass (CISO approval required):\n')
    process.stdout.write(`    ACCESS_REVIEW_BYPASS=true ACCESS_REVIEW_BYPASS_REASON="..." pnpm ue:access-review:validate\n\n`)
    process.exit(1)
  }

  let review: AccessReviewJson
  try {
    review = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as AccessReviewJson
  } catch {
    process.stdout.write(`\n  ✗ FAIL: Cannot parse ${quarter}.json — file may be corrupt.\n\n`)
    process.exit(1)
  }

  // Validate schema version
  if (!review.schemaVersion || review.schemaVersion < 1) {
    process.stdout.write(`\n  ✗ FAIL: Invalid schemaVersion in ${quarter}.json.\n\n`)
    process.exit(1)
  }

  // Validate signoff status
  const signoff = review.signoffStatus ?? 'unsigned'
  if (!VALID_SIGNOFF_STATUSES.has(signoff)) {
    process.stdout.write(`\n  ✗ FAIL: Access review signoffStatus is '${signoff}'.\n`)
    process.stdout.write(`  Expected one of: ${[...VALID_SIGNOFF_STATUSES].join(', ')}\n`)
    process.stdout.write('\n  Update the attestation JSON and re-run.\n\n')
    process.exit(1)
  }

  // All checks passed
  process.stdout.write(`\n  ✓ Access review attestation for ${quarter} is valid.\n`)
  process.stdout.write(`    Reviewer:    ${review.reviewer ?? '(unset)'}\n`)
  process.stdout.write(`    Review date: ${review.reviewDate ?? '(unset)'}\n`)
  process.stdout.write(`    Status:      ${review.status ?? '(unset)'}\n`)
  process.stdout.write(`    Sign-off:    ${signoff}\n`)
  process.stdout.write(`    Next due:    ${review.nextReviewDue ?? '(unset)'}\n\n`)
}

main()
