import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { folder } from './source'

type ReceiptCase = {
  name: string
  status: number
  outcome: 'PASS' | 'FAIL' | 'N/A'
  note?: string
}

type Receipt = {
  id: string
  sourcePath: string
  method: string
  bucket: string
  cases: ReceiptCase[]
}

type Report = {
  bucket: { bucket: string; count: number; reason: string }
  executedRoutes: number
  passCount: number
  failCount: number
  receipts: Receipt[]
  candidateDigest: string
  sourcePlanDigest: string
}

type TriageKind =
  | 'HARNESS_AUTHORIZATION_EXPECTATION_GAP'
  | 'HARNESS_FIXTURE_OR_BODY_GAP'
  | 'HARNESS_ENVIRONMENT_GAP'
  | 'POSSIBLE_SOURCE_DEFECT'

function classifyFailure(bucket: string, receipt: Receipt): { kind: TriageKind; reason: string } {
  const failed = receipt.cases.filter((test) => test.outcome === 'FAIL')
  const statuses = failed.map((test) => test.status)
  if (
    bucket === 'NOT_IMPLEMENTED_501' &&
    statuses.every((status) => status === 401 || status === 403)
  )
    return {
      kind: 'HARNESS_AUTHORIZATION_EXPECTATION_GAP',
      reason:
        '501 route was exercised without route-specific authorized actor or cron secret; auth/role denial preempted the capability body.',
    }
  if (statuses.some((status) => status === 503))
    return {
      kind: 'HARNESS_ENVIRONMENT_GAP',
      reason:
        'Route depends on an unavailable local authority/provider in the generic harness and needs environment fixture expansion.',
    }
  if (statuses.some((status) => status >= 500))
    return {
      kind: 'HARNESS_FIXTURE_OR_BODY_GAP',
      reason:
        'Generic harness reached an internal error; inspect route-specific fixture requirements, path IDs and body derivation before treating as a source defect.',
    }
  return {
    kind: 'POSSIBLE_SOURCE_DEFECT',
    reason:
      'Failure survived authentication and fixture heuristics and needs route-specific source investigation.',
  }
}

export function buildRouteBucketTriage() {
  const reports = readdirSync(folder)
    .filter((name) => /^UE_V2_ROUTE_BUCKET_EXECUTION\..+\.json$/.test(name))
    .map((name) => {
      const report = JSON.parse(readFileSync(path.join(folder, name), 'utf8')) as Report
      const failures = report.receipts
        .filter((receipt) => receipt.cases.some((test) => test.outcome === 'FAIL'))
        .map((receipt) => ({
          id: receipt.id,
          sourcePath: receipt.sourcePath,
          method: receipt.method,
          failingCases: receipt.cases.filter((test) => test.outcome === 'FAIL'),
          ...classifyFailure(report.bucket.bucket, receipt),
        }))
      const counts = failures.reduce<Record<string, number>>((accumulator, failure) => {
        accumulator[failure.kind] = (accumulator[failure.kind] ?? 0) + 1
        return accumulator
      }, {})
      return {
        file: name,
        bucket: report.bucket,
        candidateDigest: report.candidateDigest,
        sourcePlanDigest: report.sourcePlanDigest,
        executedRoutes: report.executedRoutes,
        passCount: report.passCount,
        failCount: report.failCount,
        failureKinds: counts,
        sampleFailures: failures.slice(0, 25),
      }
    })
  const output = { generatedAt: new Date().toISOString(), reports }
  const target = path.join(folder, 'UE_V2_ROUTE_BUCKET_TRIAGE.json')
  writeFileSync(target, JSON.stringify(output, null, 2) + '\n')
  return output
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  process.stdout.write(`${JSON.stringify(buildRouteBucketTriage())}\n`)
