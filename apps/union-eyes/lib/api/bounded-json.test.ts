import { describe, it, expect } from 'vitest'
import {
  readBoundedJson, assertBoundedJsonComplexity, JsonBodyBudgetError,
  MAX_JSON_BODY_BYTES, MAX_JSON_DEPTH, MAX_JSON_COLLECTION_ITEMS,
} from './bounded-json'

function req(body: string, headers: Record<string, string> = {}) {
  return new Request('https://example.invalid/api', {
    method: 'POST', body, headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('Zod 3 input resource containment', () => {
  it('reads normal JSON', async () => {
    await expect(readBoundedJson(req('{"names":["one","two"]}'))).resolves.toEqual({ names: ['one', 'two'] })
  })
  it('rejects declared over-limit body size', async () => {
    await expect(readBoundedJson(req('{}', { 'content-length': String(MAX_JSON_BODY_BYTES + 1) })))
      .rejects.toBeInstanceOf(JsonBodyBudgetError)
  })
  it('rejects actual byte overage regardless of forged Content-Length', async () => {
    const payload = JSON.stringify({ content: 'x'.repeat(MAX_JSON_BODY_BYTES) })
    await expect(readBoundedJson(req(payload, { 'content-length': '2' })))
      .rejects.toBeInstanceOf(JsonBodyBudgetError)
  })
  it('rejects large arrays before running Zod', () => {
    expect(() => assertBoundedJsonComplexity(Array(MAX_JSON_COLLECTION_ITEMS + 1).fill(null)))
      .toThrow(JsonBodyBudgetError)
  })
  it('rejects deep nesting', () => {
    let value: unknown = 1
    for (let i = 0; i <= MAX_JSON_DEPTH; i++) value = { nested: value }
    expect(() => assertBoundedJsonComplexity(value)).toThrow(JsonBodyBudgetError)
  })
  it('preserves small nested payloads', () => {
    expect(() => assertBoundedJsonComplexity({ a: [1, 2], b: { c: 'ok' } })).not.toThrow()
  })
  it('rejects bad length metadata and unlimited caller budget', async () => {
    await expect(readBoundedJson(req('{}', { 'content-length': 'NaN' })))
      .rejects.toBeInstanceOf(JsonBodyBudgetError)
    await expect(readBoundedJson(req('{}'), Number.MAX_SAFE_INTEGER)).rejects.toThrow(RangeError)
  })
})
