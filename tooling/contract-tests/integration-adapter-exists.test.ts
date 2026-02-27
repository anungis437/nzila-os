/**
 * Contract Test — Integration Adapter Exists
 *
 * Structural invariant: Every integration provider listed in the
 * integrations-core type system MUST have a corresponding adapter
 * package with a health check and send implementation.
 *
 * @invariant INTEGRATION_ADAPTER_EXISTS_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// Map from provider → adapter package + expected export file
const providerAdapterMap: Record<string, { pkg: string; files: string[] }> = {
  resend: {
    pkg: 'packages/comms-email',
    files: ['src/adapters/resend.ts'],
  },
  sendgrid: {
    pkg: 'packages/comms-email',
    files: ['src/adapters/sendgrid.ts'],
  },
  mailgun: {
    pkg: 'packages/comms-email',
    files: ['src/adapters/mailgun.ts'],
  },
  twilio: {
    pkg: 'packages/comms-sms',
    files: ['src/adapters/twilio.ts'],
  },
  firebase: {
    pkg: 'packages/comms-push',
    files: ['src/adapters/firebase.ts'],
  },
  slack: {
    pkg: 'packages/chatops-slack',
    files: ['src/adapter.ts'],
  },
  teams: {
    pkg: 'packages/chatops-teams',
    files: ['src/adapter.ts'],
  },
  hubspot: {
    pkg: 'packages/crm-hubspot',
    files: ['src/adapter.ts'],
  },
}

describe('INTEGRATION_ADAPTER_EXISTS_001 — Every provider has an adapter package', () => {
  it('integrations-core types.ts declares all known providers', () => {
    const typesPath = join(ROOT, 'packages', 'integrations-core', 'src', 'types.ts')
    expect(existsSync(typesPath), 'integrations-core/src/types.ts must exist').toBe(true)

    const content = readFileSync(typesPath, 'utf-8')
    for (const provider of Object.keys(providerAdapterMap)) {
      expect(
        content.includes(`'${provider}'`),
        `Provider '${provider}' must be declared in integrations-core types`
      ).toBe(true)
    }
  })

  for (const [provider, { pkg, files }] of Object.entries(providerAdapterMap)) {
    describe(`Provider: ${provider}`, () => {
      it(`adapter package ${pkg} exists`, () => {
        const pkgJsonPath = join(ROOT, pkg, 'package.json')
        expect(existsSync(pkgJsonPath), `${pkg}/package.json must exist`).toBe(true)
      })

      for (const file of files) {
        it(`adapter file ${file} exists`, () => {
          const filePath = join(ROOT, pkg, file)
          expect(existsSync(filePath), `${pkg}/${file} must exist`).toBe(true)
        })

        it(`${file} implements IntegrationAdapter (send + healthCheck)`, () => {
          const filePath = join(ROOT, pkg, file)
          const content = readFileSync(filePath, 'utf-8')

          // Must reference IntegrationAdapter type
          expect(
            content.includes('IntegrationAdapter'),
            `${file} must reference IntegrationAdapter`
          ).toBe(true)

          // Must implement send
          expect(
            content.includes('send') && content.includes('SendResult'),
            `${file} must implement send() returning SendResult`
          ).toBe(true)

          // Must implement healthCheck
          expect(
            content.includes('healthCheck') && content.includes('HealthCheckResult'),
            `${file} must implement healthCheck() returning HealthCheckResult`
          ).toBe(true)
        })
      }
    })
  }

  it('integrations-core registry exports integrationRegistry', () => {
    const registryPath = join(ROOT, 'packages', 'integrations-core', 'src', 'registry.ts')
    expect(existsSync(registryPath), 'registry.ts must exist').toBe(true)

    const content = readFileSync(registryPath, 'utf-8')
    expect(content).toContain('export const integrationRegistry')
    expect(content).toContain('IntegrationRegistry')
  })
})
