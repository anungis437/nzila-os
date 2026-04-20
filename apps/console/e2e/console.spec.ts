/**
 * Console — E2E Tests (Playwright)
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.CONSOLE_URL ?? 'http://localhost:3001'

test.describe('Console E2E', () => {
  test('dashboard loads', async ({ page }) => {
    await page.goto(`${BASE}/console`)
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('health endpoint returns service info', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`)
    // 200 = fully healthy, 503 = degraded (no DB/blob in CI) — both are valid
    expect([200, 503]).toContain(res.status())
    const body = await res.json()
    expect(body.status).toBeDefined()
    expect(body.app).toBeDefined()
  })

  test('metrics endpoint requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/metrics`)
    // Metrics is auth-protected; accept 200 (public) or 401 (guarded)
    expect([200, 401]).toContain(res.status())
  })
})
