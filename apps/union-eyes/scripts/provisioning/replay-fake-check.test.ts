import { describe, expect, it } from 'vitest'
import type { FakeReplayColumn } from './replay-fake-catalog'
import { parseFakeCheckSource } from './replay-fake-check'

function column(name: string, type: string, enumType = false): FakeReplayColumn {
  return {
    name,
    type_schema: enumType ? 'public' : 'pg_catalog',
    type_name: type,
    type_kind: enumType ? 'e' : 'b',
    postgres_type: type,
    not_null: false,
    identity: '',
    generated: '',
    default_expression: null,
    collation_default: true,
    acl: null,
  }
}
const columns = [
  column('status', 'authority_status', true),
  column('revoked_at', 'timestamptz'),
  column('expires_at', 'timestamptz'),
  column('created_at', 'timestamptz'),
  column('text_value', 'text'),
  column('other_status', 'other_status', true),
]
const members = (schema: string, name: string) =>
  schema === 'public' && name === 'authority_status' ? ['active', 'revoked'] : null

describe('independent CHECK source grammar, not production relation IR', () => {
  it('records exact named enum and nullable timestamp source and physical dependencies', () => {
    const expression =
      "(status <> 'revoked' OR revoked_at IS NOT NULL) AND (expires_at IS NULL OR expires_at > created_at)"
    const before = structuredClone(columns)
    expect(
      parseFakeCheckSource(`CONSTRAINT "authority_check" CHECK (${expression})`, columns, members),
    ).toEqual({
      name: 'authority_check',
      expression,
      columns: ['status', 'revoked_at', 'expires_at', 'created_at'],
    })
    expect(columns).toEqual(before)
  })
  it('records unnamed CHECK without manufacturing a source name', () => {
    expect(parseFakeCheckSource('CHECK (expires_at > created_at)', columns, members)).toEqual({
      name: null,
      expression: 'expires_at > created_at',
      columns: ['expires_at', 'created_at'],
    })
  })
  it.each([
    "CHECK (status <> 'invented')",
    "CHECK (other_status <> 'revoked')",
    'CHECK (expires_at > text_value)',
    'CHECK (text_value > text_value)',
    'CHECK (missing_column IS NULL)',
    "CHECK ('revoked' <> status)",
    'CHECK (expires_at = created_at)',
    'CHECK (expires_at >= created_at)',
    'CHECK (expires_at IS TRUE)',
    'CHECK (expires_at IS NULL) NOT VALID',
    'CHECK (now() > created_at)',
    'CHECK (expires_at IS NULL); DROP TABLE public.other;',
    'CHECK (expires_at IS NULL OR)',
    'CHECK ((expires_at IS NULL)',
    'CHECK ()',
  ])('denies unmodeled source explicitly: %s', (source) => {
    expect(() => parseFakeCheckSource(source, columns, members)).toThrow(
      'FAKE_CHECK_SOURCE_UNSUPPORTED',
    )
  })
})
