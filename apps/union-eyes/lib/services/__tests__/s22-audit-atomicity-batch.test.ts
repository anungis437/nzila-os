import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B78: audit atomicity of billing, expiry, export and deprecation access', () => {
  it('writes the invoice, its ledger entries and its audit record in one transaction', () => {
    const billing = src('services/platform-economics/billing-service.ts')
    const generate = billing.slice(billing.indexOf('export async function generateInvoice'), billing.indexOf('export async function recordPayment'))
    expect(generate).toContain('persistAtomicAudit(tx as unknown as RLSTx')
    expect(generate).toContain('}, tx);')
    expect(generate).not.toContain('await auditLog(')

    const ledger = src('services/platform-economics/ledger-service.ts')
    expect(ledger).toContain('callerTx?: unknown')
    expect(ledger).toContain('if (callerTx) await write(callerTx)')
  })

  it('expires a trial, records its event row and audits it in one transaction', () => {
    const lifecycle = src('services/platform-economics/subscription-lifecycle-service.ts')
    const expire = lifecycle.slice(lifecycle.indexOf('export async function expireTrials'), lifecycle.indexOf('export async function getTrialsEndingSoon'))
    expect(expire).toContain('await db.transaction(async (tx) => {')
    expect(expire).toContain('persistAtomicAudit(')
    expect(expire).toContain('subscription.${eventType}')
    expect(expire).not.toMatch(/await db\s*\.update\(orgSubscriptions\)/)
  })

  it('audits the closure of a lapsed triage designation', () => {
    const designations = src('lib/triage/designations.ts')
    expect(designations).toContain("action: 'triage.designation.expire'")
    expect(designations).toContain('.returning({ id: triageDesignations.id, expiresAt: triageDesignations.expiresAt })')
  })

  it('audits the workbook export before it is returned and no longer selects holder names', () => {
    const route = src('app/api/workbook/[id]/export/route.ts')
    expect(route.indexOf("action: 'workbook.export'")).toBeGreaterThan(-1)
    expect(route.indexOf("action: 'workbook.export'")).toBeLessThan(route.indexOf('return { kind: \'ok\' as const, buffer }'))
    expect(src('lib/workbook-pdf/loadWorkbookModules.ts')).not.toContain('displayName: workbookMemoryHolders.displayName')
  })

  it('names the caller on the deprecated-route access record and awaits it', () => {
    const route = src('app/api/v2/[...path]/route.ts')
    expect(route).toContain('await logDeprecatedAccess(v2Path, request.method, canonical, userId ?? undefined, organizationId ?? undefined)')
    expect(route).not.toContain('Fire-and-forget')
  })

  it('verified: an AI risk or insight GET does not insert a row', () => {
    const risk = src('lib/ai/employer-risk.ts')
    expect(risk).toContain('HTTP GET is observational')
    expect(risk).not.toMatch(/\.insert\(employerRiskScores\)/)
  })
})
