import { describe, it, expect, beforeEach } from 'vitest'
import { classifyIntent, parseQuery, buildQueryResult, executeQuery, getQueryLog, clearQueryLog } from '../src/queryEngine'
import { createEvidenceRef, validateEvidenceBacking } from '../src/evidenceBacked'
import { naturalLanguageQuerySchema, evidenceReferenceSchema, queryResultSchema } from '../src/types'
import * as queryIndex from '../src'

describe('platform-ai-query', () => {
  beforeEach(() => {
    clearQueryLog()
  })

  describe('queryEngine', () => {
    it('classifies status intent', () => {
      expect(classifyIntent('What is the health status of shop-quoter?')).toBe('status')
    })

    it('classifies comparison intent', () => {
      expect(classifyIntent('Compare revenue between Q3 and Q4')).toBe('comparison')
    })

    it('classifies anomaly intent', () => {
      expect(classifyIntent('Are there any unusual spikes in error rates?')).toBe('anomaly')
    })

    it('classifies trend intent for increase/decrease queries', () => {
      expect(classifyIntent('Why did grievances increase last month?')).toBe('trend')
    })

    it('classifies anomaly intent for risk queries', () => {
      expect(classifyIntent('Which employers are highest risk?')).toBe('anomaly')
    })

    it('classifies trend intent for change queries', () => {
      expect(classifyIntent('What changed in quote volume this week?')).toBe('trend')
    })

    it('classifies compliance intent', () => {
      expect(classifyIntent('What governance issues are currently open?')).toBe('compliance')
    })

    it('classifies anomaly for partner underperformance', () => {
      expect(classifyIntent('Which partners are highest risk?')).toBe('anomaly')
    })

    it('returns unknown for unclassifiable queries', () => {
      expect(classifyIntent('Hello world')).toBe('unknown')
    })

    it('parses query with unique ID', () => {
      const q = parseQuery({ query: 'Test', orgId: 'org-1', actor: 'admin' })
      expect(q.id).toBeTruthy()
      expect(q.query).toBe('Test')
    })

    it('parseQuery throws on empty orgId', () => {
      expect(() => parseQuery({ query: 'Test', orgId: '', actor: 'admin' })).toThrow('orgId is required')
    })

    it('builds query result', () => {
      const result = buildQueryResult({
        queryId: '123',
        answer: 'All systems operational',
        confidence: 0.95,
        evidenceRefs: [],
      })
      expect(result.id).toBeTruthy()
      expect(result.answer).toBe('All systems operational')
    })

    it('executeQuery logs query with output hash', () => {
      const result = executeQuery({
        query: 'Why did grievances increase last month?',
        orgId: 'org-1',
        actor: 'analyst',
      })
      expect(result.answer).toBeTruthy()
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.evidenceRefs.length).toBeGreaterThan(0)

      const log = getQueryLog()
      expect(log.length).toBeGreaterThan(0)
      expect(log[log.length - 1].outputHash).toBeTruthy()
      expect(log[log.length - 1].orgId).toBe('org-1')
    })

    it('executeQuery requires org scope', () => {
      expect(() =>
        executeQuery({ query: 'test', orgId: '', actor: 'x' }),
      ).toThrow('orgId is required')
    })

    it('covers remaining answer branches deterministically', () => {
      const governanceStatus = executeQuery({
        query: 'What is the governance status right now?',
        orgId: 'org-1',
        actor: 'auditor',
      })
      expect(governanceStatus.answer).toContain('Governance status')

      const genericStatus = executeQuery({
        query: 'What is the status of console?',
        orgId: 'org-1',
        actor: 'operator',
      })
      expect(genericStatus.answer).toContain('System status')

      const comparison = executeQuery({
        query: 'Compare churn versus retention',
        orgId: 'org-1',
        actor: 'analyst',
      })
      expect(comparison.answer).toContain('Comparison analysis completed')

      const trendGeneric = executeQuery({
        query: 'Show trend over time for quote volume',
        orgId: 'org-1',
        actor: 'analyst',
      })
      expect(trendGeneric.answer).toContain('Trend analysis completed')

      const compliance = executeQuery({
        query: 'Show compliance policy posture',
        orgId: 'org-1',
        actor: 'auditor',
      })
      expect(compliance.answer).toContain('Compliance status')

      const anomalyRisk = executeQuery({
        query: 'Which employer has the highest risk score?',
        orgId: 'org-1',
        actor: 'analyst',
      })
      expect(anomalyRisk.answer).toContain('Employer risk assessment')

      const anomalyGeneric = executeQuery({
        query: 'Find unusual spikes in traffic',
        orgId: 'org-1',
        actor: 'analyst',
      })
      expect(anomalyGeneric.answer).toContain('Anomaly analysis completed')

      const unknown = executeQuery({
        query: 'Bonjour planet',
        orgId: 'org-1',
        actor: 'analyst',
      })
      expect(unknown.answer).toContain('Query could not be fully resolved')
      expect(unknown.confidence).toBe(0.3)
    })
  })

  describe('evidenceBacked', () => {
    it('validates evidence with sufficient coverage', () => {
      const refs = [
        createEvidenceRef({ source: 'a', type: 'event', id: '1', summary: 's' }),
        createEvidenceRef({ source: 'b', type: 'metric', id: '2', summary: 's' }),
      ]
      const result = validateEvidenceBacking(refs)
      expect(result.valid).toBe(true)
      expect(result.coverage).toBe(0.5)
    })

    it('invalidates evidence with insufficient coverage', () => {
      const refs = [
        createEvidenceRef({ source: 'a', type: 'event', id: '1', summary: 's' }),
      ]
      const result = validateEvidenceBacking(refs)
      expect(result.valid).toBe(false)
      expect(result.coverage).toBe(0.25)
    })

    it('handles empty evidence', () => {
      const result = validateEvidenceBacking([])
      expect(result.valid).toBe(false)
      expect(result.coverage).toBe(0)
    })
  })

  describe('types and barrel exports', () => {
    it('validates schema contracts', () => {
      const evidence = evidenceReferenceSchema.parse({
        source: 'platform-events',
        type: 'event',
        id: 'evt-1',
        summary: 'Evidence summary',
      })

      const parsedQuery = naturalLanguageQuerySchema.parse({
        id: crypto.randomUUID(),
        query: 'How is system health?',
        orgId: 'org-1',
        actor: 'admin',
        timestamp: new Date().toISOString(),
        context: { region: 'ca' },
      })

      const parsedResult = queryResultSchema.parse({
        id: crypto.randomUUID(),
        queryId: crypto.randomUUID(),
        answer: 'Healthy',
        confidence: 0.88,
        evidenceRefs: [evidence],
        timestamp: new Date().toISOString(),
      })

      expect(parsedQuery.orgId).toBe('org-1')
      expect(parsedResult.evidenceRefs).toHaveLength(1)
    })

    it('exposes query helpers from index barrel', () => {
      expect(queryIndex.classifyIntent('status please')).toBe('status')
      expect(typeof queryIndex.validateEvidenceBacking).toBe('function')
      expect(typeof queryIndex.executeQuery).toBe('function')
    })
  })
})
