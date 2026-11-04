import { describe, expect, it } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { claimDetailQuery } from './claim-detail-query'
import { CLAIM_DETAIL_KEYS, CLAIM_DETAIL_KEYS_COMPLETE } from './claim-detail-wire'
import type { CaseActor } from './case-authorization'

/** The items of the select list of a query: between its first SELECT and the FROM at the same depth, split at the commas at depth zero. */
function selectList(text: string): string[] {
  const start = text.search(/\bSELECT\b/i) + 'SELECT'.length
  let depth = 0
  let end = text.length
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    else if (depth === 0 && /^FROM\b/i.test(text.slice(i, i + 5)) && /\s/.test(text[i - 1] ?? ' ')) {
      end = i
      break
    }
  }
  const items: string[] = []
  let current = ''
  depth = 0
  for (const ch of text.slice(start, end)) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      items.push(current)
      current = ''
    } else current += ch
  }
  items.push(current)
  return items.map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

/** The key a select item has in the row: its `AS "alias"`, else the column after the last dot. */
const keyOf = (item: string): string => {
  const alias = /\bAS\s+"([^"]+)"\s*$/i.exec(item)
  if (alias) return alias[1]
  return item.split('.').pop()!.trim()
}

describe('the case detail query and the answer declared for it', () => {
  const actor = { organizationId: '9210418f-6a4f-4dab-a7d2-4450d581dc81' } as CaseActor
  const { sql } = new PgDialect().sqlToQuery(claimDetailQuery(actor, 'claim-1'))
  const selected = selectList(sql).map(keyOf)

  it('selects exactly the keys ClaimDetailWire declares, each once', () => {
    expect(new Set(selected).size).toBe(selected.length)
    expect([...selected].sort()).toEqual([...CLAIM_DETAIL_KEYS].sort())
  })

  it('declares each key once', () => {
    expect(new Set(CLAIM_DETAIL_KEYS).size).toBe(CLAIM_DETAIL_KEYS.length)
    expect(CLAIM_DETAIL_KEYS_COMPLETE).toBe(true)
  })

  it('binds the case and the organization as parameters, not as text', () => {
    expect(sql).not.toContain('claim-1')
    expect(sql).not.toContain('9210418f')
  })
})
