const fs = require('fs')
const f = 'app/api/icra/[assessmentId]/capability/exchange/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap("import { rateLimit } from '@/lib/rate-limit';", "import { checkRateLimit } from '@/lib/rate-limiter';")
swap(
  "  const rl = rateLimit(request, {\n    maxRequests: 20,\n    windowSeconds: 60 * 60,\n    keyGenerator: (req) => {\n      const ip = clientAddress(req);\n      return `icra-capability-exchange:${ip}:${assessmentId}`;\n    },\n  });\n  if (!rl.success) {\n    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });\n  }",
  "  const rl = await checkRateLimit(`icra-capability-exchange:${clientAddress(request)}:${assessmentId}`, {\n    limit: 20,\n    window: 60 * 60,\n    identifier: 'icra-capability-exchange',\n    failOpen: process.env.NODE_ENV !== 'production',\n  });\n  if (!rl.allowed) {\n    return NextResponse.json(\n      { error: rl.error ? 'Temporarily unavailable.' : 'Too many requests. Please try again later.' },\n      { status: rl.error ? 503 : 429 },\n    );\n  }",
)
fs.writeFileSync(f, s)
console.log('ok')
