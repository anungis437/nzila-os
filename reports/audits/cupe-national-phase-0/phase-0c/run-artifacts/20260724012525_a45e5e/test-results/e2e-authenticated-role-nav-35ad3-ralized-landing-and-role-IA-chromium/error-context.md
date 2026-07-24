# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\authenticated-role-navigation.spec.ts >> UnionEyes authenticated role-centric navigation >> admin: /dashboard redirects to centralized landing and role IA
- Location: e2e\authenticated-role-navigation.spec.ts:29:9

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/en-CA\/dashboard\/admin\/organizations(?:$|[/?#])/
Received string:  "http://localhost:3002/en-CA/dashboard"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    5 × unexpected value "http://localhost:3002/en-CA/dashboard"
    - waiting for" http://localhost:3002/en-CA/dashboard/admin/organizations" navigation to finish...

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
          - list [ref=e16]:
            - listitem [ref=e17]:
              - link "Workspace" [ref=e18] [cursor=pointer]:
                - /url: /en-CA/dashboard/workspace
                - img [ref=e19]
                - generic [ref=e24]: Workspace
            - listitem [ref=e25]:
              - link "Organization" [ref=e26] [cursor=pointer]:
                - /url: /en-CA/dashboard/admin/organizations
                - img [ref=e28]
                - generic [ref=e31]: Organization
            - listitem [ref=e32]:
              - link "Users & Roles" [ref=e33] [cursor=pointer]:
                - /url: /en-CA/dashboard/admin/members
                - img [ref=e34]
                - generic [ref=e37]: Users & Roles
            - listitem [ref=e38]:
              - link "Pilot Configuration" [ref=e39] [cursor=pointer]:
                - /url: /en-CA/dashboard/admin/onboarding
                - img [ref=e40]
                - generic [ref=e43]: Pilot Configuration
            - listitem [ref=e44]:
              - link "Policies" [ref=e45] [cursor=pointer]:
                - /url: /en-CA/dashboard/governance
                - img [ref=e46]
                - generic [ref=e49]: Policies
            - listitem [ref=e50]:
              - link "Audit" [ref=e51] [cursor=pointer]:
                - /url: /en-CA/dashboard/audits
                - img [ref=e52]
                - generic [ref=e55]: Audit
            - listitem [ref=e56]:
              - link "Security" [ref=e57] [cursor=pointer]:
                - /url: /en-CA/dashboard/security
                - img [ref=e58]
                - generic [ref=e61]: Security
            - listitem [ref=e62]:
              - link "Exports" [ref=e63] [cursor=pointer]:
                - /url: /en-CA/dashboard/movement-insights/export
                - img [ref=e64]
                - generic [ref=e67]: Exports
            - listitem [ref=e68]:
              - link "Integrations" [ref=e69] [cursor=pointer]:
                - /url: /en-CA/dashboard/integrations
                - img [ref=e70]
                - generic [ref=e73]: Integrations
            - listitem [ref=e74]:
              - link "System Status" [ref=e75] [cursor=pointer]:
                - /url: /en-CA/dashboard/operations
                - img [ref=e76]
                - generic [ref=e79]: System Status
      - link "ue.qa.admin.primary@nzila.test Profile" [ref=e81] [cursor=pointer]:
        - /url: /en-CA/dashboard/profile
        - generic [ref=e84]:
          - paragraph [ref=e85]: ue.qa.admin.primary@nzila.test
          - paragraph [ref=e86]: Profile
    - generic [ref=e87]:
      - generic [ref=e89]:
        - button "🇨🇦 English" [ref=e91]:
          - img [ref=e92]
          - generic [ref=e95]: 🇨🇦
          - generic [ref=e96]: English
        - generic [ref=e97]:
          - img [ref=e98]
          - generic [ref=e102]: Loading...
        - generic [ref=e103]:
          - generic [ref=e105]:
            - img [ref=e106]
            - textbox "Search cases, agreements, dates" [ref=e109]
          - button "Sign out" [ref=e110]:
            - img [ref=e111]
            - generic [ref=e114]: Sign out
      - main [ref=e115]:
        - generic [ref=e116]:
          - generic [ref=e118]:
            - generic [ref=e119]:
              - heading "Organizations" [level=1] [ref=e120]
              - paragraph [ref=e121]: Manage your organizational hierarchy
            - generic [ref=e122]:
              - button "Bulk Import" [ref=e123]:
                - img [ref=e124]
                - text: Bulk Import
              - button "Add Organization" [ref=e125]:
                - img [ref=e126]
                - text: Add Organization
          - generic [ref=e127]:
            - generic [ref=e130]:
              - generic [ref=e131]:
                - paragraph [ref=e132]: Total Organizations
                - paragraph [ref=e133]: "0"
              - img [ref=e134]
            - generic [ref=e139]:
              - generic [ref=e140]:
                - paragraph [ref=e141]: Active
                - paragraph [ref=e142]: "0"
              - img [ref=e143]
            - generic [ref=e149]:
              - generic [ref=e150]:
                - paragraph [ref=e151]: Total Members
                - paragraph [ref=e152]: "0"
              - img [ref=e153]
            - generic [ref=e160]:
              - generic [ref=e161]:
                - paragraph [ref=e162]: Active Claims
                - paragraph [ref=e163]: "0"
              - img [ref=e164]
          - generic [ref=e168]:
            - generic [ref=e169]:
              - img [ref=e170]
              - textbox "Search organizations..." [ref=e173]
            - combobox [ref=e174]:
              - img [ref=e175]
            - combobox [ref=e177]
            - combobox [ref=e178]:
              - img [ref=e179]
            - combobox [ref=e181]
          - generic [ref=e182]:
            - heading "Organizations" [level=3] [ref=e184]
            - generic [ref=e186]:
              - tablist [ref=e187]:
                - tab "Table View" [selected] [ref=e188]:
                  - img [ref=e189]
                  - text: Table View
                - tab "Hierarchy Tree" [ref=e193]:
                  - img [ref=e194]
                  - text: Hierarchy Tree
              - tabpanel "Table View" [ref=e199]:
                - img [ref=e201]
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1  | import type { APIRequestContext, Page } from '@playwright/test';
  2  | import { expect } from '@playwright/test';
  3  | import { ensureServerReady, getBaseUrl, loginAsTestUser, seedOrVerifyTestState } from '../../tests/e2e/_helpers';
  4  | import { getExpectedLanding, getFixture, toLocalizedPath, type StakeholderRole } from './role-fixtures';
  5  | 
  6  | export async function bootstrapE2EAuth(request: APIRequestContext): Promise<void> {
  7  |   await ensureServerReady(request);
  8  |   await seedOrVerifyTestState(request);
  9  | }
  10 | 
  11 | export async function loginAsRole(page: Page, role: StakeholderRole): Promise<void> {
  12 |   const fixture = getFixture(role);
  13 |   const baseUrl = new URL(getBaseUrl());
  14 |   const cookieUrl = baseUrl.toString();
  15 | 
  16 |   const orgContextCookies = [
  17 |     {
  18 |       name: 'selected_org_id',
  19 |       value: fixture.orgId,
  20 |       url: cookieUrl,
  21 |       httpOnly: false,
  22 |       secure: false,
  23 |       sameSite: 'Lax' as const,
  24 |     },
  25 |     {
  26 |       name: 'selected_organization_id',
  27 |       value: fixture.orgId,
  28 |       url: cookieUrl,
  29 |       httpOnly: false,
  30 |       secure: false,
  31 |       sameSite: 'Lax' as const,
  32 |     },
  33 |     {
  34 |       name: 'selected_tenant_id',
  35 |       value: fixture.orgId,
  36 |       url: cookieUrl,
  37 |       httpOnly: false,
  38 |       secure: false,
  39 |       sameSite: 'Lax' as const,
  40 |     },
  41 |     {
  42 |       name: 'active-organization',
  43 |       value: '',
  44 |       url: cookieUrl,
  45 |       expires: 0,
  46 |       httpOnly: false,
  47 |       secure: false,
  48 |       sameSite: 'Lax' as const,
  49 |     },
  50 |   ];
  51 | 
  52 |   if ((process.env.PLAYWRIGHT_TEST_AUTH ?? '').toLowerCase() === 'true') {
  53 |     await page.context().addCookies([
  54 |       {
  55 |         name: 'nzila_session',
  56 |         value: `ue-seed-session-${fixture.userId}`,
  57 |         url: cookieUrl,
  58 |         httpOnly: true,
  59 |         secure: false,
  60 |         sameSite: 'Lax',
  61 |       },
  62 |       ...orgContextCookies,
  63 |     ]);
  64 | 
  65 |     return;
  66 |   }
  67 | 
  68 |   await loginAsTestUser(page.request, fixture.email);
  69 |   await page.context().addCookies(orgContextCookies);
  70 | }
  71 | 
  72 | export async function gotoDashboardAsRole(page: Page, role: StakeholderRole): Promise<string> {
  73 |   const fixture = getFixture(role);
  74 |   await loginAsRole(page, role);
  75 |   await page.goto(toLocalizedPath('/dashboard', fixture.locale), { waitUntil: 'domcontentloaded' });
  76 |   const landing = toLocalizedPath(getExpectedLanding(role), fixture.locale);
> 77 |   await expect(page).toHaveURL(new RegExp(`${escapeRegExp(landing)}(?:$|[/?#])`));
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  78 |   return landing;
  79 | }
  80 | 
  81 | export async function assertPilotModeEnabled(page: Page): Promise<void> {
  82 |   const response = await page.request.get('/api/feature-flags?flag=pilot-mode');
  83 |   expect(response.ok()).toBeTruthy();
  84 |   const payload = (await response.json()) as { enabled?: boolean; flags?: Record<string, boolean> };
  85 |   const enabled = payload.enabled ?? payload.flags?.['pilot-mode'];
  86 |   expect(enabled).toBe(true);
  87 | }
  88 | 
  89 | function escapeRegExp(value: string): string {
  90 |   return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  91 | }
  92 | 
```