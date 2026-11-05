const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B101-PG-MIGRATIONS-SCIM-SLA-SURVEY-DECISIONS'
const test = A + 'lib/services/__tests__/s44-gate0-pg-migrations.test.ts'
const native = A + 'db/__tests__/migrations-0048-0051-gate0.postgres.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'

const resolve = (prefix) => {
  const hits = register.filter((d) => d.id.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`prefix ${prefix} matched ${hits.length}`)
  return hits[0].id
}
const existing = () => ledger.batches.flatMap((x) => x.items)
const find = (prefix) => existing().find((i) => i.prefix.startsWith(prefix) || prefix.startsWith(i.prefix))
const item = (prefix, status, files, explanation, remaining) => ({ prefix: resolve(prefix), status, files: [...files, test, native], explanation, ...(remaining ? { remaining } : {}) })
// An item an earlier run credited outside this ledger is added here; one already in the ledger is upgraded in place.
const credit = (prefix, status, files, explanation, remaining) => {
  const found = find(prefix)
  if (!found) return item(prefix, status, files, explanation, remaining)
  found.status = status
  if (remaining) found.remaining = remaining
  else delete found.remaining
  found.files = [...new Set([...(found.files || []), ...files, test, native])]
  if (!found.explanation.includes(explanation)) found.explanation += ' ' + explanation
  return null
}
const M = A + 'db/migrations-platform/'
const C = A + 'db/migrations-cache/'

