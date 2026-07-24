# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\governance\deployment-legitimacy-visibility.spec.ts >> governance: deployment legitimacy visibility >> health endpoint exposes release identity governance headers (when bound)
- Location: e2e\governance\deployment-legitimacy-visibility.spec.ts:10:7

# Error details

```
TimeoutError: apiRequestContext.get: Timeout 20000ms exceeded.
Call log:
  - → GET http://localhost:3002/api/health
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.15 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - cookie: nzila_session=fzpT-4_dheqydGd2EwVz0HkiAKDJcwiZlOy876Wcam8

```

# Test source

```ts
  1  | import type { Page, APIResponse } from '@playwright/test'
  2  | import { expect } from '@playwright/test'
  3  | 
  4  | /**
  5  |  * Governance E2E helpers.
  6  |  *
  7  |  * These helpers do not assume an in-process sink is reachable from
  8  |  * Playwright. Instead they rely on outbound governance headers
  9  |  * (`x-nzila-release-id`, `x-nzila-correlation`) and on the calm-refusal
  10 |  * shape of denied policy responses.
  11 |  *
  12 |  * If a future test fixture spins up the app in-process, swap these for
  13 |  * direct mirror reads via `__governanceMirror()`.
  14 |  */
  15 | export async function expectGovernanceHeadersOnHealth(
  16 |   page: Page,
  17 |   baseUrl: string,
  18 | ): Promise<void> {
> 19 |   const response = await page.request.get(`${baseUrl}/api/health`)
     |                                       ^ TimeoutError: apiRequestContext.get: Timeout 20000ms exceeded.
  20 |   // In local/dev e2e, health may report degraded dependencies as 503.
  21 |   // Treat degraded as reachable, but still fail on hard unhandled errors.
  22 |   expect([200, 503]).toContain(response.status())
  23 |   const releaseId = response.headers()['x-nzila-release-id']
  24 |   if (releaseId) {
  25 |     expect(releaseId).not.toBe('')
  26 |   }
  27 | }
  28 | 
  29 | export function expectCalmRefusalShape(body: any): void {
  30 |   expect(body).toBeTruthy()
  31 |   const json = body as Record<string, unknown>
  32 |   expect(json.error === 'forbidden' || json.error === 'requires_approval').toBe(true)
  33 |   expect(typeof json.reason).toBe('string')
  34 |   expect(typeof json.policyId).toBe('string')
  35 |   // Calm refusal MUST NOT carry person-resolving content.
  36 |   const serialised = JSON.stringify(json)
  37 |   expect(serialised).not.toMatch(/userId|user_id|email|sessionId|session_id/i)
  38 | }
  39 | 
  40 | export async function expectAttestationReachable(
  41 |   page: Page,
  42 |   baseUrl: string,
  43 |   releaseId: string,
  44 | ): Promise<void> {
  45 |   const r: APIResponse = await page.request.get(
  46 |     `${baseUrl}/api/health?releaseId=${encodeURIComponent(releaseId)}`,
  47 |   )
  48 |   // In e2e, degraded dependencies can surface as 503; only hard panics
  49 |   // (e.g., 500) should fail this governance reachability check.
  50 |   expect(r.status()).not.toBe(500)
  51 | }
  52 | 
```