const fs = require('fs')
const f = 'lib/knowledge-transfer/search/hybrid-search.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap(
  "  const pattern = `%${query}%`;",
  "  // LIKE wildcards typed in the query are literal characters, not a pattern the caller controls.\n  const pattern = `%${query.replace(/[\\\\%_]/g, (ch) => `\\\\${ch}`)}%`;\n  if (allowedSensitivityLevels.length === 0) return [];",
)
swap(
  "        eq(exitInterviews.status, 'published'),\n        or(",
  "        eq(exitInterviews.status, 'published'),\n        // The sensitivity floor is part of the query, so the limit counts only interviews the caller may read.\n        inArray(exitInterviews.sensitivityLevel, allowedSensitivityLevels),\n        or(",
)
fs.writeFileSync(f, s)
console.log(/import \{[^}]*\} from 'drizzle-orm'/.exec(s)[0])