if (!ledger.batches.some((x) => x.id === id)) {
  const items = [
    credit(
      'DEF-0B6-SYS-SLA-CLOCK-RESTARTS-ON-ANY-CLAIM-UPDATE',
      ST,
      [M + '0049_claim_status_transitions.sql', C + '0039_claim_status_transitions_rls_closure.sql', A + 'lib/workflow/sla-clock.ts', A + 'lib/workflow/__tests__/sla-clock.test.ts', A + 'lib/workflow-engine.ts', A + 'lib/workflow/sla-alerts.ts', A + 'lib/ml/sla-breach-score.ts', A + 'app/api/cron/sla-watchdog/route.ts'],
      'Platform 0049 adds claims.status_changed_at, kept by a BEFORE trigger that stamps creation and a real status change and ignores an edit that leaves the status alone, and an append-only claim_status_transitions history written by a SECURITY DEFINER trigger (cache 0039 leaves the application roles SELECT only). Every SLA reader (workflow engine, alerts, watchdog, breach score) starts the clock at slaClockStart: the last status change, else creation, and says which basis it used. Claims that predate the column are not backfilled from updated_at. Proven on native PostgreSQL 15 and 16 as union_eyes_runtime and union_eyes_system, including forged-transition denial and the trigger firing under forced row security.',
    ),
    credit(
      'DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT',
      ST,
      [M + '0051_arbitration_decision_owner.sql', C + '0041_arbitration_decisions_owner_rls.sql', A + 'lib/services/precedent-service.ts', A + 'lib/services/precedent-audited-service.ts'],
      'Platform 0051 gives the library an owner (source_organization_id, recovered from typed provenance where it names a real organization) and defaults is_public to false; cache 0041 forces row security so a tenant reads a decision that is public with no access restriction or one it supplied, and writes only rows it owns. An ownerless decision changes only through the system role. precedent-service create, update and delete are owner-scoped and run in the tenant transaction, and a read no longer counts itself (view_count is not maintained). Proven on native PostgreSQL 15 and 16 under the runtime and system roles.',
      'The combined bootstrap still creates arbitration_decisions as a Django stub: the remaining Drizzle columns are the separate schema-parity item, so the library routes still need that shape before they work against a real database.',
    ),
    credit(
      'DEF-0B11-IDS-SATISFACTION-ANONYMITY-FLAG-IS-STORED-AND-NEVER-READ',
      ST,
      [M + '0050_survey_anonymity.sql', C + '0040_satisfaction_survey_responded_rls_closure.sql', A + 'lib/services/satisfaction-service.ts', A + 'app/api/satisfaction/route.ts'],
      'Platform 0050 makes the promise true in the database: a completed anonymous response is held without member_id and claim_id, without sent_at and metadata, and with its dates coarsened to the month; a CHECK refuses an anonymous completed row that still carries a member or a claim; existing anonymous rows are scrubbed (irreversibly, on purpose). satisfaction_survey_responded keeps only that this member answered this claim, so the survey is not sent again (the service answers 409), and the application roles hold SELECT only on it. The trigger avoids ON CONFLICT, which needs a SELECT policy the table owner does not have under forced row security, and the scrub and the rollback check lift and restore the force. Proven on native PostgreSQL 15 and 16.',
      'Free-text feedback is the respondent\'s own words and is not altered; it can still name someone.',
    ),
    credit(
      'DEF-0B11-IDS-SCIM-ROUTE-HAS-NO-BEARER-AUTHENTICATION',
      'PARTIAL',
      [M + '0048_sso_scim_shape.sql', C + '0038_scim_configurations_rls_closure.sql', A + 'lib/scim/scim-token.ts', A + 'lib/scim/__tests__/scim-token.test.ts', A + 'app/api/scim/v2/[organizationId]/Users/route.ts', A + 'app/api/enterprise/sso/scim-token/route.ts', A + 'lib/public-routes.ts'],
      'The SCIM Users route now authenticates the identity provider by the organization\'s bearer token, not a browser session: only the SHA-256 is stored (platform 0048 has no bearer_token column and hashes a legacy plaintext one), the lookup is by hash with a constant-time compare, a disabled, revoked or expired configuration authenticates nothing, the token (not the path) decides the organization, and the surface is rate limited per client and refuses when the limiter is unavailable. A signed-in administrator issues, rotates and revokes the token at /api/enterprise/sso/scim-token (shown once, audited atomically). The SCIM prefix is public at the edge and the token route is not. Proven on native PostgreSQL 15 and 16 (hash and per-organization uniqueness, tenant isolation, system lookup by hash).',
      'The route still offers only list and create: no get, replace, patch or delete of a user (so a deprovision cannot be sent), no groups, no ServiceProviderConfig, and no scim_events_log row per provisioning event; deprovision_action and the attribute mapping are stored but not consumed.',
    ),
    credit(
      'DEF-0B11-IDS-SCIM-PROVISION-STORES-THE-USERNAME-STRING-AS-THE-USER-ID',
      'PARTIAL',
      [A + 'app/api/scim/v2/[organizationId]/Users/route.ts'],
      'A provisioned person is keyed scim:<organizationId>:<userName> (lower-cased), so a userName that matches a real user of another organization can no longer make that user a member here, and the membership stays pending until the person accepts. The organization comes from the bearer token, never the path.',
      'The identity provider subject (externalId) is still not read, the provisional key is not linked to the person\'s account at sign-in, and a removed member with the same key still answers 409.',
    ),
    credit(
      'DEF-0B11-PRP-PRECEDENT-POST-PUBLISHES-INTO-THE-SHARED-LIBRARY',
      'PARTIAL',
      [A + 'lib/services/precedent-audited-service.ts', M + '0051_arbitration_decision_owner.sql'],
      'A typed decision is now owned by the supplying organization (source_organization_id), is created not public with access_restrictions pending_review, and keeps its typed provenance; the row-security policy of cache 0041 means no other organization can change or delete it.',
      'There is still no review, redaction or consent step that moves a decision from pending_review to shared.',
    ),
  ].filter(Boolean)
  ledger.batches.push({ id, family: 'PostgreSQL migrations: SCIM bearer token, SLA status clock, survey anonymity, decision owner', evidenceCommit: null, items })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B101 added', ledger.batches.find((x) => x.id === id).items.length, 'new items')
