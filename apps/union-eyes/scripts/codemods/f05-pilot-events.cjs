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
edit('app/api/pilot/events/route.ts', [
  [`    const body = await req.json();
    const { eventType, userId: claimedUserId, organizationId: claimedOrganizationId, sessionId, metadata } = body;`, `    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A JSON object is required" }, { status: 400 });
    }
    const { eventType, userId: claimedUserId, organizationId: claimedOrganizationId, sessionId, metadata } = body;`],
  [`    if (!VALID_EVENT_TYPES.includes(eventType)) {`, `    // The free-form fields are bounded: a session id is short text and the metadata a small plain object.
    if (typeof sessionId !== "string" || sessionId.length > 200) {
      return NextResponse.json({ error: "sessionId must be text of at most 200 characters" }, { status: 400 });
    }
    if (metadata !== undefined && metadata !== null) {
      const isObject = typeof metadata === "object" && !Array.isArray(metadata);
      if (!isObject || JSON.stringify(metadata).length > 4096) {
        return NextResponse.json({ error: "metadata must be an object of at most 4 KB" }, { status: 400 });
      }
      if (metadata.caseId !== undefined && (typeof metadata.caseId !== "string" || metadata.caseId.length > 100)) {
        return NextResponse.json({ error: "metadata.caseId must be text of at most 100 characters" }, { status: 400 });
      }
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {`],
])
edit('app/api/pilot/__tests__/pilot-events-authority.route.test.ts', [
  [`const { POST } = await import('@/app/api/pilot/events/route')`, `const { POST } = await import('@/app/api/pilot/events/route')\n// Bounds on the free-form fields are exercised in the describe at the end of this file.`],
])
let t = fs.readFileSync('app/api/pilot/__tests__/pilot-events-authority.route.test.ts', 'utf8').replace(/\r\n/g, '\n')
console.log(t.slice(0, 1800))
