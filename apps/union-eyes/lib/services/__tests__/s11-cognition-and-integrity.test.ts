import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B67: cognition honesty, aggregate guards, audit and sync integrity', () => {
  it('reports the federated benchmark as an unsourced rubric with no percentile or cohort average', () => {
    const engine = src('lib/knowledge-transfer/federated-intelligence/federated-engine.ts')
    expect(engine).toContain('estimatedPercentile: null')
    expect(engine).toContain("referenceStatus: 'UNSOURCED_RUBRIC_NO_POPULATION'")
    expect(engine).not.toContain('scoreAtPercentile: 15')
    expect(engine).not.toContain('COHORT_DIMENSION_AVERAGES')
  })

  it('labels the mitigation projections as assumptions and refuses to rank an empty evaluation', () => {
    const comparator = src('lib/knowledge-transfer/mitigation-comparison/mitigation-comparator.ts')
    expect(comparator).toContain("confidence: 'unvalidated'")
    expect(comparator).toContain("basis: 'ASSUMED_EFFECTIVENESS_NOT_CALIBRATED'")
    expect(comparator).toContain('noNodesEvaluated')
  })

  it('guards both aggregator routes and the model-backed succession route', () => {
    for (const path of ['app/api/exit-interviews/organizational-cognition/route.ts', 'app/api/exit-interviews/organizational-narratives/route.ts']) {
      const route = src(path)
      expect(route, path).toContain('limitAggregateRun')
      expect(route, path).toContain('memoizeAggregateRun')
      expect(route, path).toContain('describeAggregateOutcome')
      expect(route, path).not.toMatch(/failures: result\.failures|engineFailures: result\.failures/)
    }
    expect(src('app/api/exit-interviews/succession/route.ts')).toContain('limitModelRun')
  })

  it('keeps each propagation analysis type to its own section, node view included', () => {
    const route = src('app/api/exit-interviews/propagation/route.ts')
    expect(route).toContain("analysisType === 'upstream' || analysisType === 'coupling' ? [] : propagationMap.downstreamImpacts")
    expect(route).toContain("analysisType === 'downstream' || analysisType === 'upstream' ? undefined : coupling")
  })

  it('records the audit list as log entries, without invented findings, report flags or in-progress status', () => {
    const route = src('app/api/audits/route.ts')
    expect(route).toContain("kind: 'audit_log_entries'")
    expect(route).not.toContain('findings: 0')
    expect(route).not.toContain('hasReport')
    expect(route).not.toContain("'in-progress'")
  })

  it('records an employer communication without sending, stamping or a second audit event', () => {
    const comms = src('app/api/employers/communications/route.ts')
    const contacts = src('app/api/employers/communications/contacts/route.ts')
    expect(comms).not.toContain('emitCapeAuditEvent')
    expect(contacts).not.toContain('emitCapeAuditEvent')
    expect(comms).toContain("delivery: 'recorded_only'")
    expect(comms).not.toContain("senderName: 'System'")
    expect(comms).not.toMatch(/sentAt: data\.status === 'sent' \? new Date\(\)/)
  })

  it('gives the external download link a short life and records it', () => {
    const download = src('app/api/external/documents/[id]/download/route.ts')
    expect(download).toContain('EXTERNAL_DOWNLOAD_LINK_MINUTES = 5')
    expect(download).toContain('generateSasUrl(DOCUMENT_BLOB_CONTAINER, latestVersion.storageKey, EXTERNAL_DOWNLOAD_LINK_MINUTES)')
  })

  it('raises a clause version on a content change and keeps a shared clause from being deleted', () => {
    const route = src('app/api/clause-library/[id]/route.ts')
    expect(route).toContain('updateData.version = (existing.version ?? 1) + 1')
    expect(route).toContain('replacedTextSha256')
    expect(route).toContain("existing.sharingLevel !== 'private'")
  })

  it('does not count a failed Microsoft calendar event as imported or advance the delta link past it', () => {
    const service = src('lib/external-calendar-sync/microsoft-calendar-service.ts')
    expect(service).toContain('failed += 1')
    expect(service).toContain('MicrosoftCalendarImportError')
    expect(service).not.toMatch(/catch \(_error\) \{\n\}/)
    expect(service.indexOf('throw new MicrosoftCalendarImportError')).toBeLessThan(service.indexOf('await updateDeltaLink(connectionId'))
  })

  it('requires an organization administrator to claim an ICRA assessment', () => {
    expect(src('app/api/icra/[assessmentId]/claim/route.ts')).toContain("hasMinRole('admin')")
  })
})
