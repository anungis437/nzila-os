const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/organizations/search/route.ts', [
  ["import { and, ilike, inArray, or, ne } from 'drizzle-orm'", "import { and, asc, eq, ilike, inArray, or, ne } from 'drizzle-orm'\nimport { likeContaining } from '@/lib/api/like-pattern'"],
  [
    "  const text = q ? or(ilike(organizations.name, `%${q}%`), ilike(organizations.slug, `%${q}%`)) : ne(organizations.organizationType, 'platform')\n",
    "  // The platform organization and any organization that is not active are never offered, with or without a search term, and the\n  // term is matched literally so a bare percent or underscore cannot list the whole directory.\n  const listable = and(ne(organizations.organizationType, 'platform'), eq(organizations.status, 'active'))!\n  const text = q ? and(or(ilike(organizations.name, likeContaining(q)), ilike(organizations.slug, likeContaining(q))), listable)! : listable\n",
  ],
  ["      .where(readable ? and(text, inArray(organizations.id, readable)) : text)\n      .limit(50),", "      .where(readable ? and(text, inArray(organizations.id, readable)) : text)\n      .orderBy(asc(organizations.name), asc(organizations.id))\n      .limit(50),"],
])
