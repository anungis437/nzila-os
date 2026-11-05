const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/organizations/[id]/members/route.ts', [
  [
    "  const [created] = await withRLSContext({ organizationId: id }, async (tx) => {\n    const inserted = await tx",
    "  // A user already on the roster (in any status) is a conflict the caller can act on, not a database error.\n  const isUniqueViolation = (error: unknown) => {\n    const code = (error as { code?: string; cause?: { code?: string } } | null);\n    return code?.code === '23505' || code?.cause?.code === '23505';\n  };\n  let created: Array<typeof organizationMembers.$inferSelect>;\n  try {\n    created = await withRLSContext({ organizationId: id }, async (tx) => {\n    const inserted = await tx",
  ],
  [
    "    return inserted;\n  });\n\n  return NextResponse.json({ data: created }, { status: 201 });",
    "    return inserted;\n  });\n  } catch (error) {\n    if (isUniqueViolation(error)) return NextResponse.json({ error: 'This user is already a member of the organization' }, { status: 409 });\n    throw error;\n  }\n\n  return NextResponse.json({ data: created }, { status: 201 });",
  ],
])
edit('app/api/__tests__/organizations-read-authority.pglite.test.ts', [[
  "  it('no caller may grant a role at or above their own",
  `  // DEF-0B9-ORG-ROSTER-POST-DUPLICATE-USER-ID-AND-INVALID-JSON-HANDLING-LEAVES-UNHANDLED-ERRORS
  it('answers 409, not a server error, when the user is already on the roster, and keeps the one row', async () => {
    expect((await rosterPost('u-steward-a', { ...candidate, role: 'member' })).status).toBe(201);
    const again = await rosterPost('u-steward-a', { ...candidate, role: 'member' });
    expect(again.status).toBe(409);
    expect((await pg.query('SELECT 1 FROM organization_members WHERE user_id = $1', ['new-user'])).rows).toHaveLength(1);
  });

  it('no caller may grant a role at or above their own`,
]])
console.log('ok')
