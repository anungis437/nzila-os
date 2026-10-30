import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import scheduled from './scheduled-jobs.json'
import { CRON_API_ROUTES } from '../public-routes'

// Gate 0 F01a (DEF-0B6-SYS-CRON-GET-ALIASES-RUN-STATE-CHANGES, -CRON-ROUTES-HAVE-NO-SCHEDULER-IN-REPOSITORY,
// -CALENDAR-SYNC-SCHEDULE-ENTRY-DOES-NOT-MATCH-ROUTE-CONTRACT, -LOCATION-RETENTION-HAS-NO-SCHEDULER-IN-REPOSITORY,
// -CRON-EDGE-SECRET-CHECK-DIFFERS-FROM-ROUTE-CHECK). The manifest is the one place a scheduled route is declared.
const APP = path.resolve(__dirname, '../..')
const API = path.join(APP, 'app/api')
const BICEP = path.resolve(APP, '../../infrastructure/bicep/ue-v2/modules/apps.bicep')
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) routeFiles(full, out)
    else if (name === 'route.ts') out.push(full)
  }
  return out
}
const methodsOf = (source: string) =>
  METHODS.filter((m) => new RegExp(`export\\s+(?:async\\s+function|const|let|function)\\s+${m}\\b`).test(source)
    || new RegExp(`export\\s*\\{[^}]*\\b(?:as\\s+)?${m}\\b[^}]*\\}`).test(source))
const routeOf = (urlPath: string) => path.join(API, urlPath.split('?')[0].replace(/^\/api\//, ''), 'route.ts')

describe('scheduled jobs manifest', () => {
  const jobs = scheduled.jobs

  it('declares each job once, with a short unique code, a five-field schedule and a bounded timeout', () => {
    expect(new Set(jobs.map((j) => j.code)).size).toBe(jobs.length)
    expect(new Set(jobs.map((j) => j.path.split('?')[0])).size).toBe(jobs.length)
    for (const job of jobs) {
      expect(job.code, job.path).toMatch(/^[a-z]{2,6}$/) // a Container Apps job name is limited to 32 characters
      expect(job.schedule.trim().split(/\s+/), job.path).toHaveLength(5)
      expect(job.timeoutSeconds, job.path).toBeGreaterThan(0)
      expect(job.timeoutSeconds, job.path).toBeLessThanOrEqual(900)
    }
  })

  it('names only routes that exist and answer POST alone, so a GET can never run a job', () => {
    for (const job of jobs) {
      const file = routeOf(job.path)
      expect(existsSync(file), `${job.path} has no route file`).toBe(true)
      expect(methodsOf(readFileSync(file, 'utf8')), job.path).toEqual(['POST'])
    }
  })

  it('covers every route that authenticates with the cron secret', () => {
    const declared = new Set(jobs.map((j) => path.normalize(routeOf(j.path))))
    // Routes that take the cron secret as one of several credentials, or hold no job of their own, are named here with the reason.
    const NOT_JOBS: Record<string, string> = {
      'icra/report/[assessmentId]/review': 'a review decision, not a scheduled job (its authorization is a separate defect family)',
    }
    const undeclared = routeFiles(API).filter((file) => {
      const source = readFileSync(file, 'utf8')
      const cron = /auth:\s*\{[^}]*\bcron:\s*true/.test(source) || /cronSecretMatches\(/.test(source)
      const rel = path.relative(API, path.dirname(file)).replace(/\\/g, '/')
      return cron && !declared.has(path.normalize(file)) && !(rel in NOT_JOBS)
    })
    expect(undeclared.map((f) => path.relative(API, f))).toEqual([])
  })

  it('makes the edge check cover exactly the scheduled paths', () => {
    expect([...CRON_API_ROUTES].sort()).toEqual(jobs.map((j) => j.path.split('?')[0]).sort())
  })

  it('is what the infrastructure schedules: bicep reads this manifest and posts with the cron secret, failing the run on a non-2xx answer', () => {
    const bicep = readFileSync(BICEP, 'utf8')
    expect(bicep).toContain("loadJsonContent('../../../../apps/union-eyes/lib/operations/scheduled-jobs.json')")
    expect(bicep).toMatch(/curl -fsS -X POST[^\n]*x-cron-secret: \$CRON_SECRET/)
    expect(bicep).not.toMatch(/cronSchedule/)
  })

  it('leaves no second scheduler behind: vercel.json declares no cron entry', () => {
    const vercel = JSON.parse(readFileSync(path.join(APP, 'vercel.json'), 'utf8')) as { crons?: unknown }
    expect(vercel.crons).toBeUndefined()
  })
})
