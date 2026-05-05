type HealthSummary = {
  passed?: number
  total?: number
}

type HealthEndpoint = {
  status?: string
}

type HealthArtifact = {
  overallStatus?: string
  summary?: HealthSummary
  endpoints?: HealthEndpoint[]
}

export type RuntimeScore = {
  score: number
  status: 'healthy' | 'degraded' | 'unhealthy'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function deriveSummary(health: HealthArtifact): { passed: number; total: number } {
  if (
    typeof health.summary?.passed === 'number' &&
    typeof health.summary?.total === 'number' &&
    health.summary.total >= 0
  ) {
    return {
      passed: health.summary.passed,
      total: health.summary.total,
    }
  }

  const endpoints = Array.isArray(health.endpoints) ? health.endpoints : []
  if (endpoints.length === 0) {
    return { passed: 0, total: 0 }
  }

  const passed = endpoints.filter((endpoint) => endpoint.status === 'pass').length
  return {
    passed,
    total: endpoints.length,
  }
}

export function computeRuntimeScore(healthInput: unknown): RuntimeScore {
  const health = (healthInput ?? {}) as HealthArtifact

  if (health.overallStatus === 'fail') {
    return {
      score: 0,
      status: 'unhealthy',
    }
  }

  const { passed, total } = deriveSummary(health)
  if (total <= 0) {
    return {
      score: health.overallStatus === 'pass' ? 100 : 0,
      status: health.overallStatus === 'pass' ? 'healthy' : 'degraded',
    }
  }

  const passRate = clamp(passed / total, 0, 1)
  return {
    score: Math.round(passRate * 100),
    status: passRate === 1 ? 'healthy' : 'degraded',
  }
}
