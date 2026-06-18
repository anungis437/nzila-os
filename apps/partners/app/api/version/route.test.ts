import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getBuildMetadata: vi.fn(),
}))

vi.mock('@nzila/os-core/health', () => ({
  getBuildMetadata: mocks.getBuildMetadata,
}))

import { GET } from './route'

describe('GET /api/version', () => {
  it('returns build metadata for partners app', async () => {
    mocks.getBuildMetadata.mockReturnValue({ app: 'partners', version: '1.2.3' })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ app: 'partners', version: '1.2.3' })
    expect(mocks.getBuildMetadata).toHaveBeenCalledWith('partners')
  })
})
