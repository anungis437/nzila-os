/**
 * Partners — E2E Tests (Playwright)
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.PARTNERS_URL ?? 'http://localhost:3004'

test.describe('Partners E2E', () => {
  test('health endpoint returns service info', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`)
    // 200 = fully healthy, 503 = degraded (no DB/blob in CI) — both are valid
    expect([200, 503]).toContain(res.status())
    const body = await res.json()
    expect(body.status).toMatch(/ok|degraded/)
    expect(body.app).toBe('partners')
  })

  test('evidence export requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/evidence/export`)
    expect(res.status()).toBe(401)
  })

  test('metrics endpoint requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/metrics`)
    expect(res.status()).toBe(401)
  })

  test('deals GET requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/deals`)
    expect(res.status()).toBe(401)
  })

  test('deals POST rejects invalid payload', async ({ request }) => {
    const res = await request.post(`${BASE}/api/deals`, {
      data: {},
    })
    // Should return validation error for empty body
    expect([400, 401, 422]).toContain(res.status())
  })

  test('commissions GET requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/commissions`)
    expect(res.status()).toBe(401)
  })

  test('commissions POST rejects invalid payload', async ({ request }) => {
    const res = await request.post(`${BASE}/api/commissions`, {
      data: {},
    })
    expect([400, 401, 422]).toContain(res.status())
  })

  test('dashboard page loads', async ({ page }) => {
    await page.goto(`${BASE}/`)
    await expect(page).toHaveTitle(/Partners|Nzila/)
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
