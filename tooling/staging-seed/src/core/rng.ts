import type { SeedRng } from './types'

/**
 * mulberry32 — small, fast, deterministic PRNG.
 * Same `seed` always produces the same sequence.
 *
 * Reference: https://stackoverflow.com/a/47593316
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed: number): SeedRng {
  if (!Number.isFinite(seed) || !Number.isInteger(seed) || seed < 0) {
    throw new Error(`createRng: seed must be a non-negative integer, got ${String(seed)}`)
  }
  const next = mulberry32(seed)
  let counter = 0

  function intBetween(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error(`intBetween: invalid range [${min}, ${max}]`)
    }
    return Math.floor(next() * (max - min + 1)) + min
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick: empty array')
    return items[intBetween(0, items.length - 1)]!
  }

  function sample<T>(items: readonly T[], n: number): T[] {
    if (n < 0) throw new Error(`sample: n must be >= 0, got ${n}`)
    if (n > items.length) {
      throw new Error(`sample: n (${n}) larger than items.length (${items.length})`)
    }
    // Fisher–Yates partial shuffle, deterministic via `next()`.
    const copy = items.slice()
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(next() * (copy.length - i))
      const tmp = copy[i]!
      copy[i] = copy[j]!
      copy[j] = tmp
    }
    return copy.slice(0, n)
  }

  function id(prefix: string): string {
    counter += 1
    // 8 hex chars from the next() output combined with monotonically
    // increasing counter to guarantee uniqueness within a run.
    const a = Math.floor(next() * 0xffffffff)
      .toString(16)
      .padStart(8, '0')
      .slice(-8)
    const b = counter.toString(16).padStart(4, '0').slice(-4)
    return `${prefix}-${a}${b}`
  }

  function boolean(pTrue = 0.5): boolean {
    if (pTrue < 0 || pTrue > 1) throw new Error(`boolean: pTrue out of range: ${pTrue}`)
    return next() < pTrue
  }

  return { next, intBetween, pick, sample, id, boolean }
}

export const DEFAULT_SEED = 20260423
