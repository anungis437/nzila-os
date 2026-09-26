import { describe, expect, it } from 'vitest';
import {
  baseType,
  computeSchemaDigest,
  normalizeSchemas,
  normalizeType,
  stableStringify,
  type CanonicalSchema,
} from '../lib/normalize';

describe('normalizeType', () => {
  it('normalizes spelling variants while preserving modifiers', () => {
    expect(normalizeType('character varying(255)')).toBe('varchar(255)');
    expect(normalizeType('timestamp with time zone')).toBe('timestamptz');
    expect(normalizeType('timestamp without time zone')).toBe('timestamp');
    expect(normalizeType('boolean')).toBe('bool');
    expect(normalizeType('integer')).toBe('int4');
    expect(normalizeType('numeric(12,2)')).toBe('numeric(12,2)');
  });

  it('normalizes array udt spellings', () => {
    expect(normalizeType('_text')).toBe('text[]');
    expect(normalizeType('_uuid')).toBe('uuid[]');
    expect(normalizeType('text[]')).toBe('text[]');
  });

  it('keeps semantically distinct types distinct', () => {
    expect(normalizeType('timestamptz')).not.toBe(normalizeType('timestamp'));
    expect(normalizeType('uuid')).not.toBe(normalizeType('text'));
  });

  it('baseType strips modifiers', () => {
    expect(baseType('varchar(255)')).toBe('varchar');
    expect(baseType('numeric(12,2)')).toBe('numeric');
    expect(baseType('text[]')).toBe('text[]');
  });
});

function sample(): CanonicalSchema[] {
  return [
    {
      schema: 'public',
      tables: [
        {
          table: 'b_table',
          columns: [
            { column: 'z', type: 'text', nullable: true, default: null, primaryKey: false },
            { column: 'a', type: 'character varying(10)', nullable: false, default: null, primaryKey: true },
          ],
          primaryKey: ['a'],
          foreignKeys: [],
          uniqueConstraints: [],
          indexes: [],
          rlsEnabled: true,
          rlsForced: false,
        },
        {
          table: 'a_table',
          columns: [{ column: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()', primaryKey: true }],
          primaryKey: ['id'],
          foreignKeys: [],
          uniqueConstraints: [],
          indexes: [],
          rlsEnabled: false,
          rlsForced: false,
        },
      ],
    },
  ];
}

describe('deterministic normalization + digest', () => {
  it('sorts schemas/tables/columns lexicographically', () => {
    const n = normalizeSchemas(sample());
    expect(n[0].tables.map((t) => t.table)).toEqual(['a_table', 'b_table']);
    expect(n[0].tables[1].columns.map((c) => c.column)).toEqual(['a', 'z']);
    // type normalization applied inside
    expect(n[0].tables[1].columns[0].type).toBe('varchar(10)');
  });

  it('same input -> same digest', () => {
    expect(computeSchemaDigest(sample())).toBe(computeSchemaDigest(sample()));
  });

  it('input ordering does not affect digest', () => {
    const shuffled = sample();
    shuffled[0].tables.reverse();
    shuffled[0].tables.forEach((t) => t.columns.reverse());
    expect(computeSchemaDigest(shuffled)).toBe(computeSchemaDigest(sample()));
  });

  it('a real difference changes the digest', () => {
    const changed = sample();
    changed[0].tables[0].columns.push({ column: 'new_col', type: 'text', nullable: true, default: null, primaryKey: false });
    expect(computeSchemaDigest(changed)).not.toBe(computeSchemaDigest(sample()));
  });

  it('stableStringify emits sorted keys', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});
