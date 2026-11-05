import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  withApi: vi.fn((_options: unknown, handler: (...args: unknown[]) => unknown) => handler),
}))
vi.mock('@/lib/api/framework', () => ({ withApi: mocks.withApi }))

describe('DEF-0B1-FIX-SUPER-ADMIN-INERT — governed administrator role recovery', () => {
  it('requires system-admin authentication for both verbs, without requiring an arbitrary tenant', async () => {
    await import('../admin/fix-super-admin-roles/route')
    expect(mocks.withApi).toHaveBeenCalledTimes(2)
    for (const [options] of mocks.withApi.mock.calls) {
      expect(options).toMatchObject({
        auth: { required: true, minRole: 'system_admin' },
        requireOrg: false,
      })
    }
  })

  it('does not claim repair success or reveal a member roster via GET or POST', async () => {
    const { GET, POST } = await import('../admin/fix-super-admin-roles/route')
    for (const handler of [GET, POST]) {
      const response = await handler(new NextRequest('http://localhost/api/admin/fix-super-admin-roles'))
      expect(response.status).toBe(501)
      const body = await response.json()
      expect(body.error).toBe('GOVERNED_ROLE_REPAIR_NOT_IMPLEMENTED')
      expect(body).not.toHaveProperty('members')
      expect(body).not.toHaveProperty('success')
    }
  })

  it('has no generic membership write or read path', () => {
    const source = readFileSync(join(__dirname, '..', 'admin', 'fix-super-admin-roles', 'route.ts'), 'utf8')
    expect(source).not.toMatch(/crudRoutes\(/)
    expect(source).not.toMatch(/organizationMembers/)
    expect(source).toMatch(/status:\s*501/)
  })
})
