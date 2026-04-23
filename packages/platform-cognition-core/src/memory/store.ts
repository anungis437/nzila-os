/**
 * @nzila/platform-cognition-core/memory — File-backed memory event store
 *
 * Persistence is intentionally identical in shape to @nzila/platform-decision-engine's
 * store: per-record JSON under ops/, zod-validated on every read and write.
 * Phase-2 will swap the implementation for the Drizzle-backed store described
 * in src/schema.ts; the functional surface here will be preserved.
 *
 * Records are NEVER hard-deleted by `redactMemoryEvent`; they are flagged with
 * `redactedAt` + `redactionReason`, and the recall API silently excludes them.
 * `purgeRedacted()` exists as a separate, explicit operation for retention jobs.
 *
 * @module @nzila/platform-cognition-core/memory/store
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { memoryEventSchema } from '../schemas'
import { generateMemoryId, nowISO, subjectKey } from '../utils'
import type { CognitionSubject, MemoryEvent } from '../types'

// ── Repo root detection (mirrors platform-decision-engine) ──────────────────

function findRepoRoot(): string {
  let dir = import.meta.dirname ?? process.cwd()
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = path.dirname(dir)
  }
  return process.cwd()
}

let baseDirOverride: string | null = null

/** Override the storage root. Used by tests; production should not call this. */
export function setMemoryStoreRoot(root: string | null): void {
  baseDirOverride = root
}

function memoryDir(): string {
  const root = baseDirOverride ?? findRepoRoot()
  return path.join(root, 'ops', 'cognition-memory')
}

function eventPath(id: string): string {
  return path.join(memoryDir(), `${id}.json`)
}

// ── Write ───────────────────────────────────────────────────────────────────

export type MemoryEventInput = Omit<MemoryEvent, 'id' | 'recordedAt'> & {
  readonly id?: string
  readonly recordedAt?: string
}

export function recordMemoryEvent(input: MemoryEventInput): MemoryEvent {
  const candidate: MemoryEvent = {
    ...input,
    id: input.id ?? generateMemoryId(),
    recordedAt: input.recordedAt ?? nowISO(),
  }
  const validated = memoryEventSchema.parse(candidate) as MemoryEvent
  fs.mkdirSync(memoryDir(), { recursive: true })
  fs.writeFileSync(eventPath(validated.id), JSON.stringify(validated, null, 2), 'utf-8')
  return validated
}

// ── Read ────────────────────────────────────────────────────────────────────

export function loadMemoryEvent(id: string): MemoryEvent | null {
  const file = eventPath(id)
  if (!fs.existsSync(file)) return null
  return memoryEventSchema.parse(JSON.parse(fs.readFileSync(file, 'utf-8'))) as MemoryEvent
}

/**
 * Load all non-redacted events for a subject. The match is exact across
 * (tenant, org, user?, entityType?, entityId?) using `subjectKey`.
 *
 * Sorted ascending by `occurredAt` (oldest first) — most callers want
 * chronological order for trajectory windowing.
 */
export function loadMemoryEvents(subject: CognitionSubject): MemoryEvent[] {
  const dir = memoryDir()
  if (!fs.existsSync(dir)) return []
  const target = subjectKey(subject)
  const events: MemoryEvent[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const ev = memoryEventSchema.parse(
      JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')),
    ) as MemoryEvent
    if (ev.redactedAt) continue
    if (subjectKey(ev.subject) !== target) continue
    events.push(ev)
  }
  events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  return events
}

/** Load EVERY event (including redacted) for a subject. Audit only. */
export function loadMemoryEventsRaw(subject: CognitionSubject): MemoryEvent[] {
  const dir = memoryDir()
  if (!fs.existsSync(dir)) return []
  const target = subjectKey(subject)
  const events: MemoryEvent[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const ev = memoryEventSchema.parse(
      JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')),
    ) as MemoryEvent
    if (subjectKey(ev.subject) !== target) continue
    events.push(ev)
  }
  events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  return events
}

// ── Redaction (consent withdrawal) ──────────────────────────────────────────

export function redactMemoryEvent(id: string, reason: string): MemoryEvent | null {
  const ev = loadMemoryEvent(id)
  if (!ev) return null
  if (ev.redactedAt) return ev
  const redacted: MemoryEvent = {
    ...ev,
    payload: {}, // strip payload at redaction time; keep envelope for audit
    redactedAt: nowISO(),
    redactionReason: reason,
  }
  const validated = memoryEventSchema.parse(redacted) as MemoryEvent
  fs.writeFileSync(eventPath(validated.id), JSON.stringify(validated, null, 2), 'utf-8')
  return validated
}

/** Redact every event for a subject. Used for full account deletion / withdrawal. */
export function redactSubject(subject: CognitionSubject, reason: string): number {
  const all = loadMemoryEventsRaw(subject)
  let count = 0
  for (const ev of all) {
    if (ev.redactedAt) continue
    redactMemoryEvent(ev.id, reason)
    count++
  }
  return count
}

/** Permanently delete redacted events. Run from retention jobs only. */
export function purgeRedacted(subject: CognitionSubject): number {
  const dir = memoryDir()
  if (!fs.existsSync(dir)) return 0
  const target = subjectKey(subject)
  let count = 0
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const file = path.join(dir, f)
    const ev = memoryEventSchema.parse(JSON.parse(fs.readFileSync(file, 'utf-8'))) as MemoryEvent
    if (subjectKey(ev.subject) !== target) continue
    if (!ev.redactedAt) continue
    fs.unlinkSync(file)
    count++
  }
  return count
}
