import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B101: PostgreSQL migrations 0048-0051 and 0038-0041', () => {
  it('ships each migration with a rollback and registers it as UNQUALIFIED', () => {
    const lineage = JSON.parse(readFileSync(join(process.cwd(), '..', '..', 'tooling/scripts/lib/ue-approved-migration-lineage.json'), 'utf8')).registeredAdditions
    for (const [dir, tags, list] of [
      ['db/migrations-platform', ['0048_sso_scim_shape', '0049_claim_status_transitions', '0050_survey_anonymity', '0051_arbitration_decision_owner'], lineage.platform],
      ['db/migrations-cache', ['0038_scim_configurations_rls_closure', '0039_claim_status_transitions_rls_closure', '0040_satisfaction_survey_responded_rls_closure', '0041_arbitration_decisions_owner_rls'], lineage.scoped],
    ] as const) {
      for (const tag of tags) {
        expect(existsSync(join(process.cwd(), dir, `${tag}.sql`)), tag).toBe(true)
        expect(existsSync(join(process.cwd(), dir, `${tag}.rollback.sql`)), `${tag} rollback`).toBe(true)
        expect(list.find((e: { tag: string }) => e.tag === tag)?.status, tag).toBe('UNQUALIFIED')
      }
    }
  })

  it('keeps the SECURITY DEFINER trigger functions out of reach and avoids ON CONFLICT under forced row security', () => {
    expect(src('db/migrations-platform/0049_claim_status_transitions.sql')).toContain('REVOKE ALL ON FUNCTION public.ue_claims_record_status_transition() FROM PUBLIC')
    const survey = src('db/migrations-platform/0050_survey_anonymity.sql')
    expect(survey).toContain('REVOKE ALL ON FUNCTION public.ue_satisfaction_anonymize_response() FROM PUBLIC')
    expect(survey).not.toMatch(/ON CONFLICT \(claim_id, member_id\) DO NOTHING;\s*\n\s*END IF;\s*\n\s*NEW\.member_id/)
    expect(survey).toContain('EXCEPTION WHEN unique_violation')
  })

  it('stores no SCIM bearer token and authenticates only by hash', () => {
    expect(src('db/schema/sso-scim-schema.ts')).not.toMatch(/bearerToken|bearer_token"/)
    const auth = src('lib/scim/scim-token.ts')
    expect(auth).toContain('timingSafeEqual')
    expect(auth).toContain('eq(scimConfigurations.tokenHash, presented)')
    expect(src('app/api/scim/v2/[organizationId]/Users/route.ts')).toContain('authenticateScimRequest')
  })

  it('starts every SLA clock at the last status change, never at an edit', () => {
    for (const file of ['lib/workflow-engine.ts', 'lib/workflow/sla-alerts.ts', 'lib/ml/sla-breach-score.ts']) {
      expect(src(file), file).toContain('slaClockStart')
      expect(src(file), file).not.toMatch(/claim\.updatedAt (\?\?|\|\|) claim\.createdAt/)
    }
  })

  it('owner-scopes every write to the decision library', () => {
    const service = src('lib/services/precedent-service.ts')
    expect(service).toContain('eq(arbitrationDecisions.sourceOrganizationId, scope.organizationId)')
    expect(src('lib/services/precedent-audited-service.ts')).toContain('sourceOrganizationId: scope.organizationId')
  })
})
