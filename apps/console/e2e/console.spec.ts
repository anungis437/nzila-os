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

  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBeDefined()
    expect(body.service).toBeDefined()
  })

  test('metrics endpoint returns core observability fields', async ({ request }) => {
    const res = await request.get(`${BASE}/api/metrics`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.request_count).toBeDefined()
    expect(body.error_rate).toBeDefined()
    expect(body.latency_ms).toBeDefined()
  })
})
