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
edit('app/api/rewards/wallet/route.ts', [
  [`    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10);
`, `    // A non-numeric or negative value is the default, never NaN or a negative offset handed to the query.
    const boundedInt = (raw: string | null, fallback: number, min: number, max: number) => {
      const parsed = Number.parseInt(raw ?? '', 10);
      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
    };
    const limit = boundedInt(searchParams.get('limit'), 20, 1, 100);
    const offset = boundedInt(searchParams.get('offset'), 0, 0, 1_000_000);
`],
])
fs.writeFileSync('app/api/__tests__/rewards-wallet.route.test.ts', `import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ getBalance: vi.fn(), listLedger: vi.fn() }))

vi.mock('@/lib/services/rewards/wallet-service', () => ({ getBalance: m.getBalance, listLedger: m.listLedger }))
vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (request: NextRequest, context: unknown) => unknown) => handler,
}))

// DEF-0B11-PRP-WALLET-GET-READS-BALANCE-AND-LEDGER-SEPARATELY-WITH-UNVALIDATED-PAGING
describe('rewards/wallet GET paging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.getBalance.mockResolvedValue(10)
    m.listLedger.mockResolvedValue({ entries: [] })
  })

  const get = async (query: string) => {
    const { GET } = await import('../rewards/wallet/route')
    return (GET as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(
      new NextRequest(\`http://localhost/api/rewards/wallet\${query}\`),
      { userId: 'u1', organizationId: 'org_1' },
    )
  }

  it('turns a non-numeric or negative request into bounded defaults', async () => {
    await get('?limit=abc&offset=-5')
    expect(m.listLedger).toHaveBeenCalledWith('org_1', 'u1', 20, 0)
  })

  it('caps the limit at 100 and never passes NaN', async () => {
    await get('?limit=9999&offset=3')
    expect(m.listLedger).toHaveBeenLastCalledWith('org_1', 'u1', 100, 3)
    await get('?limit=0')
    expect(m.listLedger).toHaveBeenLastCalledWith('org_1', 'u1', 1, 0)
  })

  it('reads only the caller\\'s own balance and ledger', async () => {
    await get('')
    expect(m.getBalance).toHaveBeenCalledWith('org_1', 'u1')
  })
})
`)
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B40-F05-REWARDS-PAGING-AND-EXPORT'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B40 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F05: a page request is parsed into bounded integers and an export is bounded, administrative and audited',
  evidenceCommit: null,
  items: [
    item('DEF-0B11-PRP-WALLET-GET-READS-BALANCE-AND-LEDGER-SEPARATELY-WITH-UNVALIDATED-PAGING', [A + 'app/api/rewards/wallet/route.ts', A + 'app/api/__tests__/rewards-wallet.route.test.ts'],
      'Limit and offset are parsed to bounded integers (limit 1..100, offset 0..1,000,000), so a non-numeric or negative value is the default rather than NaN or a negative offset; the route reads only the caller own balance and ledger.',
      { status: 'PARTIAL', remaining: 'The balance and the ledger are still read in two separate statements, so a movement between them can make them disagree.' }),
    item('DEF-0B11-PRP-REWARDS-EXPORT-IS-UNBOUNDED-AND-WRITES-NO-AUDIT-RECORD', [A + 'app/api/rewards/export/route.ts', A + 'app/api/__tests__/rewards-export.route.test.ts'],
      'The export needs the administrator role before any read, is bounded to 5,000 rows, neutralises spreadsheet formula cells, and is audited in the transaction that reads it so a failed audit withholds the file (existing implementation and test).'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B40 added')
