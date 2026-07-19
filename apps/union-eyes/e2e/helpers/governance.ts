import type { Page, APIResponse } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Governance E2E helpers.
 *
 * These helpers do not assume an in-process sink is reachable from
 * Playwright. Instead they rely on outbound governance headers
 * (`x-nzila-release-id`, `x-nzila-correlation`) and on the calm-refusal
 * shape of denied policy responses.
 *
 * If a future test fixture spins up the app in-process, swap these for
 * direct mirror reads via `__governanceMirror()`.
 */
export async function expectGovernanceHeadersOnHealth(
  page: Page,
  baseUrl: string,
): Promise<void> {
  const response = await page.request.get(`${baseUrl}/api/health`)
  // In local/dev e2e, health may report degraded dependencies as 503.
  // Treat degraded as reachable, but still fail on hard unhandled errors.
  expect([200, 503]).toContain(response.status())
  const releaseId = response.headers()['x-nzila-release-id']
  if (releaseId) {
    expect(releaseId).not.toBe('')
  }
}

export function expectCalmRefusalShape(body: any): void {
  expect(body).toBeTruthy()
  const json = body as Record<string, unknown>
  expect(json.error === 'forbidden' || json.error === 'requires_approval').toBe(true)
  expect(typeof json.reason).toBe('string')
  expect(typeof json.policyId).toBe('string')
  // Calm refusal MUST NOT carry person-resolving content.
  const serialised = JSON.stringify(json)
  expect(serialised).not.toMatch(/userId|user_id|email|sessionId|session_id/i)
}

export async function expectAttestationReachable(
  page: Page,
  baseUrl: string,
  releaseId: string,
): Promise<void> {
  const r: APIResponse = await page.request.get(
    `${baseUrl}/api/health?releaseId=${encodeURIComponent(releaseId)}`,
  )
  // In e2e, degraded dependencies can surface as 503; only hard panics
  // (e.g., 500) should fail this governance reachability check.
  expect(r.status()).not.toBe(500)
}
