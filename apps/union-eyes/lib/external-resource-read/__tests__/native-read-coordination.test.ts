/** Observer controls only; no native socket/concurrency qualification. */
import { describe, expect, it, vi } from 'vitest'
import { awaitNativePhase, deferred, observeNativeAdvisoryWait } from './fixtures/native-read-coordination'
import type { SqlExecutor } from '@/lib/authority/store/executor'

const observer = (blocked: boolean, advisory_wait: boolean): SqlExecutor => ({ query: vi.fn(async () => ({ rows: [{ blocked, advisory_wait }] })) as SqlExecutor['query'] })
describe('native concurrency proof coordination (transport doubles)', () => {
  it('releases an explicit latch without inventing a readiness result', async () => {
    const gate = deferred<number>(); gate.resolve(4); expect(await gate.promise).toBe(4)
  })
  it('requires both the actual expected blocker and an ungranted advisory lock', async () => {
    expect(await observeNativeAdvisoryWait(observer(true, true), 11, 12, { settled: () => false })).toEqual({ waiter: 11, blocker: 12, advisoryWaitObserved: true })
  })
  it.each([[true, false], [false, true], [false, false]])('refuses an incomplete wait observation %s/%s', async (blocked, advisory) => {
    await expect(observeNativeAdvisoryWait(observer(blocked, advisory), 11, 12, { settled: () => false, timeoutMs: 1, intervalMs: 1 }))
      .rejects.toThrow('not observed')
  })
  it('rejects early successful completion instead of counting it as concurrency coverage', async () => {
    const db = observer(true, true)
    await expect(observeNativeAdvisoryWait(db, 11, 12, { settled: () => true })).rejects.toThrow('settled before')
    expect(db.query).not.toHaveBeenCalled()
  })
  it('rejects reusing one connection as two concurrent native backends', async () => {
    await expect(observeNativeAdvisoryWait(observer(true, true), 11, 11, { settled: () => false })).rejects.toThrow('distinct')
  })
  it('propagates an early native failure instead of hanging on a phase latch', async () => {
    await expect(awaitNativePhase(new Promise<never>(() => undefined), Promise.reject(new Error('SYNTHETIC_NATIVE_FAILURE')), 'reader held'))
      .rejects.toThrow('SYNTHETIC_NATIVE_FAILURE')
  })
  it('rejects an early completed operation and times out missing phases', async () => {
    await expect(awaitNativePhase(new Promise<never>(() => undefined), Promise.resolve(), 'reader held')).rejects.toThrow('completed before')
    await expect(awaitNativePhase(new Promise<never>(() => undefined), new Promise<never>(() => undefined), 'reader held', 1)).rejects.toThrow('not reached')
  })
})
