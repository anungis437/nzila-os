const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}

edit('app/api/rewards/redemptions/route.ts', [
  [
    "    const limit = Math.min(\n      parseInt(searchParams.get('limit') || '20', 10),\n      100\n    );\n    const offset = parseInt(searchParams.get('offset') || '0', 10);",
    "    // A non-numeric or negative value is the default, never NaN or a negative offset handed to the query.\n    const boundedInt = (raw: string | null, fallback: number, min: number, max: number) => {\n      const parsed = Number.parseInt(raw ?? '', 10);\n      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;\n    };\n    const limit = boundedInt(searchParams.get('limit'), 20, 1, 100);\n    const offset = boundedInt(searchParams.get('offset'), 0, 0, 1_000_000);",
  ],
  [
    "        redemptions: result.redemptions,\n        pagination",
    "        // The provider's order payload and checkout identifiers are the processor's record, not the member's: they are not returned.\n        redemptions: result.redemptions.map(({ providerPayloadJson: _payload, providerCheckoutId: _checkout, ...redemption }) => redemption),\n        pagination",
  ],
])

edit('app/api/union-eyes/queue-status/route.ts', [
  ["import { logger } from '@/lib/logger'\n", "import { logger } from '@/lib/logger'\nimport { timingSafeEqual } from 'node:crypto'\n\n// A shared secret is compared in constant time, so response timing does not reveal how much of a guess was right.\nfunction sameSecret(presented: string | null, expected: string): boolean {\n  if (!presented) return false\n  const a = Buffer.from(presented)\n  const b = Buffer.from(expected)\n  return a.length === b.length && timingSafeEqual(a, b)\n}\n"],
  ["const isServiceRequest = !!svcKey && req.headers.get('x-service-key') === svcKey", "const isServiceRequest = !!svcKey && sameSecret(req.headers.get('x-service-key'), svcKey)"],
])
console.log('ok')
