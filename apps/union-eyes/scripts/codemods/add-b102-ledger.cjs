const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B102-AUDIT-SETTINGS-NOT-IMPLEMENTED-HONESTY'
const test = A + 'lib/services/__tests__/s45-gate0-audit-honesty.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'

const resolve = (prefix) => {
  const hits = register.filter((d) => d.id.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`prefix ${prefix} matched ${hits.length}`)
  return hits[0].id
}
const existing = () => ledger.batches.flatMap((x) => x.items)
const find = (prefix) => existing().find((i) => i.prefix.startsWith(prefix) || prefix.startsWith(i.prefix))
const item = (prefix, status, files, explanation, remaining) => {
  if (find(prefix)) throw new Error('already credited: ' + prefix)
  return { prefix: resolve(prefix), status, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) }
}

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Mandatory external-access audit, unrecorded sync outcome, unenforced settings, 501 for the absent DSR route, workbook peer floor',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B8-FED-EXTERNAL-DECISION-AUDIT-SEPARATE-AND-BEST-EFFORT-IN-LEGACY-MODE',
        'PARTIAL',
        [A + 'lib/services/external-resource-authorization-service.ts', A + 'lib/external-resource-middleware.ts'],
        'The external access decision is now written through persistAtomicAudit in its own tenant transaction and a failure throws, so the middleware answers 403 and the outside party receives nothing when the decision record could not be written; the legacy logger that logged and swallowed a failed insert is no longer on this path. A stranger who holds no authority is still not written into the named organization\'s trail.',
        'The read or write that follows is still not recorded as its own event, the decision record commits before the read rather than in the same transaction, and a document request still writes a matter decision row and a document decision row.',
      ),
      item(
        'DEF-0B8-ICRA-SYNC-OUTCOME-AUDIT-IS-WRITTEN-AFTER-THE-EFFECT-AND-ITS-FAILURE-IS-SWALLOWED',
        ST,
        [A + 'lib/audit/operation-audit.ts', A + 'lib/audit/__tests__/operation-audit.test.ts', A + 'lib/integrations/control-plane.ts', A + 'app/api/integrations/framework/[id]/sync/route.ts'],
        'performAuditedOperation reports whether the outcome record was written (outcomeReport.recorded), and the sync route returns auditOutcomeRecorded with the result, so a synchronization whose outcome row could not be written says so instead of looking fully audited; the intent row still precedes the effect.',
      ),
      item(
        'DEF-0B6-CMP-DSR-GENERIC-ROUTE-REFUSES-WITH-MISLEADING-403',
        'PARTIAL',
        [A + 'app/api/enterprise/dsr/requests/route.ts'],
        'The enterprise data subject request route no longer wraps the generic factory that refused every call with a 403 naming another route: it answers 501 NOT_IMPLEMENTED for capability UE-PRIVACY-DSAR-WORKFLOW, as the privacy route does.',
        'No request can still be received: the table has no organization column to scope a request to the institution that must answer it, which is a schema and ownership decision.',
      ),
      item(
        'DEF-0B11-IDS-SETTINGS-SECURITY-POLICY-VALUES-ARE-SAVED-AS-UPDATED-TRUE-AND-ENFORCED-BY-NO-CODE',
        'PARTIAL',
        [A + 'lib/settings/unenforced-settings.ts', A + 'app/api/settings/organization/route.ts'],
        'The settings save reports the stored-but-unenforced keys (session timeout, MFA, password policy, rate limit, webhook, IP and domain lists) as notEnforced with a message, so a saved value is not read as one in force.',
        'No authentication, session, password, rate-limit or notification code reads these keys yet, and the settings screen does not yet display the notEnforced list.',
      ),
      item(
        'DEF-0B12-WBK-ANY-MEMBER-OF-THE-CLAIMING-ORGANIZATION-CAN-READ-CHANGE-AND-DELETE-THE-NAMED-PEOPLE',
        'PARTIAL',
        [A + 'lib/workbook/access-control.ts', A + 'lib/workbook/__tests__/access-control.test.ts'],
        'A same-organization peer of a claimed workbook now needs a steward role in the claimed organization (hasRoleInOrganization), not just a membership, before the memory-holder routes admit it to read, change or delete the named people.',
        'The named people still have no notice that they are recorded, and the PATCH and DELETE audit rows are written only when a row changed.',
      ),
      item(
        'DEF-0B9-ASM-NATIONAL-AVERAGE-BENCHMARK-FALLS-BACK-TO-HARD-CODED-LITERALS-WITH-NO-INDICATION',
        ST,
        [A + 'lib/utils/smart-onboarding.ts', A + 'lib/__tests__/smart-onboarding.test.ts'],
        'Credited from the B100 code change (commits 43cbe020f and f895de200): the invented national table is gone, an unavailable or invalid CLC measurement is null and is never replaced by a peer average, the endpoint must be an explicitly configured HTTPS URL, and a peer set with no positive member counts yields no average or percentile instead of 0 divided by 0. The existing tests assert nationalAverage null for an unset key, a 404, an invalid body, an invalid cache and a thrown error.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B102 added')
