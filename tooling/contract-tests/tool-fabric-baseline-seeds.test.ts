import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { writeDiagnostic } from '../../packages/os-core/src/telemetry/diagnostic'

describe.each(['cfo', 'console', 'control-plane', 'partners', 'web', 'weekone'])('N16 %s seed compatibility', (app) => {
  function load(argv: string[], failLogger = false) {
    const info = vi.fn(() => { if (failLogger) throw new Error('sink unavailable') })
    const error = vi.fn()
    const source = readFileSync(resolve(__dirname, `../../apps/${app}/lib/demoSeed.ts`), 'utf8')
    const exports: Record<string, (...args: unknown[]) => unknown> = {}
    const process = { argv, exit: vi.fn() }
    runInNewContext(ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText, {
      exports, process,
      require: (id: string) => {
        if (id !== '@nzila/os-core/telemetry') throw new Error(`Unexpected runtime dependency ${id}`)
        return { createLogger: () => ({ info, error }), writeDiagnostic }
      },
    })
    return { exports, info, process }
  }
  it('keeps runtime fixture imports side-effect free and seed exports/results available', async () => {
    const loaded = load(['node', 'application.ts'])
    expect(loaded.info).not.toHaveBeenCalled()
    const seed = loaded.exports[app === 'weekone' ? 'seedWeekOneDemo' : 'seedDemo']
    expect(seed).toBeTypeOf('function')
    const result = await seed()
    expect(result).toBeTypeOf('object')
    expect(Object.keys(result as object).length).toBeGreaterThan(0)
    expect(loaded.info.mock.calls[0][0]).toContain('[demo:seed]')
    expect(loaded.process.exit).not.toHaveBeenCalled()
  })
  it('retains direct demoSeed entry invocation and catches diagnostic failure independently', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    try {
      const loaded = load(['node', 'demoSeed.ts'], true)
      await Promise.resolve()
      expect(loaded.info).toHaveBeenCalled()
      expect(stderr).toHaveBeenCalled()
      expect(loaded.process.exit).not.toHaveBeenCalled()
      expect(await loaded.exports[app === 'weekone' ? 'seedWeekOneDemo' : 'seedDemo']()).toBeTypeOf('object')
    } finally {
      stderr.mockRestore()
    }
  })
})
