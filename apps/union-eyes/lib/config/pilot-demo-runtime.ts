const KNOWN_NZILA_MODES = [
  'development',
  'test',
  'staging',
  'internal',
  'pilot',
  'demo',
  'production',
] as const

const DEMO_MUTATION_MODES = ['pilot', 'demo'] as const

type KnownNzilaMode = (typeof KNOWN_NZILA_MODES)[number]
type DemoMutationMode = (typeof DEMO_MUTATION_MODES)[number]

export interface PilotDemoRuntimeValidation {
  runtimeMode: string | null
  normalizedMode: KnownNzilaMode | null
  isKnownMode: boolean
  allowsDemoMutations: boolean
  startupMessage: string
}

export function getPilotDemoRuntimeValidation(): PilotDemoRuntimeValidation {
  const runtimeMode = (process.env.NZILA_MODE ?? '').trim().toLowerCase()
  const normalizedMode = runtimeMode && KNOWN_NZILA_MODES.includes(runtimeMode as KnownNzilaMode)
    ? (runtimeMode as KnownNzilaMode)
    : null

  if (!runtimeMode) {
    return {
      runtimeMode: null,
      normalizedMode: null,
      isKnownMode: false,
      allowsDemoMutations: false,
      startupMessage: 'NZILA_MODE is not set; pilot demo mutation routes will remain fail-closed',
    }
  }

  if (!normalizedMode) {
    return {
      runtimeMode,
      normalizedMode: null,
      isKnownMode: false,
      allowsDemoMutations: false,
      startupMessage: `NZILA_MODE=${runtimeMode} is invalid; expected one of ${KNOWN_NZILA_MODES.join(', ')}`,
    }
  }

  if (!DEMO_MUTATION_MODES.includes(normalizedMode as DemoMutationMode)) {
    return {
      runtimeMode,
      normalizedMode,
      isKnownMode: true,
      allowsDemoMutations: false,
      startupMessage: `NZILA_MODE=${normalizedMode} keeps pilot demo mutation routes disabled`,
    }
  }

  return {
    runtimeMode,
    normalizedMode,
    isKnownMode: true,
    allowsDemoMutations: true,
    startupMessage: `NZILA_MODE=${normalizedMode} enables pilot demo mutation routes`,
  }
}

export function assertPilotDemoMutationRuntime(): DemoMutationMode {
  const validation = getPilotDemoRuntimeValidation()
  if (validation.allowsDemoMutations && validation.normalizedMode) {
    return validation.normalizedMode as DemoMutationMode
  }

  throw new Error('Demo data operations are disabled unless NZILA_MODE is set to pilot or demo')
}