# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\empty-states.spec.ts >> Empty states >> dashboard with no active cases shows meaningful empty state
- Location: e2e\empty-states.spec.ts:83:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | /**
  2   |  * Union-Eyes E2E — Empty State Validation
  3   |  *
  4   |  * Coverage gap addressed (USER_JOURNEY_VALIDATION.md):
  5   |  *   GAP-05 — No test for empty state on grievances page
  6   |  *
  7   |  * Tests that key pages show meaningful empty states when no data is present,
  8   |  * rather than blank/broken layouts or raw errors.
  9   |  *
  10  |  * API routes are intercepted to return empty collections, making these tests
  11  |  * deterministic regardless of seeded data in the test environment.
  12  |  */
  13  | import { test, expect } from '@playwright/test';
  14  | import { bootstrapE2EAuth, loginAsRole } from './helpers/auth';
  15  | import { getFixture, toLocalizedPath } from './helpers/role-fixtures';
  16  | 
  17  | const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === 'true';
  18  | 
  19  | /** Returns a stubbed empty-list API response. */
  20  | function emptyList() {
  21  |   return JSON.stringify({ success: true, data: [], total: 0, page: 1, pageSize: 20 });
  22  | }
  23  | 
  24  | /**
  25  |  * Pattern that matches a real server-error surface in visible text.
  26  |  *
  27  |  * Intentionally narrow: avoids bare-number matches like `\b500\b` which
  28  |  * false-positive on CSS values (`font-weight:500`), latency strings
  29  |  * (`500ms`), or account codes embedded in dashboards.
  30  |  */
  31  | const SERVER_ERROR_PATTERN = /internal server error|http\s*5\d\d\b|application error: a server-side exception/i;
  32  | 
  33  | /** Checks that the page body contains a non-trivial empty-state signal. */
  34  | async function assertEmptyStateVisible(page: import('@playwright/test').Page): Promise<void> {
  35  |   await page.waitForLoadState('load');
  36  |   // Use innerText to read only visually rendered text — this excludes
  37  |   // <script> tag contents (e.g. the serialized RSC payload) where CSS
  38  |   // values and JSON numbers would otherwise trigger false positives.
  39  |   const body = await page.locator('body').innerText();
  40  |   const bodyLower = body.toLowerCase();
  41  | 
  42  |   // The page must not be a raw error or fully blank.
  43  |   expect(bodyLower).not.toMatch(SERVER_ERROR_PATTERN);
  44  |   // Also catch the Next.js default error page element directly, in case
  45  |   // the visible status text is rendered solely as a non-text element.
  46  |   await expect(page.locator('h1.next-error-h1')).toHaveCount(0);
  47  |   expect(bodyLower).not.toMatch(/^\s*$/);
  48  | 
  49  |   // Accept any of these common empty-state patterns.
  50  |   const emptySignals = [
  51  |     'no ',        // "No cases found", "No results", etc.
  52  |     'empty',
  53  |     'nothing here',
  54  |     'get started',
  55  |     'create your first',
  56  |     '0 results',
  57  |     'no records',
  58  |     'no data',
  59  |     'not found',  // a soft 404 component (not the HTTP error) is acceptable
  60  |   ];
  61  | 
  62  |   const hasSignal = emptySignals.some((signal) => bodyLower.includes(signal));
  63  | 
  64  |   // Also accept a visible placeholder/illustration element.
  65  |   const illustrationCount = await page
  66  |     .locator('[data-testid*="empty"], [data-empty], .empty-state, [aria-label*="empty"]')
  67  |     .count();
  68  | 
  69  |   expect(hasSignal || illustrationCount > 0).toBe(true);
  70  | }
  71  | 
  72  | // ─── Main suite ───────────────────────────────────────────────────────────────
  73  | 
  74  | test.describe('Empty states', () => {
  75  |   test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');
  76  | 
> 77  |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  78  |     await bootstrapE2EAuth(request);
  79  |   });
  80  | 
  81  |   // ─── Dashboard: no active cases ─────────────────────────────────────────
  82  | 
  83  |   test('dashboard with no active cases shows meaningful empty state', async ({ page }) => {
  84  |     await loginAsRole(page, 'member');
  85  | 
  86  |     // Stub all data endpoints the member dashboard surface touches so the
  87  |     // assertion is deterministic regardless of seeded data.
  88  |     await page.route('**/api/cases**', async (route) => {
  89  |       await route.fulfill({ status: 200, contentType: 'application/json', body: emptyList() });
  90  |     });
  91  |     await page.route('**/api/inbox**', async (route) => {
  92  |       await route.fulfill({ status: 200, contentType: 'application/json', body: emptyList() });
  93  |     });
  94  |     await page.route('**/api/notifications**', async (route) => {
  95  |       await route.fulfill({ status: 200, contentType: 'application/json', body: emptyList() });
  96  |     });
  97  | 
  98  |     // Navigate directly to the member's actual landing surface
  99  |     // (`getRoleLandingPath('member') === '/dashboard/inbox'`). Going via
  100 |     // `/dashboard` would force the role-router redirect chain which is
  101 |     // environment-sensitive and unrelated to empty-state rendering.
  102 |     await page.goto('/en-CA/dashboard/inbox', { waitUntil: 'domcontentloaded' });
  103 | 
  104 |     // Ensure the page body renders something meaningful.
  105 |     await expect(page.locator('body')).toBeVisible();
  106 |     await page.waitForLoadState('load');
  107 | 
  108 |     // Dashboard itself must load — not a Next.js error page.
  109 |     const bodyText = await page.locator('body').innerText();
  110 |     expect(bodyText).not.toMatch(SERVER_ERROR_PATTERN);
  111 |     await expect(page.locator('h1.next-error-h1')).toHaveCount(0);
  112 |   });
  113 | 
  114 |   test('steward inbox renders the signal feed without errors', async ({ page }) => {
  115 |     await loginAsRole(page, 'steward');
  116 |     await page.goto('/en-CA/dashboard/inbox', { waitUntil: 'domcontentloaded' });
  117 | 
  118 |     // Wait for InboxConsole to mount and complete the /api/claims +
  119 |     // /api/notifications fetches (loading=true → fetch → loading=false).
  120 |     // Stub-based interception was not used here: broad URL stubs also matched
  121 |     // /api/notifications/count and /api/notifications?organizationId=... from
  122 |     // the topbar/header components, causing those components to receive
  123 |     // malformed responses and cascade React errors before InboxConsole mounted.
  124 |     // The CI database always contains seeded cases for the steward user, so
  125 |     // the reliable invariant is "page loads and renders without crashing",
  126 |     // not "empty state appears".
  127 |     await page.waitForLoadState('load');
  128 | 
  129 |     // InboxConsole always renders an <h1> once mounted — confirms the component
  130 |     // rendered successfully (not stuck on spinner or replaced by an error UI).
  131 |     await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
  132 | 
  133 |     // Loading spinner (animate-spin) must be detached — the fetch completed.
  134 |     await page.locator('.animate-spin').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  135 | 
  136 |     // No server-side exception should be surfaced.
  137 |     const body = await page.locator('body').innerText();
  138 |     expect(body).not.toMatch(SERVER_ERROR_PATTERN);
  139 |     await expect(page.locator('h1.next-error-h1')).toHaveCount(0);
  140 |     expect(body.trim()).not.toBe('');
  141 |   });
  142 | 
  143 |   // ─── Grievances page (GAP-05) ────────────────────────────────────────────
  144 | 
  145 |   test('GAP-05: grievances page with no grievances shows empty state', async ({ page }) => {
  146 |     const fixture = getFixture('steward');
  147 |     await loginAsRole(page, 'steward');
  148 | 
  149 |     await page.route('**/api/grievances**', async (route) => {
  150 |       await route.fulfill({ status: 200, contentType: 'application/json', body: emptyList() });
  151 |     });
  152 | 
  153 |     await page.goto(
  154 |       toLocalizedPath('/dashboard/grievances', fixture.locale),
  155 |       { waitUntil: 'domcontentloaded' },
  156 |     );
  157 |     await page.waitForLoadState('load');
  158 | 
  159 |     const url = page.url();
  160 |     // If the route returns 404 entirely, record that as a known gap and skip.
  161 |     const bodyText = (await page.textContent('body')) ?? '';
  162 |     if (url.includes('404') || bodyText.match(/\bpage not found\b|\b404\b/i)) {
  163 |       // GAP-05 is a subset of the FLOW-003 missing-route finding.
  164 |       // Mark as skip so it shows as pending (not failing) until route is built.
  165 |       test.skip(
  166 |         true,
  167 |         'Route not yet implemented: FLOW-003 — /dashboard/grievances is 404; empty-state test is pending',
  168 |       );
  169 |       return;
  170 |     }
  171 | 
  172 |     await assertEmptyStateVisible(page);
  173 |   });
  174 | 
  175 |   // ─── Members search with no results ─────────────────────────────────────
  176 | 
  177 |   test('members page with no search results shows empty state message', async ({ page }) => {
```