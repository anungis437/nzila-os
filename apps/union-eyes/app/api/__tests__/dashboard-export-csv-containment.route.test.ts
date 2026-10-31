import { beforeEach, describe, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({ options: [] as Array<Record<string, unknown>> }))

vi.mock('@/lib/api/framework', () => ({
  withApi: (options: Record<string, unknown>, handler: unknown) => {
    captured.options.push(options)
    return handler
  },
}))

beforeEach(() => {
  captured.options.length = 0
  vi.resetModules()
})

describe('dashboard CSV export fail-closed containment', () => {
  it('requires administrator authentication before any export is considered', async () => {
    await import('../dashboard/export-csv/route')
    expect(captured.options).toHaveLength(1)
    expect(captured.options[0]).toMatchObject({ auth: { required: true, minRole: 'admin' } })
  })

  it('refuses absent organization context without producing a CSV', async () => {
    const { GET } = await import('../dashboard/export-csv/route')
    const response = await (GET as any)({ organizationId: null })
    expect(response.status).toBe(403)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect((await response.json()).error).toBe('ORGANIZATION_CONTEXT_REQUIRED')
  })

  it('returns an explicit non-success for an authorized tenant rather than fabricated zero rows', async () => {
    const { GET } = await import('../dashboard/export-csv/route')
    const response = await (GET as any)({ organizationId: 'org-a' })
    expect(response.status).toBe(501)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('content-disposition')).toBeNull()
    expect((await response.json()).error).toBe('DASHBOARD_CSV_EXPORT_NOT_IMPLEMENTED')
  })
})
