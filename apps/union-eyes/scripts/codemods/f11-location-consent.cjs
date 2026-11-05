const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/location/consent/route.ts', [
  [
    "const _locationConsentSchema = z.object({\n  purpose: z.unknown().optional(),\n  purposeDescription: z.string().optional(),\n  consentText: z.unknown().optional(),\n  allowedDuringStrike: z.unknown().optional(),\n  allowedDuringEvents: z.unknown().optional(),\n});",
    "// The consent record is what the member agreed to, so every field is typed and bounded and an unknown field is refused: a boolean that\n// arrives as the string \"false\" used to be stored as consent to track.\nconst locationConsentSchema = z.object({\n  purpose: z.string().trim().min(1).max(100),\n  purposeDescription: z.string().trim().min(1).max(1000),\n  consentText: z.string().trim().min(1).max(4000),\n  allowedDuringStrike: z.boolean().optional(),\n  allowedDuringEvents: z.boolean().optional(),\n}).strict();",
  ],
  [
    "    const body = await req.json();\n    const { purpose, purposeDescription, consentText, allowedDuringStrike, allowedDuringEvents } = body;\n\n    if (!purpose || !purposeDescription || !consentText) {\n      return standardErrorResponse(\n      ErrorCode.VALIDATION_ERROR,\n      'Missing required fields: purpose, purposeDescription, consentText'\n    );\n    }",
    "    const parsed = locationConsentSchema.safeParse(await req.json().catch(() => null));\n    if (!parsed.success) {\n      return standardErrorResponse(\n        ErrorCode.VALIDATION_ERROR,\n        'purpose, purposeDescription and consentText are required text, the two allowance flags must be true or false, and no other field is accepted',\n      );\n    }\n    const { purpose, purposeDescription, consentText, allowedDuringStrike, allowedDuringEvents } = parsed.data;",
  ],
])
edit('app/api/__tests__/location-consent.route.test.ts', [[
  "  it('POST grants consent for the authenticated caller, ignoring a client-supplied userId in the body'",
  `  // DEF-0B8-JUR-LOCATION-CONSENT-TEXT-AND-PURPOSE-ARE-CLIENT-SUPPLIED-AND-UNVALIDATED
  it('POST refuses a body whose allowance flag is a string or that carries an unknown field, recording no consent', async () => {
    const { POST } = await loadRoute();
    const base = { purpose: 'strike', purposeDescription: 'desc', consentText: 'I agree' };
    for (const extra of [{ allowedDuringStrike: 'false' }, { allowedDuringEvents: 1 }, { userId: 'victim' }, { consentText: '' }]) {
      const response = await POST(new NextRequest('http://localhost/api/location/consent', { method: 'POST', body: JSON.stringify({ ...base, ...extra }) }));
      expect(response.status).toBe(400);
    }
    const response = await POST(new NextRequest('http://localhost/api/location/consent', { method: 'POST', body: 'not json' }));
    expect(response.status).toBe(400);
    expect(m.requestLocationConsent).not.toHaveBeenCalled();
  });

  it('POST grants consent for the authenticated caller, ignoring a client-supplied userId in the body'`,
]])
console.log('ok')
