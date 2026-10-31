import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkDocumentLocation } from '@/lib/knowledge-transfer/governance/document-location'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

const ORG = '11111111-1111-4111-8111-111111111111'
const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv
const dev = { NODE_ENV: 'development' } as NodeJS.ProcessEnv
const HOST = 'nzilacanadastore.blob.core.windows.net'

describe('Gate 0 batch B82: document location, cascade wording, per-capita job, education cap, precedent reads', () => {
  describe('interview document location', () => {
    it('accepts an object inside the organization area of the approved host', () => {
      expect(checkDocumentLocation(`https://${HOST}/interviews/${ORG}/x.pdf`, ORG, prod).ok).toBe(true)
    })

    it.each([
      ['another organization area', `https://${HOST}/interviews/22222222-2222-4222-8222-222222222222/x.pdf`],
      ['plain http', `http://${HOST}/interviews/${ORG}/x.pdf`],
      ['a look-alike host', `https://${HOST}.evil.example/${ORG}/x.pdf`],
      ['a subdomain of the approved host', `https://other.${HOST}/${ORG}/x.pdf`],
      ['embedded credentials', `https://u:p@${HOST}/${ORG}/x.pdf`],
      ['a signed query string', `https://${HOST}/${ORG}/x.pdf?sig=abc`],
      ['a fragment', `https://${HOST}/${ORG}/x.pdf#frag`],
      ['localhost in production', `https://localhost/${ORG}/x.pdf`],
      ['a path with no organization segment', `https://${HOST}/x.pdf`],
    ])('refuses %s', (_label, url) => {
      expect(checkDocumentLocation(url, ORG, prod).ok).toBe(false)
    })

    it('allows localhost only outside production, and reads extra approved hosts from the environment', () => {
      expect(checkDocumentLocation(`http://localhost:3000/${ORG}/x.pdf`, ORG, dev).ok).toBe(true)
      expect(checkDocumentLocation(`https://files.example.org/${ORG}/x.pdf`, ORG, { ...prod, UE_DOCUMENT_STORAGE_HOSTS: 'files.example.org' } as NodeJS.ProcessEnv).ok).toBe(true)
    })

    it('is what the attach route calls', () => {
      expect(src('app/api/exit-interviews/[id]/documents/route.ts')).toContain('checkDocumentLocation(body!.fileUrl, organizationId!)')
    })
  })

  it('calls a dependency a dependency: cascade lists only what depends on a compliance node and attaches no fixed advice', () => {
    const analyzer = src('lib/knowledge-transfer/cascade-analysis/cascade-analyzer.ts')
    expect(analyzer).toContain('Depends on a compliance node:')
    expect(analyzer).not.toContain('Regulatory continuity risk:')
    expect(analyzer).not.toContain('Formalize all governance procedures')
  })

  it('does not run the per-capita job: it answers 501, imports no calculator and is no longer scheduled', () => {
    const route = src('app/api/cron/monthly-per-capita/route.ts')
    expect(route).toContain('ApiError.notImplemented')
    expect(route).not.toContain('processMonthlyPerCapita')
    expect(src('lib/operations/scheduled-jobs.json')).not.toContain('monthly-per-capita')
  })

  it('caps each reminder kind in one education run and reports what was left', () => {
    const route = src('app/api/cron/education-reminders/route.ts')
    expect(route).toContain('const MAX_RECIPIENTS_PER_KIND = 300')
    expect(route).toContain('slice(0, MAX_RECIPIENTS_PER_KIND)')
  })

  it('verified: every precedent read filters isPublic and access restrictions in SQL and answers a public projection', () => {
    const service = src('lib/services/precedent-service.ts')
    expect(service.match(/sharedDecisions\(\)/g)!.length).toBeGreaterThanOrEqual(9)
    expect(src('app/api/precedents/route.ts')).toContain('toPublicPrecedentSummary')
    expect(src('app/api/precedents/search/route.ts')).toContain('toPublicPrecedentSummary')
  })
})
