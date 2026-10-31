const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
fs.writeFileSync('lib/icra/assessment-id.ts', `const ASSESSMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A path value that is not a UUID names no assessment: it is answered as not found, never sent to the database to fail there. */
export function isAssessmentId(value: unknown): value is string {
  return typeof value === 'string' && ASSESSMENT_ID.test(value);
}
`)

const IMPORT = "import { isAssessmentId } from '@/lib/icra/assessment-id'\n"
const NOT_FOUND = "  if (!isAssessmentId(assessmentId)) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })\n"
const withGuard = (f, anchor, extraPairs = []) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  const re = new RegExp(`(\\n[ \\t]*const \\{ assessmentId \\} = await params;?\\n)`)
  if (!re.test(s)) throw new Error(`${f}: params destructure not found`)
  s = s.replace(re, `$1${NOT_FOUND}`)
  const m = s.match(/^import [^\n]*\n/m)
  s = m ? s.replace(m[0], m[0] + IMPORT) : IMPORT + s
  for (const [a, b] of extraPairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
for (const p of ['claim', 'profile', 'submit', 'capability/exchange']) withGuard(`app/api/icra/[assessmentId]/${p}/route.ts`)

withGuard('app/api/icra/[assessmentId]/answer/route.ts', null, [
  [
    "  const rl = rateLimit(request, {\n    maxRequests: 240,\n    windowSeconds: 60 * 60,\n    keyGenerator: (req) => {\n      const ip = clientAddress(req)\n      return `icra-answer:${assessmentId}:${ip}`\n    },\n  })\n  if (!rl.success) {\n    return NextResponse.json({ error: 'Too many answer submissions. Please slow down.' }, { status: 429 })\n  }",
    "  const rl = await checkRateLimit(`icra-answer:${assessmentId}:${clientAddress(request)}`, {\n    limit: 240,\n    window: 60 * 60,\n    identifier: 'icra-answer',\n    failOpen: process.env.NODE_ENV !== 'production',\n  })\n  if (!rl.allowed) {\n    return NextResponse.json(\n      { error: rl.error ? 'Answers are temporarily unavailable.' : 'Too many answer submissions. Please slow down.' },\n      { status: rl.error ? 503 : 429 },\n    )\n  }",
  ],
  [
    "  try {\n    return await withSystemContext(async (tx) => {\n      const assessments = await tx",
    "  // A value that does not fit the question, or a note the deployment mode forbids, is the caller's error, not a server failure.\n  let answer: ReturnType<typeof buildAnswer>\n  try {\n    answer = buildAnswer(question, payload.rawValue, payload.note)\n  } catch (err) {\n    return NextResponse.json({ error: 'Invalid answer value', details: (err as Error).message }, { status: 400 })\n  }\n\n  try {\n    return await withSystemContext(async (tx) => {\n      const assessments = await tx",
  ],
  ["      const answer = buildAnswer(question, payload.rawValue, payload.note)\n\n", ""],
])
const s = fs.readFileSync('app/api/icra/[assessmentId]/answer/route.ts', 'utf8')
if (!/import \{ rateLimit \}/.test(s)) throw new Error('rateLimit import not found')
edit('app/api/icra/[assessmentId]/answer/route.ts', [["import { rateLimit } from '@/lib/rate-limit'", "import { checkRateLimit } from '@/lib/rate-limiter'"]])
console.log('ok')
