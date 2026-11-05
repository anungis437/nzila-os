const fs = require('fs')
const f = 'app/api/workbook/[id]/memory-holders/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap("import { opaqueRef } from '@/lib/icra/opaque-ref';", "import { opaqueRef } from '@/lib/icra/opaque-ref';\nimport { guardPublicIntake } from '@/lib/public-intake/guard';")
swap(
  "export async function GET(\n  _request: NextRequest,\n  { params }: { params: Promise<{ id: string }> },\n) {\n  const { id: workbookId } = await params;\n",
  "export async function GET(\n  request: NextRequest,\n  { params }: { params: Promise<{ id: string }> },\n) {\n  const { id: workbookId } = await params;\n  // The identifier of an unclaimed workbook is its only credential, so reads are slowed like every other bearer route.\n  const intake = await guardPublicIntake(request, { bucket: 'capability', readBody: false });\n  if (!intake.ok) return intake.response;\n",
)
swap(
  "  // Parse + validate before establishing any DB execution context so no\n  // transaction is held open across the request body read.\n  let body: any;\n  try {\n    body = await request.json();\n  } catch {\n    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });\n  }\n",
  "  // Rate limited and body capped before the body is parsed, and before any DB execution context so no transaction is held open across\n  // the request body read.\n  const intake = await guardPublicIntake(request, { bucket: 'capability' });\n  if (!intake.ok) return intake.response;\n  const body: unknown = intake.json;\n",
)
fs.writeFileSync(f, s)
console.log('ok')
