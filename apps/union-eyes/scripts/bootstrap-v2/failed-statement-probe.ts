import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildPlan, folder, type V2Plan } from './source'
import { openNativeRuntimeFixture } from './native-runtime-fixture'

/**
 * Replays the SQL that failed in the authenticated-500 diagnostics against a fresh V2 database
 * (PREPARE + EXPLAIN: no rows are read or written) under each real application role, so the real
 * PostgreSQL SQLSTATE and message is recorded instead of inferred.
 */
const ROLES = ['union_eyes_runtime', 'union_eyes_system', null] as const

export function failedStatements(excerpt: string): string[] {
  const found = new Set<string>()
  for (const match of excerpt.matchAll(/Failed query: ((?:[^"\\]|\\.)*?)\\nparams:/g)) {
    try {
      found.add(JSON.parse(`"${match[1]}"`) as string)
    } catch {
      /* partially captured statement: skip */
    }
  }
  return [...found]
}

export async function probeFailedStatements() {
  const diagnostics = JSON.parse(
    readFileSync(path.join(folder, 'UE_V2_AUTHENTICATED_500_DIAGNOSTICS.json'), 'utf8'),
  ) as { diagnostics: { id: string; status: number; logExcerpt: string }[] }
  const statements = new Map<string, string[]>()
  for (const entry of diagnostics.diagnostics.filter((item) => item.status >= 500))
    for (const statement of failedStatements(entry.logExcerpt)) {
      const routes = statements.get(statement) ?? []
      routes.push(entry.id)
      statements.set(statement, routes)
    }

  const plan: V2Plan = await buildPlan(process.env.UE_V2_WHEELHOUSE!)
  const fixture = await openNativeRuntimeFixture(plan)
  try {
    const results = []
    for (const [statement, routes] of statements) {
      const parameters = Math.max(
        0,
        ...[...statement.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])),
      )
      const outcome: Record<string, string> = {}
      for (const role of ROLES) {
        const client = role === 'union_eyes_system' ? fixture.system : fixture.runtime
        await client.query('DEALLOCATE ALL')
        await client.query('BEGIN')
        try {
          if (role === 'union_eyes_runtime') await client.query(`SET LOCAL ROLE ${role}`)
          await client.query(`PREPARE probe AS ${statement}`)
          const nulls = Array.from({ length: parameters }, () => 'NULL').join(',')
          await client.query(`EXPLAIN EXECUTE probe${parameters ? `(${nulls})` : ''}`)
          outcome[role ?? 'bare_login'] = 'OK'
        } catch (error: unknown) {
          const failure = error as { code?: string; message?: string }
          outcome[role ?? 'bare_login'] = `${failure.code ?? '?'} ${failure.message ?? error}`
        } finally {
          await client.query('ROLLBACK')
        }
      }
      results.push({ statement: statement.slice(0, 400), routes: [...new Set(routes)], outcome })
    }
    return results
  } finally {
    await fixture.dispose()
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  probeFailedStatements()
    .then((results) => {
      const target = process.argv[2]
      if (target) writeFileSync(target, `${JSON.stringify(results, null, 2)}\n`)
      process.stdout.write(`${JSON.stringify({ statements: results.length })}\n`)
    })
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
}
