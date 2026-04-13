/**
 * @nzila/mobility-ai — Governance & Checklist Tests
 *
 * Tests AI governance validation, prohibited action checks,
 * auto-approval logic, and document checklist generation.
 */
import { describe, it, expect } from 'vitest'
import {
  validateAiOutput,
  isProhibitedAction,
  canAutoApprove,
  DEFAULT_AI_GOVERNANCE,
} from './governance'
import type { AiGovernancePolicy } from './governance'
import { generateDocumentChecklist, updateChecklistStats } from './checklist'
import type { DocumentChecklist } from './checklist'

// ── AI Governance Tests ─────────────────────────────────────────────────────

describe('AI Governance', () => {
  describe('validateAiOutput', () => {
    it('returns no violations for compliant output', () => {
      const violations = validateAiOutput({
        content: 'Analysis of case eligibility',
        confidenceScore: 0.85,
        reasoningTrace: 'Based on investment threshold...',
        jurisdictionRefs: ['PT'],
      })
      expect(violations).toEqual([])
    })

    it('flags missing reasoning trace', () => {
      const violations = validateAiOutput({
        content: 'Some output',
        confidenceScore: 0.5,
        reasoningTrace: '',
        jurisdictionRefs: [],
      })
      expect(violations).toContainEqual(
        expect.objectContaining({ rule: 'explanation_required' }),
      )
    })

    it('flags out-of-range confidence (negative)', () => {
      const violations = validateAiOutput({
        content: 'Output',
        confidenceScore: -0.1,
        reasoningTrace: 'trace',
        jurisdictionRefs: [],
      })
      expect(violations).toContainEqual(
        expect.objectContaining({ rule: 'confidence_range' }),
      )
    })

    it('flags out-of-range confidence (>1)', () => {
      const violations = validateAiOutput({
        content: 'Output',
        confidenceScore: 1.5,
        reasoningTrace: 'trace',
        jurisdictionRefs: [],
      })
      expect(violations).toContainEqual(
        expect.objectContaining({ rule: 'confidence_range' }),
      )
    })

    it('flags empty content', () => {
      const violations = validateAiOutput({
        content: '',
        confidenceScore: 0.5,
        reasoningTrace: 'trace',
        jurisdictionRefs: [],
      })
      expect(violations).toContainEqual(
        expect.objectContaining({ rule: 'non_empty_content' }),
      )
    })

    it('flags whitespace-only content', () => {
      const violations = validateAiOutput({
        content: '   ',
        confidenceScore: 0.5,
        reasoningTrace: 'trace',
        jurisdictionRefs: [],
      })
      expect(violations).toContainEqual(
        expect.objectContaining({ rule: 'non_empty_content' }),
      )
    })

    it('can report multiple violations', () => {
      const violations = validateAiOutput({
        content: '',
        confidenceScore: -1,
        reasoningTrace: '',
        jurisdictionRefs: [],
      })
      expect(violations.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('isProhibitedAction', () => {
    it('rejects legal_determination', () => {
      expect(isProhibitedAction('legal_determination')).toBe(true)
    })

    it('rejects compliance_override', () => {
      expect(isProhibitedAction('compliance_override')).toBe(true)
    })

    it('rejects document_auto_approve', () => {
      expect(isProhibitedAction('document_auto_approve')).toBe(true)
    })

    it('rejects case_auto_submit', () => {
      expect(isProhibitedAction('case_auto_submit')).toBe(true)
    })

    it('allows regular actions', () => {
      expect(isProhibitedAction('generate_summary')).toBe(false)
      expect(isProhibitedAction('risk_assessment')).toBe(false)
    })

    it('respects custom policy', () => {
      const policy: AiGovernancePolicy = {
        ...DEFAULT_AI_GOVERNANCE,
        prohibitedActions: ['custom_action'],
      }
      expect(isProhibitedAction('custom_action', policy)).toBe(true)
      expect(isProhibitedAction('legal_determination', policy)).toBe(false)
    })
  })

  describe('canAutoApprove', () => {
    it('never auto-approves with default policy', () => {
      expect(canAutoApprove(1.0)).toBe(false)
      expect(canAutoApprove(0.99)).toBe(false)
    })

    it('auto-approves when policy allows and confidence meets threshold', () => {
      const policy: AiGovernancePolicy = {
        ...DEFAULT_AI_GOVERNANCE,
        requireHumanApproval: false,
        maxConfidenceAutoApprove: 0.9,
      }
      expect(canAutoApprove(0.95, policy)).toBe(true)
      expect(canAutoApprove(0.85, policy)).toBe(false)
    })
  })
})

// ── Document Checklist Tests ────────────────────────────────────────────────

describe('Document Checklist', () => {
  describe('generateDocumentChecklist', () => {
    it('creates checklist for primary applicant', () => {
      const cl = generateDocumentChecklist('case-001', 'PT', ['passport', 'bank_statement'])
      expect(cl.caseId).toBe('case-001')
      expect(cl.programCountryCode).toBe('PT')
      expect(cl.items).toHaveLength(2)
      expect(cl.totalRequired).toBe(2)
      expect(cl.completionPercent).toBe(0)
    })

    it('adds dependent documents for spouse', () => {
      const cl = generateDocumentChecklist('case-002', 'GR', ['passport'], [
        { memberId: 'dep-1', relation: 'spouse' },
      ])
      // 1 primary + 4 spouse docs (passport, birth_certificate, marriage_certificate, police_clearance)
      expect(cl.items.length).toBeGreaterThanOrEqual(5)
      const depItems = cl.items.filter((i) => i.target === 'dependent')
      expect(depItems.every((i) => i.memberId === 'dep-1')).toBe(true)
    })

    it('adds dependent documents for child', () => {
      const cl = generateDocumentChecklist('case-003', 'MT', ['passport'], [
        { memberId: 'dep-2', relation: 'child' },
      ])
      const depItems = cl.items.filter((i) => i.target === 'dependent')
      // child needs passport + birth_certificate
      expect(depItems).toHaveLength(2)
    })

    it('handles multiple dependents', () => {
      const cl = generateDocumentChecklist('case-004', 'PT', ['passport'], [
        { memberId: 'dep-1', relation: 'spouse' },
        { memberId: 'dep-2', relation: 'child' },
        { memberId: 'dep-3', relation: 'child' },
      ])
      const depItems = cl.items.filter((i) => i.target === 'dependent')
      expect(depItems.length).toBeGreaterThanOrEqual(8) // 4 spouse + 2 child + 2 child
    })

    it('sets all items to pending status', () => {
      const cl = generateDocumentChecklist('case-005', 'PT', ['passport', 'bank_statement'])
      expect(cl.items.every((i) => i.status === 'pending')).toBe(true)
    })

    it('supports additional dependent relation document rules', () => {
      const cl = generateDocumentChecklist('case-006', 'PT', ['passport'], [
        { memberId: 'dep-parent', relation: 'parent' },
        { memberId: 'dep-sibling', relation: 'sibling' },
      ])

      const parentDocs = cl.items.filter((i) => i.memberId === 'dep-parent')
      const siblingDocs = cl.items.filter((i) => i.memberId === 'dep-sibling')

      expect(parentDocs.some((i) => i.documentType === 'medical_report')).toBe(true)
      expect(siblingDocs.some((i) => i.documentType === 'police_clearance')).toBe(true)
    })
  })

  describe('updateChecklistStats', () => {
    it('calculates uploaded count', () => {
      const cl: DocumentChecklist = {
        caseId: 'case-001',
        programCountryCode: 'PT',
        items: [
          { documentType: 'passport', target: 'primary_applicant', required: true, description: '', status: 'uploaded' },
          { documentType: 'bank_statement', target: 'primary_applicant', required: true, description: '', status: 'pending' },
        ],
        totalRequired: 2,
        uploaded: 0,
        verified: 0,
        completionPercent: 0,
      }
      const updated = updateChecklistStats(cl)
      expect(updated.uploaded).toBe(1)
      expect(updated.completionPercent).toBe(50)
    })

    it('counts verified as uploaded', () => {
      const cl: DocumentChecklist = {
        caseId: 'case-001',
        programCountryCode: 'PT',
        items: [
          { documentType: 'passport', target: 'primary_applicant', required: true, description: '', status: 'verified' },
          { documentType: 'bank_statement', target: 'primary_applicant', required: true, description: '', status: 'verified' },
        ],
        totalRequired: 2,
        uploaded: 0,
        verified: 0,
        completionPercent: 0,
      }
      const updated = updateChecklistStats(cl)
      expect(updated.uploaded).toBe(2)
      expect(updated.verified).toBe(2)
      expect(updated.completionPercent).toBe(100)
    })

    it('returns 0 completion when no required documents exist', () => {
      const cl: DocumentChecklist = {
        caseId: 'case-empty',
        programCountryCode: 'PT',
        items: [
          {
            documentType: 'passport',
            target: 'primary_applicant',
            required: false,
            description: '',
            status: 'pending',
          },
        ],
        totalRequired: 0,
        uploaded: 0,
        verified: 0,
        completionPercent: 99,
      }

      const updated = updateChecklistStats(cl)
      expect(updated.totalRequired).toBe(0)
      expect(updated.completionPercent).toBe(0)
    })
  })
})
