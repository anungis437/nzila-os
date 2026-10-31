/**
 * Loads the certified-supersession grant from the authority kernel.
 *
 * The request body is not a source. The caller supplies the authenticated principal,
 * the organization, and the election id. A missing election and an election owned by
 * another organization are both NOT_FOUND, and neither answer reads `council_elections`
 * before the ownership relation confirms this organization.
 */
import type { EnforcementDeps } from '@/lib/authority/store/enforce'
import { enforceAuthority } from '@/lib/authority/store/enforce'
import { isUuid, type SqlExecutor } from '@/lib/authority/store/executor'
import { kernelDeps } from '@/lib/authority/store/route-adapter'
import { certificateProvenanceFromRow, type SuccessionGrant } from '@/lib/voting/election-succession'

export type SupersessionLoadCode = 'NOT_FOUND' | 'STORE_UNAPPLIED' | 'CORRECTION_UNISSUED' | 'RECUSAL_REQUIRED'

export type SupersessionLoad =
  | { ok: true; grant: SuccessionGrant }
  | { ok: false; code: SupersessionLoadCode; message: string }

const ELECTION_ROW = `SELECT e.id::text AS id, e.election_year, e.election_date::text AS election_date, e.positions_available,
            e.candidates, e.winners, e.total_votes, e.participation_rate, e.verified_by,
            e.verification_date::text AS verification_date
       FROM public.council_elections e
       INNER JOIN public.election_organization_ownership o ON o.election_id = e.id
      WHERE e.id = $1::uuid AND o.organization_id = $2::uuid`

function denied(code: SupersessionLoadCode, message: string): SupersessionLoad {
  return { ok: false, code, message }
}

export async function loadCertifiedSupersessionGrant(
  exec: SqlExecutor,
  input: { electionId: string; organizationId: string; userId: string },
  deps: EnforcementDeps = kernelDeps,
): Promise<SupersessionLoad> {
  if (!isUuid(input.electionId) || !isUuid(input.organizationId)) {
    return denied('NOT_FOUND', 'Election not found.')
  }
  const relation = (await exec.query<{ rel: string | null }>(`SELECT to_regclass('public.election_organization_ownership')::text AS rel`)).rows[0]?.rel
  if (!relation) {
    return denied('STORE_UNAPPLIED', 'The election ownership relation is not in this database. Nothing was written.')
  }

  const decision = await enforceAuthority(
    exec,
    deps,
    {
      principalUserId: input.userId,
      organizationId: input.organizationId,
      action: 'governance:supersede_certified_result',
      resource: { type: 'council_election', id: input.electionId, organizationId: input.organizationId },
    },
    { authenticated: true },
  )
  const codes = decision.reasons.map((reason) => reason.code)
  if (codes.includes('RESOURCE_FACTS_MISSING') || codes.includes('FOREIGN_TENANT')) {
    return denied('NOT_FOUND', 'Election not found.')
  }
  if (codes.includes('RECUSED') || codes.includes('ADVERSE_PARTY')) {
    return denied('RECUSAL_REQUIRED', 'A person named on the certified result, or recused from it, cannot supersede it.')
  }
  if (decision.effect !== 'allow') {
    return denied('CORRECTION_UNISSUED', 'A certified result is superseded only by a live governance mandate for this election. A request field is not a grant.')
  }

  try {
    const mandateId = decision.authority.find((source) => source.kind === 'mandate')?.id
    if (!mandateId || !isUuid(mandateId)) {
      return denied('CORRECTION_UNISSUED', 'The kernel allow did not name a mandate in this organization.')
    }
    const mandate = (
      await exec.query<{ granted_by: string; approved_by: string | null; source_instrument: string }>(
        `SELECT granted_by, approved_by, source_instrument
           FROM ue_authority_mandates
          WHERE id = $1::uuid AND organization_id = $2::uuid AND principal_user_id = $3
            AND kind = 'governance_review' AND status = 'active' AND revoked_at IS NULL`,
        [mandateId, input.organizationId, input.userId],
      )
    ).rows[0]
    const reference = mandate?.source_instrument?.trim() ?? ''
    if (!mandate?.approved_by || reference.length === 0 || reference.length > 200) {
      return denied('CORRECTION_UNISSUED', 'The supersession mandate has no independent reviewer or decision reference.')
    }
    const row = (await exec.query<Record<string, unknown>>(ELECTION_ROW, [input.electionId, input.organizationId])).rows[0]
    if (!row) return denied('NOT_FOUND', 'Election not found.')
    const recused = (
      await exec.query<{ principal_user_id: string }>(
        `SELECT principal_user_id
           FROM ue_authority_recusals
          WHERE organization_id = $1::uuid AND resource_type = 'council_election' AND resource_id = $2::uuid AND lifted_at IS NULL`,
        [input.organizationId, input.electionId],
      )
    ).rows.map((item) => item.principal_user_id)
    const grant: SuccessionGrant = {
      loadedBy: 'authority-kernel',
      action: 'election:supersede_certified_result',
      electionId: input.electionId,
      organizationId: input.organizationId,
      issued: true,
      issuerUserId: mandate.granted_by,
      reviewerUserId: mandate.approved_by,
      decisionReference: reference,
      provenanceHash: certificateProvenanceFromRow(row),
      recusedUserIds: recused,
      institutionalNoticeRequired: true,
    }
    return { ok: true, grant }
  } catch {
    return denied('CORRECTION_UNISSUED', 'The supersession grant could not be loaded from the authority store. Nothing was written.')
  }
}
