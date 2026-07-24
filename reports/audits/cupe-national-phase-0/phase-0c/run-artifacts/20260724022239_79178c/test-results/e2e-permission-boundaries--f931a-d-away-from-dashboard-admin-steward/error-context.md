# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\permission-boundaries.spec.ts >> Permission boundaries — role gate enforcement >> Unauthenticated user >> is redirected away from /dashboard/admin
- Location: e2e\permission-boundaries.spec.ts:40:9

# Error details

```
Error: expect(received).toMatch(expected)

Expected pattern: /sign[-/]?in|login|signup|^https?:\/\/[^/]+\/?$/i
Received string:  "http://localhost:3002/en-CA/dashboard/admin"
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - complementary "Primary navigation" [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]:
          - link "UnionEyes home" [ref=e8] [cursor=pointer]:
            - /url: /en-CA/dashboard
            - img "UnionEyes" [ref=e9]
          - button "Collapse sidebar" [ref=e10]:
            - img [ref=e11]
        - navigation "Primary" [ref=e14]:
          - generic [ref=e15]:
            - button "Workspace" [expanded] [ref=e16]:
              - generic [ref=e17]: Workspace
              - img [ref=e18]
            - list [ref=e20]:
              - listitem [ref=e21]:
                - link "Workspace" [ref=e22] [cursor=pointer]:
                  - /url: /en-CA/dashboard/workspace
                  - img [ref=e23]
                  - generic [ref=e28]: Workspace
          - generic [ref=e29]:
            - button "Operations" [expanded] [ref=e30]:
              - generic [ref=e31]: Operations
              - img [ref=e32]
            - list [ref=e34]:
              - listitem [ref=e35]:
                - link "Operations (Casework Console)" [ref=e36] [cursor=pointer]:
                  - /url: /en-CA/dashboard/work
                  - img [ref=e37]
                  - generic [ref=e41]: Operations (Casework Console)
              - listitem [ref=e42]:
                - link "Operations Queue (Representation Cases)" [ref=e43] [cursor=pointer]:
                  - /url: /en-CA/dashboard/inbox?type=intake
                  - img [ref=e44]
                  - generic [ref=e47]: Operations Queue (Representation Cases)
              - listitem [ref=e48]:
                - link "Operations Priorities (Commitments & Deadlines)" [ref=e49] [cursor=pointer]:
                  - /url: /en-CA/dashboard/priorities
                  - img [ref=e50]
                  - generic [ref=e53]: Operations Priorities (Commitments & Deadlines)
              - listitem [ref=e54]:
                - link "Members" [ref=e55] [cursor=pointer]:
                  - /url: /en-CA/dashboard/members
                  - img [ref=e56]
                  - generic [ref=e59]: Members
              - listitem [ref=e60]:
                - link "Documents" [ref=e61] [cursor=pointer]:
                  - /url: /en-CA/dashboard/documents
                  - img [ref=e62]
                  - generic [ref=e65]: Documents
              - listitem [ref=e66]:
                - link "Operations Communications" [ref=e67] [cursor=pointer]:
                  - /url: /en-CA/dashboard/correspondence
                  - img [ref=e68]
                  - generic [ref=e71]: Operations Communications
              - listitem [ref=e72]:
                - link "Notifications" [ref=e73] [cursor=pointer]:
                  - /url: /en-CA/dashboard/notifications
                  - img [ref=e74]
                  - generic [ref=e77]: Notifications
          - generic [ref=e78]:
            - button "Settings" [expanded] [ref=e79]:
              - generic [ref=e80]: Settings
              - img [ref=e81]
            - list [ref=e83]:
              - listitem [ref=e84]:
                - link "Profile & Settings" [ref=e85] [cursor=pointer]:
                  - /url: /en-CA/dashboard/settings
                  - img [ref=e86]
                  - generic [ref=e89]: Profile & Settings
      - link "ue.qa.steward.primary@nzila.test Profile" [ref=e91] [cursor=pointer]:
        - /url: /en-CA/dashboard/profile
        - generic [ref=e94]:
          - paragraph [ref=e95]: ue.qa.steward.primary@nzila.test
          - paragraph [ref=e96]: Profile
    - generic [ref=e97]:
      - generic [ref=e99]:
        - button "🇨🇦 English" [ref=e101]:
          - img [ref=e102]
          - generic [ref=e105]: 🇨🇦
          - generic [ref=e106]: English
        - generic [ref=e107]:
          - img [ref=e108]
          - generic [ref=e112]: Loading...
        - generic [ref=e113]:
          - generic [ref=e115]:
            - img [ref=e116]
            - textbox "Search cases, agreements, dates" [ref=e119]
          - button "Sign out" [ref=e120]:
            - img [ref=e121]
            - generic [ref=e124]: Sign out
      - main [ref=e125]:
        - generic [ref=e126]:
          - complementary [ref=e127]:
            - navigation [ref=e130]
          - main [ref=e161]
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1   | /**
  2   |  * Union-Eyes E2E — Permission Boundary Tests
  3   |  *
  4   |  * Validates server-side role gates on protected dashboard routes.
  5   |  *
  6   |  * P0 FINDINGS (PAGE_RENDER_VALIDATION.md):
  7   |  *   - /dashboard/admin has NO server-side role gate — this file surfaces that gap.
  8   |  *   - /dashboard/documents has no server-side role gate.
  9   |  *
  10  |  * These tests INTENTIONALLY FAIL when the gate is missing, making the bug visible
  11  |  * in the test report. Use assertRedirectOrDenied, which passes only if the response
  12  |  * redirects to the role landing page OR the page body contains a 403/forbidden signal.
  13  |  */
  14  | import { test, expect } from '@playwright/test';
  15  | import { bootstrapE2EAuth, gotoDashboardAsRole, loginAsRole } from './helpers/auth';
  16  | import { getFixture, toLocalizedPath } from './helpers/role-fixtures';
  17  | import { assertRedirectOrDenied } from './helpers/navigation-assertions';
  18  | 
  19  | const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === 'true';
  20  | 
  21  | test.describe('Permission boundaries — role gate enforcement', () => {
  22  |   test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');
  23  | 
  24  |   test.beforeAll(async ({ request }) => {
  25  |     await bootstrapE2EAuth(request);
  26  |   });
  27  | 
  28  |   // ─── Unauthenticated access ────────────────────────────────────────────────
  29  | 
  30  |   test.describe('Unauthenticated user', () => {
  31  |     test('is redirected away from /dashboard', async ({ page }) => {
  32  |       // No login — fresh context with no session cookie.
  33  |       await page.goto('/en-CA/dashboard', { waitUntil: 'domcontentloaded' });
  34  |       await page.waitForLoadState('load');
  35  |       const url = page.url();
  36  |       // Must end up on a public route (sign-in, signup, root) — never the dashboard.
  37  |       expect(url).toMatch(/sign[-/]?in|login|signup|^https?:\/\/[^/]+\/?$/i);
  38  |     });
  39  | 
  40  |     test('is redirected away from /dashboard/admin', async ({ page }) => {
  41  |       await page.goto('/en-CA/dashboard/admin', { waitUntil: 'domcontentloaded' });
  42  |       await page.waitForLoadState('load');
  43  |       const url = page.url();
> 44  |       expect(url).toMatch(/sign[-/]?in|login|signup|^https?:\/\/[^/]+\/?$/i);
      |                   ^ Error: expect(received).toMatch(expected)
  45  |     });
  46  | 
  47  |     test('unauthenticated POST to /api/cases/intake returns 401 or 403', async ({ request }) => {
  48  |       // GAP-04: No test for unauthenticated POST to API routes.
  49  |       const response = await request.post('/api/cases/intake', {
  50  |         data: {
  51  |           memberId: 'not-real',
  52  |           title: 'Unauthenticated probe',
  53  |           caseType: 'wage_dispute',
  54  |           priority: 'critical',
  55  |         },
  56  |         headers: { 'Content-Type': 'application/json' },
  57  |       });
  58  |       expect([401, 403]).toContain(response.status());
  59  |     });
  60  | 
  61  |     test('unauthenticated PATCH to /api/cases/transition returns 401', async ({ request }) => {
  62  |       // GAP-04: unauthenticated request to the transition endpoint.
  63  |       // The route only exposes PATCH — using POST returns 405 before auth
  64  |       // fires, which is a method-routing decision, not an auth gate.
  65  |       const response = await request.patch('/api/cases/FAKE-CASE-001/transition', {
  66  |         data: { targetStatus: 'resolved' },
  67  |         headers: { 'Content-Type': 'application/json' },
  68  |       });
  69  |       expect([401, 403, 404]).toContain(response.status());
  70  |     });
  71  | 
  72  |     test('unauthenticated POST to /api/cases/assign returns 401 or 403', async ({ request }) => {
  73  |       // GAP-04: unauthenticated POST to assign endpoint.
  74  |       const response = await request.post('/api/cases/FAKE-CASE-001/assign', {
  75  |         data: { assigneeId: 'steward-probe' },
  76  |         headers: { 'Content-Type': 'application/json' },
  77  |       });
  78  |       expect([401, 403, 404]).toContain(response.status());
  79  |     });
  80  |   });
  81  | 
  82  |   // ─── Member role gates ─────────────────────────────────────────────────────
  83  | 
  84  |   test.describe('Member role — blocked admin surfaces', () => {
  85  |     test('member: /dashboard/admin is blocked (P0 — missing server-side gate)', async ({ page }) => {
  86  |       const fixture = getFixture('member');
  87  |       const localizedLanding = await gotoDashboardAsRole(page, 'member');
  88  |       // P0 finding: no server-side gate detected at time of validation.
  89  |       // This test will FAIL until the gate is added, surfacing the issue.
  90  |       await assertRedirectOrDenied(
  91  |         page,
  92  |         toLocalizedPath('/dashboard/admin', fixture.locale),
  93  |         localizedLanding,
  94  |       );
  95  |     });
  96  | 
  97  |     test('member: /dashboard/documents is blocked (P1 — missing server-side gate)', async ({ page }) => {
  98  |       const fixture = getFixture('member');
  99  |       const localizedLanding = await gotoDashboardAsRole(page, 'member');
  100 |       await assertRedirectOrDenied(
  101 |         page,
  102 |         toLocalizedPath('/dashboard/documents', fixture.locale),
  103 |         localizedLanding,
  104 |       );
  105 |     });
  106 | 
  107 |     test('member: /dashboard/billing-admin is blocked', async ({ page }) => {
  108 |       const fixture = getFixture('member');
  109 |       const localizedLanding = await gotoDashboardAsRole(page, 'member');
  110 |       await assertRedirectOrDenied(
  111 |         page,
  112 |         toLocalizedPath('/dashboard/billing-admin', fixture.locale),
  113 |         localizedLanding,
  114 |       );
  115 |     });
  116 | 
  117 |     test('member: /dashboard/admin/organizations is blocked', async ({ page }) => {
  118 |       const fixture = getFixture('member');
  119 |       const localizedLanding = await gotoDashboardAsRole(page, 'member');
  120 |       await assertRedirectOrDenied(
  121 |         page,
  122 |         toLocalizedPath('/dashboard/admin/organizations', fixture.locale),
  123 |         localizedLanding,
  124 |       );
  125 |     });
  126 |   });
  127 | 
  128 |   // ─── Steward role gates ────────────────────────────────────────────────────
  129 | 
  130 |   test.describe('Steward role — blocked admin surfaces', () => {
  131 |     test('steward: /dashboard/admin is blocked (P0 — missing server-side gate)', async ({ page }) => {
  132 |       const fixture = getFixture('steward');
  133 |       const localizedLanding = await gotoDashboardAsRole(page, 'steward');
  134 |       // P0 finding: same missing gate as member path.
  135 |       await assertRedirectOrDenied(
  136 |         page,
  137 |         toLocalizedPath('/dashboard/admin', fixture.locale),
  138 |         localizedLanding,
  139 |       );
  140 |     });
  141 | 
  142 |     test('steward: /dashboard/billing-admin is blocked', async ({ page }) => {
  143 |       const fixture = getFixture('steward');
  144 |       const localizedLanding = await gotoDashboardAsRole(page, 'steward');
```