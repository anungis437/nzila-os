import { test, expect } from '@playwright/test'
import { loginAsRole } from './helpers/auth'
import { getExpectedLanding, getFixture, toLocalizedPath } from './helpers/role-fixtures'

// Fail once at the common prerequisite instead of waiting through retries of
// every authenticated journey. This is additive; all existing specs still run.
test('seeded member and admin can enter their protected dashboard', async ({ page }) => {
  for (const role of ['member', 'admin'] as const) {
    await test.step(`${role} resolves to its protected landing`, async () => {
      await page.context().clearCookies()
      await loginAsRole(page, role)
      const fixture = getFixture(role)
      const landing = toLocalizedPath(getExpectedLanding(role), fixture.locale)
      const response = await page.goto(toLocalizedPath('/dashboard', fixture.locale), {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      })

      expect(response?.ok(), `${role}: protected navigation must return a successful page`).toBe(
        true,
      )
      await expect(page, `${role}: test identity must reach ${landing}, not login`).toHaveURL(
        (url) => url.pathname === landing,
        { timeout: 10_000 },
      )
      await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible({
        timeout: 10_000,
      })
    })
  }
})
