import { describe, expect, it } from 'vitest'
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
    'http://198.18.0.1/', 'http://198.19.255.255/', 'http://198.51.100.1/', 'http://203.0.113.7/',
    'http://192.0.2.4/', 'http://192.88.99.1/',
    'http://[::ffff:198.18.0.1]/', 'http://[::ffff:203.0.113.7]/',
    'http://[2001:db8::1]/', 'http://[2001::1]/', 'http://[2002:c0a8:0101::1]/', 'http://[64:ff9b::a00:1]/',
    'https://user:pass@example.com/',
  ])('refuses %s', (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(OutboundUrlError)
  })

  it('does not refuse a public address just because it starts like a private one', () => {
    expect(() => assertPublicHttpUrl('http://172.32.0.1/')).not.toThrow()
    expect(() => assertPublicHttpUrl('http://11.0.0.1/')).not.toThrow()
  })
})
