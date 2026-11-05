const fs = require('fs')
const path = require('path')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/cba-intelligence/sources/route.ts', [
  [`  baseUrl: z.string().url().optional(),
  apiEndpoint: z.string().url().optional(),
  feedUrl: z.string().url().optional(),`, `  // A source address is fetched by the server, so it must be a public http(s) address when it is saved, not only when it is fetched.
  baseUrl: publicUrl.optional(),
  apiEndpoint: publicUrl.optional(),
  feedUrl: publicUrl.optional(),`],
  [`const createSourceSchema = z.object({`, `const publicUrl = z.string().url().max(2000).refine((value) => {
  try {
    assertPublicHttpUrl(value);
    return true;
  } catch {
    return false;
  }
}, 'Must be a public http(s) address');

const createSourceSchema = z.object({`],
])
let s = fs.readFileSync('app/api/cba-intelligence/sources/route.ts', 'utf8').replace(/\r\n/g, '\n')
s = s.replace(/(\nimport [^\n]*\n)/, `$1import { assertPublicHttpUrl } from '@/lib/security/outbound-url';\n`)
fs.writeFileSync('app/api/cba-intelligence/sources/route.ts', s)
fs.writeFileSync('lib/api/__tests__/f08-b41-outbound.contract.test.ts', `import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F08 outbound fetches of supplied addresses', () => {
  // DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS
  it('every CBA ingestion adapter fetches through the guarded base fetch', () => {
    const base = read('lib/services/cba-intelligence/adapters/base-adapter.ts')
    expect(base).toContain('assertPublicHttpUrl(url)')
    expect(base).toContain('redirect: "manual"')
    const adapters = ['canlii', 'esdc', 'fpslreb', 'html-bulletin', 'provincial-board', 'statscan-csv', 'union-bargaining']
    for (const name of adapters) {
      const source = read(\`lib/services/cba-intelligence/adapters/\${name}-adapter.ts\`)
      expect(source, name).toContain('this.fetchWithRetry(')
      expect(source, name).not.toMatch(/[^.]\\bfetch\\(sourceUrl/)
    }
  })

  it('a source address is checked when it is saved', () => {
    const source = read('app/api/cba-intelligence/sources/route.ts')
    expect(source).toContain('assertPublicHttpUrl(value)')
    expect(source).toContain('baseUrl: publicUrl.optional()')
  })
})
`)
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B41-F08-OUTBOUND-FETCH-OF-SUPPLIED-ADDRESSES'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B41 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F08: the server fetches a supplied address only if it is a public http(s) address, follows each redirect by hand and reads a bounded document',
  evidenceCommit: null,
  items: [
    item('DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS', [A + 'lib/security/outbound-url.ts', A + 'lib/security/__tests__/outbound-url.test.ts', A + 'lib/services/cba-intelligence/adapters/base-adapter.ts', A + 'lib/services/cba-intelligence/adapters/__tests__/base-adapter.test.ts', A + 'app/api/cba-intelligence/sources/route.ts', A + 'lib/api/__tests__/f08-b41-outbound.contract.test.ts'],
      'A shared guard refuses non-http(s) schemes, credentials in the address, localhost and internal names, private, loopback, link-local, metadata and reserved IPv4 and IPv6 literals (including IPv4-mapped forms). The base adapter checks every address before fetching, follows redirects by hand (three at most) re-checking each hop, and refuses a source larger than 10 million characters; every ingestion adapter fetches through it, and a source address is checked when it is saved.',
      { status: 'PARTIAL', remaining: 'The guard reads the address as written and does not resolve DNS, so a public name that resolves to a private address is not caught; that needs an egress policy or a resolving fetch. The body is still read whole before the size check.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B41 added')
