import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { runArchitectureAudit } from '../architecture-audit'

// ── Helpers ─────────────────────────────────────────────────────────────────

function scaffold(tmpDir: string) {
  mkdirSync(join(tmpDir, 'packages'), { recursive: true })
  mkdirSync(join(tmpDir, 'apps'), { recursive: true })
  writeFileSync(join(tmpDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - apps/*')
}

function writeFile(tmpDir: string, relPath: string, content: string) {
  const full = join(tmpDir, relPath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('runArchitectureAudit', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), 'arch-audit-'))
    scaffold(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // ── Empty monorepo ──────────────────────────────────────────────────────

  it('returns empty report for empty monorepo', () => {
    const report = runArchitectureAudit(tmpDir)
    expect(report.totalFiles).toBe(0)
    expect(report.totalFindings).toBe(0)
    expect(report.findingsBySeverity).toEqual({ error: 0, warning: 0, info: 0 })
  })

  it('has generatedAt and correct structure', () => {
    const report = runArchitectureAudit(tmpDir)
    expect(report.generatedAt).toBeTruthy()
    expect(report.findingsByRule).toBeDefined()
    expect(report.findings).toEqual([])
  })

  // ── no-direct-provider-sdk: banned imports in apps ──────────────────────

  it('flags direct Azure Blob SDK import in app non-wrapper file', () => {
    writeFile(tmpDir, 'apps/web/src/api/upload.ts',
      `import { BlobServiceClient } from '@azure/storage-blob'\nexport function upload() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'no-direct-provider-sdk')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0]!.severity).toBe('warning')
    expect(findings[0]!.message).toContain('Azure Blob')
  })

  it('flags Stripe SDK import in app non-wrapper file', () => {
    writeFile(tmpDir, 'apps/web/src/components/checkout.ts',
      `import Stripe from 'stripe'\nexport function pay() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'no-direct-provider-sdk')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0]!.message).toContain('Stripe')
  })

  it('flags SendGrid SDK import', () => {
    writeFile(tmpDir, 'apps/console/src/utils/mailer.ts',
      `import sgMail from '@sendgrid/mail'\nexport function send() {}\n`,
    )
    // mailer → not matching /wrapper|client|service|worker|encryption|auth|keyvault|speech/
    // wait, actually "mailer" doesn't match. But parentDir is "utils" not "lib"/"services".
    // So it should be flagged as a warning.
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'no-direct-provider-sdk')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0]!.message).toContain('SendGrid')
  })

  // ── no-direct-provider-sdk: allowed in wrapper packages ─────────────────

  it('allows Azure SDK in blob wrapper package', () => {
    writeFile(tmpDir, 'packages/blob/src/client.ts',
      `import { BlobServiceClient } from '@azure/storage-blob'\nexport function upload() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'no-direct-provider-sdk' && f.file.includes('packages/blob'),
    )
    expect(findings).toEqual([])
  })

  it('allows Stripe SDK in payments-stripe wrapper package', () => {
    writeFile(tmpDir, 'packages/payments-stripe/src/charge.ts',
      `import Stripe from 'stripe'\nexport function charge() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'no-direct-provider-sdk' && f.file.includes('packages/payments-stripe'),
    )
    expect(findings).toEqual([])
  })

  // ── no-direct-provider-sdk: local wrappers in apps ──────────────────────

  it('emits info (not warning) for app local wrapper files (lib/ dir)', () => {
    writeFile(tmpDir, 'apps/web/lib/blob-client.ts',
      `import { BlobServiceClient } from '@azure/storage-blob'\nexport function getClient() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'no-direct-provider-sdk' && f.file.includes('lib/blob-client'),
    )
    // Local wrappers in lib/ should get info severity
    expect(findings.every(f => f.severity === 'info')).toBe(true)
  })

  it('emits info for app service file using SDK', () => {
    writeFile(tmpDir, 'apps/web/services/storage.ts',
      `import { BlobServiceClient } from '@azure/storage-blob'\nexport function getClient() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'no-direct-provider-sdk' && f.file.includes('services/storage'),
    )
    expect(findings.every(f => f.severity === 'info')).toBe(true)
  })

  // ── no-direct-provider-sdk: non-wrapper package ─────────────────────────

  it('flags SDK import in non-wrapper package', () => {
    writeFile(tmpDir, 'packages/utils/src/helper.ts',
      `import Stripe from 'stripe'\nexport function helper() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'no-direct-provider-sdk')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0]!.severity).toBe('warning')
  })

  // ── org-isolation ───────────────────────────────────────────────────────

  it('flags req.body.orgId in API route', () => {
    writeFile(tmpDir, 'apps/web/src/app/api/users/route.ts',
      `export async function POST(req: unknown) {\n  const orgId = req.body.orgId\n  return new Response('ok')\n}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'org-isolation')
    expect(findings.length).toBe(1)
    expect(findings[0]!.severity).toBe('error')
    expect(findings[0]!.message).toContain('org_id extracted from request body')
  })

  it('flags request.body.org_id in API route', () => {
    writeFile(tmpDir, 'apps/console/src/app/api/data/route.ts',
      `export async function POST(request: unknown) {\n  const id = request.body.org_id\n}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'org-isolation')
    expect(findings.length).toBe(1)
  })

  it('does not flag non-route files for org-isolation', () => {
    writeFile(tmpDir, 'apps/web/src/utils/parser.ts',
      `function parse(req: unknown) { return req.body.orgId; }\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'org-isolation')
    expect(findings).toEqual([])
  })

  // ── correlation-ids ─────────────────────────────────────────────────────

  it('flags API route without correlation IDs', () => {
    writeFile(tmpDir, 'apps/web/src/app/api/items/route.ts',
      `export async function GET() {\n  return new Response('[]')\n}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'correlation-ids')
    expect(findings.length).toBe(1)
    expect(findings[0]!.severity).toBe('warning')
  })

  it('does not flag API route with requestId', () => {
    writeFile(tmpDir, 'apps/web/src/app/api/items/route.ts',
      `export async function GET() {\n  const requestId = crypto.randomUUID()\n  return new Response('[]')\n}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'correlation-ids')
    expect(findings).toEqual([])
  })

  it('skips health endpoint for correlation ID check', () => {
    writeFile(tmpDir, 'apps/web/src/app/api/health/route.ts',
      `export async function GET() {\n  return new Response('ok')\n}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'correlation-ids')
    expect(findings).toEqual([])
  })

  it('skips status endpoint for correlation ID check', () => {
    writeFile(tmpDir, 'apps/web/src/app/api/status/route.ts',
      `export async function GET() { return new Response('ok') }\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'correlation-ids')
    expect(findings).toEqual([])
  })

  // ── config-fail-fast ────────────────────────────────────────────────────

  it('flags env.ts without Zod validation', () => {
    writeFile(tmpDir, 'apps/web/src/env.ts',
      `export const DATABASE_URL = process.env.DATABASE_URL ?? ''\nexport const PORT = process.env.PORT ?? '3000'\n// more than 100 chars of config content here to trigger the rule that requires >100 chars of content in the file\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'config-fail-fast')
    expect(findings.length).toBe(1)
    expect(findings[0]!.severity).toBe('warning')
    expect(findings[0]!.message).toContain('Zod validation')
  })

  it('does not flag env.ts with Zod', () => {
    writeFile(tmpDir, 'apps/web/src/env.ts',
      `import { z } from 'zod'\nconst schema = z.object({ DATABASE_URL: z.string() })\nexport const env = schema.parse(process.env)\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'config-fail-fast')
    expect(findings).toEqual([])
  })

  it('ignores non-env config files (tailwind.config.ts)', () => {
    writeFile(tmpDir, 'apps/web/tailwind.config.ts',
      `export default { content: ['./src/**/*.tsx'] }\n// lots of configuration here\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'config-fail-fast')
    expect(findings).toEqual([])
  })

  // ── platform-structure ──────────────────────────────────────────────────

  it('flags platform package missing barrel export', () => {
    const pkgDir = join(tmpDir, 'packages', 'platform-auth')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/platform-auth"}')
    writeFileSync(join(pkgDir, 'src', 'auth.ts'), 'export function login() {}')

    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.message.includes('barrel export'),
    )
    expect(findings.length).toBe(1)
  })

  it('does not flag platform package with src/index.ts', () => {
    const pkgDir = join(tmpDir, 'packages', 'platform-auth')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/platform-auth"}')
    writeFileSync(join(pkgDir, 'src', 'index.ts'), 'export * from "./auth"')
    writeFileSync(join(pkgDir, 'src', 'auth.ts'), 'export function login() {}')

    const report = runArchitectureAudit(tmpDir)
    const barrelFindings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.message.includes('barrel export'),
    )
    expect(barrelFindings).toEqual([])
  })

  it('flags platform package without test files', () => {
    const pkgDir = join(tmpDir, 'packages', 'platform-utils')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/platform-utils"}')
    writeFileSync(join(pkgDir, 'src', 'index.ts'), 'export const x = 1')

    const report = runArchitectureAudit(tmpDir)
    const testFindings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.message.includes('no test files'),
    )
    expect(testFindings.length).toBe(1)
  })

  it('does not flag platform package with test files', () => {
    const pkgDir = join(tmpDir, 'packages', 'platform-tested')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/platform-tested"}')
    writeFileSync(join(pkgDir, 'src', 'index.ts'), 'export const x = 1')
    writeFileSync(join(pkgDir, 'src', 'index.test.ts'), 'it("works", () => {})')

    const report = runArchitectureAudit(tmpDir)
    const testFindings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.message.includes('no test files') && f.file.includes('platform-tested'),
    )
    expect(testFindings).toEqual([])
  })

  // ── Aggregation ─────────────────────────────────────────────────────────

  it('correctly aggregates findings by rule and severity', () => {
    // Two routes without correlation IDs → 2 correlation-ids warnings
    writeFile(tmpDir, 'apps/web/src/app/api/a/route.ts', `export async function GET() { return new Response('a') }\n`)
    writeFile(tmpDir, 'apps/web/src/app/api/b/route.ts', `export async function GET() { return new Response('b') }\n`)

    const report = runArchitectureAudit(tmpDir)
    expect(report.findingsByRule['correlation-ids']).toBe(2)
    expect(report.findingsBySeverity.warning).toBeGreaterThanOrEqual(2)
  })

  // ── Multiple banned imports in same file ────────────────────────────────

  it('reports each banned import separately', () => {
    writeFile(tmpDir, 'apps/web/src/mixed.ts', [
      `import { BlobServiceClient } from '@azure/storage-blob'`,
      `import Stripe from 'stripe'`,
      `export function process() {}`,
    ].join('\n'))
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'no-direct-provider-sdk')
    expect(findings.length).toBe(2)
    expect(findings.map(f => f.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Azure Blob'),
        expect.stringContaining('Stripe'),
      ]),
    )
  })

  // ── Additional provider SDKs ────────────────────────────────────────────

  it('flags Twilio SDK import', () => {
    writeFile(tmpDir, 'apps/web/src/sms.ts',
      `import twilio from 'twilio'\nexport function send() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'no-direct-provider-sdk')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0]!.message).toContain('Twilio')
  })

  it('flags OpenAI SDK import', () => {
    writeFile(tmpDir, 'apps/web/src/ai.ts',
      `import OpenAI from 'openai'\nexport function chat() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'no-direct-provider-sdk')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0]!.message).toContain('OpenAI')
  })

  it('flags HubSpot SDK import', () => {
    writeFile(tmpDir, 'apps/web/src/crm.ts',
      `import { Client } from '@hubspot/api-client'\nexport function sync() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'no-direct-provider-sdk')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0]!.message).toContain('HubSpot')
  })

  it('flags Azure Identity SDK import', () => {
    writeFile(tmpDir, 'apps/web/src/identity.ts',
      `import { DefaultAzureCredential } from '@azure/identity'\nexport const cred = new DefaultAzureCredential()\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'no-direct-provider-sdk')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0]!.message).toContain('Azure Identity')
  })

  it('flags Azure Key Vault SDK import', () => {
    writeFile(tmpDir, 'apps/web/src/vault.ts',
      `import { SecretClient } from '@azure/keyvault-secrets'\nexport function getSecret() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'no-direct-provider-sdk')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0]!.message).toContain('Azure Key Vault')
  })

  // ── Allowed wrapper packages for each SDK ───────────────────────────────

  it('allows OpenAI SDK in ai-core wrapper package', () => {
    writeFile(tmpDir, 'packages/ai-core/src/model.ts',
      `import OpenAI from 'openai'\nexport function complete() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'no-direct-provider-sdk' && f.file.includes('ai-core'),
    )
    expect(findings).toEqual([])
  })

  it('allows Twilio SDK in comms-sms wrapper package', () => {
    writeFile(tmpDir, 'packages/comms-sms/src/sender.ts',
      `import twilio from 'twilio'\nexport function send() {}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'no-direct-provider-sdk' && f.file.includes('comms-sms'),
    )
    expect(findings).toEqual([])
  })

  // ── config-fail-fast: short env file (<=100 chars) ──────────────────────

  it('does not flag very short env.ts (<=100 chars)', () => {
    writeFile(tmpDir, 'apps/web/src/env.ts', `export const PORT = '3000'\n`)
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'config-fail-fast')
    expect(findings).toEqual([])
  })

  // ── config-fail-fast: environment.ts file name ──────────────────────────

  it('flags environment.ts without Zod', () => {
    writeFile(tmpDir, 'apps/web/src/environment.ts',
      `export const DATABASE_URL = process.env.DATABASE_URL ?? ''\n// padding to ensure > 100 chars of content so the rule triggers properly for environment.ts files\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'config-fail-fast')
    expect(findings.length).toBe(1)
  })

  // ── config-fail-fast: env.ts inside node_modules is skipped ─────────────

  it('skips env.ts inside node_modules', () => {
    writeFile(tmpDir, 'apps/web/node_modules/some-lib/env.ts',
      `export const X = process.env.X ?? ''\n// padding padding padding padding padding padding to exceed one hundred characters for the rule check\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    // node_modules should be excluded from walkFiles
    const findings = report.findings.filter(f =>
      f.rule === 'config-fail-fast' && f.file.includes('node_modules'),
    )
    expect(findings).toEqual([])
  })

  // ── platform-structure: integrations- prefix packages ─────────────────

  it('does not flag non-platform packages (integrations- prefix is not platform)', () => {
    const pkgDir = join(tmpDir, 'packages', 'utils')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/utils"}')
    writeFileSync(join(pkgDir, 'src', 'index.ts'), 'export const x = 1')

    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.file.includes('utils'),
    )
    expect(findings).toEqual([])
  })

  // ── platform-structure: package with __tests__ dir ─────────────────────

  it('accepts platform package with __tests__ directory', () => {
    const pkgDir = join(tmpDir, 'packages', 'platform-db')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    mkdirSync(join(pkgDir, '__tests__'), { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/platform-db"}')
    writeFileSync(join(pkgDir, 'src', 'index.ts'), 'export const db = {}')
    writeFileSync(join(pkgDir, '__tests__', 'db.test.ts'), 'it("works", () => {})')

    const report = runArchitectureAudit(tmpDir)
    const testFindings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.message.includes('no test files') && f.file.includes('platform-db'),
    )
    expect(testFindings).toEqual([])
  })

  // ── platform-structure: package with tests/ dir ────────────────────────

  it('accepts platform package with tests/ directory', () => {
    const pkgDir = join(tmpDir, 'packages', 'platform-cache')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    mkdirSync(join(pkgDir, 'tests'), { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/platform-cache"}')
    writeFileSync(join(pkgDir, 'src', 'index.ts'), 'export const cache = {}')
    writeFileSync(join(pkgDir, 'tests', 'cache.test.ts'), 'it("works", () => {})')

    const report = runArchitectureAudit(tmpDir)
    const testFindings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.message.includes('no test files') && f.file.includes('platform-cache'),
    )
    expect(testFindings).toEqual([])
  })

  // ── correlation-ids: more skip patterns ─────────────────────────────────

  it('skips ping endpoint for correlation ID check', () => {
    writeFile(tmpDir, 'apps/web/src/app/api/ping/route.ts',
      `export async function GET() { return new Response('pong') }\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'correlation-ids')
    expect(findings).toEqual([])
  })

  it('accepts correlationId usage pattern', () => {
    writeFile(tmpDir, 'apps/web/src/app/api/data/route.ts',
      `export async function GET() {\n  const correlationId = getCorrelation()\n  return new Response('ok')\n}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'correlation-ids')
    expect(findings).toEqual([])
  })

  // ── platform-structure: package without package.json ────────────────────

  it('skips platform dir without package.json', () => {
    const pkgDir = join(tmpDir, 'packages', 'platform-noconfig')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    writeFileSync(join(pkgDir, 'src', 'index.ts'), 'export {}')
    // No package.json

    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.file.includes('platform-noconfig'),
    )
    expect(findings).toEqual([])
  })

  // ── platform-structure: package with package.json but no src/ ──────────

  it('skips test check when platform package has no src dir', () => {
    const pkgDir = join(tmpDir, 'packages', 'platform-nosrc')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/platform-nosrc"}')
    // No src/

    const report = runArchitectureAudit(tmpDir)
    // Should flag missing barrel but NOT missing test files (no src to check)
    const barrelFindings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.file.includes('platform-nosrc') && f.message.includes('barrel'),
    )
    expect(barrelFindings.length).toBe(1)

    const testFindings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.file.includes('platform-nosrc') && f.message.includes('test'),
    )
    expect(testFindings).toEqual([])
  })

  // ── platform-structure: has index.tsx instead of index.ts ──────────────

  it('accepts index.tsx as barrel export', () => {
    const pkgDir = join(tmpDir, 'packages', 'platform-react')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/platform-react"}')
    writeFileSync(join(pkgDir, 'src', 'index.tsx'), 'export default function Component() {}')
    writeFileSync(join(pkgDir, 'src', 'component.test.tsx'), 'it("ok", () => {})')

    const report = runArchitectureAudit(tmpDir)
    const barrelFindings = report.findings.filter(f =>
      f.rule === 'platform-structure' && f.file.includes('platform-react') && f.message.includes('barrel'),
    )
    expect(barrelFindings).toEqual([])
  })

  // ── Files in both apps and packages ─────────────────────────────────────

  it('correctly reports totalFiles from both apps and packages', () => {
    writeFile(tmpDir, 'apps/web/src/page.tsx', 'export default function Page() {}')
    writeFile(tmpDir, 'packages/ui/src/button.tsx', 'export function Button() {}')
    const report = runArchitectureAudit(tmpDir)
    expect(report.totalFiles).toBe(2)
  })

  // ── config-fail-fast: skips .test. files named env.ts ──────────────────

  it('skips env.test.ts from config-fail-fast check', () => {
    writeFile(tmpDir, 'apps/web/src/env.test.ts',
      `// large test file for env\n${'const x = 1;\n'.repeat(20)}\n`,
    )
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'config-fail-fast' && f.file.includes('env.test.ts'),
    )
    expect(findings).toEqual([])
  })

  // ── config-fail-fast: short env.ts files are not flagged ──────────────

  it('does not flag env.ts files shorter than 100 chars without Zod', () => {
    writeFile(tmpDir, 'apps/web/src/env.ts', 'export const PORT = 3000;\n')
    const report = runArchitectureAudit(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'config-fail-fast' && f.file.includes('env.ts'),
    )
    // Content is < 100 chars, so should not be flagged
    expect(findings).toEqual([])
  })
})

