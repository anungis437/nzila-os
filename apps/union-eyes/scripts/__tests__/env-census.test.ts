/**
 * The environment census (UE-CONV-H-024).
 *
 * The first part pins what each verdict of the census means, on synthetic inputs, so a change to the judge cannot quietly stop catching what it was written to catch.
 * The second part runs the census over the real tree and holds each kind of finding at or below its ceiling (scripts/lib/env-census/ceiling.ts), which can only fall.
 * The end is zero for everything that is code. What stays above zero is the owner's decision, recorded by name in that file: the keys a deployed environment requires
 * are provisioned after stabilization, and `.env.example` and the startup validator list them after the registry does.
 */
import { describe, expect, it } from 'vitest'
import type { EnvEntry } from '../../lib/config/env-registry'
import { CEILING, DEFERRED_PROVISIONING, overCeiling } from '../lib/env-census/ceiling'
import type { Collected, ReadSite } from '../lib/env-census/collect'
import { generateExample } from '../lib/env-census/example'
import { judge, type JudgeInput } from '../lib/env-census/judge'
import { parseBicep, parseDockerfile, parseWorkflow } from '../lib/env-census/provision'
import { validatorKeys } from '../lib/env-census/validator'
import { runCensus } from '../runtime/env-census'

const site = (file: string, line = 1, via = 'property'): ReadSite => ({ file, line, via })

const entry = (name: string, over: Partial<EnvEntry> = {}): EnvEntry => ({
  name,
  kind: 'config',
  required: 'optional',
  capability: 'development',
  whenMissing: 'default:unset, nothing happens without it',
  provisionedBy: { via: 'not-needed', because: 'a tuning knob with a safe default' },
  group: 'dev',
  description: 'A variable.',
  ...over,
})

function verdicts(registry: EnvEntry[], reads: Record<string, ReadSite[]>, over: Partial<JudgeInput> = {}): string[] {
  const collected: Collected = { files: 0, reads: new Map(Object.entries(reads)), writes: new Map(), unresolved: [], helpers: [], whole: [] }
  const findings = judge({
    registry,
    patterns: [],
    collected,
    checkFiles: new Set(['lib/config/env-validation.ts', 'app/api/ready/route.ts']),
    checkHelpers: new Set(),
    djangoReads: new Set(),
    exampleText: generateExample(registry),
    validatorKeys: new Set(),
    bicep: { env: new Map(), secrets: new Set() },
    workflow: new Set(),
    dockerfile: new Set(),
    fileText: () => null,
    ...over,
  })
  return findings.map((finding) => `${finding.kind}:${finding.name}`).sort()
}

describe('what each verdict of the census means', () => {
  it('is quiet when every variable read is declared and every declaration is read', () => {
    expect(verdicts([entry('KNOB')], { KNOB: [site('lib/a.ts')] })).toEqual([])
  })

  it('finds a variable the code reads that nobody declared, and a declaration nothing reads', () => {
    expect(verdicts([entry('KNOB')], { OTHER: [site('lib/a.ts')] })).toEqual(['STALE:KNOB', 'UNDECLARED:OTHER'])
  })

  it('finds a variable that only a validator or a probe reads: validated, never used', () => {
    expect(verdicts([entry('KNOB')], { KNOB: [site('lib/config/env-validation.ts')] })).toEqual(['CHECK_ONLY:KNOB'])
  })

  it('accepts a variable that configures the check itself, when it names the check file and that file reads it', () => {
    const configures = entry('READY_REQUIRE_X', { configuresCheckIn: 'app/api/ready/route.ts' })
    expect(verdicts([configures], { READY_REQUIRE_X: [site('app/api/ready/route.ts')] })).toEqual([])
  })

  it('refuses configuresCheckIn that names a file which does not read the variable, or a file that is not a check file', () => {
    const wrongFile = entry('READY_REQUIRE_X', { configuresCheckIn: 'app/api/ready/route.ts' })
    expect(verdicts([wrongFile], { READY_REQUIRE_X: [site('lib/config/env-validation.ts')] })).toEqual(['CHECK_ONLY:READY_REQUIRE_X', 'INVALID_ENTRY:READY_REQUIRE_X'])
    const notACheckFile = entry('KNOB', { configuresCheckIn: 'lib/a.ts' })
    expect(verdicts([notACheckFile], { KNOB: [site('lib/a.ts')] })).toEqual(['INVALID_ENTRY:KNOB'])
  })

  it('holds a development hatch to a test that proves a deployed runtime refuses it', () => {
    const hatch = (proof?: string) => entry('HATCH', { required: 'dev-only', provisionedBy: { via: 'not-needed', because: 'development only, refused on any deployed runtime' }, ...(proof ? { productionProof: proof } : {}) })
    const reads = { HATCH: [site('lib/a.ts')] }
    expect(verdicts([hatch()], reads)).toEqual(['PROOF_MISSING:HATCH'])
    expect(verdicts([hatch('lib/proof.test.ts')], reads)).toEqual(['PROOF_MISSING:HATCH'])
    expect(verdicts([hatch('lib/proof.test.ts')], reads, { fileText: () => 'it("refuses it")' })).toEqual(['PROOF_MISSING:HATCH'])
    expect(verdicts([hatch('lib/proof.test.ts')], reads, { fileText: () => 'it("HATCH is refused on a deployed runtime")' })).toEqual([])
  })

  it('finds a variable a deployed environment requires that nothing checked in supplies, and accepts one the workflow supplies', () => {
    const required = entry('SECRET', { kind: 'secret', required: 'production', whenMissing: 'fail-closed', provisionedBy: { via: 'operator', note: 'set by hand on the container' } })
    expect(verdicts([required], { SECRET: [site('lib/a.ts')] })).toEqual(['UNPROVISIONED:SECRET'])
    const supplied = { ...required, provisionedBy: { via: 'workflow' as const } }
    expect(verdicts([supplied], { SECRET: [site('lib/a.ts')] }, { workflow: new Set(['SECRET']) })).toEqual([])
    expect(verdicts([supplied], { SECRET: [site('lib/a.ts')] })).toEqual(['UNPROVISIONED:SECRET', 'UNVERIFIED_PROVISION:SECRET'])
  })

  it('finds what the deployment sets that the registry does not name, and what the startup validator declares that it does not', () => {
    expect(verdicts([entry('KNOB')], { KNOB: [site('lib/a.ts')] }, { workflow: new Set(['NEW_ONE']), validatorKeys: new Set(['KNOB', 'ONLY_CHECKED']), bicep: { env: new Map([['BICEP_ONE', { secret: null }]]), secrets: new Set() } })).toEqual([
      'PROVISIONED_UNKNOWN:BICEP_ONE',
      'PROVISIONED_UNKNOWN:NEW_ONE',
      'VALIDATOR_UNKNOWN:ONLY_CHECKED',
    ])
  })

  it('finds an example file that has drifted from what the registry generates', () => {
    expect(verdicts([entry('KNOB')], { KNOB: [site('lib/a.ts')] }, { exampleText: 'KNOB=\nSTRAY=\n' })).toEqual(['EXAMPLE_DRIFT:STRAY'])
  })
})

