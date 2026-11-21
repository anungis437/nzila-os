import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canonicalAuditContentHash, canonicalPythonJson } from '@/lib/audit/canonical-audit-chain'
import { EXTERNAL_AUDIT_JSON_BODY, EXTERNAL_AUDIT_JSON_FUNCTION } from './fixtures/audit-contract'

describe('bounded external audit SQL encoding matches the canonical chain', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`CREATE FUNCTION ${EXTERNAL_AUDIT_JSON_FUNCTION}(value jsonb) RETURNS text
      LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $body$${EXTERNAL_AUDIT_JSON_BODY}$body$;`)
  })
  afterAll(async () => {
    await db?.close()
  })

  it.each([
    {
      label: 'non-BMP and Unicode codepoint key ordering',
      value: { '\u{10000}': 'é🇨🇦', '\ue000': 'high BMP', a: '😀' },
    },
    {
      label: 'controls, quotes, slashes and empty strings',
      value: ['\b\t\n\f\r\u0001\u001f\u007f', '"\\/', ''],
    },
    {
      label: 'nested arrays, nulls and default separator spacing',
      value: { z: [null, true, false, {}, []], a: { b: 'two words', a: null } },
    },
    {
      label: 'safe integer numeric contract',
      value: [-9007199254740991, -1, -0, 0, 1, 52428800, 9007199254740991],
    },
  ])('preserves $label', async ({ value }) => {
    const actual = await db.query<{ encoded: string }>(
      `SELECT ${EXTERNAL_AUDIT_JSON_FUNCTION}($1::jsonb) AS encoded`,
      [JSON.stringify(value)],
    )
    expect(actual.rows[0].encoded).toBe(canonicalPythonJson(value))
  })

  it.each(['1.5', '9007199254740992', '-9007199254740992'])(
    'refuses ambiguous numeric input %s',
    async (value) => {
      await expect(
        db.query(`SELECT ${EXTERNAL_AUDIT_JSON_FUNCTION}($1::jsonb)`, [value]),
      ).rejects.toThrow('EXTERNAL_AUDIT_INTEGER_REQUIRED')
    },
  )

  it('hashes the exact canonical external receipt payload rather than PostgreSQL JSON text', async () => {
    const entry = {
      action: 'document.external_download',
      resourceType: 'documents',
      resourceId: 'document-id',
      userId: 'external-é-😀',
      correlationId: '',
      previousHash: 'a'.repeat(64),
      details: {
        actorKind: 'external_representative',
        delivery: 'served_by_route',
        versionNo: 3,
        sizeBytes: 123,
        text: '\n"é😀',
      },
    }
    const payload = {
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      user_id: entry.userId,
      correlation_id: entry.correlationId,
      previous_hash: entry.previousHash,
      details: entry.details,
    }
    const actual = await db.query<{ encoded: string }>(
      `SELECT ${EXTERNAL_AUDIT_JSON_FUNCTION}($1::jsonb) AS encoded`,
      [JSON.stringify(payload)],
    )
    expect(createHash('sha256').update(actual.rows[0].encoded, 'utf8').digest('hex')).toBe(
      canonicalAuditContentHash(entry),
    )
    expect(actual.rows[0].encoded).not.toBe(JSON.stringify(payload))
  })
})
