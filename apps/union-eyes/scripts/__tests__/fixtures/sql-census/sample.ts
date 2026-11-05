import { sql } from 'drizzle-orm'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const things = pgTable('things', { id: uuid('id').primaryKey(), title: text('title_col') })

const TABLE = 'things'
const COLUMNS = ['id', 'title_col'].join(', ')

// A template whose every part resolves: values bind, columns and tables render with their physical names.
export const columns = sql`SELECT ${things.id}, ${things.title} FROM ${things} WHERE ${things.id} = ${'x'}`

// A conditional yields both branches.
export const branches = (flag: boolean) => sql`SELECT 1 FROM things ${flag ? sql`WHERE id = ${'x'}` : sql``}`

// A pg string built from constants.
export async function constants(client: { query: (text: string, values?: unknown[]) => unknown }) {
  return client.query(`SELECT ${COLUMNS} FROM ${TABLE} WHERE id = $1`, ['x'])
}

// An array bound into a drizzle template is spread into ($1, $2).
export const spread = (ids: string[]) => sql`SELECT 1 FROM things WHERE id = ANY(${ids})`

// A branch for another engine.
export const dialect = (dbType: string) => {
  if (dbType === 'mssql') return sql`GETUTCDATE()`
  return sql`NOW()`
}

// Something only the run knows.
export const hole = (fragment: unknown) => sql`SELECT 1 FROM things WHERE ${fragment}`

// English that begins like a statement.
export const prose = 'Select an option from the list below'

// A value spliced into the text instead of bound.
export async function spliced(client: { query: (text: string) => unknown }, name: string) {
  return client.query(`SELECT id FROM things WHERE title_col = '${name}'`)
}
