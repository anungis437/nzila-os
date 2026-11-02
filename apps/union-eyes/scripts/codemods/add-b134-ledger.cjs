const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')

const sourceCommit = process.env.UE_TRANCHE9_SOURCE_COMMIT
if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? '')) throw new Error('set UE_TRANCHE9_SOURCE_COMMIT to the 40-character sha of the pushed tranche 9 source commit')

// The files are read from the commit, so the evidence commit and every affected source file are recoverable programmatically.
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
git('cat-file', '-e', `${sourceCommit}^{commit}`)
const baseline = git('rev-parse', `${sourceCommit}^`)
const files = git('diff', '--name-only', baseline, sourceCommit, '--', 'apps/union-eyes', 'docs/union-eyes/convergence/remediation/evidence', 'docs/union-eyes/convergence/RUNTIME-ACCEPTANCE.md')
  .split('\n')
  .filter(Boolean)
for (const required of [
  'apps/union-eyes/backend/services/api/governance_service_views.py',
  'apps/union-eyes/backend/services/api/twilio_sms_service_views.py',
  'apps/union-eyes/backend/services/api/fcm_service_views.py',
  'apps/union-eyes/backend/services/api/schema_views.py',
  'apps/union-eyes/backend/services/tests_service_write_path_containment.py',
  'docs/union-eyes/convergence/remediation/evidence/ue-django-service-write-paths-contained-20261102.md',
]) {
  if (!files.includes(required)) throw new Error(`the tranche 9 source commit does not change ${required}`)
}

// No frozen defect is credited: this is containment of endpoints nothing calls (source hardening), so it belongs with the cross-cutting records.
const tranche9 = {
  id: 'UE-DJANGO-SERVICE-WRITE-PATHS-CONTAINED-20261102',
  status: 'SOURCE_CHANGED_UNIT_PASS_NOT_QUALIFIED',
  defectCredit: 0,
  closureCredit: 0,
  evidenceFile: 'docs/union-eyes/convergence/remediation/evidence/ue-django-service-write-paths-contained-20261102.md',
  sourceBaseline: baseline,
  sourceCommit,
  files,
  correction:
    'Eighteen generated Django service ViewSets under /api/services/ were IsAuthenticated only, with no role and mostly no tenant scope: any signed-in user could send push, SMS and email, change location-tracking and privacy configuration, approve access to indigenous traditional knowledge, change payment and currency policy, declare or lift force majeure, issue or convert a golden share, define and trigger workflows and list every model and field; 64 create paths (48 behind that permission) built the row from every key of the request body. The application calls exactly one of them (governance-service/check_status, through services/governance-service.ts, used by lib/middleware/admin-auth.ts and lib/trust/system-metrics.ts). Seventeen are contained with core.isolation.DenyAllPermission; governance-service is default-deny with check_status as its only live action. services/tests_service_write_path_containment.py (9 tests, DRF view layer): an authenticated caller reaches exactly that one action over every registered ViewSet and action, the other 150+ routes answer 403 and write nothing, an anonymous caller reaches none; reopening a ViewSet or adding a live action fails the tests.',
  remaining:
    'No HTTP-level proof (the middleware needs Redis and request signing). The four serializer-based control-plane modules (services/integration_control_plane, events, evidence_pack, compliance_snapshot) are IsAuthenticated and were not reviewed. check_status returns the global golden share to any authenticated caller (a role gate is an institutional decision). UE_V2_APPLICATION_ACTOR_MAP.json pins file hashes of these modules, was last generated on 2026-10-26 and is not regenerated. Reopening a ViewSet needs a reviewed, tenant-scoped, role-gated design and a caller. Exact-SHA CI for the final head; independent reviewer. No defect or CLOSED credit.',
}

const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
const index = ledger.crossCuttingSourceEvidence.findIndex((existing) => existing.id === tranche9.id)
if (index === -1) ledger.crossCuttingSourceEvidence.push(tranche9)
else ledger.crossCuttingSourceEvidence[index] = tranche9
console.log(index === -1 ? 'added' : 'replaced', tranche9.id, `(${files.length} files)`)
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')
