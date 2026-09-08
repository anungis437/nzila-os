#!/usr/bin/env tsx
/**
 * scripts/generate-simple-tenant-remediation-report-round53.ts
 *
 * PR #752 round 53 (FINAL_SIMPLE_TENANT_EXCEPTION_CLOSURE): durable,
 * advisory-only remediation record for the 11 SIMPLE_TENANT:org:HIGH
 * exceptions left open since round 41.
 *
 * This script NEVER rewrites the manifest. Every table's
 * `finalManifestClassification` field reflects the ACTUAL
 * db/rls-storage-authority/*.ts disposition applied this round.
 *
 * Usage: tsx scripts/generate-simple-tenant-remediation-report-round53.ts
 * Output: reports/union-eyes-simple-tenant-remediation-round53.{json,md}
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const APP_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(APP_ROOT, '..', '..')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

type Family =
  | 'AI_BUDGET_CONTROL'
  | 'CALENDAR_AND_SCHEDULING'
  | 'TRAINING_AND_REGISTRATION'
  | 'PILOT_CONTROL_PLANE_STORAGE'
  | 'REPORTING'
  | 'SSO_CREDENTIAL_CONFIGURATION'

interface RemediatedTable {
  table: string
  family: Family
  firstDeferredRound: number
  finalManifestClassification: string
  invocationAuthority: string
  dbExecutionPrincipal: string
  djangoDisposition: string
  concreteDefectFixed: string | null
  residualBlocker: string | null
  status: 'CLOSED'
}

// prettier-ignore
const TABLES: RemediatedTable[] = [
  { table: 'ai_budgets', family: 'AI_BUDGET_CONTROL', firstDeferredRound: 41, finalManifestClassification: 'CONTAINED_NO_AUTHORITY', invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'Already DenyAllPermission since round 35; the doctrine\'s own round-38 CONTAINED_NO_AUTHORITY definition cites this table as its paradigm case, but the classification itself was never applied until this round', concreteDefectFixed: null, residualBlocker: 'Real ai_budgets table has RLS enabled with broken CREATE POLICY statements referencing a nonexistent auth.user_id() function (round-35 finding, not re-litigated) \u2014 a schema/migration hygiene defect, not an authority-classification blocker', status: 'CLOSED' },

  { table: 'calendars', family: 'CALENDAR_AND_SCHEDULING', firstDeferredRound: 41, finalManifestClassification: 'TENANT_RLS_REQUIRED', invocationAuthority: 'MIXED', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'Was IsAuthenticated-only, no org filter \u2014 contained via DenyAllPermission', concreteDefectFixed: 'Same-org peer exposure of personal (isPersonal=true) calendars via GET/PATCH/DELETE (any member could list/read/edit/delete any other member\'s personal calendar); ownerId was fully client-controllable on create (identity-spoofing)', residualBlocker: null, status: 'CLOSED' },
  { table: 'meeting_rooms', family: 'CALENDAR_AND_SCHEDULING', firstDeferredRound: 41, finalManifestClassification: 'TENANT_RLS_REQUIRED', invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'MeetingRoomsViewSet and RoomBookingsViewSet were both IsAuthenticated-only, no org filter \u2014 both contained via DenyAllPermission', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },

  { table: 'training_programs', family: 'TRAINING_AND_REGISTRATION', firstDeferredRound: 41, finalManifestClassification: 'TENANT_RLS_REQUIRED', invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'Was IsAuthenticated-only, no org filter \u2014 contained via DenyAllPermission', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'training_courses', family: 'TRAINING_AND_REGISTRATION', firstDeferredRound: 41, finalManifestClassification: 'TENANT_RLS_REQUIRED', invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'Was IsAuthenticated-only, no org filter \u2014 contained via DenyAllPermission', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'course_registrations', family: 'TRAINING_AND_REGISTRATION', firstDeferredRound: 41, finalManifestClassification: 'TENANT_RLS_REQUIRED', invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'CourseRegistrationsViewSet exposed a member_id filterset with no org filter, letting any authenticated user enumerate any org\'s registrations \u2014 contained via DenyAllPermission', concreteDefectFixed: 'memberId was fully client-controllable on the self-registration route (identity spoofing \u2014 registering another member without consent); courseId/sessionId were not validated against the caller\'s own organization (cross-org FK injection)', residualBlocker: null, status: 'CLOSED' },

  { table: 'pilot_checklist_items', family: 'PILOT_CONTROL_PLANE_STORAGE', firstDeferredRound: 41, finalManifestClassification: 'TENANT_RLS_REQUIRED', invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'No Django ViewSet exists for this table', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'pilot_enrollments', family: 'PILOT_CONTROL_PLANE_STORAGE', firstDeferredRound: 41, finalManifestClassification: 'MIXED_GLOBAL_TENANT_RLS_REQUIRED', invocationAuthority: 'MIXED', dbExecutionPrincipal: 'SYSTEM_RUNTIME', djangoDisposition: 'No Django ViewSet exists for this table', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },
  { table: 'pilot_milestones', family: 'PILOT_CONTROL_PLANE_STORAGE', firstDeferredRound: 41, finalManifestClassification: 'TENANT_RLS_REQUIRED', invocationAuthority: 'MIXED', dbExecutionPrincipal: 'SYSTEM_RUNTIME', djangoDisposition: 'No Django ViewSet exists for this table', concreteDefectFixed: null, residualBlocker: null, status: 'CLOSED' },

  { table: 'reports', family: 'REPORTING', firstDeferredRound: 41, finalManifestClassification: 'TENANT_RLS_REQUIRED', invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'Was IsAuthenticated-only, no org filter \u2014 contained via DenyAllPermission', concreteDefectFixed: null, residualBlocker: 'ReportExecutor\'s own dynamic SQL-generation injection-safety was not audited this round (out of scope \u2014 does not touch the reports table\'s own row-level authority)', status: 'CLOSED' },

  { table: 'sso_providers', family: 'SSO_CREDENTIAL_CONFIGURATION', firstDeferredRound: 41, finalManifestClassification: 'TENANT_RLS_REQUIRED', invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'Already DenyAllPermission (contained in a prior round, reverified unchanged)', concreteDefectFixed: 'POST create response echoed raw samlCertificate/oidcClientSecret in the clear (GET already redacted these fields) \u2014 fixed to apply identical redaction', residualBlocker: 'oidcClientSecret is stored plaintext despite a schema comment claiming encryption (CREDENTIAL_STORAGE_MODEL_UNRESOLVED); no unique constraint on samlEntityId/oidcIssuer (theoretical domain-collision risk, not currently exploitable since no pre-auth discovery path exists)', status: 'CLOSED' },
]

const FINANCE_FROZEN_EXCEPTIONS = [
  'contribution_rates',
  'currency_enforcement_audit',
  'fx_rate_audit_log',
  't106_filing_tracking',
  'bank_of_canada_rates',
  'currency_enforcement_policy',
  'currency_enforcement_violations',
  'transaction_currency_conversions',
  'transfer_pricing_documentation',
  'fee_settlement_batches',
]

function main() {
  const familyCounts: Record<string, number> = {}
  for (const t of TABLES) familyCounts[t.family] = (familyCounts[t.family] ?? 0) + 1

  const concreteDefects = TABLES.filter((t) => t.concreteDefectFixed !== null)
  const residualBlockers = TABLES.filter((t) => t.residualBlocker !== null)

  const summary = {
    generatedAt: new Date().toISOString(),
    round: 53,
    mission: 'FINAL_SIMPLE_TENANT_EXCEPTION_CLOSURE',
    startSha: 'c37232b531b6d2d02598f06f1f5e318df4168de8',
    simpleTenantLaneStartCount: 11,
    simpleTenantLaneEndCount: 0,
    totalTablesRemediated: TABLES.length,
    familyCounts,
    financeFrozenExceptions: FINANCE_FROZEN_EXCEPTIONS,
    financeFreezeStatus: 'PRESERVED — none of these 10 tables, their manifest classifications, or their runtime principal architecture were touched this round',
    concreteDefectsFixedCount: concreteDefects.length,
    residualBlockersCount: residualBlockers.length,
    pilotControlPlaneDoctrine: 'UNCHANGED — storage authority only, no pilot business/readiness doctrine touched',
    tables: TABLES,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'union-eyes-simple-tenant-remediation-round53.json'), JSON.stringify(summary, null, 2))

  const md: string[] = []
  md.push('# Union Eyes Simple-Tenant Exception Remediation Report (round 53)')
  md.push('')
  md.push(`Generated: ${summary.generatedAt}`)
  md.push('')
  md.push('Advisory only -- does not rewrite the manifest. See db/rls-storage-authority/*.ts for the authoritative classification of each table.')
  md.push('')
  md.push('This report closes the final 11-table SIMPLE_TENANT:org:HIGH lane, deferred since round 41.')
  md.push('')
  md.push(`SIMPLE_TENANT lane: ${summary.simpleTenantLaneStartCount} -> ${summary.simpleTenantLaneEndCount}`)
  md.push('')
  md.push('## Family counts')
  md.push('')
  md.push('| Family | Count |')
  md.push('| --- | --- |')
  for (const [family, count] of Object.entries(familyCounts)) {
    md.push(`| ${family} | ${count} |`)
  }
  md.push('')
  md.push('## 11-table disposition matrix')
  md.push('')
  md.push('| Table | Family | First deferred | Final classification | Invocation | DB principal | Concrete defect fixed | Residual blocker |')
  md.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const t of TABLES) {
    md.push(`| ${t.table} | ${t.family} | round ${t.firstDeferredRound} | ${t.finalManifestClassification} | ${t.invocationAuthority} | ${t.dbExecutionPrincipal} | ${t.concreteDefectFixed ?? '(none)'} | ${t.residualBlocker ?? '(none)'} |`)
  }
  md.push('')
  md.push('## Pilot control-plane doctrine')
  md.push('')
  md.push(summary.pilotControlPlaneDoctrine)
  md.push('')
  md.push('## Finance freeze (must remain PRESERVED)')
  md.push('')
  md.push(summary.financeFreezeStatus)
  md.push('')
  for (const f of FINANCE_FROZEN_EXCEPTIONS) md.push(`- ${f}`)
  md.push('')

  writeFileSync(resolve(OUT_DIR, 'union-eyes-simple-tenant-remediation-round53.md'), md.join('\n'))

  console.log(`Total remediated: ${summary.totalTablesRemediated}`)
  console.log(`SIMPLE_TENANT lane: ${summary.simpleTenantLaneStartCount} -> ${summary.simpleTenantLaneEndCount}`)
  console.log(`Concrete defects fixed: ${summary.concreteDefectsFixedCount}`)
  console.log(`Residual blockers: ${summary.residualBlockersCount}`)
  console.log('Report written to reports/union-eyes-simple-tenant-remediation-round53.{json,md}')
}

main()
