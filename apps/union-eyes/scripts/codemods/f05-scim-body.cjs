const fs = require('fs')
const edit = (file, pairs) => {
  let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  for (const [from, to] of pairs) {
    if (!t.includes(from)) throw new Error(`${file}: missing ${from.slice(0, 60)}`)
    t = t.replace(from, to)
  }
  fs.writeFileSync(file, t)
}
edit('app/api/scim/v2/[organizationId]/Users/route.ts', [
  ["import { eq", "import { eq"], // no-op guard
].slice(1).concat([
  [
    "export const dynamic = 'force-dynamic';\n",
    `export const dynamic = 'force-dynamic';

// A provisioning request is bounded, typed input. Malformed or oversized input is a 400 naming the field, not a 500 from a failed insert.
const provisionSchema = z.object({
  userName: z.string().trim().min(1).max(320),
  name: z.object({ givenName: z.string().trim().max(100).optional(), familyName: z.string().trim().max(100).optional() }).optional(),
  emails: z.array(z.object({ value: z.string().trim().email().max(320), primary: z.boolean().optional() })).max(10).optional(),
});
`,
  ],
  ["import { and, asc,", "import { z } from 'zod';\nimport { and, asc,"],
  [
    "    const body = await request.json();\n    const { userName, name, emails } = body as {\n      userName: string;\n      name?: { givenName?: string; familyName?: string };\n      emails?: Array<{ value: string; primary?: boolean }>;\n    };\n\n    if (!userName) {\n      throw ApiError.badRequest('userName is required');\n    }\n",
    "    const parsed = provisionSchema.safeParse(await request.json().catch(() => null));\n    if (!parsed.success) {\n      throw ApiError.badRequest(`Invalid SCIM user: ${parsed.error.issues.map((i) => i.path.join('.') || 'body').join(', ')}`);\n    }\n    const { userName, name, emails } = parsed.data;\n",
  ],
]))
console.log('ok')
