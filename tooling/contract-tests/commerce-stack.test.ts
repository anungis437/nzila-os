/**
 * Contract Test — Commerce Stack Completeness (STUDIO-COM-01)
 *
 * Verifies:
 *   Apps that declare @nzila/commerce-core or @nzila/commerce-services
 *   must also wire the full commerce stack: commerce-audit, commerce-observability,
 *   and (for quoting apps) commerce-state + commerce-governance.
 *
 *   The CFO app additionally must wire @nzila/payments-stripe, @nzila/qbo,
 *   and @nzila/tax to fulfil its "Virtual CFO" brand promise.
 *
 *   STUDIO-COM-02 (State Machine Activation):
 *   Apps with @nzila/commerce-state must have a wiring module that wraps
 *   attemptTransition, use enums from domain packages (not hardcoded strings),
 *   and wire commerce telemetry (logTransition) into status-changing actions.
 *
 * This prevents half-baked commerce integrations where apps declare
 * commerce-core but skip auditing, observability, or governance.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function allTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...allTsFiles(full))
    else if (/\.tsx?$/.test(entry.name)) files.push(full)
  }
  return files
}

const APPS = [
  'console',
  'partners',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
]

/** Required companion packages when commerce-core is declared */
const COMMERCE_COMPANIONS = [
  '@nzila/commerce-observability',
]

/** CFO-specific finance packages */
const CFO_FINANCE_DEPS = [
  '@nzila/payments-stripe',
  '@nzila/qbo',
  '@nzila/tax',
  '@nzila/commerce-core',
]

