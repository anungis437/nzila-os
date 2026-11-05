/**
 * The answer of a scheduled job.
 *
 * A scheduler decides whether a run succeeded from the HTTP status alone (the job runs `curl -f`), so a job that finished with
 * failed organizations or failed sources must not answer 200. Several jobs returned success true with a count of zero, or
 * swallowed a per-organization failure with no log and no count, so a run that did nothing looked like a run that worked.
 * Every job reports through this one function: the counts are always in the body, and any recorded failure makes the status
 * 500 so the run is visibly failed while the work that did succeed is kept.
 */
import { NextResponse } from 'next/server'

export interface JobFailure {
  /** What failed: an organization id, a data source, a task name. Never a person's data. */
  scope: string
  /** A short reason for the log and the body; not a stack trace. */
  reason: string
}

export interface JobOutcome {
  job: string
  /** Units of work the run set out to do (organizations, sources, tasks). */
  attempted: number
  succeeded: number
  failures: readonly JobFailure[]
  details?: Record<string, unknown>
}

export function jobBody(outcome: JobOutcome) {
  const ok = outcome.failures.length === 0
  return {
    success: ok,
    job: outcome.job,
    timestamp: new Date().toISOString(),
    attempted: outcome.attempted,
    succeeded: outcome.succeeded,
    failed: outcome.failures.length,
    ...(ok ? {} : { failures: outcome.failures.slice(0, 50) }),
    ...(outcome.details ?? {}),
  }
}

/** 200 when nothing failed; otherwise 500, with every count and the failures in the body. */
export function jobResponse(outcome: JobOutcome): NextResponse {
  return NextResponse.json(jobBody(outcome), { status: outcome.failures.length === 0 ? 200 : 500 })
}
