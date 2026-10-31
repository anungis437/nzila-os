const fs = require('fs')
const f = 'app/api/pilot/__tests__/pilot-events-authority.route.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
s = s.replace('\n// Bounds on the free-form fields are exercised in the describe at the end of this file.', '')
s = s.trimEnd() + `

// DEF-0B10-PIL-PILOT-WRITE-ROUTES-CAST-THE-JSON-BODY-WITHOUT-A-SCHEMA-AND-STORE-CALLER-TEXT-IN-AN-UNBOUNDED-JSON
describe('pilot/events route — free-form fields are bounded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.trackPilotEvent.mockResolvedValue(undefined)
  })

  it.each([
    [{ eventType: 'feature_used', sessionId: 's'.repeat(201) }],
    [{ eventType: 'feature_used', sessionId: 5 }],
    [{ eventType: 'feature_used', sessionId: 's1', metadata: 'text' }],
    [{ eventType: 'feature_used', sessionId: 's1', metadata: [1] }],
    [{ eventType: 'feature_used', sessionId: 's1', metadata: { blob: 'x'.repeat(5000) } }],
    [{ eventType: 'case_created', sessionId: 's1', metadata: { caseId: { nested: true } } }],
  ])('refuses %j with 400 and records nothing', async (body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(mocks.trackPilotEvent).not.toHaveBeenCalled()
    expect(mocks.trackCaseCreated).not.toHaveBeenCalled()
  })

  it('refuses a body that is not a JSON object', async () => {
    const res = await POST(new NextRequest('http://localhost/api/pilot/events', { method: 'POST', body: '[1]' }), { userId: 'caller', organizationId: 'caller-org' })
    expect(res.status).toBe(400)
  })

  it('still records a small event', async () => {
    expect((await post({ eventType: 'feature_used', sessionId: 's1', metadata: { feature: 'x' } })).status).toBe(200)
  })
})
`
fs.writeFileSync(f, s)
console.log('ok')
