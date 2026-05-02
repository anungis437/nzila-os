export type StrictCoverageInput = {
  score: number
  missingRouteRegistrationsCount: number
  missingRouteFilesCount: number
  criticalWithoutRouteMappingCount: number
  blockWithoutProofCount: number
}

export function evaluateStrictCoverageFailures(input: StrictCoverageInput): string[] {
  const failures: string[] = []

  if (input.missingRouteRegistrationsCount > 0) {
    failures.push('Critical route missing registered decision mapping')
  }

  if (input.missingRouteFilesCount > 0) {
    failures.push('Critical route inventory contains missing files')
  }

  if (input.criticalWithoutRouteMappingCount > 0) {
    failures.push('Registered block-level decision has no critical route mapping')
  }

  if (input.blockWithoutProofCount > 0) {
    failures.push('Block-level decision missing proofRequired=true')
  }

  if (input.score < 95) {
    failures.push(`Decision coverage score below threshold (expected >=95, received ${input.score})`)
  }

  return failures
}
