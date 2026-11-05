const fs = require('fs')
const f = 'app/api/__tests__/workbook-id-claim.route.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap("  persistAtomicAudit: vi.fn(),\n}));", "  persistAtomicAudit: vi.fn(),\n  checkRateLimit: vi.fn(),\n}));\n\nvi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit }));")
swap("    vi.clearAllMocks();\n", "    vi.clearAllMocks();\n    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 60 });\n")
swap("{ workbookId: 'w1', userId: 'u1', orgId: 'org_1' },", "{ workbookRef: opaqueRef('w1'), userId: 'u1', orgId: 'org_1' },")
swap("{ workbookId: 'w1', err: expect.any(Error) },", "{ workbookRef: opaqueRef('w1'), err: expect.any(Error) },")
swap("import { NextRequest } from 'next/server';\n", "import { NextRequest } from 'next/server';\nimport { opaqueRef } from '@/lib/icra/opaque-ref';\n")
const end = s.lastIndexOf('});')
s = s.slice(0, end) + `
  // DEF-0B12-WBK-CLAIM-HAS-NO-RATE-LIMIT-AND-READS-AN-UNCAPPED-BODY
  it('rate limits claim attempts and never reads the body of a refused request', async () => {
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 120 });
    const response = await postClaim();
    expect(response.status).toBe(429);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('refuses an oversized body with 413 before parsing it', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/workbook/w1/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimToken: 'x'.repeat(20_000) }),
    }), { params: Promise.resolve({ id: 'w1' }) });
    expect(response.status).toBe(413);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  // DEF-0B12-WBK-ROUTES-LOG-THE-BEARER-WORKBOOK-ID
  it('logs an opaque reference for the workbook, never the identifier that acts as a capability', async () => {
    m.updateQueue.push([{ id: 'w1' }]);
    await postClaim();
    const logged = JSON.stringify(m.logger.info.mock.calls);
    expect(logged).not.toContain('"w1"');
    expect(logged).toContain(opaqueRef('w1'));
  });
});
`
fs.writeFileSync(f, s)
console.log('ok')
