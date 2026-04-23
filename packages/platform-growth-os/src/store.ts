/**
 * @nzila/platform-growth-os — File-backed store primitives.
 *
 * Mirrors the precedent set by `@nzila/platform-cognition-core` and
 * `@nzila/platform-decision-engine`: JSON-per-record under `ops/{thing}/`.
 *
 * Phase-2 wires these to the Drizzle schema in `./schema.ts`.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ZodType } from 'zod'
import { ensureDir, findRepoRoot } from './utils'

let storeRootOverride: string | null = null

/** Override the on-disk root (used in tests). Pass `null` to reset. */
export function setGrowthStoreRoot(root: string | null): void {
  storeRootOverride = root
}

function rootDir(): string {
  return storeRootOverride ?? path.join(findRepoRoot(), 'ops')
}

function entityDir(entity: string): string {
  const dir = path.join(rootDir(), `growth-${entity}`)
  ensureDir(dir)
  return dir
}

export function writeRecord<T>(entity: string, id: string, record: T, schema: ZodType<T>): T {
  const validated = schema.parse(record)
  const file = path.join(entityDir(entity), `${id}.json`)
  fs.writeFileSync(file, JSON.stringify(validated, null, 2), 'utf-8')
  return validated
}

export function readRecord<T>(entity: string, id: string, schema: ZodType<T>): T | null {
  const file = path.join(entityDir(entity), `${id}.json`)
  if (!fs.existsSync(file)) return null
  return schema.parse(JSON.parse(fs.readFileSync(file, 'utf-8')))
}

export function deleteRecord(entity: string, id: string): boolean {
  const file = path.join(entityDir(entity), `${id}.json`)
  if (!fs.existsSync(file)) return false
  fs.unlinkSync(file)
  return true
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
