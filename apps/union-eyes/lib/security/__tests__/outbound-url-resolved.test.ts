import { beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.hoisted(() => vi.fn())
vi.mock('node:dns/promises', () => ({ lookup }))

import { assertPublicHttpUrlResolved } from '../outbound-url'

async function refusal(url: string): Promise<string> {
  try {
    await assertPublicHttpUrlResolved(url)
    return 'accepted'
  } catch (error) {
    return (error as Error).message
  }
}

describe('assertPublicHttpUrlResolved', () => {
  beforeEach(() => lookup.mockReset())

  it('accepts a name that resolves only to public addresses', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    expect((await assertPublicHttpUrlResolved('https://source.example.org/a')).hostname).toBe('source.example.org')
  })

  it('refuses a public-looking name that resolves to a private, loopback or metadata address', async () => {
    for (const address of ['10.0.0.5', '127.0.0.1', '169.254.169.254']) {
      lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address, family: 4 }])
      await expect(assertPublicHttpUrlResolved('https://rebind.example.org/')).rejects.toThrow(/private|reserved/)
    }
    lookup.mockResolvedValue([{ address: '::1', family: 6 }])
    await expect(assertPublicHttpUrlResolved('https://rebind6.example.org/')).rejects.toThrow()
  })

  it('refuses a name that does not resolve and an address that is refused as written', async () => {
    lookup.mockResolvedValue([])
    expect(await refusal('https://nowhere.example.org/')).toMatch(/resolved/)
    expect(await refusal('http://localhost/')).toMatch(/public host/)
  })

  it('does not resolve an IP literal', async () => {
    await expect(assertPublicHttpUrlResolved('https://93.184.216.34/')).resolves.toBeInstanceOf(URL)
    expect(lookup).not.toHaveBeenCalled()
  })
})





