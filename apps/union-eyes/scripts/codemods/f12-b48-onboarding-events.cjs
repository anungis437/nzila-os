const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/onboarding/events/route.ts', [
  [
    "  targetUserId: z.string().optional(),\n  role: z.string().optional(),\n  metadata: z.record(z.string(), z.unknown()).optional(),\n});",
    "  targetUserId: z.string().trim().min(1).max(255).optional(),\n  role: z.string().trim().min(1).max(64).optional(),\n  metadata: z\n    .record(z.string().max(64), z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))\n    .refine((value) => Object.keys(value).length <= 20, 'metadata has too many keys')\n    .optional(),\n});",
  ],
  [
    "        metadata: {\n          targetUserId: parsed.data.targetUserId,\n          role: parsed.data.role,\n          ...(parsed.data.metadata ?? {}),\n        },",
    "        // The named target and role come last: caller metadata can add context but never replace what the audit row records.\n        metadata: {\n          ...(parsed.data.metadata ?? {}),\n          targetUserId: parsed.data.targetUserId,\n          role: parsed.data.role,\n        },",
  ],
])
