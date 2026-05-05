export type DependencyCheck = {
  name: string
  ok: boolean
  critical?: boolean
  message?: string
}

export type StrictHealthResponse = {
  status: 200 | 503
  body: {
    ok: boolean
    checks: DependencyCheck[]
    timestamp: string
  }
}

export function buildHealthResponse(checks: DependencyCheck[]): StrictHealthResponse {
  const criticalFailures = checks.filter((check) => (check.critical ?? true) && !check.ok)
  const status: 200 | 503 = criticalFailures.length === 0 ? 200 : 503

  return {
    status,
    body: {
      ok: status === 200,
      checks,
      timestamp: new Date().toISOString(),
    },
  }
}
