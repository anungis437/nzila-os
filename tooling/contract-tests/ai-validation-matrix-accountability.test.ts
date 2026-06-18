import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const INVENTORY_PATH = resolve(ROOT, 'governance/ai/inventory.json')
const MATRIX_PATH = resolve(ROOT, 'governance/ai/AI_VALIDATION_MATRIX.md')

describe('AI validation matrix accountability', () => {
  it('matrix file exists', () => {
    expect(existsSync(MATRIX_PATH)).toBe(true)
  })

  const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf-8')) as {
    surfaces: Array<{ id: string }>
  }
  const matrix = readFileSync(MATRIX_PATH, 'utf-8')

  it('includes every inventory surface id', () => {
    const missing = inventory.surfaces
      .map((s) => s.id)
      .filter((id) => !matrix.includes(`| ${id} |`))

    expect(
      missing,
      `Matrix missing inventory surface rows: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('marks every inventory surface as accounted', () => {
    const invalidRows = inventory.surfaces
      .map((s) => s.id)
      .filter((id) => {
        const rowRegex = new RegExp(
          `\\|\\s${id}\\s\\|[\\s\\S]*?\\|\\s(ACCOUNTED|ACCOUNTED-ATTENTION|ACCOUNTED-DESIGN)\\s\\|`,
        )
        return !rowRegex.test(matrix)
      })

    expect(
      invalidRows,
      `Rows missing accountability status: ${invalidRows.join(', ')}`,
    ).toEqual([])
  })
})