// ── CLI entry + generateMarkdown tests ────────────────────────────────────

describe('architecture-audit CLI entry', () => {
  let tmpDir: string
  const origArgv1 = process.argv[1]

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), 'arch-cli-'))
    mkdirSync(join(tmpDir, 'packages'), { recursive: true })
    mkdirSync(join(tmpDir, 'apps'), { recursive: true })
    writeFileSync(join(tmpDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - apps/*')
  })

  afterEach(() => {
    process.argv[1] = origArgv1
    vi.restoreAllMocks()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes JSON and markdown reports when invoked as CLI', async () => {
    // Add a file with a banned import so the report has findings
    const webDir = join(tmpDir, 'apps', 'web', 'src')
    mkdirSync(webDir, { recursive: true })
    writeFileSync(join(webDir, 'blob.ts'), 'import { BlobServiceClient } from "@azure/storage-blob"\n')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    process.argv[1] = '/some/path/architecture-audit'
    vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.resetModules()
    await import('../architecture-audit.js')

    expect(existsSync(join(tmpDir, 'reports', 'architecture-audit.json'))).toBe(true)
    expect(existsSync(join(tmpDir, 'reports', 'architecture-audit.md'))).toBe(true)

    const json = JSON.parse(readFileSync(join(tmpDir, 'reports', 'architecture-audit.json'), 'utf-8'))
    expect(json.totalFiles).toBeGreaterThanOrEqual(1)

    const md = readFileSync(join(tmpDir, 'reports', 'architecture-audit.md'), 'utf-8')
    expect(md).toContain('Architecture')
    expect(md).toContain('no-direct-provider-sdk')
  })

  it('creates reports dir when not present', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    process.argv[1] = '/some/path/architecture-audit'
    vi.spyOn(console, 'log').mockImplementation(() => {})

    // reports/ does not exist yet
    expect(existsSync(join(tmpDir, 'reports'))).toBe(false)

    vi.resetModules()
    await import('../architecture-audit.js')

    // reports/ should have been created
    expect(existsSync(join(tmpDir, 'reports'))).toBe(true)
  })
})
