import { describe, expect, it } from 'vitest'
import { signerNetworkAddress, trustedProxyHops } from '../signer-network-address'

const headers = (init: Record<string, string>) => new Headers(init)

describe('signer network address', () => {
  it('ignores a client-chosen first value and takes the address the trusted proxy appended', () => {
    const result = signerNetworkAddress(headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }), 1)

    expect(result.address).toBe('203.0.113.7')
    expect(result.provenance).toEqual({ source: 'x-forwarded-for', trustedProxyHops: 1 })
  })

  it('counts trusted hops from the right', () => {
    expect(signerNetworkAddress(headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7, 10.0.0.2' }), 2).address).toBe('203.0.113.7')
  })

  it('records no address when the header has fewer entries than there are trusted hops', () => {
    const result = signerNetworkAddress(headers({ 'x-forwarded-for': '203.0.113.7' }), 2)

    expect(result.address).toBeNull()
    expect(result.provenance.source).toBe('none')
  })

  it.each(['not-an-address', '999.1.1.1', "1.2.3.4'; DROP TABLE"])('records no address for the implausible value %j', (value) => {
    expect(signerNetworkAddress(headers({ 'x-forwarded-for': `1.1.1.1, ${value}` }), 1).address).toBeNull()
  })

  it('accepts an IPv6 address', () => {
    expect(signerNetworkAddress(headers({ 'x-forwarded-for': '2001:db8::1' }), 1).address).toBe('2001:db8::1')
  })

  it('falls back to x-real-ip only when there is no forwarded header', () => {
    expect(signerNetworkAddress(headers({ 'x-real-ip': '203.0.113.9' }), 1)).toMatchObject({ address: '203.0.113.9', provenance: { source: 'x-real-ip' } })
    expect(signerNetworkAddress(headers({ 'x-forwarded-for': 'garbage', 'x-real-ip': '203.0.113.9' }), 1).address).toBeNull()
  })

  it('never invents an address', () => {
    expect(signerNetworkAddress(headers({}), 1)).toEqual({ address: null, provenance: { source: 'none', trustedProxyHops: 1 } })
  })

  it('reads the trusted hop count from the environment within a sane range', () => {
    expect(trustedProxyHops({ UE_TRUSTED_PROXY_HOPS: '2' })).toBe(2)
    expect(trustedProxyHops({ UE_TRUSTED_PROXY_HOPS: '0' })).toBe(1)
    expect(trustedProxyHops({ UE_TRUSTED_PROXY_HOPS: '99' })).toBe(1)
    expect(trustedProxyHops({})).toBe(1)
  })
})
