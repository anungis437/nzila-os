/** Additive current-model repair. Never replay released migration journals on a live database. */
import { createHash } from 'node:crypto'
import type { V2Plan } from './source'
import { compileSecurity } from './security'
import {
  inspectMessagingPhysicalCatalog,
  planMessagingPhysicalGuards,
} from '../../db/auth/messaging-physical-guards'

export const MESSAGING_ADDITIVE_TABLES = [
  'message_thread_lifecycle',
  'message_retention_policies',
  'message_thread_reads',
] as const

type Execute = (sql: string) => Promise<Record<string, unknown>[]>
export async function planMessagingSchemaCompanion(plan: V2Plan, execute: Execute) {
  const snapshot = await inspectMessagingPhysicalCatalog(execute)
  const guards = planMessagingPhysicalGuards(snapshot)
  const missing = guards.missingTables
  if (missing.some((name) => !(MESSAGING_ADDITIVE_TABLES as readonly string[]).includes(name)))
    throw new Error('Messaging predecessor relations missing; additive companion refused')
  const ddl: string[] = []
  const security = compileSecurity(plan)
  for (const name of missing) {
    const sourceTable = plan.tables.find((table) => table.name === name)
    if (!sourceTable || sourceTable.source !== 'apps/union-eyes/db/schema/messages-schema.ts')
      throw new Error(`Current messaging declaration required: ${name}`)
    const entries = plan.statements.filter((statement) =>
      statement.canonicalId.startsWith(`CURRENT_DECLARATION:public.${name}:`),
    )
    if (entries.filter((entry) => entry.sql.startsWith(`CREATE TABLE "${name}"`)).length !== 1)
      throw new Error(`Exactly one current CREATE TABLE required: ${name}`)
    for (const entry of entries) {
      if (
        !new RegExp(
          `^(?:CREATE TABLE "${name}"|CREATE (?:UNIQUE )?INDEX "[^"\\n]+" ON "${name}"|ALTER TABLE "${name}" ADD CONSTRAINT )`,
        ).test(entry.sql)
      )
        throw new Error(`Non-additive messaging declaration refused: ${name}`)
      ddl.push(entry.sql)
    }
    const rule = security.rules.find((rule) => rule.table === name)
    if (!rule || rule.status !== 'COMPLETE' || !rule.runtimePrivileges.length)
      throw new Error(`Complete current messaging security required: ${name}`)
  }
  const relationSecurity = security.statements.filter((sql) =>
    missing.some((name) =>
      new RegExp(`(?:ON(?: TABLE)?|ALTER TABLE) public\\."${name}"(?:\\s|;)`).test(sql),
    ),
  )
  // Compile with the full source universe so foreign-parent visibility checks are retained.
  const statements = [
    ...ddl.filter((sql) => !sql.startsWith('ALTER TABLE')),
    ...ddl.filter((sql) => sql.startsWith('ALTER TABLE')),
    ...relationSecurity,
    ...guards.statements,
  ]
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ sourceCommitments: plan.sourceCommitments, snapshot, statements }))
    .digest('hex')
  return {
    fingerprint,
    missingTables: missing,
    statements,
    guardStatements: guards.statements.length,
  }
}

/** Caller owns transaction and the existing bounded owner role. SQL is always recomputed from source. */
export async function applyMessagingSchemaCompanion(
  plan: V2Plan,
  execute: Execute,
  reviewedFingerprint: string,
) {
  const fresh = await planMessagingSchemaCompanion(plan, execute)
  if (fresh.fingerprint !== reviewedFingerprint)
    throw new Error('Messaging repair metadata drift; nothing applied')
  for (const sql of fresh.statements) await execute(sql)
  const after = await planMessagingSchemaCompanion(plan, execute)
  if (after.missingTables.length || after.statements.length)
    throw new Error('Messaging repair postcondition failed')
  return {
    addedTables: fresh.missingTables,
    executedStatements: fresh.statements.length,
    preservedExistingRows: true,
  }
}
