const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
const IMPORT = "import { clientAddress } from '@/lib/public-intake/guard';\n"
const addImport = (s) => {
  const idx = s.indexOf('\nimport ')
  return idx < 0 ? IMPORT + s : s
}

edit('lib/public-intake/guard.ts', [[
  `export function clientAddress(request: Request): string {
  const direct = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip')
  if (direct) return direct
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}`,
  `/**
 * The client address a limiter may key on. The edge-set headers win. Otherwise the forwarded-for list is read from the right,
 * at the number of trusted proxy hops (TRUSTED_PROXY_HOPS, default 1): the first entry is whatever the client typed, so keying on
 * it let a caller pick a fresh bucket on every request.
 */
export function clientAddress(request: Request): string {
  const direct = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip')
  if (direct) return direct
  const chain = (request.headers.get('x-forwarded-for') ?? '').split(',').map((part) => part.trim()).filter(Boolean)
  if (chain.length === 0) return 'unknown'
  const parsed = Number(process.env.TRUSTED_PROXY_HOPS ?? '1')
  const hops = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
  return chain[Math.max(0, chain.length - hops)]
}`,
]])

const swapIn = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  if (!s.includes("from '@/lib/public-intake/guard'")) {
    const m = s.match(/^import [^\n]*\n/m)
    s = m ? s.replace(m[0], m[0] + IMPORT) : IMPORT + s
  }
  fs.writeFileSync(f, s)
}
swapIn('app/api/icra/email-results/route.ts', [["req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null", 'clientAddress(req)']])
swapIn('app/api/icra/submit/route.ts', [["req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null", 'clientAddress(req)']])
swapIn('app/api/icra/telemetry/route.ts', [["req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null", 'clientAddress(req)']])
swapIn('app/api/icra/[assessmentId]/answer/route.ts', [["req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'", 'clientAddress(req)']])
swapIn('app/api/icra/[assessmentId]/capability/exchange/route.ts', [[
  "const forwarded = req.headers.get('x-forwarded-for');\n      const ip = forwarded ? forwarded.split(',')[0]?.trim() : 'unknown';",
  'const ip = clientAddress(req);',
]])
console.log('ok')
