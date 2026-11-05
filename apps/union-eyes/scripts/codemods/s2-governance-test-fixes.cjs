const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  const crlf = s.includes('\r\n')
  s = s.replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s)
}
// The mutation-scope scanner needs the organization predicate to be visible inside the where clause of the write.
edit('lib/services/committee-workspace-service.ts', [
  [
    "    const conditions = [eq(committeeMeetings.id, meetingId), eq(committeeMeetings.organizationId, organizationId)];\n    if (touchesApprovedRecord) conditions.push(isNull(committeeMeetings.minutesApprovedAt));\n    const [updated] = await tx\n      .update(committeeMeetings)\n      .set({ ...changes, updatedAt: sql`now()` })\n      .where(and(...conditions))\n      .returning();",
    "    const [updated] = await tx\n      .update(committeeMeetings)\n      .set({ ...changes, updatedAt: sql`now()` })\n      .where(and(eq(committeeMeetings.id, meetingId), eq(committeeMeetings.organizationId, organizationId), touchesApprovedRecord ? isNull(committeeMeetings.minutesApprovedAt) : undefined))\n      .returning();",
  ],
])
edit('db/__tests__/rls-storage-authority-round47-communications-consent-user-subject.test.ts', [
  [
    "const occurrences = src.match(/if \\(ownerCol && userId\\) \\{\\s*conditions\\.push\\(eq\\(ownerCol, userId\\)\\);/g);",
    "// A read is scoped to the owner unless staff may read all (staffMayReadAll); a write is always scoped to the owner.\n    const occurrences = src.match(/if \\(ownerCol && userId(?: && !\\(await staffMayReadAll\\(userId, organizationId\\)\\))?\\) \\{\\s*conditions\\.push\\(eq\\(ownerCol, userId\\)\\);/g);",
  ],
])
edit('lib/services/__tests__/b55-workflow-integrity.test.ts', [
  ["    expect(service).toContain('if (touchesApprovedRecord) conditions.push(isNull(committeeMeetings.minutesApprovedAt))')", "    expect(service).toContain('touchesApprovedRecord ? isNull(committeeMeetings.minutesApprovedAt) : undefined')"],
])
