import { describe, expect, it } from 'vitest'
import { ROOT, readContent, relPath, walkSync } from './governance-helpers'

describe('Generated/runtime separation', () => {
  it('does not import generated artifacts into runtime business logic', () => {
    const runtimeFiles = [
      ...walkSync(`${ROOT}/apps`, ['.ts', '.tsx', '.js', '.jsx', '.mjs']),
      ...walkSync(`${ROOT}/packages`, ['.ts', '.tsx', '.js', '.jsx', '.mjs']),
    ]
      .filter((filePath) => !/[\\/]generated[\\/]/.test(filePath))
      .filter((filePath) => !/\.test\./.test(filePath))

    const violations = runtimeFiles
      .filter((filePath) => {
        const source = readContent(filePath)
        return /from\s+['"][^'"]*generated[^'"]*['"]|import\(['"][^'"]*generated[^'"]*['"]\)/.test(source)
      })
      .map((filePath) => relPath(filePath))

    expect(violations).toEqual([])
  })
})
