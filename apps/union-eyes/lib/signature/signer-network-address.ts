/**
 * The network address of a signer, taken from a proxy header only as far as the deployment trusts it.
 *
 * The first value of X-Forwarded-For is whatever the client chose to send. Each trusted proxy appends the address it received the
 * connection from, so the address that matters is counted from the right: with N trusted proxy hops it is the Nth entry from the end.
 * UE_TRUSTED_PROXY_HOPS says how many (default 1). Fewer entries than hops means the header was not produced by the trusted chain
 * and no address is recorded rather than a guessed one. The way the address was obtained is recorded with it.
 */
export interface SignerNetworkAddress {
  address: string | null
  provenance: { source: 'x-forwarded-for' | 'x-real-ip' | 'none'; trustedProxyHops: number }
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/
const IPV6 = /^[0-9a-f:]+$/i

const plausible = (value: string): boolean => (IPV4.test(value) && value.split('.').every((part) => Number(part) <= 255)) || (value.includes(':') && IPV6.test(value))

export function trustedProxyHops(env: Record<string, string | undefined> = process.env): number {
  const parsed = Number.parseInt(env.UE_TRUSTED_PROXY_HOPS ?? '1', 10)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 1
}

export function signerNetworkAddress(headers: Headers, hops: number = trustedProxyHops()): SignerNetworkAddress {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const entries = forwarded.split(',').map((entry) => entry.trim()).filter(Boolean)
    const candidate = entries.length >= hops ? entries[entries.length - hops] : undefined
    if (candidate && plausible(candidate)) {
      return { address: candidate, provenance: { source: 'x-forwarded-for', trustedProxyHops: hops } }
    }
    return { address: null, provenance: { source: 'none', trustedProxyHops: hops } }
  }
  const real = headers.get('x-real-ip')?.trim()
  if (real && plausible(real)) return { address: real, provenance: { source: 'x-real-ip', trustedProxyHops: hops } }
  return { address: null, provenance: { source: 'none', trustedProxyHops: hops } }
}
