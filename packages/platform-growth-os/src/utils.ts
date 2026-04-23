/**
 * @nzila/platform-growth-os — Internal utilities.
 */
import { createHash, randomBytes } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { GrowthScope } from './types'

export function nowISO(): string {
  return new Date().toISOString()
}

export function makeId(prefix: string): string {
  const ts = Date.now().toString(36)
  const rnd = randomBytes(6).toString('hex')
  return `${prefix}_${ts}_${rnd}`
}

export function scopeKey(s: GrowthScope): string {
  return `${s.tenantId}::${s.orgId}::${s.product ?? '_'}`
}

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

export function sigmoid(x: number): number {
  if (x >= 0) {
    const e = Math.exp(-x)
    return 1 / (1 + e)
  }
  const e = Math.exp(x)
  return e / (1 + e)
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex')
}

export function findRepoRoot(start?: string): string {
  let dir = start ?? process.cwd()
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

export function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

export function daysBetween(from: string | Date, to: string | Date): number {
  const a = typeof from === 'string' ? Date.parse(from) : from.getTime()
  const b = typeof to === 'string' ? Date.parse(to) : to.getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return (b - a) / 86_400_000
}
