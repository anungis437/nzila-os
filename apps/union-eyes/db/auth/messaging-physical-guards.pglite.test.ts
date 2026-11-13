import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { describe, expect, it } from 'vitest'
import {
  planMessagingSchemaCompanion,
  applyMessagingSchemaCompanion,
} from '../../scripts/bootstrap-v2/messaging-schema-companion'
import type { V2Plan } from '../../scripts/bootstrap-v2/source'
import * as current from '../schema/messages-schema'
import * as domain from '../schema/domains/communications/messages'
import {
  compileMessagingPhysicalGuards,
  inspectMessagingPhysicalCatalog,
  messagingPhysicalGuardViolations,
  MESSAGING_GUARD_FUNCTIONS,
  MESSAGING_GUARD_TRIGGERS,
  MESSAGING_REQUIRED_TABLES,
  planMessagingPhysicalGuards,
} from './messaging-physical-guards'

const sourceRoot = path.resolve(__dirname, '../../../..')
describe('current messaging physical protections', () => {
  it('uses the same declaration objects for the current API and domain/schema generator', () => {
    for (const [name, value] of Object.entries(current))
      expect(domain[name as keyof typeof domain]).toBe(value)
    for (const fn of MESSAGING_GUARD_FUNCTIONS) {
      const source = readFileSync(path.join(sourceRoot, fn.source), 'utf8')
      expect(createHash('sha256').update(source).digest('hex')).toBe(fn.sourceSha256)
      expect(source).toContain(`AS $$${fn.body}$$`)
    }
    for (const trigger of MESSAGING_GUARD_TRIGGERS)
      expect(readFileSync(path.join(sourceRoot, trigger.source), 'utf8')).toContain(trigger.sql)
    expect(compileMessagingPhysicalGuards([])).toEqual([])
    expect(() => compileMessagingPhysicalGuards([{ name: 'message_threads' }])).toThrow(
      'incomplete',
    )
    expect(
      messagingPhysicalGuardViolations({ tables: [], functions: [], triggers: [] }),
    ).toHaveLength(7)
  })

  it('installs current declarations without migration replay and enforces immutable history and monotonic reads', async () => {
    const pg = new PGlite()
    try {
      await pg.exec(
        'CREATE ROLE ue_v2_owner; CREATE ROLE union_eyes_runtime; CREATE ROLE union_eyes_system; SET ROLE ue_v2_owner;',
      )
      await pg.exec(
        'RESET ROLE; GRANT CREATE ON SCHEMA public TO ue_v2_owner; SET ROLE ue_v2_owner;',
      )
      const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(current))
      for (const sql of ddl.filter((sql) => !sql.startsWith('ALTER TABLE'))) await pg.exec(sql)
      for (const sql of ddl.filter((sql) => sql.startsWith('ALTER TABLE'))) await pg.exec(sql)
      for (const sql of compileMessagingPhysicalGuards(
        MESSAGING_REQUIRED_TABLES.map((name) => ({ name })),
      ))
        await pg.exec(sql)
      const execute = async (sql: string) => (await pg.query(sql)).rows as Record<string, unknown>[]
      const snapshot = await inspectMessagingPhysicalCatalog(execute)
      expect(messagingPhysicalGuardViolations(snapshot)).toEqual([])
      expect(planMessagingPhysicalGuards(snapshot).statements).toEqual([])
      const thread = '11111111-1111-4111-8111-111111111111',
        org = '22222222-2222-4222-8222-222222222222'
      await pg.query(
        `INSERT INTO message_threads(id,subject,member_id,organization_id) VALUES($1,'Synthetic conversation','member',$2)`,
        [thread, org],
      )
      await pg.query(
        `INSERT INTO message_thread_reads(thread_id,user_id,organization_id,last_read_at) VALUES($1,'member',$2,'2026-11-13T12:00Z')`,
        [thread, org],
      )
      await expect(
        pg.exec(`UPDATE message_thread_reads SET last_read_at='2026-11-12'`),
      ).rejects.toThrow('never moves backwards')
      await expect(pg.exec('DELETE FROM message_thread_reads')).rejects.toThrow('refused')
      await expect(pg.exec("UPDATE message_threads SET status='closed'")).rejects.toThrow(
        'requires its lifecycle record',
      )
      await pg.exec('BEGIN')
      await pg.exec("UPDATE message_threads SET status='closed'")
      await pg.query(
        `INSERT INTO message_thread_lifecycle(thread_id,organization_id,action,acted_by,acted_via) VALUES($1,$2,'close','member','thread_member')`,
        [thread, org],
      )
      await pg.exec('COMMIT')
      await expect(pg.exec("UPDATE message_threads SET status='open'")).rejects.toThrow(
        'only move to closed',
      )
      await expect(pg.exec('DELETE FROM message_thread_lifecycle')).rejects.toThrow('append-only')
      await pg.exec('ALTER TABLE message_thread_reads DISABLE TRIGGER message_reads_guard_write')
      expect(
        messagingPhysicalGuardViolations(await inspectMessagingPhysicalCatalog(execute)).join(),
      ).toContain('replacement refused')
    } finally {
      await pg.close()
    }
  }, 30000)
  it('repairs only the three absent current tables, preserves predecessor rows and refuses stale metadata', async () => {
    const pg = new PGlite()
    try {
      const plan = JSON.parse(
        readFileSync(
          path.join(
            sourceRoot,
            'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json',
          ),
          'utf8',
        ),
      ) as V2Plan
      await pg.exec(`CREATE ROLE ue_v2_owner; CREATE ROLE union_eyes_runtime; CREATE ROLE union_eyes_system;
        GRANT CREATE ON SCHEMA public TO ue_v2_owner; CREATE SCHEMA user_management;
        CREATE FUNCTION user_management.auth_business_org_authorized(uuid,text[] DEFAULT NULL) RETURNS boolean LANGUAGE sql AS 'SELECT true';
        GRANT USAGE ON SCHEMA user_management TO ue_v2_owner; SET ROLE ue_v2_owner;`)
      const predecessor = {
        messageThreads: current.messageThreads,
        messages: current.messages,
        messageStatusEnum: current.messageStatusEnum,
        messageTypeEnum: current.messageTypeEnum,
        triageDesignations: current.triageDesignations,
        messageThreadAssignments: current.messageThreadAssignments,
      }
      const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(predecessor))
      for (const sql of [
        ...ddl.filter((sql) => !sql.startsWith('ALTER TABLE')),
        ...ddl.filter((sql) => sql.startsWith('ALTER TABLE')),
      ])
        await pg.exec(sql)
      await pg.exec(
        "INSERT INTO message_threads(subject,member_id,organization_id) VALUES('Preserve synthetic predecessor','member','22222222-2222-4222-8222-222222222222')",
      )
      const execute = async (sql: string) => (await pg.query(sql)).rows as Record<string, unknown>[]
      const physicalBefore = (
        await pg.query(
          "SELECT oid::text,relfilenode::text FROM pg_class WHERE oid='public.message_threads'::regclass",
        )
      ).rows
      const reviewed = await planMessagingSchemaCompanion(plan, execute)
      expect(reviewed.missingTables.sort()).toEqual([
        'message_retention_policies',
        'message_thread_lifecycle',
        'message_thread_reads',
      ])
      expect(reviewed.statements.filter((sql) => sql.startsWith('CREATE POLICY'))).toHaveLength(11)
      await expect(applyMessagingSchemaCompanion(plan, execute, '0'.repeat(64))).rejects.toThrow(
        'metadata drift',
      )
      await pg.exec('BEGIN')
      await applyMessagingSchemaCompanion(plan, execute, reviewed.fingerprint)
      await pg.exec('COMMIT')
      expect((await pg.query('SELECT subject FROM message_threads')).rows).toEqual([
        { subject: 'Preserve synthetic predecessor' },
      ])
      expect(
        (
          await pg.query(
            "SELECT oid::text,relfilenode::text FROM pg_class WHERE oid='public.message_threads'::regclass",
          )
        ).rows,
      ).toEqual(physicalBefore)
      expect((await planMessagingSchemaCompanion(plan, execute)).statements).toEqual([])
      expect(
        (
          await pg.query(
            "SELECT count(*)::int AS n FROM pg_policies WHERE tablename IN ('message_thread_reads','message_retention_policies','message_thread_lifecycle') AND policyname='ue_v2_verified_business_session' AND permissive='RESTRICTIVE'",
          )
        ).rows,
      ).toEqual([{ n: 3 }])
      await pg.exec('ALTER FUNCTION public.message_reads_guard() SECURITY DEFINER')
      await expect(planMessagingSchemaCompanion(plan, execute)).rejects.toThrow(
        'replacement refused',
      )
    } finally {
      await pg.close()
    }
  }, 30000)
})
