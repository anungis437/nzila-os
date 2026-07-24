# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\no-fsm-overexposure.spec.ts >> No FSM overexposure in pilot-facing UX >> executive: raw FSM terms are hidden across role journey
- Location: e2e\no-fsm-overexposure.spec.ts:25:9

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/en-CA\/dashboard\/intelligence(?:$|[/?#])/
Received string:  "http://localhost:3002/en-CA/dashboard"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    6 × unexpected value "http://localhost:3002/en-CA/dashboard"
    - waiting for" http://localhost:3002/en-CA/dashboard/intelligence" navigation to finish...

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
            - button "OCRA" [expanded] [ref=e30]:
              - generic [ref=e31]: OCRA
              - img [ref=e32]
            - list [ref=e34]:
              - listitem [ref=e35]:
                - link "OCRA Intelligence (Executive Overview)" [ref=e36] [cursor=pointer]:
                  - /url: /en-CA/dashboard/intelligence?scope=executive
                  - img [ref=e38]
                  - generic [ref=e41]: OCRA Intelligence (Executive Overview)
              - listitem [ref=e42]:
                - link "OCRA Signals (Continuity Insights)" [ref=e43] [cursor=pointer]:
                  - /url: /en-CA/dashboard/continuity-intelligence
                  - img [ref=e44]
                  - generic [ref=e47]: OCRA Signals (Continuity Insights)
          - generic [ref=e48]:
            - button "Operations" [expanded] [ref=e49]:
              - generic [ref=e50]: Operations
              - img [ref=e51]
            - list [ref=e53]:
              - listitem [ref=e54]:
                - link "Operations Continuity" [ref=e55] [cursor=pointer]:
                  - /url: /en-CA/dashboard/executive-operating-intelligence
                  - img [ref=e56]
                  - generic [ref=e59]: Operations Continuity
              - listitem [ref=e60]:
                - link "Operations Outcomes (Member Outcomes Ledger)" [ref=e61] [cursor=pointer]:
                  - /url: /en-CA/dashboard/outcomes
                  - img [ref=e62]
                  - generic [ref=e65]: Operations Outcomes (Member Outcomes Ledger)
              - listitem [ref=e66]:
                - link "Onboarding Survivability (Leadership Continuity)" [ref=e67] [cursor=pointer]:
                  - /url: /en-CA/dashboard/leadership
                  - img [ref=e68]
                  - generic [ref=e71]: Onboarding Survivability (Leadership Continuity)
          - generic [ref=e72]:
            - button "Governance Continuity" [expanded] [ref=e73]:
              - generic [ref=e74]: Governance Continuity
              - img [ref=e75]
            - list [ref=e77]:
              - listitem [ref=e78]:
                - link "Governance Continuity" [ref=e79] [cursor=pointer]:
                  - /url: /en-CA/dashboard/governance-center
                  - img [ref=e80]
                  - generic [ref=e83]: Governance Continuity
              - listitem [ref=e84]:
                - link "Governance Trust & Oversight" [ref=e85] [cursor=pointer]:
                  - /url: /en-CA/dashboard/trust
                  - img [ref=e86]
                  - generic [ref=e89]: Governance Trust & Oversight
          - generic [ref=e90]:
            - button "Settings" [expanded] [ref=e91]:
              - generic [ref=e92]: Settings
              - img [ref=e93]
            - list [ref=e95]:
              - listitem [ref=e96]:
                - link "Profile & Settings" [ref=e97] [cursor=pointer]:
                  - /url: /en-CA/dashboard/settings
                  - img [ref=e98]
                  - generic [ref=e101]: Profile & Settings
      - link "ue.qa.executive.primary@nzila.test Profile" [ref=e103] [cursor=pointer]:
        - /url: /en-CA/dashboard/profile
        - generic [ref=e106]:
          - paragraph [ref=e107]: ue.qa.executive.primary@nzila.test
          - paragraph [ref=e108]: Profile
    - generic [ref=e109]:
      - generic [ref=e111]:
        - button "🇨🇦 English" [ref=e113]:
          - img [ref=e114]
          - generic [ref=e117]: 🇨🇦
          - generic [ref=e118]: English
        - generic [ref=e119]:
          - img [ref=e120]
          - generic [ref=e124]: Loading...
        - generic [ref=e125]:
          - generic [ref=e127]:
            - img [ref=e128]
            - textbox "Search cases, agreements, dates" [ref=e131]
          - button "Sign out" [ref=e132]:
            - img [ref=e133]
            - generic [ref=e136]: Sign out
      - main [ref=e137]:
        - generic [ref=e138]:
          - generic [ref=e139]:
            - heading "Intelligence" [level=1] [ref=e140]
            - paragraph [ref=e141]: Research, analysis, and insights — understand trends and make informed decisions.
            - link "Supporting references in Organizational Memory" [ref=e142] [cursor=pointer]:
              - /url: /en-CA/dashboard/organizational-memory?tab=knowledge
              - img [ref=e143]
              - text: Supporting references in Organizational Memory
          - generic [ref=e145]:
            - tablist [ref=e146]:
              - tab "Organization Trends" [selected] [ref=e147]
              - tab "Strategic Context" [ref=e148]
            - tabpanel "Organization Trends" [ref=e149]:
              - generic [ref=e151]:
                - generic [ref=e152]:
                  - generic [ref=e153]:
                    - img [ref=e155]
                    - heading "Analytics & Insights" [level=1] [ref=e157]
                  - paragraph [ref=e158]: Comprehensive union metrics, trends, and performance data
                - generic [ref=e162]:
                  - generic [ref=e163]:
                    - img [ref=e164]
                    - generic [ref=e166]: "Time Range:"
                    - generic [ref=e167]:
                      - button "Last 7 Days" [ref=e168]
                      - button "Last 30 Days" [ref=e169]
                      - button "Last 90 Days" [ref=e170]
                      - button "Last Year" [ref=e171]
                      - button "All Time" [ref=e172]
                  - generic [ref=e173]:
                    - button "Refresh" [disabled] [ref=e174]:
                      - img [ref=e175]
                      - generic [ref=e180]: Refresh
                    - button "Export Report" [ref=e181]:
                      - img [ref=e182]
                      - generic [ref=e185]: Export Report
                - generic [ref=e229]:
                  - generic [ref=e231]:
                    - heading "Cases Trend" [level=3] [ref=e233]:
                      - img [ref=e234]
                      - text: Cases Trend
                    - generic [ref=e237]:
                      - generic [ref=e238]:
                        - generic [ref=e241]: Resolved
                        - generic [ref=e244]: Pending
                      - img [ref=e246]
                  - generic [ref=e249]:
                    - heading "Cases by Category" [level=3] [ref=e251]:
                      - img [ref=e252]
                      - text: Cases by Category
                    - img [ref=e258]
                - generic [ref=e262]:
                  - heading "Additional Metrics" [level=3] [ref=e264]:
                    - img [ref=e265]
                    - text: Additional Metrics
                  - generic [ref=e269]:
                    - generic [ref=e270]:
                      - generic [ref=e271]:
                        - img [ref=e272]
                        - generic [ref=e275]: Open Cases
                      - paragraph [ref=e276]: "0"
                      - paragraph [ref=e277]: 0% of total
                    - generic [ref=e278]:
                      - generic [ref=e279]:
                        - img [ref=e280]
                        - generic [ref=e283]: Resolved
                      - paragraph [ref=e284]: "0"
                      - paragraph [ref=e285]: 0% of total
                    - generic [ref=e286]:
                      - generic [ref=e287]:
                        - img [ref=e288]
                        - generic [ref=e291]: Avg. Response
                      - paragraph [ref=e292]: 0 hrs
                      - paragraph [ref=e293]: Within 24h target
                    - generic [ref=e294]:
                      - generic [ref=e295]:
                        - img [ref=e296]
                        - generic [ref=e301]: Active Representatives
                      - paragraph [ref=e302]: "0"
                      - paragraph [ref=e303]: 0% of members
                - generic [ref=e305]:
                  - img [ref=e306]
                  - paragraph [ref=e308]: Use these metrics to track union performance, identify trends, and make data-driven decisions. Monitor case resolution rates, member satisfaction, and representative performance to ensure effective representation.
  - region "Notifications (F8)":
    - list
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