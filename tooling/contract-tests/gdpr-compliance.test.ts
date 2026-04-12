/**
 * GDPR Compliance Contract Tests
 *
 * @invariant GDPR_001 — GDPR API routes must exist for consent management, data export, and data erasure
 * @invariant GDPR_002 — Consumer-facing apps must include a privacy policy link in their footer
 * @invariant GDPR_003 — GDPR consent purposes must be defined and non-empty
 * @invariant GDPR_004 — GDPR DB schema must include request tracking tables
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROOT,
  readContent,
  relPath,
  formatViolations,
  type Violation,
} from './governance-helpers'

/** Required GDPR API route paths under union-eyes */
const REQUIRED_GDPR_ROUTES = [
  'apps/union-eyes/app/api/gdpr/consents/route.ts',
  'apps/union-eyes/app/api/gdpr/requests/route.ts',
  'apps/union-eyes/app/api/gdpr/data-export/route.ts',
  'apps/union-eyes/app/api/gdpr/data-erasure/route.ts',
  'apps/union-eyes/app/api/gdpr/cookie-consent/route.ts',
]

/** Consumer-facing apps expected to have a privacy policy link */
const CONSUMER_FACING_APPS = [
  'trade',
  'partners',
  'agrimo',
  'cora',
  'zonga',
]

describe('GDPR_001 — GDPR API routes exist', () => {
  it('should have all required GDPR API routes', () => {
    const violations: Violation[] = []

    for (const route of REQUIRED_GDPR_ROUTES) {
      const absPath = join(ROOT, route)
      if (!existsSync(absPath)) {
        violations.push({
          ruleId: 'GDPR_001',
          filePath: route,
          remediation: `Create GDPR route handler at ${route}`,
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

describe('GDPR_002 — Privacy policy links in consumer-facing apps', () => {
  it('should include a privacy policy link in footer components', () => {
    const violations: Violation[] = []

    for (const app of CONSUMER_FACING_APPS) {
      const footerCandidates = [
        `apps/${app}/components/public/site-footer.tsx`,
        `apps/${app}/components/footer.tsx`,
        `apps/${app}/components/layout/footer.tsx`,
        `apps/${app}/components/site-footer.tsx`,
      ]

      const footerFile = footerCandidates.find((c) =>
        existsSync(join(ROOT, c)),
      )

      if (!footerFile) {
        violations.push({
          ruleId: 'GDPR_002',
          filePath: `apps/${app}/`,
          remediation: `Add a footer component with a privacy policy link`,
        })
        continue
      }

      const content = readContent(join(ROOT, footerFile))
      const hasPrivacyLink =
        /privacy/i.test(content) || /data.?protection/i.test(content)

      if (!hasPrivacyLink) {
        violations.push({
          ruleId: 'GDPR_002',
          filePath: footerFile,
          remediation: `Add a link to the privacy policy (e.g., /privacy or /legal/privacy)`,
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

describe('GDPR_003 — Consent purposes are defined', () => {
  it('should have a consent purposes module with defined purposes', () => {
    const consentPurposesPath = join(
      ROOT,
      'apps/union-eyes/lib/gdpr/consent-purposes.ts',
    )
    const violations: Violation[] = []

    if (!existsSync(consentPurposesPath)) {
      violations.push({
        ruleId: 'GDPR_003',
        filePath: 'apps/union-eyes/lib/gdpr/consent-purposes.ts',
        remediation: `Create consent purposes definition module`,
      })
    } else {
      const content = readContent(consentPurposesPath)
      // Must export at least one consent purpose
      if (
        !content.includes('export') ||
        (!content.includes('purpose') && !content.includes('Purpose'))
      ) {
        violations.push({
          ruleId: 'GDPR_003',
          filePath: relPath(consentPurposesPath),
          remediation: `Consent purposes module must export defined purposes`,
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

describe('GDPR_004 — GDPR DB schema includes request tracking', () => {
  it('should define GDPR data request table in the database schema', () => {
    const violations: Violation[] = []

    // Check for GDPR request schema in Drizzle schema files, migrations, or migration snapshots
    const searchDirs = [
      join(ROOT, 'apps/union-eyes/db'),
      join(ROOT, 'apps/union-eyes/lib/db'),
      join(ROOT, 'migrations'),
    ]

    let foundGdprSchema = false

    for (const dir of searchDirs) {
      if (foundGdprSchema) break
      if (!existsSync(dir)) continue

      const { readdirSync } = require('node:fs')
      try {
        const files = readdirSync(dir, { recursive: true }) as string[]
        for (const file of files) {
          const name = String(file)
          if (!name.endsWith('.ts') && !name.endsWith('.sql') && !name.endsWith('.json')) continue
          const content = readContent(join(dir, name))
          if (
            content.includes('gdpr_requests') ||
            content.includes('gdpr_data_requests') ||
            content.includes('gdprRequests') ||
            content.includes('gdprDataRequests')
          ) {
            foundGdprSchema = true
            break
          }
        }
      } catch {
        // Directory might not be readable
      }
    }

    if (!foundGdprSchema) {
      violations.push({
        ruleId: 'GDPR_004',
        filePath: 'apps/union-eyes/db/',
        remediation: `Define gdpr_data_requests table in the Drizzle schema or migrations`,
      })
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})
