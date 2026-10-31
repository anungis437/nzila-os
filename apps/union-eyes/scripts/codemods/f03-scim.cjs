const fs = require('fs')
const file = 'app/api/scim/v2/[organizationId]/Users/route.ts'
let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const sub = (from, to) => {
  if (!t.includes(from)) throw new Error('missing: ' + from.slice(0, 60))
  t = t.replace(from, to)
}
sub("import { eq } from 'drizzle-orm';", "import { and, asc, count as countRows, eq, isNull } from 'drizzle-orm';")
sub(
  `    const startIndex = Math.max(1, parseInt(url.searchParams.get('startIndex') || '1', 10));
    const count = Math.min(100, parseInt(url.searchParams.get('count') || '50', 10));

    const members = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));

    const paged = members.slice(startIndex - 1, startIndex - 1 + count);

    return {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: members.length,`,
  `    const startIndex = Math.max(1, Number.parseInt(url.searchParams.get('startIndex') || '1', 10) || 1);
    const count = Math.min(100, Math.max(0, Number.parseInt(url.searchParams.get('count') || '50', 10) || 0));

    // A removed member is not a user of the organization, and the page is read in SQL with the count, not by loading the whole roster.
    const live = and(eq(organizationMembers.organizationId, orgId), isNull(organizationMembers.deletedAt));
    const [{ total }] = await db.select({ total: countRows() }).from(organizationMembers).where(live);
    const paged = count === 0
      ? []
      : await db
          .select()
          .from(organizationMembers)
          .where(live)
          .orderBy(asc(organizationMembers.createdAt), asc(organizationMembers.id))
          .limit(count)
          .offset(startIndex - 1);

    return {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: Number(total),`,
)
sub(
  "          role: 'member',\n          status: 'active',\n        })",
  "          role: 'member',\n          // Provisioning names a user; it does not give that user access. The membership is pending until the person accepts, as for a\n          // member added through the roster route, and the SCIM representation reports it as not active.\n          status: 'pending',\n        })",
)
fs.writeFileSync(file, t)
console.log('ok')
