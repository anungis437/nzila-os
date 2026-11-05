import { describe, expect, it } from 'vitest'
import { bind } from '../store/route-adapter'

describe('route adapter array binding', () => {
  it('passes a scalar through untouched', () => {
    expect(bind('x')).toBe('x')
    expect(bind(3)).toBe(3)
  })

  it('writes an array as one Postgres array literal', () => {
    expect(bind(['a', 'b'])).toBe('{"a","b"}')
    expect(bind([])).toBe('{}')
    expect(bind(['a', null])).toBe('{"a",NULL}')
  })

  it('escapes the quote and backslash that would otherwise end an element or the literal', () => {
    expect(bind(['say "hi"'])).toBe('{"say \\"hi\\""}')
    expect(bind(['back\\slash'])).toBe('{"back\\\\slash"}')
    expect(bind(['a","b'])).toBe('{"a\\",\\"b"}')
  })
})
