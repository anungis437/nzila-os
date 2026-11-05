const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B87-PLATFORM-READS-COMMUNICATIONS-SIGNATURES'
const test = A + 'lib/services/__tests__/s31-platform-comms-signature.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'

const resolve = (prefix) => {
  const hits = register.filter((d) => d.id.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`prefix ${prefix} matched ${hits.length}`)
  return hits[0].id
}
const existing = () => ledger.batches.flatMap((x) => x.items)
const find = (prefix) => existing().find((i) => i.prefix.startsWith(prefix) || prefix.startsWith(i.prefix))
const fresh = (prefix, status, files, explanation, remaining) => ({ prefix: resolve(prefix), status, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })
const upgrade = (prefix, status, files, explanation, remaining) => {
  const found = find(prefix)
  if (!found) throw new Error('not found ' + prefix)
  found.status = status
  if (remaining) found.remaining = remaining
  else delete found.remaining
  found.files = [...new Set([...(found.files || []), ...files, test])]
  if (!found.explanation.includes(explanation)) found.explanation += ' ' + explanation
}

if (!ledger.batches.some((x) => x.id === id)) {
  const items = [
    fresh(
      'DEF-0B10-OPL-13',
      ST,
      [A + 'app/api/platform/metrics/mrr/route.ts', A + 'app/api/platform/metrics/churn/route.ts', A + 'app/api/platform/metrics/unit-economics/route.ts'],
      'Verified on source in B87: the three platform metric routes are at the system_admin floor (not the organization administrator floor) and read no table: each answers 501 NOT_IMPLEMENTED until a platform-data mandate and source reconciliation exist, so no revenue or churn aggregate reaches any administrator.',
    ),
    fresh(
      'DEF-0B11-PRP-PRECEDENT-POST',
      'PARTIAL',
      [A + 'lib/services/precedent-audited-service.ts', A + 'app/api/precedents/route.ts'],
      'B87: the precedent is created as a draft (not public, access restriction pending_review), the audit row names the supplying organization, and the row itself now records its source as typed:<organizationId>:<userId> in imported_from, since the shared table has no organization column.',
      'No review, redaction or consent step exists yet to publish a draft, and the shared table has no owning-organization column; both need a reviewed publication workflow and a migration.',
    ),
    fresh(
      'DEF-0B12-PLT-ORGANIZATIONS-LEGACY-BRANCH-LISTS-EVERY',
      ST,
      [A + 'app/api/organizations/route.ts'],
      'Verified on source in B87: the legacy branch is gone from the organizations route; the list is bounded by the caller identity scope and no environment list of platform user ids is read there.',
    ),
    fresh(
      'DEF-0B5-UNSUBSCRIBE-NO-CONSENT-RECORD-WITHOUT-CAMPAIGN',
      ST,
      [A + 'app/api/communications/unsubscribe/[recipientId]/route.ts', A + 'app/api/__tests__/communications-unsubscribe.route.test.ts', A + 'lib/services/__tests__/b55-workflow-integrity.test.ts'],
      'A link without a campaign now revokes in every organization that holds a preference row or a list subscription for the recipient, in the same transaction and through the same helper as a campaign link: preference, list subscriptions and one revoked consent record per organization, each attributed to its organization. The reason text is bounded at 200 characters. The route tests were extended and the b55 pin was adapted to the helper (disclosed).',
    ),
    fresh(
      'DEF-0B5-TRACKING-STATS-READ-MODIFY-WRITE-UNAUDITED',
      ST,
      [A + 'app/api/communications/track/click/route.ts', A + 'app/api/__tests__/communications-track-click.route.test.ts'],
      'The click route now matches the open route: one system-context transaction, a conditional UPDATE that elects a single winner for the first click, PostgreSQL jsonb increments (clicked, and opened only when no open was recorded) so concurrent events keep their counts, and an atomic audit record; a failed transaction counts nothing and the verified redirect still happens. The click tests were adapted to the transaction and two cases were added (disclosed).',
    ),
    fresh(
      'DEF-0B11-IDS-SETTINGS-TWILIO',
      ST,
      [A + 'services/twilio-sms-service.ts', A + 'lib/settings/organization-settings-policy.ts'],
      'twilioPhoneNumber is already a protected key that an organization administrator cannot write (earlier batch). B87: the inbound lookup reads two rows and refuses to attribute a message when the number is held by more than one organization, so an ambiguous number can no longer place a member text in the wrong tenant.',
    ),
    fresh(
      'DEF-0B11-SOC-SIGNATURE-DOCUMENT-GET-CALLS-THE-PROVIDER',
      ST,
      [A + 'lib/signature/signature-service.ts', A + 'app/api/signatures/documents/[id]/route.ts'],
      'The status read no longer calls the provider or writes a row. A sender refreshes explicitly with POST /api/signatures/documents/[id], which runs the existing conditional, audited syncDocumentStatus.',
    ),
    fresh(
      'DEF-0B11-SOC-SIGNATURE-ENVELOPE-AND-STORED-FILE',
      ST,
      [A + 'lib/signature/signature-service.ts'],
      'The signer list is validated against active organization members before anything leaves the platform (earlier batch). B87: when the transaction that records the document fails, the provider envelope is voided and the stored file is deleted (best effort, both attempted), and the original failure is reported.',
    ),
    fresh(
      'DEF-0B11-SOC-SIGNATURE-READS-AND-ACCESS-CHECK',
      'PARTIAL',
      [A + 'lib/signature/signature-service.ts', A + 'lib/signature/signer-verification.ts'],
      'A signer user id must now be an active member of the sending organization when the request is created, so a user of another organization cannot be named as a signer, and the status and audit views are projected per viewer.',
      'verifyDocumentAccess, getDocumentStatus and the audit reads still look the document up by id through the shared handle with no tenant context; they need an organization-bound read path.',
    ),
  ]
  ledger.batches.push({ id, family: 'Platform reads, communications tracking and unsubscribe, signature service', evidenceCommit: null, items })
}

upgrade(
  'DEF-0B10-OPL-14',
  'PARTIAL',
  [A + 'lib/queries/platform-stats.ts', A + 'app/api/platform/stats/route.ts'],
  'B87: the platform read records platform_stats.read in the same system-context transaction, attributed to the caller and the organization they act in, so the cross-tenant read is no longer silent.',
  'The route is still authorized by the platform_lead role title; a platform-staff mandate does not exist in the authority kernel, so it cannot be issued here.',
)

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B87 added')
