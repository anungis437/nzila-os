/** Test-only coordination. A concurrency proof needs an observed PostgreSQL
 * advisory wait on the expected backend, never elapsed HTTP time alone. */
import type { SqlExecutor } from '@/lib/authority/store/executor'

export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

export async function awaitNativePhase<T>(signal: Promise<T>, operation: Promise<unknown>, label: string, timeoutMs = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([signal, operation.then(() => { throw new Error(`Native operation completed before ${label}`) }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Native phase not reached: ${label}`)), timeoutMs) })])
  } finally { if (timer) clearTimeout(timer) }
}

export async function observeNativeAdvisoryWait(observer: SqlExecutor, waiter: number, blocker: number,
  options: { settled: () => boolean; timeoutMs?: number; intervalMs?: number } ) {
  if (!Number.isInteger(waiter) || !Number.isInteger(blocker) || waiter <= 0 || blocker <= 0 || waiter === blocker)
    throw new Error('Two distinct native backend identities are required')
  const deadline = Date.now() + (options.timeoutMs ?? 10_000)
  do {
    if (options.settled()) throw new Error('Concurrent operation settled before its expected database wait')
    const row = (await observer.query<{ blocked: boolean; advisory_wait: boolean }>(`SELECT
      $2::integer=ANY(pg_blocking_pids($1::integer)) AS blocked,
      EXISTS(SELECT FROM pg_locks WHERE pid=$1::integer AND locktype='advisory' AND NOT granted) AS advisory_wait`, [waiter, blocker])).rows[0]
    if (row?.blocked === true && row.advisory_wait === true) return { waiter, blocker, advisoryWaitObserved: true as const }
    await new Promise(resolve => setTimeout(resolve, options.intervalMs ?? 10))
  } while (Date.now() < deadline)
  throw new Error('Expected native advisory blocking relationship was not observed')
}
