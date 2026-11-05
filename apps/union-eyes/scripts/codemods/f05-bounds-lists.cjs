const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
const P = 'app/api/pension/'
const CONST = `// A list answers at most this many rows.\nconst LIST_LIMIT = 200;\n\n`
const lim = (f, orderBy) => edit(P + f, [
  [`export const GET = withApi(`, CONST + `export const GET = withApi(`],
  [orderBy, orderBy.replace(/\)(;?)$/, `).limit(LIST_LIMIT)$1`)],
])
// the orderBy expression ends the chain in each handler
lim('plans/route.ts', `      .orderBy(desc(pensionPlans.createdAt));`)
lim('trustees/route.ts', `      .orderBy(desc(pensionTrustees.createdAt));`)
lim('members/route.ts', `      .orderBy(desc(pensionMembers.createdAt));`)
lim('benefits/route.ts', `.orderBy(desc(pensionBenefitClaims.createdAt));`)
lim('contributions/route.ts', `.orderBy(desc(pensionContributions.createdAt));`)
lim('t4a/route.ts', `.orderBy(desc(pensionT4aRecords.createdAt));`)
// the agreement list takes a bounded page, and a read of one agreement does not count a view
edit('app/api/cbas/route.ts', [
  [`  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
`, `  // An invalid or oversized page request is refused, never clamped into an unbounded scan.
  const bounded = (raw: string | null, fallback: number, max: number) => {
    if (raw === null) return fallback;
    if (!/^[1-9][0-9]{0,5}$/.test(raw)) return null;
    const parsed = Number(raw);
    return parsed <= max ? parsed : null;
  };
  const page = bounded(url.searchParams.get('page'), 1, 10000);
  const limit = bounded(url.searchParams.get('limit'), 20, 100);
  if (page === null || limit === null) {
    return NextResponse.json({ error: 'Invalid pagination: page must be 1..10000 and limit 1..100' }, { status: 400 });
  }
`],
])
edit('app/api/cbas/[id]/route.ts', [
  [`getCbaForOrganization(organizationId, id, { countView: includeAnalytics });`, `getCbaForOrganization(organizationId, id, { countView: false });`],
])
console.log('ok')
