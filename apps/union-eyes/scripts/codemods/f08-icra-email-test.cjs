const fs = require('fs')
const f = 'app/api/__tests__/icra-email-results.route.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap("vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rateLimit }));", "vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.rateLimit }));")
swap("m.rateLimit.mockReturnValue({ success: true });", "m.rateLimit.mockResolvedValue({ allowed: true });")
swap("m.rateLimit.mockReturnValueOnce({ success: false });", "m.rateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });")
swap("    body: JSON.stringify(bodyObj),\n  });\n}", "    body: JSON.stringify({ acknowledgeLinkAccess: true, ...bodyObj }),\n  });\n}")
swap("body: JSON.stringify({ assessmentId: 'a1', email: 'a@example.com' }),\n    }));\n\n    expect(response.status).toBe(401);", "body: JSON.stringify({ assessmentId: 'a1', email: 'a@example.com', acknowledgeLinkAccess: true }),\n    }));\n\n    expect(response.status).toBe(401);")
swap(
  "  it('returns 400 for invalid email'",
  `  // DEF-0B8-ICRA-EMAIL-RESULTS-SENDS-THE-BEARER-CAPABILITY-TO-ANY-TYPED-ADDRESS
  it('refuses to mail the link until the respondent acknowledges that anyone holding it can open the results', async () => {
    const { POST } = await loadRoute();
    const response = await POST(req({ assessmentId: 'a1', email: 'a@example.com', acknowledgeLinkAccess: false }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('LINK_ACCESS_ACKNOWLEDGEMENT_REQUIRED');
    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  // DEF-0B8-ICRA-RATE-LIMITS-PER-PROCESS-AND-KEYED-ON-REQUEST-HEADER-ADDRESS
  it('uses the shared limiter, answers 503 when it is unavailable in production, and never sends', async () => {
    const { POST } = await loadRoute();
    m.rateLimit.mockResolvedValueOnce({ allowed: false, error: 'redis down', resetIn: 30 });
    const response = await POST(req({ assessmentId: 'a1', email: 'a@example.com' }));
    expect(response.status).toBe(503);
    expect(m.sendEmail).not.toHaveBeenCalled();
    expect(m.rateLimit).toHaveBeenCalledWith(expect.stringContaining('icra-email-results:'), expect.objectContaining({ limit: 5, window: 3600 }));
  });

  it('returns 400 for invalid email'`,
)
fs.writeFileSync(f, s)
console.log('ok')
