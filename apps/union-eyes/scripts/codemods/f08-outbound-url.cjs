const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
fs.mkdirSync('lib/security/__tests__', { recursive: true })
fs.writeFileSync('lib/security/outbound-url.ts', `export class OutboundUrlError extends Error {
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
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new OutboundUrlError(\`Scheme \${url.protocol} is not allowed\`)
  if (url.username || url.password) throw new OutboundUrlError('An address with credentials is not allowed')
  const host = url.hostname.toLowerCase().replace(/^\\[|\\]$/g, '')
  if (!host) throw new OutboundUrlError('The address has no host')
  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) throw new OutboundUrlError('The host is not a public host')
  const v4 = host.match(/^(\\d+)\\.(\\d+)\\.(\\d+)\\.(\\d+)$/)
  if (v4 && ipv4Private(Number(v4[1]), Number(v4[2]))) throw new OutboundUrlError('A private or reserved address is not allowed')
  if (host.includes(':')) {
    const mapped = host.match(/^::ffff:(\\d+)\\.(\\d+)\\.(\\d+)\\.(\\d+)$/)
    if (host === '::1' || host === '::' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || (mapped && ipv4Private(Number(mapped[1]), Number(mapped[2])))) {
      throw new OutboundUrlError('A private or reserved address is not allowed')
    }
  }
  return url
}
`)
fs.writeFileSync('lib/security/__tests__/outbound-url.test.ts', `import { describe, expect, it } from 'vitest'
import { OutboundUrlError, assertPublicHttpUrl } from '../outbound-url'

// DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS
describe('assertPublicHttpUrl', () => {
  it.each(['https://www.canlii.org/en/', 'http://example.com/a.pdf', 'https://8.8.8.8/x'])('accepts %s', (url) => {
    expect(assertPublicHttpUrl(url).href).toBe(new URL(url).href)
  })

  it.each([
    'file:///etc/passwd', 'ftp://example.com/x', 'gopher://example.com', 'javascript:alert(1)', 'not a url',
    'http://localhost/x', 'http://LOCALHOST:8080/', 'http://app.localhost/', 'http://printer.local/', 'http://db.internal/',
    'http://127.0.0.1/', 'http://127.1.2.3/', 'http://0.0.0.0/', 'http://10.0.0.5/', 'http://172.16.0.1/', 'http://172.31.255.255/',
    'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data', 'http://100.64.0.1/', 'http://224.0.0.1/',
    'http://metadata.google.internal/computeMetadata/v1/', 'http://[::1]/', 'http://[fd00::1]/', 'http://[fe80::1]/', 'http://[::ffff:10.0.0.1]/',
    'https://user:pass@example.com/',
  ])('refuses %s', (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(OutboundUrlError)
  })

  it('does not refuse a public address just because it starts like a private one', () => {
    expect(() => assertPublicHttpUrl('http://172.32.0.1/')).not.toThrow()
    expect(() => assertPublicHttpUrl('http://11.0.0.1/')).not.toThrow()
  })
})
`)
edit('lib/services/cba-intelligence/adapters/base-adapter.ts', [
  [`import { logger } from "@/lib/logger";`, `import { logger } from "@/lib/logger";
import { assertPublicHttpUrl } from "@/lib/security/outbound-url";

/** A source page larger than this is refused rather than read whole into memory. */
const MAX_SOURCE_CHARACTERS = 10_000_000;
const MAX_REDIRECTS = 3;`],
  [`    const rawContent = await response.text();
`, `    const rawContent = await response.text();
    if (rawContent.length > MAX_SOURCE_CHARACTERS) throw new Error("Source document is larger than the allowed size");
`],
  [`    retries = this.maxRetries,
  ): Promise<Response> {
    const controller`, `    retries = this.maxRetries,
    redirects = 0,
  ): Promise<Response> {
    // The address comes from a configured source or a discovered link: only a public http(s) address is fetched, and a
    // redirect is followed by hand so each hop is checked again.
    assertPublicHttpUrl(url);
    const controller`],
  [`        signal: controller.signal,
        headers: {`, `        signal: controller.signal,
        redirect: "manual",
        headers: {`],
  [`      if (!response.ok) {
        if (retries > 0`, `      if (response.status >= 300 && response.status < 400) {
        const location = response.headers?.get?.("location");
        if (!location || redirects >= MAX_REDIRECTS) throw new Error(\`Too many or empty redirects fetching \${url}\`);
        return this.fetchWithRetry(new URL(location, url).href, options, retries, redirects + 1);
      }

      if (!response.ok) {
        if (retries > 0`],
  [`this.fetchWithRetry(url, options, retries - 1);`, `this.fetchWithRetry(url, options, retries - 1, redirects);`],
])
console.log('ok')
