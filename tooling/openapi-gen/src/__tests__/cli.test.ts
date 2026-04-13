/**
 * @nzila/openapi-gen — CLI entry point tests
 *
 * CLI runs side-effects on import so we test via a single import
 * with default argv, verifying generate() is called and output is printed.
 */
import { describe, it, expect, vi } from 'vitest'
import type { GenerationResult } from '../types'

const mockGenerate = vi.hoisted(() => vi.fn())

vi.mock('../generator.js', () => ({
  generate: mockGenerate,
}))

const fakeResult: GenerationResult = {
  totalRoutes: 5,
  routesWithSchemas: 2,
  apps: [
    { name: 'web', routeCount: 3, specPath: '/out/web.json' },
    { name: 'console', routeCount: 2, specPath: '/out/console.json' },
  ],
  combinedSpecPath: '/out/combined.json',
}

const fakeNoCombined: GenerationResult = {
  ...fakeResult,
  combinedSpecPath: undefined,
}

describe('cli', () => {
  it('calls generate with correct config and prints output', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    mockGenerate.mockReturnValue(fakeResult)

    // cli.ts runs at import time; default process.argv has no flags
    await import('../cli.js')

    // Verify generate() was called with correct defaults
    expect(mockGenerate).toHaveBeenCalledOnce()
    const config = mockGenerate.mock.calls[0][0]
    expect(config.rootDir).toBeDefined()
    expect(config.outputDir).toBeDefined()
    expect(config.format).toBe('json')
    expect(config.apps).toBeUndefined()
    expect(config.combined).toBe(true)

    // Verify CLI output
    const output = logSpy.mock.calls.map(c => c[0]).join('\n')
    expect(output).toContain('@nzila/openapi-gen')
    expect(output).toContain('Routes discovered: 5')
    expect(output).toContain('With Zod schemas:  2')
    expect(output).toContain('web')
    expect(output).toContain('3 routes')
    expect(output).toContain('console')
    expect(output).toContain('Combined spec')

    logSpy.mockRestore()
  })
})
