/**
 * Domain vs Audit Model — contract test
 *
 * Verifies that business UI pages and business services in target apps
 * do not directly query audit/evidence tables as their primary data source.
 *
 * Allowed exceptions are documented in domain-audit-allowlist.json.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

const allowlist: {
  allowlist: string[]
  audit_table_patterns: string[]
  audit_import_patterns: string[]
} = JSON.parse(fs.readFileSync(join(__dirname, 'domain-audit-allowlist.json'), 'utf-8'))

const TARGET_APPS = ['union-eyes', 'zonga', 'cfo', 'partners']

const BUSINESS_DIRS = [
  'app/(dashboard)',
  'app/(app)',
  'lib/services',
  'lib/actions',
  'server/services',
  'server/actions',
]

function isAllowlisted(filePath: string): boolean {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/')
  return allowlist.allowlist.some((pattern) => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '[^/]*').replace(/\*\*/g, '.*') + '$')
    return regex.test(rel)
  })
}

function scanDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      results.push(...scanDir(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      results.push(full)
    }
  }
  return results
}

function checkFileForAuditMisuse(filePath: string): string[] {
  if (isAllowlisted(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  const violations: string[] = []

  // Check for direct audit table references in queries
  for (const pattern of allowlist.audit_table_patterns) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'g')
    if (regex.test(content)) {
      // Exclude comments and string-only references in type definitions
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith('//') || line.startsWith('*')) continue
        if (regex.test(line)) {
          violations.push(
            `${path.relative(ROOT, filePath)}:${i + 1} — references audit table "${pattern}" in business logic`,
          )
        }
      }
    }
  }

  // Check for suspicious audit package imports in business logic
  for (const pattern of allowlist.audit_import_patterns) {
    const regex = new RegExp(pattern)
    if (regex.test(content)) {
      const rel = path.relative(ROOT, filePath).replace(/\\/g, '/')
      // Only flag if the file is in a business directory, not an audit view
      if (!rel.includes('/evidence/') && !rel.includes('/audit/') && !rel.includes('/governance/')) {
        violations.push(
          `${rel} — imports audit/evidence package in business context (pattern: ${pattern})`,
        )
      }
    }
  }

  return violations
}

describe('Domain vs Audit Model boundary', () => {
  for (const app of TARGET_APPS) {
    describe(`apps/${app}`, () => {
      it('business logic must not query audit/evidence tables as primary data source', () => {
        const appDir = path.join(ROOT, 'apps', app)
        if (!fs.existsSync(appDir)) return

        const violations: string[] = []

        for (const subDir of BUSINESS_DIRS) {
          const dir = path.join(appDir, subDir)
          const files = scanDir(dir)
          for (const file of files) {
            violations.push(...checkFileForAuditMisuse(file))
          }
        }

        if (violations.length > 0) {
          const msg = [
            `Domain vs Audit boundary violations in apps/${app}:`,
            '',
            ...violations.map((v) => `  - ${v}`),
            '',
            'Business UI pages and services must not query audit/evidence tables',
            'as their primary data source. See docs/DOMAIN_VS_AUDIT_MODEL.md',
            '',
            'If this is a legitimate audit view, add the path to',
            'tooling/contract-tests/domain-audit-allowlist.json',
          ].join('\n')
          expect.fail(msg)
        }
      })
    })
  }
})
