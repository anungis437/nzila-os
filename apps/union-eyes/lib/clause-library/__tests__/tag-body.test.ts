import { describe, expect, it } from 'vitest'
import { parseClauseTagBody } from '../tag-body'

const validId = '00000000-0000-4000-8000-000000000001'

describe('Gate 0 clause tag input validation', () => {
  it('normalizes the legacy alias and trims names within the database limit', () => {
    expect(parseClauseTagBody({ tag: '  wages  ' }, 'add')).toEqual({ tagName: 'wages' })
    expect(parseClauseTagBody({ tagName: 'x'.repeat(100) }, 'add')).toEqual({ tagName: 'x'.repeat(100) })
    expect(parseClauseTagBody({ tagId: validId }, 'remove')).toEqual({ tagId: validId })
    expect(parseClauseTagBody({ tagName: ' benefits ' }, 'remove')).toEqual({ tagName: 'benefits' })
  })

  it.each([
    null, [], 'wages', 7, {},
    { tagName: 9 }, { tagName: '' }, { tagName: ' '.repeat(4) },
    { tagName: 'x'.repeat(101) }, { tagName: 'ok', createdBy: 'attacker' },
    { tagName: 'one', tag: 'two' }, { tagName: { trim: 'fake' } },
  ])('rejects malformed add payload %j before a database write', (body) => {
    expect(() => parseClauseTagBody(body, 'add')).toThrow()
  })

  it.each([
    null, {}, [], { tagId: 'not-a-uuid' }, { tagName: 'x'.repeat(101) },
    { tagId: validId, tagName: 'wages' }, { tag: 'one', tagName: 'two' },
    { tagName: true }, { tagName: 'ok', clauseId: validId },
  ])('rejects malformed remove payload %j before a database write', (body) => {
    expect(() => parseClauseTagBody(body, 'remove')).toThrow()
  })
})
