/**
 * The shape of the platform and cache migration files (UE-CONV-H-010).
 *
 * Two shapes cost a run-time failure that no one saw until the file was executed:
 *   - an untyped empty array literal (`ARRAY[]`): PostgreSQL refuses it when the statement runs (42P18), so a generated rollback for a set of relations with no enum type could
 *     never run (platform 0075's did not);
 *   - a statement chunk with no terminating semicolon: the bootstrap runner splits on the breakpoint marker and does not need one, but the file then cannot run as one script
 *     (psql, a client.query of the whole file), which is how a rollback is exercised (platform 0076 had none).
 * No migration has either today; this keeps it so.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DB = join(__dirname, '..')
const DIRS = ['migrations-platform', 'migrations-cache']

const files = DIRS.flatMap((dir) => readdirSync(join(DB, dir)).filter((f) => f.endsWith('.sql')).map((f) => ({ dir, file: f, sql: readFileSync(join(DB, dir, f), 'utf8').replace(/\r\n/g, '\n') })))

/** A chunk with no statement in it (comments only) needs no terminator. */
const unterminated = (sql: string): number[] => {
  const chunks = sql.split(/^--> statement-breakpoint\s*$/m)
  const bad: number[] = []
  chunks.forEach((chunk, i) => {
    const body = chunk.split('\n').filter((line) => line.trim() !== '' && !line.trim().startsWith('--')).join('\n').trim()
    if (body !== '' && !body.endsWith(';')) bad.push(i + 1)
  })
  return bad
}

describe('platform and cache migration files', () => {
  it('has migration files to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(150)
  })

  it('has no untyped empty array literal', () => {
    const offenders = files.filter(({ sql }) => /ARRAY\[\s*\](?!\s*::)/.test(sql)).map(({ dir, file }) => `${dir}/${file}`)
    expect(offenders).toEqual([])
  })

  it('ends every statement chunk with a semicolon, so a file runs as one script', () => {
    const offenders = files.filter(({ sql }) => unterminated(sql).length > 0).map(({ dir, file, sql }) => `${dir}/${file}: chunk ${unterminated(sql).join(', ')}`)
    expect(offenders).toEqual([])
  })
})
