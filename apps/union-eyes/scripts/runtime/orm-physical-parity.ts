/**
 * ORM <-> physical schema parity sweep (dev tooling). The comparison lives in schema-convergence.ts; the strict classes it reports are
 * the ones the native ratchet db/__tests__/schema-convergence.postgres.test.ts holds at zero.
 *
 * Read-only. Usage: DATABASE_URL=... tsx scripts/runtime/orm-physical-parity.ts [--json] [--strict] [--write=<file>] [--kinds=KIND,KIND]
 *   --strict       report only the strict classes and exit 1 when any is present.
 *   --write=<file> write the findings as a deterministic register (the input of scripts/generate-declared-convergence.ts).
 *   --kinds=...    write (and report) only these classes.
 */
import { writeFileSync } from 'node:fs'
import pg from 'pg'
import { loadDeclarationSources, measureConvergence, STRICT_KINDS, summarize } from './schema-convergence'

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const measured = await measureConvergence(client, await loadDeclarationSources())
    const strict = process.argv.includes('--strict')
    const kinds = process.argv.find((a) => a.startsWith('--kinds='))?.slice('--kinds='.length).split(',').filter(Boolean)
    const writtenKinds = strict ? [...STRICT_KINDS, 'EXTENSION_ABSENT'] : kinds ?? null
    const findings = writtenKinds ? measured.findings.filter((f) => writtenKinds.includes(f.kind)) : measured.findings
    const target = process.argv.find((a) => a.startsWith('--write='))?.slice('--write='.length)
    if (target) {
      const ordered = [...findings].sort((a, b) => a.kind.localeCompare(b.kind) || a.table.localeCompare(b.table) || (a.column ?? '').localeCompare(b.column ?? '') || a.detail.localeCompare(b.detail))
      writeFileSync(target, `${JSON.stringify({ schemaVersion: 1, tables: measured.tables, summary: summarize(ordered), findings: ordered }, null, 1)}\n`)
    }
    if (process.argv.includes('--json')) console.log(JSON.stringify({ tables: measured.tables, summary: summarize(findings), findings }, null, 2))
    else {
      console.log(`parity sweep: ${measured.tables} tables compared, ${findings.length} finding(s) ${JSON.stringify(summarize(findings))}`)
      for (const f of findings) console.log(`${f.kind}\t${f.table}${f.column ? `.${f.column}` : ''}\t${f.detail}`)
    }
    if (strict && findings.some((f) => STRICT_KINDS.includes(f.kind))) process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
