const fs = require('fs')
fs.writeFileSync('lib/icra/opaque-ref.ts', `import { createHash } from 'node:crypto';

/**
 * A short, one-way reference for a bearer identifier in a log line. A workbook or assessment id is a capability: whoever has it can
 * act on the record, so it is never written to a log. The reference lets an operator correlate lines of one record without holding it.
 */
export function opaqueRef(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12);
}
`)

const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const write = (f, s) => fs.writeFileSync(f, s)
const IMPORT = "import { opaqueRef } from '@/lib/icra/opaque-ref';\n"
const addImport = (s) => { const m = s.match(/^import [^\n]*\n(?![\s\S]*^import )/m); const all = [...s.matchAll(/^import [^\n]*\n/gm)]; const last = all[all.length - 1]; return s.slice(0, last.index + last[0].length) + IMPORT + s.slice(last.index + last[0].length) }

const logFiles = [
  'app/api/workbook/[id]/claim/route.ts',
  'app/api/workbook/[id]/export/route.ts',
  'app/api/workbook/[id]/memory-holders/[holderId]/route.ts',
  'app/api/workbook/[id]/memory-holders/route.ts',
  'app/api/workbook/checkout/route.ts',
  'app/api/workbook/start/route.ts',
]
for (const f of logFiles) {
  let s = read(f)
  const before = s
  s = s.replace(/(logger\.(?:info|error|warn|debug)\([^\n]*\{ )workbookId,/g, '$1workbookRef: opaqueRef(workbookId),')
  s = s.replace(/(logger\.(?:info|error|warn|debug)\([^\n]*\{ )workbookId: wb\.id,/g, '$1workbookRef: opaqueRef(wb.id),')
  s = s.replace(/(logger\.info\('\[workbook-checkout\] Checkout session created', \{\n\s+)workbookId,/, '$1workbookRef: opaqueRef(workbookId),')
  if (s === before) throw new Error(`${f}: no log line changed`)
  write(f, addImport(s))
}

// Checkout: refuse a missing public base URL in production (no localhost redirects) and reuse a session opened within the window.
{
  const f = 'app/api/workbook/checkout/route.ts'
  let s = read(f)
  const swap = (a, b) => { if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`); s = s.replace(a, b) }
  swap(
    "  const baseUrl =\n    process.env.NEXT_PUBLIC_APP_URL?.replace(/\\/$/, '') ?? 'http://localhost:3000';",
    "  // A payment redirect to localhost would strand the buyer after paying, so production refuses to open a session without a public base URL.\n  const configuredBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\\/$/, '');\n  if (!configuredBase && process.env.NODE_ENV === 'production') {\n    logger.error('[workbook-checkout] NEXT_PUBLIC_APP_URL is not configured', { workbookRef: opaqueRef(workbookId) });\n    return NextResponse.json({ error: 'Checkout is temporarily unavailable' }, { status: 503 });\n  }\n  const baseUrl = configuredBase ?? 'http://localhost:3000';",
  )
  swap(
    "      customer_creation: 'if_required',\n    });",
    "      customer_creation: 'if_required',\n    }, {\n      // A repeated request in the same window gets the session already opened instead of a new one.\n      idempotencyKey: `workbook-checkout:${workbookId}:${SELF_GUIDED_TIER_ID}:${Math.floor(Date.now() / CHECKOUT_REUSE_WINDOW_MS)}`,\n    });",
  )
  swap("const SELF_GUIDED_TIER_ID = 'workbook_self_guided' as const;", "const SELF_GUIDED_TIER_ID = 'workbook_self_guided' as const;\nconst CHECKOUT_REUSE_WINDOW_MS = 30 * 60 * 1000;")
  write(f, s)
}

// Claim: bound the attempts and the body like every other public write.
{
  const f = 'app/api/workbook/[id]/claim/route.ts'
  let s = read(f)
  const swap = (a, b) => { if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`); s = s.replace(a, b) }
  swap("import { logger } from '@/lib/logger';", "import { logger } from '@/lib/logger';\nimport { guardPublicIntake } from '@/lib/public-intake/guard';")
  swap(
    "  let body: any;\n  try {\n    body = await request.json();\n  } catch {\n    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });\n  }\n\n  const parse = bodySchema.safeParse(body);",
    "  // The claim token is a bearer secret, so attempts are rate limited and the body is capped before it is parsed.\n  const intake = await guardPublicIntake(request, { bucket: 'capability' });\n  if (!intake.ok) return intake.response;\n\n  const parse = bodySchema.safeParse(intake.json);",
  )
  write(f, s)
}
console.log('ok')
