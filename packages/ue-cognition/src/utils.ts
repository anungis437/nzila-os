/**
 * @nzila/ue-cognition — Internal utilities + file-backed store.
 *
 * Storage shape mirrors @nzila/platform-cognition-core/memory/store and
 * @nzila/platform-growth-os/store: per-record JSON under
 * `ops/ue-cognition/{entity}/`, zod-validated on every read and write.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomBytes } from 'node:crypto'
import type { ZodType } from 'zod'
import type { CognitionSubject } from '@nzila/platform-cognition-core'

export function nowISO(): string {
  return new Date().toISOString()
}

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`
}

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

export function subjectKey(s: CognitionSubject): string {
  return `${s.tenantId}::${s.orgId}::${s.userId ?? '_'}::${s.entityType ?? '_'}::${s.entityId ?? '_'}`
}

export function findRepoRoot(start?: string): string {
  let dir = start ?? process.cwd()
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

let storeRootOverride: string | null = null

export function setUeCognitionStoreRoot(root: string | null): void {
  storeRootOverride = root
}

export function ueCognitionRoot(): string {
  return storeRootOverride ?? path.join(findRepoRoot(), 'ops', 'ue-cognition')
}

function entityDir(entity: string): string {
  return path.join(ueCognitionRoot(), entity)
}

function recordPath(entity: string, id: string): string {
  return path.join(entityDir(entity), `${id}.json`)
}

export function writeRecord<T>(entity: string, id: string, value: T, schema: ZodType<T>): T {
  const validated = schema.parse(value)
  fs.mkdirSync(entityDir(entity), { recursive: true })
  fs.writeFileSync(recordPath(entity, id), JSON.stringify(validated, null, 2), 'utf-8')
  return validated
}

export function readRecord<T>(entity: string, id: string, schema: ZodType<T>): T | null {
  const file = recordPath(entity, id)
  if (!fs.existsSync(file)) return null
  return schema.parse(JSON.parse(fs.readFileSync(file, 'utf-8')))
}

export function listRecords<T>(entity: string, schema: ZodType<T>): T[] {
  const dir = entityDir(entity)
  if (!fs.existsSync(dir)) return []
  const out: T[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    out.push(schema.parse(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))))
  }
  return out
}

export function daysBetween(from: string | Date, to: string | Date): number {
  const a = typeof from === 'string' ? Date.parse(from) : from.getTime()
  const b = typeof to === 'string' ? Date.parse(to) : to.getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return (b - a) / 86_400_000
}

export function stdev(xs: readonly number[]): number {
  if (xs.length <= 1) return 0
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length
  return Math.sqrt(variance)
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}
