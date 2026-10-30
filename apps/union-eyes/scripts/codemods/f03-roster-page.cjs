const fs = require('fs')
const file = 'app/api/organizations/[id]/members/route.ts'
let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const sub = (from, to) => {
  if (!t.includes(from)) throw new Error('missing: ' + from.slice(0, 60))
  t = t.replace(from, to)
}
sub(
  "export async function GET(_req: NextRequest, { params }: Params) {",
  "const ROSTER_PAGE_SIZE = 200;\n\nexport async function GET(req: NextRequest, { params }: Params) {",
)
sub(
  "  const rows = await withRLSContext({ organizationId: id }, async () =>\n    db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, id)),\n  );\n",
  `  // A removed member is not on the roster, and the roster is read a page at a time in a stable order, so a large organization is neither
  // truncated silently nor read whole in one request.
  const url = new URL(req.url);
  const limit = Math.min(ROSTER_PAGE_SIZE, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '', 10) || ROSTER_PAGE_SIZE));
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '', 10) || 1);
  const rows = await withRLSContext({ organizationId: id }, async () =>
    db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, id), isNull(organizationMembers.deletedAt)))
      .orderBy(asc(organizationMembers.createdAt), asc(organizationMembers.id))
      .limit(limit)
      .offset((page - 1) * limit),
  );
`,
)
sub("  return NextResponse.json({ data: mapped });\n}\n\nexport async function POST", "  return NextResponse.json({ data: mapped, page, limit });\n}\n\nexport async function POST")
fs.writeFileSync(file, t)
console.log(t.match(/from 'drizzle-orm'.*/)?.[0], t.match(/import \{[^}]*\} from 'drizzle-orm'/)?.[0])