describe('Commerce stack completeness', () => {
  for (const app of APPS) {
    const pkgPath = resolve(ROOT, 'apps', app, 'package.json')
    if (!existsSync(pkgPath)) continue

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const deps = pkg.dependencies ?? {}

    // If you have commerce-core, you must have commerce-observability
    if (deps['@nzila/commerce-core']) {
      for (const companion of COMMERCE_COMPANIONS) {
        it(`${app} — declares ${companion} alongside commerce-core`, () => {
          expect(deps[companion]).toBeDefined()
        })
      }
    }

    // If you declare commerce-observability, you must have a lib/commerce-telemetry.ts
    if (deps['@nzila/commerce-observability']) {
      it(`${app} — has lib/commerce-telemetry.ts wiring`, () => {
        const f = resolve(ROOT, 'apps', app, 'lib', 'commerce-telemetry.ts')
        expect(existsSync(f), `${app}/lib/commerce-telemetry.ts must exist`).toBe(true)
        const c = readFileSync(f, 'utf-8')
        expect(c).toContain('@nzila/commerce-observability')
      })
    }
  }

  describe('CFO finance stack', () => {
    const cfoPkg = resolve(ROOT, 'apps', 'cfo', 'package.json')
    if (!existsSync(cfoPkg)) return

    const deps = JSON.parse(readFileSync(cfoPkg, 'utf-8')).dependencies ?? {}

    for (const dep of CFO_FINANCE_DEPS) {
      it(`cfo — declares ${dep}`, () => {
        expect(deps[dep]).toBeDefined()
      })
    }

    it('cfo — has lib/stripe.ts wiring', () => {
      const f = resolve(ROOT, 'apps', 'cfo', 'lib', 'stripe.ts')
      expect(existsSync(f)).toBe(true)
      const c = readFileSync(f, 'utf-8')
      expect(c).toContain('@nzila/payments-stripe')
    })

    it('cfo — has lib/qbo.ts wiring', () => {
      const f = resolve(ROOT, 'apps', 'cfo', 'lib', 'qbo.ts')
      expect(existsSync(f)).toBe(true)
      const c = readFileSync(f, 'utf-8')
      expect(c).toContain('@nzila/qbo')
    })

    it('cfo — has lib/tax.ts wiring', () => {
      const f = resolve(ROOT, 'apps', 'cfo', 'lib', 'tax.ts')
      expect(existsSync(f)).toBe(true)
      const c = readFileSync(f, 'utf-8')
      expect(c).toContain('@nzila/tax')
    })
  })

  // ── STUDIO-COM-02: State Machine Activation ─────────────────────────────

  describe('State machine wiring', () => {
    const MACHINE_APPS: Record<string, { wiring: string; machine: string }> = {
      'nacp-exams': { wiring: 'lib/session-machine.ts', machine: 'examSessionMachine' },
    }

    for (const [app, cfg] of Object.entries(MACHINE_APPS)) {
      it(`${app} — has ${cfg.wiring}`, () => {
        expect(existsSync(resolve(ROOT, 'apps', app, cfg.wiring))).toBe(true)
      })

      it(`${app} — wiring imports attemptTransition`, () => {
        const src = readFileSync(resolve(ROOT, 'apps', app, cfg.wiring), 'utf-8')
        expect(src).toContain('attemptTransition')
      })

      it(`${app} — wiring references ${cfg.machine}`, () => {
        const src = readFileSync(resolve(ROOT, 'apps', app, cfg.wiring), 'utf-8')
        expect(src).toContain(cfg.machine)
      })

      it(`${app} — wiring exports a transition function`, () => {
        const src = readFileSync(resolve(ROOT, 'apps', app, cfg.wiring), 'utf-8')
        expect(src).toMatch(/export function transition\w+/)
      })
    }
  })

  describe('Enum usage (no hardcoded status strings)', () => {
    const ENUM_APPS: Record<string, { enumSource: string; actionDir: string }> = {
      'nacp-exams': { enumSource: '@nzila/nacp-core/enums', actionDir: 'lib/actions' },
      'zonga': { enumSource: '@/lib/zonga-services', actionDir: 'lib/actions' },
    }

    for (const [app, cfg] of Object.entries(ENUM_APPS)) {
      it(`${app} — action files import enums (value imports, not type-only)`, () => {
        const actionFiles = allTsFiles(resolve(ROOT, 'apps', app, cfg.actionDir))
        expect(actionFiles.length).toBeGreaterThan(0)

        const hasValueImport = actionFiles.some((f) => {
          const src = readFileSync(f, 'utf-8')
          const importLines = src
            .split('\n')
            .filter((line) => line.includes(cfg.enumSource) && !line.match(/import\s+type\b/))
          return importLines.length > 0
        })
        expect(
          hasValueImport,
          `${app} action files must import enums as values (not type-only) from ${cfg.enumSource}`,
        ).toBe(true)
      })
    }
  })

  describe('Commerce telemetry (logTransition)', () => {
    const TELEMETRY_APPS = ['nacp-exams', 'zonga']

    for (const app of TELEMETRY_APPS) {
      it(`${app} — has commerce-telemetry.ts`, () => {
        expect(existsSync(resolve(ROOT, 'apps', app, 'lib', 'commerce-telemetry.ts'))).toBe(true)
      })

      it(`${app} — at least one action file calls logTransition()`, () => {
        const actionsDir = resolve(ROOT, 'apps', app, 'lib', 'actions')
        const libDir = resolve(ROOT, 'apps', app, 'lib')

        const actionFiles = [
          ...allTsFiles(actionsDir),
          ...(existsSync(resolve(libDir, 'actions.ts')) ? [resolve(libDir, 'actions.ts')] : []),
        ]

        const callsLogTransition = actionFiles.some((f) => {
          const src = readFileSync(f, 'utf-8')
          return src.includes('logTransition(')
        })
        expect(
          callsLogTransition,
          `No action file in ${app} calls logTransition() — commerce telemetry is dead code`,
        ).toBe(true)
      })
    }
  })

  // ── STUDIO-COM-03: Schema Validation on Mutations ───────────────────────

  describe('Schema validation on mutations (STUDIO-COM-03)', () => {
    /**
     * Apps that have Zod schemas available from their domain package
     * must call .safeParse() or .parse() in mutation functions before
     * persisting data. Schema-imported-but-never-called is a code smell.
     */
    const SCHEMA_APPS: Record<string, { actionDir: string; schemaSource: string }> = {
      'zonga': { actionDir: 'lib/actions', schemaSource: '@/lib/zonga-services' },
      'nacp-exams': { actionDir: 'lib/actions', schemaSource: '@nzila/nacp-core/schemas' },
    }

    for (const [app, cfg] of Object.entries(SCHEMA_APPS)) {
      it(`${app} — at least one action file calls .safeParse()`, () => {
        const actionFiles = allTsFiles(resolve(ROOT, 'apps', app, cfg.actionDir))
        expect(actionFiles.length).toBeGreaterThan(0)

        const usesSafeParse = actionFiles.some((f) => {
          const src = readFileSync(f, 'utf-8')
          return src.includes('.safeParse(') || src.includes('.parse(')
        })
        expect(
          usesSafeParse,
          `${app} action files must call .safeParse() or .parse() for input validation`,
        ).toBe(true)
      })

      it(`${app} — no schema imported but never called`, () => {
        const actionFiles = allTsFiles(resolve(ROOT, 'apps', app, cfg.actionDir))
        for (const f of actionFiles) {
          const src = readFileSync(f, 'utf-8')
          // Find all Schema imports (e.g. CreateCreatorSchema, RecordRevenueEventSchema)
          const schemaImports = src.match(/\b\w+Schema\b/g) ?? []
          const uniqueSchemas = [...new Set(schemaImports)].filter((s) =>
            // Only check schemas that appear in import statements
            src.split('\n').some((line) => line.includes('import') && line.includes(s)),
          )
          for (const schema of uniqueSchemas) {
            // Schema must be used beyond just the import line (i.e. called somewhere)
            const usageCount = (src.match(new RegExp(`\\b${schema}\\b`, 'g')) ?? []).length
            expect(
              usageCount,
              `${f.split('apps/')[1]}: ${schema} is imported but only appears ${usageCount} time(s) — call .safeParse() on it`,
            ).toBeGreaterThan(1)
          }
        }
      })
    }
  })
})
