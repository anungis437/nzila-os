const fs = require('fs')
const CONSENT = "consent: { acceptedAt: '2026-01-01T00:00:00.000Z', doctrineVersion: '1.0.0', acknowledgedAntiSurveillance: true, acknowledgedDataHandling: true, acknowledgedExplainability: true }"

function patch(p, fn) {
  const s = fs.readFileSync(p, 'utf8')
  const out = fn(s)
  if (out === s) throw new Error('no change in ' + p)
  fs.writeFileSync(p, out)
}

patch('app/api/__tests__/icra-start.route.test.ts', (s) =>
  s
    .replace("body: JSON.stringify({ locale: 'en-CA' }),\n    }));\n\n    expect(response.status).toBe(500);", "body: JSON.stringify({\n        locale: 'en-CA',\n        consent: { acknowledgedAntiSurveillance: true, acknowledgedDataHandling: true, acknowledgedExplainability: true },\n      }),\n    }));\n\n    expect(response.status).toBe(500);\n  });\n\n  it('POST refuses to start without all three acknowledgements and stamps the consent itself', async () => {\n    const { POST } = await loadRoute();\n    const post = (consent: unknown) => POST(new NextRequest('http://localhost/api/icra/start', {\n      method: 'POST',\n      headers: { 'content-type': 'application/json' },\n      body: JSON.stringify({ locale: 'en-CA', consent }),\n    }));\n\n    expect((await post(undefined)).status).toBe(400);\n    expect((await post({ acknowledgedAntiSurveillance: true, acknowledgedDataHandling: true, acknowledgedExplainability: false })).status).toBe(400);\n    expect(m.withSystemContext).not.toHaveBeenCalled();"),
)

patch('app/api/__tests__/icra-assessmentId-answer.route.test.ts', (s) => {
  let out = s.replace("                  status: 'in_progress',\n                  capabilityTokenHash: TOKEN_HASH,", "                  status: 'in_progress',\n                  " + CONSENT + ",\n                  capabilityTokenHash: TOKEN_HASH,")
  out = out.replace("  it('returns 400 for invalid answer payload', async () => {", "  it('refuses to store an answer for an assessment with no recorded consent', async () => {\n    m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {\n      const insert = vi.fn(() => ({ values: vi.fn(async () => ({})) }));\n      const tx = {\n        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'a1', status: 'in_progress', consent: null, capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]) })) })) })),\n        delete: vi.fn(() => ({ where: vi.fn(async () => ({})) })),\n        insert,\n      };\n      const result = await fn(tx);\n      expect(insert).not.toHaveBeenCalled();\n      return result;\n    });\n    const { POST } = await loadRoute();\n    const response = await POST(req({ questionId: 'q1', rawValue: 'yes' }), { params: Promise.resolve({ assessmentId: A1 }) });\n    expect(response.status).toBe(409);\n  });\n\n  it('returns 400 for invalid answer payload', async () => {")
  return out
})

patch('app/api/__tests__/icra-assessmentId-submit.route.test.ts', (s) => {
  let out = s.split("{ id: 'a1', status: 'in_progress', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }").join("{ id: 'a1', status: 'in_progress', " + CONSENT + ", capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }")
  out = out.replace("  logger: { info: vi.fn(), error: vi.fn() },\n  eq: vi.fn(),\n}));", "  logger: { info: vi.fn(), error: vi.fn() },\n  eq: vi.fn(),\n  missingRequiredAnswerIds: vi.fn(),\n}));")
  out = out.replace("vi.mock('@/lib/logger', () => ({ logger: m.logger }));", "vi.mock('@/lib/logger', () => ({ logger: m.logger }));\nvi.mock('@/lib/icra/stepwise-coverage', () => ({ missingRequiredAnswerIds: m.missingRequiredAnswerIds }));")
  out = out.replace("    m.eq.mockReturnValue('eq');\n", "    m.eq.mockReturnValue('eq');\n    m.missingRequiredAnswerIds.mockReturnValue([]);\n")
  return out
})
