/**
 * Contract Test — ABR Integrations Dispatcher-Only Enforcement
 *
 * ABR must not make direct outbound SDK calls for email, SMS, webhooks, or CRM.
 * All outbound communications must go through the integrations-runtime dispatcher.
 *
 * @invariant ABR_NO_DIRECT_SDK_001: No direct SDK usage for outbound comms
 * @invariant ABR_DISPATCHER_ONLY_002: ABR uses integrations-runtime dispatcher
 * @invariant ABR_INTEGRATION_EVENTS_003: ABR defines integration events
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const ABR_ROOT = join(ROOT, 'apps', 'abr')

function walkSync(
  dir: string,
  extensions: string[] = ['.ts', '.tsx'],
): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'dist', 'backend'].includes(entry.name)) continue
      results.push(...walkSync(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

function readContent(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

function relPath(fullPath: string): string {
  return fullPath.replace(ROOT, '').replace(/\\/g, '/')
}

// ── ABR_NO_DIRECT_SDK_001 ─────────────────────────────────────────────────

describe('ABR_NO_DIRECT_SDK_001 — No direct SDK usage for outbound comms in ABR', () => {
  // Patterns that indicate direct SDK usage instead of dispatcher
  const DIRECT_SDK_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
    { pattern: /from\s+['"]@sendgrid\/mail['"]/, description: 'Direct SendGrid SDK import' },
    { pattern: /from\s+['"]resend['"]/, description: 'Direct Resend SDK import' },
    { pattern: /from\s+['"]@mailgun/, description: 'Direct Mailgun SDK import' },
    { pattern: /from\s+['"]twilio['"]/, description: 'Direct Twilio SDK import' },
    { pattern: /from\s+['"]@slack\/web-api['"]/, description: 'Direct Slack SDK import' },
    { pattern: /from\s+['"]@microsoft\/microsoft-graph-client['"]/, description: 'Direct Microsoft Graph import' },
    { pattern: /from\s+['"]@hubspot/, description: 'Direct HubSpot SDK import' },
    { pattern: /from\s+['"]nodemailer['"]/, description: 'Direct Nodemailer import' },
    { pattern: /from\s+['"]@nzila\/comms-email['"]/, description: 'Direct comms-email import (use dispatcher)' },
    { pattern: /from\s+['"]@nzila\/comms-sms['"]/, description: 'Direct comms-sms import (use dispatcher)' },
    { pattern: /from\s+['"]@nzila\/comms-push['"]/, description: 'Direct comms-push import (use dispatcher)' },
    { pattern: /from\s+['"]@nzila\/chatops-slack['"]/, description: 'Direct chatops-slack import (use dispatcher)' },
    { pattern: /from\s+['"]@nzila\/chatops-teams['"]/, description: 'Direct chatops-teams import (use dispatcher)' },
    { pattern: /from\s+['"]@nzila\/crm-hubspot['"]/, description: 'Direct crm-hubspot import (use dispatcher)' },
  ]

  it('no direct outbound SDK imports in ABR Next.js app (excluding backend)', () => {
    const files = walkSync(ABR_ROOT)
    const violations: string[] = []

    for (const file of files) {
      const rel = relPath(file)
      // Skip test files
      if (rel.includes('.test.') || rel.includes('__tests__') || rel.includes('/fixtures/')) continue

      const content = readContent(file)
      for (const { pattern, description } of DIRECT_SDK_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${rel}: ${description}`)
        }
      }
    }

    expect(
      violations,
      `ABR has direct outbound SDK imports (must use integrations-runtime dispatcher):\n${violations.join('\n')}`,
    ).toEqual([])
  })
})

// ── ABR_DISPATCHER_ONLY_002 ────────────────────────────────────────────────

describe('ABR_DISPATCHER_ONLY_002 — ABR uses integrations-runtime dispatcher', () => {
  it('ABR integration-events.ts exists', () => {
    const eventsPath = join(ABR_ROOT, 'lib', 'integration-events.ts')
    expect(
      existsSync(eventsPath),
      'ABR must define integration events in lib/integration-events.ts',
    ).toBe(true)
  })

  it('integration-events.ts imports from @nzila/integrations-core', () => {
    const eventsPath = join(ABR_ROOT, 'lib', 'integration-events.ts')
    if (!existsSync(eventsPath)) return

    const content = readContent(eventsPath)
    expect(
      content.includes('@nzila/integrations-core'),
      'ABR integration events must import types from @nzila/integrations-core',
    ).toBe(true)
  })

  it('integration-events.ts exports buildAbrSendRequest', () => {
    const eventsPath = join(ABR_ROOT, 'lib', 'integration-events.ts')
    if (!existsSync(eventsPath)) return

    const content = readContent(eventsPath)
    expect(content).toContain('buildAbrSendRequest')
  })
})

// ── ABR_INTEGRATION_EVENTS_003 ─────────────────────────────────────────────

describe('ABR_INTEGRATION_EVENTS_003 — ABR defines required integration events', () => {
  it('ABR integration events cover core notification scenarios', () => {
    const eventsPath = join(ABR_ROOT, 'lib', 'integration-events.ts')
    if (!existsSync(eventsPath)) return

    const content = readContent(eventsPath)
    expect(content).toContain('CASE_STATUS_NOTIFICATION')
    expect(content).toContain('DECISION_NOTIFICATION')
  })
})
