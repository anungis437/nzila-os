import { z } from 'zod'

const readiness = z.object({ ready: z.literal(true), gitSha: z.string().regex(/^[0-9a-f]{40}$/),
  releaseProfile: z.literal('union-eyes-v2-base'), checks: z.record(z.string(), z.unknown()) })
const REQUIRED = ['process', 'noTestBypass', 'runtimeProfile', 'database', 'catalogAuthority', 'decisionProof', 'storage', 'scanner']

export async function probeBaseApplicationReadiness(sourceSha: string, origin: string | undefined) {
  try {
    const url = new URL(origin ?? '')
    if (!/^[0-9a-f]{40}$/.test(sourceSha) || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('invalid origin')
    const response = await fetch(new URL('/api/ready', url), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) })
    const parsed = readiness.safeParse(await response.json())
    const ok = response.ok && parsed.success && parsed.data.gitSha === sourceSha &&
      REQUIRED.every(name => parsed.data.checks[name] === 'ok')
    return { state: ok ? 'ok' as const : 'fail' as const,
      note: ok ? 'Actual source-matched database, catalog, key, document storage and scanner readiness verified' : 'Required application dependencies are not ready' }
  } catch { return { state: 'fail' as const, note: 'Required application dependency readiness could not be read' } }
}
