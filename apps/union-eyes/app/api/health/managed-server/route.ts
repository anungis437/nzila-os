import { NextResponse } from 'next/server'

/**
 * GET /api/health/managed-server
 *
 * Phase 0C.2 §5 — Managed-server handshake endpoint.
 *
 * Exists ONLY when the process was booted with
 * `NZILA_E2E_MANAGED_SERVER=true`. In every other environment the route
 * returns 404 (as if it did not exist) — this is deliberate: production
 * and staging servers must not advertise any handshake endpoint at all.
 *
 * When present, the endpoint echoes the `NZILA_E2E_RUN_ID` the process
 * was booted with. The governed lifecycle orchestrator
 * (`apps/union-eyes/scripts/lifecycle/run.ts`) calls
 * `verifyManagedServer()` before spawning Playwright and aborts the run
 * if the returned run-ID does not match the expected value. This
 * prevents Playwright from ever attaching to a stale or unrelated dev
 * server (e.g. one left running from a previous run or from an
 * unrelated developer terminal).
 *
 * Response shape (200):
 *   { app, managedServer: true, runId, pid, uptimeSec }
 *
 * Never returns a body containing secrets, DB URLs, cookies, or tokens.
 */
export async function GET(): Promise<NextResponse> {
  const managed = process.env.NZILA_E2E_MANAGED_SERVER === 'true'
  if (!managed) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const runId = process.env.NZILA_E2E_RUN_ID
  if (typeof runId !== 'string' || runId.length === 0) {
    return NextResponse.json(
      {
        error:
          'NZILA_E2E_MANAGED_SERVER=true but NZILA_E2E_RUN_ID is missing — orchestrator misconfiguration',
      },
      { status: 500 },
    )
  }

  return NextResponse.json(
    {
      app: 'union-eyes',
      managedServer: true,
      runId,
      pid: process.pid,
      uptimeSec: process.uptime(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  )
}
