import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';
import { sqlIn } from '../sql-in';

const render = (query: SQL) => new PgDialect().sqlToQuery(query);

describe('sqlIn', () => {
  it('renders a list of parameters after IN, one per value, in order', () => {
    expect(render(sqlIn(sql`c.status`, ['open', 'closed']))).toMatchObject({ sql: 'c.status IN ($1, $2)', params: ['open', 'closed'] });
    expect(render(sqlIn(sql`c.status`, ['open']))).toMatchObject({ sql: 'c.status IN ($1)', params: ['open'] });
    expect(render(sqlIn(sql`c.status`, ['a', 'b', 'c']))).toMatchObject({ sql: 'c.status IN ($1, $2, $3)', params: ['a', 'b', 'c'] });
  });

  it('matches nothing for an empty list, so a filter that allows nothing stays closed', () => {
    expect(render(sqlIn(sql`ei.sensitivity_level`, []))).toMatchObject({ sql: 'false', params: [] });
  });

  it('numbers its parameters after the ones before it and before the ones after it', () => {
    const query = sql`select 1 where a = ${'x'} and ${sqlIn(sql`b`, ['y', 'z'])} and c = ${'w'}`;
    expect(render(query)).toMatchObject({ sql: 'select 1 where a = $1 and b IN ($2, $3) and c = $4', params: ['x', 'y', 'z', 'w'] });
  });

  it('keeps a value a parameter, never text: a value that looks like SQL is bound, not run', () => {
    const rendered = render(sqlIn(sql`c.status`, ["open') OR true --"]));
    expect(rendered.sql).toBe('c.status IN ($1)');
    expect(rendered.params).toEqual(["open') OR true --"]);
  });

  // Why the helper exists: Drizzle does not turn a JavaScript array into one array parameter. PostgreSQL refuses `= ANY(($1, $2))` (42809), and `= ANY(($1))` (22P02),
  // so every `= ANY(${values})` in a `sql` template failed on its first run. If a Drizzle upgrade changes this, this test fails and the helper can be revisited.
  it('characterizes the spelling it replaces: an array in ANY(...) becomes a parenthesized list, not an array', () => {
    expect(render(sql`x = ANY(${['a', 'b']})`).sql).toBe('x = ANY(($1, $2))');
    expect(render(sql`x = ANY(${['a', 'b']}::uuid[])`).sql).toBe('x = ANY(($1, $2)::uuid[])');
  });
});
