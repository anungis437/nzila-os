# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\member-journey.spec.ts >> Member journey >> GAP-01 — Governance persona: no edit/write controls visible >> governance: cannot see "Open Representation Case" action
- Location: e2e\member-journey.spec.ts:175:9

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/en-CA\/dashboard\/governance(?:$|[/?#])/
Received string:  "http://localhost:3002/en-CA/dashboard/inbox"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    7 × unexpected value "http://localhost:3002/en-CA/dashboard"
    - unexpected value "http://localhost:3002/en-CA/dashboard/inbox"

```

# Test source

```ts
  1   | import type { APIRequestContext, Page } from '@playwright/test';
  2   | import { expect } from '@playwright/test';
  3   | import { ensureServerReady, getBaseUrl, loginAsTestUser, seedOrVerifyTestState } from '../../tests/e2e/_helpers';
  4   | import { getExpectedLanding, getFixture, toLocalizedPath, type StakeholderRole } from './role-fixtures';
  5   | 
  6   | export async function bootstrapE2EAuth(request: APIRequestContext): Promise<void> {
  7   |   await ensureServerReady(request);
  8   |   await seedOrVerifyTestState(request);
  9   | }
  10  | 
  11  | export async function loginAsRole(page: Page, role: StakeholderRole): Promise<void> {
  12  |   const fixture = getFixture(role);
  13  |   const baseUrl = new URL(getBaseUrl());
  14  |   const cookieUrl = baseUrl.toString();
  15  | 
  16  |   const orgContextCookies = [
  17  |     {
  18  |       name: 'selected_org_id',
  19  |       value: fixture.orgId,
  20  |       url: cookieUrl,
  21  |       httpOnly: false,
  22  |       secure: false,
  23  |       sameSite: 'Lax' as const,
  24  |     },
  25  |     {
  26  |       name: 'selected_organization_id',
  27  |       value: fixture.orgId,
  28  |       url: cookieUrl,
  29  |       httpOnly: false,
  30  |       secure: false,
  31  |       sameSite: 'Lax' as const,
  32  |     },
  33  |     {
  34  |       name: 'selected_tenant_id',
  35  |       value: fixture.orgId,
  36  |       url: cookieUrl,
  37  |       httpOnly: false,
  38  |       secure: false,
  39  |       sameSite: 'Lax' as const,
  40  |     },
  41  |     {
  42  |       name: 'active-organization',
  43  |       value: '',
  44  |       url: cookieUrl,
  45  |       expires: 0,
  46  |       httpOnly: false,
  47  |       secure: false,
  48  |       sameSite: 'Lax' as const,
  49  |     },
  50  |   ];
  51  | 
  52  |   if ((process.env.PLAYWRIGHT_TEST_AUTH ?? '').toLowerCase() === 'true') {
  53  |     // Phase 0C.2 §11 — reconcile with §8 persona storageState.
  54  |     //
  55  |     // When Playwright loads a project's storageState (e.g.
  56  |     // `playwright/.auth/<role>.json`), the context already carries a real
  57  |     // `nzila_session` cookie backed by a PG session row. Injecting a
  58  |     // synthetic `nzila_session=ue-seed-session-*` on top of that would
  59  |     // overwrite the valid cookie with garbage and break every test that
  60  |     // relies on the real persona (dashboard renders, RBAC checks,
  61  |     // organization_members lookups).
  62  |     //
  63  |     // Contract:
  64  |     //   • If a real `nzila_session` cookie is present → apply ONLY
  65  |     //     org-context cookies and return; do NOT touch nzila_session.
  66  |     //   • Otherwise → keep the legacy synthetic-cookie behaviour so
  67  |     //     specs written before §8 (which never opted into storageState)
  68  |     //     continue to work.
  69  |     const existing = await page.context().cookies(cookieUrl);
  70  |     const hasRealSession = existing.some((c) => c.name === 'nzila_session' && c.value.length > 0);
  71  |     if (hasRealSession) {
  72  |       await page.context().addCookies(orgContextCookies);
  73  |       return;
  74  |     }
  75  |     await page.context().addCookies([
  76  |       {
  77  |         name: 'nzila_session',
  78  |         value: `ue-seed-session-${fixture.userId}`,
  79  |         url: cookieUrl,
  80  |         httpOnly: true,
  81  |         secure: false,
  82  |         sameSite: 'Lax',
  83  |       },
  84  |       ...orgContextCookies,
  85  |     ]);
  86  | 
  87  |     return;
  88  |   }
  89  | 
  90  |   await loginAsTestUser(page.request, fixture.email);
  91  |   await page.context().addCookies(orgContextCookies);
  92  | }
  93  | 
  94  | export async function gotoDashboardAsRole(page: Page, role: StakeholderRole): Promise<string> {
  95  |   const fixture = getFixture(role);
  96  |   await loginAsRole(page, role);
  97  |   await page.goto(toLocalizedPath('/dashboard', fixture.locale), { waitUntil: 'domcontentloaded' });
  98  |   const landing = toLocalizedPath(getExpectedLanding(role), fixture.locale);
> 99  |   await expect(page).toHaveURL(new RegExp(`${escapeRegExp(landing)}(?:$|[/?#])`));
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  100 |   return landing;
  101 | }
  102 | 
  103 | export async function assertPilotModeEnabled(page: Page): Promise<void> {
  104 |   const response = await page.request.get('/api/feature-flags?flag=pilot-mode');
  105 |   expect(response.ok()).toBeTruthy();
  106 |   const payload = (await response.json()) as { enabled?: boolean; flags?: Record<string, boolean> };
  107 |   const enabled = payload.enabled ?? payload.flags?.['pilot-mode'];
  108 |   expect(enabled).toBe(true);
  109 | }
  110 | 
  111 | function escapeRegExp(value: string): string {
  112 |   return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  113 | }
  114 | 
```