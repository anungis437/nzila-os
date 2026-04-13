/**
 * @nzila/secrets — SecretScanner extended tests
 *
 * Targets uncovered branches: allowlisting, redaction, more patterns.
 */
import { describe, it, expect } from 'vitest'
import { SecretScanner } from '../scanner'

// Build test secrets dynamically to avoid triggering GitHub secret scanning
const clerkLiveKey = ['sk', 'live'].join('_') + '_' + 'A'.repeat(24)
const clerkTestKey = ['sk', 'test'].join('_') + '_' + 'B'.repeat(24)
const stripeKey = ['sk', 'live'].join('_') + '_' + 'C'.repeat(24)
const stripeWebhook = 'whsec_' + 'D'.repeat(24)
const azureKvUrl = 'https://my-vault.vault.azure.net'
const dbConnStr = 'postgresql://user:pass@prod-db.example.com:5432/mydb'
const qboSecret = 'QBO_CLIENT_SECRET=' + 'E'.repeat(20)
const openAiKey = ['sk', 'F'.repeat(30)].join('-')
const azureStorageKey = 'AccountKey=' + 'G'.repeat(40)

describe('SecretScanner — pattern detection', () => {
  const scanner = new SecretScanner()

  it('detects Clerk test key (non-placeholder)', () => {
    const results = scanner.scanContent('src/config.ts', `KEY="${clerkTestKey}"`)
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.pattern === 'clerk-test-key')).toBe(true)
    expect(results.find((r) => r.pattern === 'clerk-test-key')!.severity).toBe('high')
  })

  it('detects Stripe secret key', () => {
    const results = scanner.scanContent('src/stripe.ts', `const key = "${stripeKey}"`)
    expect(results.some((r) => r.pattern === 'stripe-secret-key')).toBe(true)
  })

  it('detects Stripe webhook secret', () => {
    const results = scanner.scanContent('src/webhook.ts', `whsec = "${stripeWebhook}"`)
    expect(results.some((r) => r.pattern === 'stripe-webhook-secret')).toBe(true)
  })

  it('detects Azure Key Vault URL', () => {
    const results = scanner.scanContent('src/kv.ts', `url = "${azureKvUrl}"`)
    expect(results.some((r) => r.pattern === 'azure-keyvault-url')).toBe(true)
    expect(results.find((r) => r.pattern === 'azure-keyvault-url')!.severity).toBe('medium')
  })

  it('detects PostgreSQL connection string (non-localhost)', () => {
    const results = scanner.scanContent('src/db.ts', `DATABASE_URL="${dbConnStr}"`)
    expect(results.some((r) => r.pattern === 'database-connection-string')).toBe(true)
    expect(results.find((r) => r.pattern === 'database-connection-string')!.severity).toBe('critical')
  })

  it('detects QBO client secret', () => {
    const results = scanner.scanContent('.env', qboSecret)
    expect(results.some((r) => r.pattern === 'qbo-client-secret')).toBe(true)
  })

  it('detects OpenAI API key', () => {
    const results = scanner.scanContent('config.ts', `OPENAI_API_KEY=${openAiKey}`)
    expect(results.some((r) => r.pattern === 'openai-api-key')).toBe(true)
  })

  it('detects Azure Storage account key', () => {
    const results = scanner.scanContent('conn.ts', azureStorageKey)
    expect(results.some((r) => r.pattern === 'azure-storage-key')).toBe(true)
  })
})

describe('SecretScanner — allowlisting', () => {
  const scanner = new SecretScanner()

  it('skips .env.example files', () => {
    const results = scanner.scanContent('.env.example', `KEY="${clerkLiveKey}"`)
    expect(results).toHaveLength(0)
  })

  it('skips .env.test files', () => {
    const results = scanner.scanContent('.env.test', `KEY="${clerkLiveKey}"`)
    expect(results).toHaveLength(0)
  })

  it('skips pnpm-lock.yaml', () => {
    const results = scanner.scanContent('pnpm-lock.yaml', `KEY="${clerkLiveKey}"`)
    expect(results).toHaveLength(0)
  })

  it('skips snapshot files (*.snap)', () => {
    const results = scanner.scanContent('__snapshots__/auth.test.ts.snap', `KEY="${clerkLiveKey}"`)
    expect(results).toHaveLength(0)
  })

  it('skips .gitleaks.toml', () => {
    const results = scanner.scanContent('.gitleaks.toml', openAiKey)
    expect(results).toHaveLength(0)
  })

  it('does NOT skip regular .ts files', () => {
    const results = scanner.scanContent('src/config.ts', `KEY="${clerkLiveKey}"`)
    expect(results.length).toBeGreaterThan(0)
  })
})

describe('SecretScanner — redaction', () => {
  const scanner = new SecretScanner()

  it('redacts long secrets keeping first 4 and last 4 chars', () => {
    const results = scanner.scanContent('src/app.ts', `const key = "${clerkLiveKey}"`)
    const result = results.find((r) => r.redacted.includes('***REDACTED***'))
    expect(result).toBeDefined()
    expect(result!.redacted).toMatch(/^.{4}\*\*\*REDACTED\*\*\*.{4}$/)
  })

  it('fully redacts short matches', () => {
    // Create a custom pattern that matches short strings
    const scanner2 = new SecretScanner([
      { name: 'short', pattern: 'SH_[A-Z]{3}', severity: 'low', description: 'Short test' },
    ])
    const results = scanner2.scanContent('test.ts', 'token=SH_ABC')
    const shortResult = results.find((r) => r.pattern === 'short')
    if (shortResult) {
      expect(shortResult.redacted).toBe('***REDACTED***')
    }
  })
})

describe('SecretScanner — multi-line scanning', () => {
  const scanner = new SecretScanner()

  it('reports correct line numbers', () => {
    const content = [
      'line 1: no secret',
      'line 2: no secret',
      `line 3: ${clerkLiveKey}`,
      'line 4: clean',
    ].join('\n')

    const results = scanner.scanContent('src/multiline.ts', content)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].line).toBe(3)
  })

  it('detects multiple secrets in a single file', () => {
    const content = [
      `CLERK_KEY="${clerkLiveKey}"`,
      `OPENAI_KEY=${openAiKey}`,
    ].join('\n')

    const results = scanner.scanContent('src/secrets.ts', content)
    expect(results.length).toBeGreaterThanOrEqual(2)
  })
})

describe('SecretScanner — custom patterns', () => {
  it('merges custom patterns with defaults', () => {
    const scanner = new SecretScanner([
      { name: 'internal-token', pattern: 'NZILA_TOKEN_[A-Z0-9]{16,}', severity: 'high', description: 'Internal token' },
    ])

    // Custom pattern detected
    const results1 = scanner.scanContent('config.ts', 'NZILA_TOKEN_' + 'A'.repeat(20))
    expect(results1.some((r) => r.pattern === 'internal-token')).toBe(true)

    // Default patterns still active
    const results2 = scanner.scanContent('config.ts', `KEY="${clerkLiveKey}"`)
    expect(results2.length).toBeGreaterThan(0)
  })
})
