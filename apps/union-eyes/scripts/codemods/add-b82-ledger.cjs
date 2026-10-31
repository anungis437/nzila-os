const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B82-ATTACH-CASCADE-CRON'
const test = A + 'lib/services/__tests__/s26-attach-cascade-cron.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const item = (prefix, files, explanation) => ({ prefix, status: ST, files: [...files, test], explanation })

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Interview document location, cascade wording, per-capita job, education reminder cap, precedent reads',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B7-EXC-DOCUMENT-ATTACH-ACCEPTS-ANY-URL-ON-SHARED-HOST-OR-LOCALHOST',
        [
          A + 'lib/knowledge-transfer/governance/document-location.ts',
          A + 'app/api/exit-interviews/[id]/documents/route.ts',
          A + 'app/api/__tests__/exit-interviews-mutations.route.test.ts',
        ],
        'A document location must be https on an exact approved host (UE_DOCUMENT_STORAGE_HOSTS, default the shared storage account; a subdomain is another party\'s host and is refused), carry no credentials, query string or fragment (so a signed-access token is never stored), and have the organization id as a path segment so one organization cannot register another\'s object; localhost is accepted outside production only. The attach test body was moved to a path inside the organization area and four refusal cases were added (disclosed). The storage path convention (organization id as a segment) is a rule this change introduces: no uploader in the repository produces these URLs, so the client of the presigned-URL flow must follow it.',
      ),
      item(
        'DEF-0B7-COGA-CASCADE-REGULATORY-RISK-IS-A-LABEL-TEMPLATE',
        [A + 'lib/knowledge-transfer/cascade-analysis/cascade-analyzer.ts', A + 'lib/knowledge-transfer/cascade-analysis/__tests__/cascade-analyzer.test.ts'],
        'regulatoryRisks lists only the areas that depend on a compliance node, worded as a dependency ("Depends on a compliance node: X"), with regulatoryAssessment dependency_only_no_regulation_assessed; the three fixed recommendation sentences are gone (the list is empty). The analyzer test was rewritten for this (disclosed).',
      ),
      item(
        'DEF-0B6-SYS-PER-CAPITA-CRON-WRITES-A-DOMAIN-DECLARED-NOT-IMPLEMENTED',
        [A + 'app/api/cron/monthly-per-capita/route.ts', A + 'lib/operations/scheduled-jobs.json'],
        'The monthly per-capita route no longer calculates or writes anything: it answers 501 to an administrator (the affiliate remittance capability is NOT_IMPLEMENTED), and its schedule entry is removed so no monthly run fails for it. The calculator service and its tests are untouched.',
      ),
      item(
        'DEF-0B6-EDU-CRON-UNBOUNDED-SEQUENTIAL-SENDS',
        [A + 'app/api/cron/education-reminders/route.ts'],
        'Each reminder kind is capped at 300 recipients per run, the remainder is reported as truncated in the job details and logged, so the run no longer grows with the member count past the job timeout.',
      ),
      item(
        'DEF-0B11-PRP-PRECEDENT-LIBRARY-READS-RETURN-EVERY-COLUMN-AND-IGNORE-IS-PUBLIC-AND-ACCESS-RESTRICTIONS',
        [A + 'lib/services/precedent-service.ts', A + 'lib/precedents/public-decision-view.ts', A + 'app/api/precedents/route.ts', A + 'app/api/precedents/search/route.ts'],
        'Verified in source: every library read (by id, case number, list, search, issue type, related, statistics, most cited) filters isPublic and empty access restrictions in SQL, and the list, issue-type, most-cited and search routes answer an explicit public projection without the full text, grievor, remedy or provenance columns.',
      ),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B82 added')
