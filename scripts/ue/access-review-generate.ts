#!/usr/bin/env tsx
/**
 * access-review-generate.ts — Prepare a quarterly access review packet.
 *
 * This creates an unsigned scaffold only. It does not enumerate identities,
 * verify controls, record an approval, or satisfy the access-review gate.
 *
 * Usage:
 *   pnpm exec tsx scripts/ue/access-review-generate.ts
 *   pnpm exec tsx scripts/ue/access-review-generate.ts --quarter 2026-Q4
 *   pnpm exec tsx scripts/ue/access-review-generate.ts --operator security-team
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const ACCESS_REVIEW_DIR = path.join(ROOT, 'reports', 'compliance', 'access-review')
const REVIEW_SCOPE = [
  'privileged-admins',
  'elevated-roles',
  'dormant-accounts',
  'cross-org-anomalies',
  'sso-scim-sync',
]
const REQUIRED_EVIDENCE = [
  'Current privileged account and elevated-role enumeration',
  'Dormant and orphaned account review',
  'SSO/SCIM provisioning and deprovisioning evidence',
  'Cross-organization access-isolation review',
  'Completed findings, dispositions, and remediation owners',
]

function currentQuarterLabel(): string {
  const d = new Date()
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}-Q${q}`
}

function nextQuarterLabel(current: string): string {
  const [year, qStr] = current.split('-Q')
  const q = Number.parseInt(qStr ?? '1', 10)
  if (q === 4) return `${Number.parseInt(year ?? '2026', 10) + 1}-Q1`
  return `${year}-Q${q + 1}`
}

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1]
  }
  const prefix = `${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

function main(): void {
  const quarter = parseArg('--quarter') ?? currentQuarterLabel()
  if (!/^\d{4}-Q[1-4]$/.test(quarter)) {
    process.stderr.write(`Invalid quarter '${quarter}'; expected YYYY-Q1 through YYYY-Q4.\n`)
    process.exitCode = 1
    return
  }

  const preparedBy =
    parseArg('--operator') ??
    process.env.GITHUB_ACTOR ??
    process.env.USER ??
    'unidentified-operator'
  const preparedAt = new Date().toISOString()
  const nextReviewDue = nextQuarterLabel(quarter)
  const jsonPath = path.join(ACCESS_REVIEW_DIR, `${quarter}.json`)
  const mdPath = path.join(ACCESS_REVIEW_DIR, `${quarter}.md`)

  if (fs.existsSync(jsonPath) && fs.existsSync(mdPath)) {
    process.stdout.write(
      `Access review packet for ${quarter} already exists; leaving it unchanged.\n`,
    )
    process.stdout.write(`  ${path.relative(ROOT, jsonPath)}\n`)
    process.stdout.write(`  ${path.relative(ROOT, mdPath)}\n`)
    return
  }

  fs.mkdirSync(ACCESS_REVIEW_DIR, { recursive: true })

  const jsonContent = {
    schemaVersion: 1,
    quarter,
    status: 'pending-review',
    signoffStatus: 'pending-review',
    app: 'union-eyes',
    preparedBy,
    preparedAt,
    reviewer: null,
    reviewDate: null,
    approvedBy: null,
    approvedAt: null,
    reviewScope: REVIEW_SCOPE,
    requiredEvidence: REQUIRED_EVIDENCE,
    evidence: [],
    findings: null,
    controls: null,
    exceptions: null,
    remediationOwner: null,
    remediationTarget: null,
    nextReviewDue,
    automationScript: 'scripts/ue/access-review-generate.ts',
    validatorScript: 'scripts/ue/access-review-validate.ts',
    evidenceArtifact: `reports/compliance/access-review/${quarter}.json`,
  }

  const mdContent = `# Union Eyes — Quarterly Privileged-Access Review

> **Quarter:** ${quarter}
> **Packet prepared:** ${preparedAt}
> **Prepared by:** ${preparedBy}
> **Reviewer:** Not assigned
> **Approval:** Pending human review
> **Classification:** Internal — CISO-Shareable

---

## Review status

This is an unsigned preparation packet, not an attestation. No identities have
been enumerated, no controls have been marked verified, and no approval has
been recorded. This packet does not satisfy the access-review governance gate.

## Review scope

Complete each review area and link its source evidence before sign-off.

| Area | Completed | Evidence reference |
|------|-----------|-------------------|
| Privileged admin accounts | [ ] | |
| Elevated role assignments | [ ] | |
| Dormant and orphaned accounts | [ ] | |
| SSO / SCIM provisioning and deprovisioning | [ ] | |
| Cross-organization access anomalies | [ ] | |

## Required evidence

${REQUIRED_EVIDENCE.map((item) => `- [ ] ${item}`).join('\n')}

## Findings and remediation

Record each finding, its disposition, and an accountable remediation owner.
Do not record “none” until the review has been completed.

## Human sign-off

| Field | Value |
|-------|-------|
| Reviewer | Not assigned |
| Review date | Not completed |
| Approver | Not provided |
| Approval timestamp | Not provided |
| Evidence references | Not provided |

To pass validation, complete the JSON packet with a reviewer, valid review
date, explicit approved status, approver, approval timestamp, and at least one
evidence reference. Pending or incomplete packets remain blocked.

## Next review

**Due:** ${nextReviewDue}

\`\`\`bash
pnpm exec tsx scripts/ue/access-review-generate.ts --quarter ${nextReviewDue}
pnpm exec tsx scripts/ue/access-review-validate.ts
\`\`\`

---

_Prepared: ${preparedAt} · Operator: ${preparedBy}_
`

  fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf-8')
  fs.writeFileSync(mdPath, mdContent, 'utf-8')

  process.stdout.write(`\nAccess review packet prepared for ${quarter}.\n`)
  process.stdout.write('  Status: pending human review; not an attestation.\n')
  process.stdout.write(`  JSON: ${path.relative(ROOT, jsonPath)}\n`)
  process.stdout.write(`  Markdown: ${path.relative(ROOT, mdPath)}\n`)
}

if (require.main === module) main()
