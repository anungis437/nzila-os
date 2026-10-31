const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
const limiter = (key, limit, windowSeconds, id) =>
  `await checkRateLimit(${key}, {\n    limit: ${limit},\n    window: ${windowSeconds},\n    identifier: '${id}',\n    failOpen: process.env.NODE_ENV !== 'production',\n  })`

edit('app/api/icra/submit/route.ts', [
  ["import { rateLimit } from '@/lib/rate-limit'", "import { checkRateLimit } from '@/lib/rate-limiter'"],
  [
    "  const rl = rateLimit(req, { maxRequests: 3, windowSeconds: 60 * 60 })\n  if (!rl.success) {\n    return NextResponse.json(\n      { error: 'Too many submissions. Please try again later.' },\n      { status: 429 },\n    )\n  }",
    `  const rl = ${limiter('`icra-submit:${ip}`', 3, '60 * 60', 'icra-submit')}\n  if (!rl.allowed) {\n    return NextResponse.json(\n      { error: rl.error ? 'Submissions are temporarily unavailable.' : 'Too many submissions. Please try again later.' },\n      { status: rl.error ? 503 : 429 },\n    )\n  }`,
  ],
])
edit('app/api/icra/telemetry/route.ts', [
  ["import { rateLimit } from '@/lib/rate-limit'", "import { checkRateLimit } from '@/lib/rate-limiter'\nimport { clientAddress } from '@/lib/public-intake/guard'"],
  [
    "  const rl = rateLimit(req, { maxRequests: 60, windowSeconds: 60 })\n  if (!rl.success) {\n    return new NextResponse(null, { status: 204 })\n  }",
    `  // Telemetry is best effort: a refusal or an unavailable limiter drops the event silently.\n  const rl = ${limiter('`icra-telemetry:${clientAddress(req)}`', 60, 60, 'icra-telemetry')}\n  if (!rl.allowed) {\n    return new NextResponse(null, { status: 204 })\n  }`,
  ],
])
edit('app/api/icra/results/[id]/route.ts', [
  ["import { rateLimit } from '@/lib/rate-limit';", "import { checkRateLimit } from '@/lib/rate-limiter';\nimport { clientAddress } from '@/lib/public-intake/guard';"],
  [
    "  const rl = rateLimit(req, { maxRequests: 20, windowSeconds: 60 });\n  if (!rl.success) {\n    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });\n  }",
    `  const rl = ${limiter('`icra-results:${clientAddress(req)}`', 20, 60, 'icra-results')};\n  if (!rl.allowed) {\n    return NextResponse.json({ error: rl.error ? 'Temporarily unavailable.' : 'Rate limit exceeded.' }, { status: rl.error ? 503 : 429 });\n  }`,
  ],
])
console.log('ok')
