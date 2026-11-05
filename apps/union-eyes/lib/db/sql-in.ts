import { sql, type SQL } from 'drizzle-orm';

/**
 * `expression IN (value, value, ...)` for a JavaScript array in hand-written SQL.
 *
 * Drizzle expands an array inside a `sql` template to a parenthesized list of parameters, not to one array parameter. A template that hands such an array to
 * ANY therefore reaches PostgreSQL as `= ANY(($1, $2))`, which it refuses whatever the length (42809 for several values, 22P02 for one), and so does the
 * spelling with an array cast (42846). A column of a Drizzle table takes `inArray(column, values)`; raw SQL that names its own aliases
 * (`c.status`) takes this. An empty list matches nothing, so a filter that allows nothing stays closed.
 *
 * Pass the expression as a parameterless template (sql`c.status`), never text from a request: it is part of the statement.
 */
export function sqlIn(expression: SQL, values: readonly unknown[]): SQL {
  if (values.length === 0) return sql`false`;
  const list = values.slice(1).reduce<SQL>((joined, value) => sql`${joined}, ${value}`, sql`${values[0]}`);
  return sql`${expression} IN (${list})`;
}
