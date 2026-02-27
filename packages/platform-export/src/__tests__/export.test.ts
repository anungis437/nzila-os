import { describe, it, expect } from 'vitest'
import { datasetToCsv } from '../index'

describe('datasetToCsv', () => {
  it('returns empty string for empty array', () => {
    expect(datasetToCsv([])).toBe('')
  })

  it('generates valid CSV with headers', () => {
    const rows = [
      { id: '1', name: 'Alice', score: 95 },
      { id: '2', name: 'Bob', score: 87 },
    ]
    const csv = datasetToCsv(rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('id,name,score')
    expect(lines[1]).toBe('1,Alice,95')
    expect(lines[2]).toBe('2,Bob,87')
  })

  it('escapes commas in values', () => {
    const rows = [{ id: '1', note: 'hello, world' }]
    const csv = datasetToCsv(rows)
    expect(csv).toContain('"hello, world"')
  })

  it('escapes quotes in values', () => {
    const rows = [{ id: '1', note: 'say "hi"' }]
    const csv = datasetToCsv(rows)
    expect(csv).toContain('"say ""hi"""')
  })

  it('handles null values', () => {
    const rows = [{ id: '1', name: null }]
    const csv = datasetToCsv(rows)
    expect(csv).toBe('id,name\n1,')
  })
})
