const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/pilot/apply/route.ts', [
  [
    "  responses: z.record(z.string(), z.unknown()).optional(),\n  assessment: z.object({ score: z.union([z.number(), z.string()]).optional() }).passthrough().optional(),",
    "  responses: boundedJsonRecord({ maxBytes: 16 * 1024, maxKeys: 60, maxDepth: 4 }).optional(),\n  // Only the score is read; any other key an anonymous caller adds is dropped rather than carried.\n  assessment: z.object({ score: z.union([z.number().finite(), z.string().trim().max(20)]).optional() }).optional(),",
  ],
  ["import { logger } from '@/lib/logger';\n", "import { logger } from '@/lib/logger';\nimport { boundedJsonRecord } from '@/lib/api/bounded-json';\n"],
])
