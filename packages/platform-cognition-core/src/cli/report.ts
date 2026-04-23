#!/usr/bin/env tsx
/**
 * @nzila/platform-cognition-core — Operational report
 *
 * Reads every event from the file-backed memory store, scores each unique
 * subject across all trajectory kinds, and prints a human-readable summary.
 *
 * No external IO beyond the local cognition-memory dir. Safe to run in CI.
 *
 * Usage: `pnpm cognition:report`
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { memoryEventSchema } from '../schemas'
import { listTrajectoryModels, scoreSubject } from '../trajectory/index'
import { COGNITION_ENGINE_VERSION, type CognitionSubject, type MemoryEvent } from '../types'
import { subjectKey } from '../utils'

function findRepoRoot(): string {
  let dir = import.meta.dirname ?? process.cwd()
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = path.dirname(dir)
  }
  return process.cwd()
}

function memoryDir(): string {
  return path.join(findRepoRoot(), 'ops', 'cognition-memory')
}

function loadAllEvents(): MemoryEvent[] {
  const dir = memoryDir()
  if (!fs.existsSync(dir)) return []
  const out: MemoryEvent[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const ev = memoryEventSchema.parse(
      JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')),
    ) as MemoryEvent
    out.push(ev)
  }
  return out
}

function uniqueSubjects(events: readonly MemoryEvent[]): CognitionSubject[] {
  const seen = new Map<string, CognitionSubject>()
  for (const ev of events) {
    const key = subjectKey(ev.subject)
    if (!seen.has(key)) seen.set(key, ev.subject)
  }
  return [...seen.values()]
}

function main(): void {
  const events = loadAllEvents()
  const subjects = uniqueSubjects(events)

  console.log('# Cognition Engine Report')
  console.log(`Engine version: ${COGNITION_ENGINE_VERSION}`)
  console.log(`Memory events:  ${events.length}`)
  console.log(`Active subjects: ${subjects.length}`)
  console.log('')
  console.log('## Active models')
  for (const m of listTrajectoryModels()) {
    console.log(`  • ${m.kind.padEnd(14)} ${m.version}`)
  }
  console.log('')

  if (subjects.length === 0) {
    console.log('No subjects recorded yet. Seed events via the memory.recordMemoryEvent API.')
    return
  }

  console.log('## Top-of-window risk per subject')
  for (const s of subjects) {
    const scores = scoreSubject(s)
    const top = [...scores].sort((a, b) => b.probability - a.probability)[0]
    console.log(
      `  • ${subjectKey(s)}  →  ${top.kind} = ${(top.probability * 100).toFixed(1)}% ` +
        `(conf ${(top.confidence * 100).toFixed(0)}%)`,
    )
  }
}

main()
