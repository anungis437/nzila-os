/**
 * Partners — E2E Tests (Playwright)
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.PARTNERS_URL ?? 'http://localhost:3004'

test.describe('Partners E2E', () => {
  test('health endpoint returns ok with service name', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('partners')
    expect(body.timestamp).toBeDefined()
  })

  test('evidence export returns structured pack', async ({ request }) => {
    const res = await request.get(`${BASE}/api/evidence/export`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.app).toBe('partners')
    expect(body.generatedAt).toBeDefined()
  })

  test('metrics endpoint returns observability data', async ({ request }) => {
    const res = await request.get(`${BASE}/api/metrics`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.request_count).toBeDefined()
    expect(body.error_rate).toBeDefined()
    expect(body.latency_ms).toBeDefined()
  })

  test('deals GET returns deal list', async ({ request }) => {
    const res = await request.get(`${BASE}/api/deals`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.deals) || Array.isArray(body)).toBe(true)
  })

  test('deals POST rejects invalid payload', async ({ request }) => {
    const res = await request.post(`${BASE}/api/deals`, {
      data: {},
    })
    // Should return validation error for empty body
    expect([400, 401, 422]).toContain(res.status())
  })

  test('commissions GET returns commission data', async ({ request }) => {
    const res = await request.get(`${BASE}/api/commissions`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toBeDefined()
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