describe('the ceilings', () => {
  const report = (counts: Record<string, number>, findings: Array<{ kind: string; name: string }> = []) => ({ counts, findings: findings.map((finding) => ({ ...finding, detail: 'x' })) })

  it('say nothing at or below the ceiling, and name every kind above it', () => {
    expect(overCeiling(report({ UNDECLARED: 0, EXAMPLE_DRIFT: CEILING.EXAMPLE_DRIFT }))).toEqual([])
    const over = overCeiling(report({ UNDECLARED: 1, EXAMPLE_DRIFT: CEILING.EXAMPLE_DRIFT + 1 }, [{ kind: 'UNDECLARED', name: 'NEW_VARIABLE' }]))
    expect(over).toHaveLength(2)
    expect(over[0]).toContain('UNDECLARED: 1 > 0')
    expect(over[0]).toContain('NEW_VARIABLE')
    expect(over[1]).toContain('EXAMPLE_DRIFT')
  })

  it('refuse a key a deployed environment requires that the owner has not deferred by name, even when the count is below the ceiling', () => {
    expect(overCeiling(report({ UNPROVISIONED: 1 }, [{ kind: 'UNPROVISIONED', name: 'NEW_SECRET' }]))).toEqual(['UNPROVISIONED NEW_SECRET: a deployed environment requires it and the owner has not deferred it by name'])
    expect(overCeiling(report({ UNPROVISIONED: 1 }, [{ kind: 'UNPROVISIONED', name: DEFERRED_PROVISIONING[0] }]))).toEqual([])
  })

  it('are zero for everything that is code', () => {
    const deferred = new Set(['EXAMPLE_DRIFT', 'VALIDATOR_UNKNOWN', 'UNVERIFIED_PROVISION', 'UNPROVISIONED'])
    for (const [kind, ceiling] of Object.entries(CEILING)) if (!deferred.has(kind)) expect(ceiling, kind).toBe(0)
  })
})

describe('what the deployment files supply', () => {
  it('reads the application container of the Bicep module, the workflow strings and the Dockerfile lines', () => {
    const bicep = parseBicep(`env: [\n { name: 'DB_POOL_MAX', value: '10' }\n { name: 'AUTH_SECRET', secretRef: 'auth-secret' }\n]\nresource cronJobs\n { name: 'JOB_ONLY', value: '1' }`)
    expect([...bicep.env.keys()].sort()).toEqual(['AUTH_SECRET', 'DB_POOL_MAX'])
    expect(bicep.env.get('AUTH_SECRET')).toEqual({ secret: 'auth-secret' })
    expect([...parseWorkflow('--set-env-vars "READY_REQUIRE_QUEUE=true" --build-arg NEXT_PUBLIC_APP_URL=x')].sort()).toEqual(['NEXT_PUBLIC_APP_URL', 'READY_REQUIRE_QUEUE'])
    expect([...parseDockerfile('ARG BUILD_TIME\nENV NODE_ENV=production\nRUN echo ENV_NOT_THIS')].sort()).toEqual(['BUILD_TIME', 'NODE_ENV'])
  })

  it('reads the keys of the validator schema and nothing else', () => {
    expect(validatorKeys(`const envSchema = z.object({ A: z.string(), 'B_C': z.string().optional() })\nconst other = z.object({ NOT_A_SCHEMA_NAME: z.string() })`)).toEqual(['A', 'B_C'])
  })
})

describe('the environment against its registry', () => {
  it('holds every kind of finding at or below its ceiling, and defers no key a deployed environment requires that is not named', () => {
    const report = runCensus()
    expect(report.files).toBeGreaterThan(1500)
    expect(report.names).toBeGreaterThan(200)
    expect(overCeiling(report)).toEqual([])
  }, 240_000)
})
