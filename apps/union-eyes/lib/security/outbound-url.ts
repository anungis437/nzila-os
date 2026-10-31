export class OutboundUrlError extends Error {
  readonly code = 'OUTBOUND_URL_REFUSED'
}

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata', 'instance-data'])
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa']

function ipv4Private(a: number, b: number, c: number, d: number): boolean {
  // Non-globally-routable IPv4 literals must never be used for outbound ingestion.
  // Include documentation, benchmarking, protocol assignment and relay ranges:
  // these are not safe substitutes for a public source URL.
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
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
  if (v4 && ipv4Private(Number(v4[1]), Number(v4[2]), Number(v4[3]), Number(v4[4]))) throw new OutboundUrlError('A private or reserved address is not allowed')
  if (host.includes(':')) {
    // URL normalises an IPv4-mapped address to hex groups (::ffff:a00:1), so both spellings are read back to octets.
    const dotted = host.match(/^::ffff:(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    const mapped = dotted
      ? [Number(dotted[1]), Number(dotted[2]), Number(dotted[3]), Number(dotted[4])]
      : hex
        ? [parseInt(hex[1]!, 16) >> 8, parseInt(hex[1]!, 16) & 255, parseInt(hex[2]!, 16) >> 8, parseInt(hex[2]!, 16) & 255]
        : null
    // Transition and documentation prefixes can encapsulate other destinations.
    // Until egress pins a verified public DNS result, reject these literal forms.
    if (host === '::1' || host === '::' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) ||
        /^ff/.test(host) || /^2001:db8:/.test(host) || /^2002:/.test(host) ||
        /^64:ff9b:/.test(host) || /^2001:0:/.test(host) ||
        (mapped && ipv4Private(mapped[0]!, mapped[1]!, mapped[2]!, mapped[3]!))) {
      throw new OutboundUrlError('A private or reserved address is not allowed')
    }
  }
  return url
}
