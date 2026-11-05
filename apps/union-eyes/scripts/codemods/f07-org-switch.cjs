const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/organizations/switch/route.ts', [
  ["import { and, eq } from 'drizzle-orm';", "import { and, eq, isNull } from 'drizzle-orm';"],
  [
    "  // Platform admins can switch to any org without membership check\n  if (!isAdmin) {",
    "  // Platform admins can switch to any org without membership check\n  if (!isAdmin) {\n    // An archived or inactive organization cannot be switched to: the resolver that reads the selection requires it to be active.\n    if ((org.status ?? 'active') !== 'active') {\n      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });\n    }",
  ],
  [
    "          eq(organizationMembers.organizationId, organizationId),\n        ),",
    "          eq(organizationMembers.organizationId, organizationId),\n          // Only an active, non-removed membership counts: a suspended, inactive or removed member is not a member here.\n          eq(organizationMembers.status, 'active'),\n          isNull(organizationMembers.deletedAt),\n        ),",
  ],
])
edit('app/api/__tests__/organizations-switch.route.test.ts', [[
  "  it('POST denies a member when the UUID membership is absent'",
  `  // DEF-0B10-OPL-09
  it('POST answers 404 to a member for an organization that is not active', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'org_1', name: 'Org 1', slug: 'org-1', status: 'archived' }], [{ id: 'membership_1', userId: 'user_1', organizationId: 'org_1' }]);

    const response = await POST(
      new NextRequest('http://localhost/api/organizations/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: 'org_1' }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it('POST denies a member when the UUID membership is absent'`,
]])
console.log('ok')
