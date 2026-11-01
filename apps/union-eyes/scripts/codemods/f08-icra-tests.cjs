const fs = require('fs')
const A1 = "A1"
const files = [
  'app/api/__tests__/icra-assessmentId-profile.route.test.ts',
  'app/api/__tests__/icra-assessmentId-submit.route.test.ts',
  'app/api/__tests__/icra-assessmentId-claim.route.test.ts',
  'app/api/__tests__/icra-assessmentId-answer.route.test.ts',
  'app/api/__tests__/icra-capability-exchange.route.test.ts',
]
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  s = s.replace(/assessmentId: 'a1'/g, 'assessmentId: A1')
  s = s.replace(/(\nimport [^\n]*vitest';\n)/, `$1\n// The route answers a path value that is not a UUID as not found, so the tests use a real identifier.\nconst A1 = '00000000-0000-4000-8000-0000000000a1';\n`)
  fs.writeFileSync(f, s)
}

// The exchange test exercised the removed per-process counter; it now drives the shared limiter through its mock.
{
  const f = 'app/api/__tests__/icra-capability-exchange.route.test.ts'
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 60)}`); s = s.replace(a, b) }
  swap("const m = vi.hoisted(() => ({\n  withSystemContext: vi.fn(),\n  eq: vi.fn(),\n}));", "const m = vi.hoisted(() => ({\n  withSystemContext: vi.fn(),\n  eq: vi.fn(),\n  checkRateLimit: vi.fn(),\n}));\n\nvi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit }));")
  const start = s.indexOf("  it('returns 429 after exceeding the per (IP, assessmentId) rate limit'")
  s = s.slice(0, start) + `  // DEF-0B8-ICRA-RATE-LIMITS-PER-PROCESS-AND-KEYED-ON-REQUEST-HEADER-ADDRESS
  // Replaced: this test drove 21 calls through the per-process counter; the route now asks the shared limiter.
  it('answers 429 when the shared limiter refuses, and 503 when it is unavailable', async () => {
    mockTx({ capabilityTokenHash: createHash('sha256').update('wrong', 'utf8').digest('hex'), capabilityTokenExpiresAt: FUTURE });
    const { POST } = await loadRoute();
    const call = () => POST(new Request('http://localhost/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': 'spoofed, 5.5.5.5' },
      body: JSON.stringify({ capability: TOKEN }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });
    expect((await call()).status).toBe(429);
    expect(m.checkRateLimit).toHaveBeenCalledWith(\`icra-capability-exchange:5.5.5.5:\${A1}\`, expect.objectContaining({ limit: 20 }));

    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, error: 'redis down', resetIn: 60 });
    expect((await call()).status).toBe(503);
  });

  // DEF-0B8-ICRA-MALFORMED-IDS-AND-ANSWER-VALUES-SURFACE-AS-SERVER-ERRORS
  it('answers a path value that is not a UUID as not found, before any limiter or database call', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/x', { method: 'POST', body: '{}' }), { params: Promise.resolve({ assessmentId: 'not-a-uuid' }) });
    expect(response.status).toBe(404);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });
});
`
  s = s.replace("beforeEach(() => {\n    vi.clearAllMocks();", "beforeEach(() => {\n    vi.clearAllMocks();\n    m.checkRateLimit.mockResolvedValue({ allowed: true });")
  fs.writeFileSync(f, s)
}
console.log('ok')
