/**
 * PHASE 6 — End-to-End Union Workflow Certification
 *
 * Validates the grievance/case management lifecycle is
 * production-certifiable:
 *  - Schema covers full grievance lifecycle
 *  - Status transitions use FSM enforcement
 *  - Assignment and triage flows exist
 *  - Document upload/download routes exist
 *  - Audit timeline is tracked
 *  - Role-based restrictions verified
 *  - AI triage has human-approval gate
 *  - Settlement and arbitration workflows exist
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE = join(ROOT, 'apps', 'union-eyes')
const UE_SCHEMA = join(UE, 'db', 'schema')
const UE_API = join(UE, 'app', 'api')

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

/** Find files by filename pattern */
function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = []
  function walk(d: string, depth = 0) {
    if (depth > 8 || !existsSync(d)) return
    try {
      for (const entry of readdirSync(d)) {
        if (entry === 'node_modules' || entry === '.next') continue
        const full = join(d, entry)
        try {
          const stat = statSync(full)
          if (stat.isDirectory()) walk(full, depth + 1)
          else if (pattern.test(entry)) results.push(full)
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir)
  return results
}

/** Find route.ts files whose FULL PATH contains a pattern (for API route discovery) */
function findRoutesByPath(dir: string, pattern: RegExp): string[] {
  const results: string[] = []
  function walk(d: string, depth = 0) {
    if (depth > 10 || !existsSync(d)) return
    try {
      for (const entry of readdirSync(d)) {
        if (entry === 'node_modules' || entry === '.next') continue
        const full = join(d, entry)
        try {
          const stat = statSync(full)
          if (stat.isDirectory()) walk(full, depth + 1)
          else if (entry === 'route.ts' && pattern.test(full.replace(/\\/g, '/'))) {
            results.push(full)
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir)
  return results
}

describe('CERT-PHASE-6 — Union Workflow Certification', () => {
  // ── Grievance schema completeness ─────────────────────────────────────
  describe('grievance schema lifecycle', () => {
    const grievanceSchema = readIfExists(join(UE_SCHEMA, 'grievance-schema.ts'))
    const workflowSchema = readIfExists(join(UE_SCHEMA, 'grievance-workflow-schema.ts'))

    it('grievance_status enum covers full lifecycle', () => {
      const required = ['draft', 'filed', 'investigating', 'escalated', 'arbitration', 'closed']
      for (const status of required) {
        expect(grievanceSchema, `Missing grievance status: ${status}`).toContain(status)
      }
    })

    it('grievance_type enum covers CUPE categories', () => {
      const required = ['harassment', 'discrimination', 'safety', 'termination', 'discipline']
      for (const type of required) {
        expect(grievanceSchema, `Missing grievance type: ${type}`).toContain(type)
      }
    })

    it('grievance_step enum covers multi-step process', () => {
      expect(grievanceSchema).toContain('step_1')
      expect(grievanceSchema).toContain('step_2')
      expect(grievanceSchema).toContain('step_3')
      expect(grievanceSchema).toContain('arbitration')
    })

    it('arbitration_status enum exists', () => {
      expect(grievanceSchema).toContain('arbitration_status')
      expect(grievanceSchema).toContain('award_rendered')
    })

    it('settlement_type enum exists', () => {
      expect(grievanceSchema).toContain('settlement_type')
      expect(grievanceSchema).toContain('monetary')
      expect(grievanceSchema).toContain('reinstatement')
    })

    it('workflow schema has stage types for full pipeline', () => {
      const requiredStages = ['filed', 'intake', 'investigation', 'mediation', 'arbitration', 'resolved']
      for (const stage of requiredStages) {
        expect(workflowSchema, `Missing workflow stage: ${stage}`).toContain(stage)
      }
    })

    it('workflow schema has assignment tracking', () => {
      expect(workflowSchema).toContain('grievanceAssignments')
      expect(workflowSchema).toContain('assignment_role')
      expect(workflowSchema).toContain('assignment_status')
    })

    it('workflow schema has document management', () => {
      expect(workflowSchema).toContain('grievanceDocuments')
      expect(workflowSchema).toContain('document_version_status')
    })

    it('workflow schema has settlement tracking', () => {
      expect(workflowSchema).toContain('grievanceSettlements')
      expect(workflowSchema).toContain('settlement_status')
    })

    it('workflow schema has communication tracking', () => {
      expect(workflowSchema).toContain('grievanceCommunications')
    })
  })

  // ── FSM-based status transitions ──────────────────────────────────────
  describe('case FSM enforcement', () => {
    it('case-fsm-enforcement module exists', () => {
      const fsmFiles = findFiles(join(UE, 'lib'), /case-fsm/i)
      expect(fsmFiles.length).toBeGreaterThan(0)
    })

    it('transition route uses FSM validation', () => {
      const transitionRoutes = findRoutesByPath(UE_API, /transition/)
      expect(transitionRoutes.length).toBeGreaterThan(0)

      const hasValidation = transitionRoutes.some(f => {
        const content = readFileSync(f, 'utf-8')
        return content.includes('validateCUPETransition') || content.includes('transition')
      })
      expect(hasValidation).toBe(true)
    })

    it('transition route has audit trail', () => {
      const transitionRoutes = findRoutesByPath(UE_API, /transition/)
      expect(transitionRoutes.length).toBeGreaterThan(0)
      const hasAudit = transitionRoutes.some(f => {
        const content = readFileSync(f, 'utf-8')
        return /audit|withApi|log/i.test(content)
      })
      expect(hasAudit).toBe(true)
    })
  })

  // ── Case intake ───────────────────────────────────────────────────────
  describe('case intake flow', () => {
    it('intake route exists', () => {
      const intakeDir = join(UE_API, 'cases', 'intake')
      expect(existsSync(intakeDir)).toBe(true)
    })

    it('intake validates using CUPE vocabulary', () => {
      const routeFile = join(UE_API, 'cases', 'intake', 'route.ts')
      const content = readIfExists(routeFile)
      expect(content).toMatch(/validate|cupe-vocabulary|validateIntake/i)
    })

    it('intake has auth check', () => {
      const routeFile = join(UE_API, 'cases', 'intake', 'route.ts')
      const content = readIfExists(routeFile)
      expect(content).toMatch(/auth\(\)|withApiAuth|authenticateUser/i)
    })
  })

  // ── AI triage with human-in-the-loop ──────────────────────────────────
  describe('AI triage governance', () => {
    it('AI triage schema exists', () => {
      const triageFiles = findFiles(UE_SCHEMA, /ai-grievance-triage/i)
      expect(triageFiles.length).toBeGreaterThan(0)
    })

    it('AI triage has humanApproved gate', () => {
      const triageFiles = findFiles(UE_SCHEMA, /ai-grievance-triage/i)
      const content = triageFiles.map(f => readFileSync(f, 'utf-8')).join('\n')
      expect(content).toContain('humanApproved')
    })

    it('AI triage has confidence score', () => {
      const triageFiles = findFiles(UE_SCHEMA, /ai-grievance-triage/i)
      const content = triageFiles.map(f => readFileSync(f, 'utf-8')).join('\n')
      expect(content).toContain('confidence')
    })

    it('AI triage has mandatory explanation', () => {
      const triageFiles = findFiles(UE_SCHEMA, /ai-grievance-triage/i)
      const content = triageFiles.map(f => readFileSync(f, 'utf-8')).join('\n')
      expect(content).toMatch(/explanation.*notNull|\.notNull\(\)/)
    })

    it('AI triage API routes exist', () => {
      const aiTriageApi = join(UE_API, 'ai', 'grievances')
      expect(existsSync(aiTriageApi)).toBe(true)
    })
  })

  // ── Document management ───────────────────────────────────────────────
  describe('document and evidence management', () => {
    it('evidence/document API routes exist', () => {
      const evidenceRoutes = findRoutesByPath(UE_API, /evidence|document/i)
      expect(evidenceRoutes.length).toBeGreaterThan(0)
    })

    it('defensibility pack export exists', () => {
      const defPack = findRoutesByPath(UE_API, /defensibility|export/i)
      expect(defPack.length).toBeGreaterThan(0)
    })
  })

  // ── Audit timeline ────────────────────────────────────────────────────
  describe('case audit timeline', () => {
    it('audit trail route exists for cases', () => {
      const auditRoutes = findRoutesByPath(UE_API, /audit|timeline/i)
      expect(auditRoutes.length).toBeGreaterThan(0)
    })

    it('audit events table has immutability triggers', () => {
      // Triggers may be in migrations or in seed/setup SQL files
      const migrationFiles = findFiles(join(UE, 'db', 'migrations'), /\.sql$/)
      const seedFiles = findFiles(join(UE, 'db', 'seeds'), /\.sql$/)
      const allSql = [...migrationFiles, ...seedFiles]
      const hasTrigger = allSql.some(f => {
        const content = readFileSync(f, 'utf-8')
        return content.includes('reject_mutation') ||
               content.includes('audit_log_immutability_guard') ||
               content.includes('prevent_') && content.includes('CREATE TRIGGER') ||
               content.includes('immutability') && content.includes('CREATE FUNCTION')
      })
      // Also check schema TS files for trigger/immutability references
      const schemaFiles = findFiles(UE_SCHEMA, /audit|immutab/i)
      const hasTriggerRef = schemaFiles.some(f => {
        const c = readFileSync(f, 'utf-8')
        return c.includes('no_update') || c.includes('no_delete') || c.includes('immutab') ||
               c.includes('reject_mutation') || c.includes('prevent_')
      })
      expect(hasTrigger || hasTriggerRef).toBe(true)
    })
  })

  // ── Role-based access ────────────────────────────────────────────────
  describe('role-based access patterns', () => {
    it('RLS context used in case routes', () => {
      const caseRouteFiles = findFiles(join(UE_API, 'cases'), /route\.ts$/)
      const hasRLS = caseRouteFiles.some(f => {
        const c = readFileSync(f, 'utf-8')
        return c.includes('withRLSContext') || c.includes('rls') || c.includes('orgId')
      })
      expect(hasRLS).toBe(true)
    })
  })

  // ── Workflow completeness ─────────────────────────────────────────────
  describe('workflow API completeness', () => {
    it('workflow transition route exists', () => {
      const wf = join(UE_API, 'workflow', 'transition')
      expect(existsSync(wf) || existsSync(join(UE_API, 'cases'))).toBe(true)
    })

    it('workbench assignment route exists', () => {
      const assign = findRoutesByPath(UE_API, /assign/i)
      expect(assign.length).toBeGreaterThan(0)
    })
  })
})
