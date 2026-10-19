import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const appRoot = path.resolve(__dirname, '..', '..', '..')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.next', 'dist', '__tests__'].includes(entry.name)) return []
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(file)
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\.[jt]sx?$/.test(entry.name)) return []
    return [file]
  })
}

describe('member employment query callers', () => {
  it('is imported only by the employment action module', () => {
    const callers = sourceFiles(appRoot)
      .filter((file) => !file.endsWith(`${path.sep}db${path.sep}queries${path.sep}member-employment-queries.ts`))
      .filter((file) => /from\s+['"][^'"]*member-employment-queries['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(appRoot, file).split(path.sep).join('/'))
      .sort()
    expect(callers).toEqual(['actions/member-employment-actions.ts'])
  })
})
