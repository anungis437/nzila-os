export class OutboundUrlError extends Error {
  readonly code = 'OUTBOUND_URL_REFUSED'
}

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata', 'instance-data'])
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa']

function ipv4Private(a: number, b: number): boolean {
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    a >= 224
  )
}

/**
 * A server-side fetch of an address someone supplied. Only http(s) to a named public host or public IP literal is allowed:
 * no credentials in the address, no loopback, private, link-local or metadata host. Returns the parsed URL.
 *
 * This checks the address as written. It does not resolve DNS, so a public name that resolves to a private address is not
 * caught here; the network egress policy is the control for that.
 */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new OutboundUrlError('The address is not a valid URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new OutboundUrlError(`Scheme ${url.protocol} is not allowed`)
  if (url.username || url.password) throw new OutboundUrlError('An address with credentials is not allowed')
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) throw new OutboundUrlError('The address has no host')
  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) throw new OutboundUrlError('The host is not a public host')
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4 && ipv4Private(Number(v4[1]), Number(v4[2]))) throw new OutboundUrlError('A private or reserved address is not allowed')
  if (host.includes(':')) {
    // URL normalises an IPv4-mapped address to hex groups (::ffff:a00:1), so both spellings are read back to octets.
    const dotted = host.match(/^::ffff:(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    const mapped = dotted ?? (hex ? [hex[0], String(parseInt(hex[1]!, 16) >> 8), String(parseInt(hex[1]!, 16) & 255)] : null)
    if (host === '::1' || host === '::' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || (mapped && ipv4Private(Number(mapped[1]), Number(mapped[2])))) {
      throw new OutboundUrlError('A private or reserved address is not allowed')
    }
  }
  return url
}
