# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\stakeholder-demo-journeys.spec.ts >> Marketing-to-app continuity routes >> executive and governance journeys avoid raw FSM language
- Location: e2e\stakeholder-demo-journeys.spec.ts:207:7

# Error details

```
TimeoutError: page.goto: Timeout 45000ms exceeded.
Call log:
  - navigating to "http://localhost:3002/en-CA/proof?context=executive", waiting until "domcontentloaded"

```

# Test source

```ts
  108 | 
  109 |     for (const step of path) {
  110 |       await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
  111 |       await expect(page.locator('body')).toBeVisible();
  112 |     }
  113 | 
  114 |     const body = await getVisiblePageText(page);
  115 |     expect(body).not.toContain('governance overview');
  116 |     expect(body).not.toContain('executive overview');
  117 |     expect(body).not.toContain('users & roles');
  118 |   });
  119 | 
  120 |   test('admin demo path exposes controls and pilot configuration', async ({ page }) => {
  121 |     const fixture = getFixture('admin');
  122 |     await gotoDashboardAsRole(page, 'admin');
  123 | 
  124 |     const path: Array<{ label: string; href: string }> = [
  125 |       { label: 'Organization', href: '/dashboard/admin/organizations' },
  126 |       { label: 'Users & Roles', href: '/dashboard/admin/members' },
  127 |       { label: 'Policies', href: '/dashboard/governance' },
  128 |       { label: 'Security', href: '/dashboard/security' },
  129 |       { label: 'Audit', href: '/dashboard/audits' },
  130 |     ];
  131 | 
  132 |     for (const step of path) {
  133 |       await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
  134 |       await expect(page.locator('body')).toBeVisible();
  135 |     }
  136 | 
  137 |     const body = await getVisiblePageText(page);
  138 |     expect(body).not.toMatch(/raw fsm|workflow builder|orchestration engine/);
  139 |   });
  140 | });
  141 | 
  142 | test.describe('Marketing-to-app continuity routes', () => {
  143 |   const locale = 'en-CA';
  144 | 
  145 |   test('for-clc and context-aware pages preserve context in CTAs', async ({ page }) => {
  146 |     const routes = [
  147 |       '/for-clc',
  148 |       '/proof?context=executive',
  149 |       '/trust?context=governance',
  150 |       '/proof?context=procurement',
  151 |       '/organizational-continuity-risk?context=conference',
  152 |       '/insights?context=conference',
  153 |     ];
  154 | 
  155 |     for (const route of routes) {
  156 |       await page.goto(`/${locale}${route}`, { waitUntil: 'domcontentloaded' });
  157 |       await expect(page.locator('body')).toBeVisible();
  158 |       await expect(page).not.toHaveURL(/404|not-found/i);
  159 |     }
  160 | 
  161 |     await page.goto(`/${locale}/proof?context=executive`, { waitUntil: 'domcontentloaded' });
  162 |     const executiveContextLinks = page.locator('a[href*="context=executive"]');
  163 |     await expect(executiveContextLinks.first()).toBeVisible({ timeout: 10000 });
  164 | 
  165 |     await page.goto(`/${locale}/trust?context=governance`, { waitUntil: 'domcontentloaded' });
  166 |     const governanceContextLinks = page.locator('a[href*="context=governance"]');
  167 |     await expect(governanceContextLinks.first()).toBeVisible({ timeout: 10000 });
  168 | 
  169 |     await page.goto(`/${locale}/insights?context=conference`, { waitUntil: 'domcontentloaded' });
  170 |     const conferenceContextCta = page.locator(
  171 |       'a[href*="organizational-continuity-risk"][href*="context=conference"], a[href*="institutional-continuity-risk"][href*="context=conference"]',
  172 |     );
  173 |     if (await conferenceContextCta.count()) {
  174 |       await expect(conferenceContextCta.first()).toBeVisible({ timeout: 10000 });
  175 |     } else {
  176 |       const conferenceFallbackCta = page.locator(
  177 |         'a[href*="organizational-continuity-risk"], a[href*="institutional-continuity-risk"]',
  178 |       );
  179 |       await expect(conferenceFallbackCta.first()).toBeVisible({ timeout: 10000 });
  180 |     }
  181 |   });
  182 | 
  183 |   test('pilot request CTA remains actionable from context routes', async ({ page }) => {
  184 |     await page.goto(`/${locale}/proof?context=procurement`, { waitUntil: 'domcontentloaded' });
  185 |     const procurementContextCta = page
  186 |       .locator(
  187 |         'a[href*="/organizational-continuity-risk"][href*="context=procurement"], a[href*="/institutional-continuity-risk"][href*="context=procurement"]',
  188 |       )
  189 |       .first();
  190 |     const cta =
  191 |       (await procurementContextCta.count()) > 0
  192 |         ? procurementContextCta
  193 |         : page
  194 |             .locator('a[href*="/organizational-continuity-risk"], a[href*="/institutional-continuity-risk"]')
  195 |             .first();
  196 |     await expect(cta).toBeVisible({ timeout: 10000 });
  197 |     await Promise.all([
  198 |       page.waitForURL(new RegExp(`/${locale}/(organizational|institutional)-continuity-risk`)),
  199 |       cta.evaluate((link: HTMLAnchorElement) => link.click()),
  200 |     ]);
  201 |     await expect(page.url()).toMatch(new RegExp(`/${locale}/(organizational|institutional)-continuity-risk`));
  202 |     if (page.url().includes('context=')) {
  203 |       await expect(page.url()).toContain('context=procurement');
  204 |     }
  205 |   });
  206 | 
  207 |   test('executive and governance journeys avoid raw FSM language', async ({ page }) => {
> 208 |     await page.goto(`/${locale}/proof?context=executive`, { waitUntil: 'domcontentloaded' });
      |                ^ TimeoutError: page.goto: Timeout 45000ms exceeded.
  209 |     await assertNoTextExposure(page, ['FSM', 'Finite State Machine', 'Workflow Engine', 'Transition Graph']);
  210 | 
  211 |     await page.goto(`/${locale}/trust?context=governance`, { waitUntil: 'domcontentloaded' });
  212 |     await assertNoTextExposure(page, ['FSM', 'Finite State Machine', 'Workflow Engine', 'Transition Graph']);
  213 |   });
  214 | });
  215 | 
```