const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'S08-CONTACT-SUBMISSIONS-STORE-MIGRATIONS-0045-AND-0036'
const known = (start) => { for (const b of ledger.batches) for (const i of b.items) if (i.prefix.startsWith(start)) return i.prefix; throw new Error('no earlier item ' + start) }
if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Schema: a local, system-only record of public contact-form submissions',
    evidenceCommit: null,
    items: [{
      prefix: known('DEF-0B6-SYS-CONTACT-ACKNOWLEDGES'), status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'db/migrations-platform/0045_contact_submissions.sql', A + 'db/migrations-platform/0045_contact_submissions.rollback.sql', A + 'db/migrations-cache/0036_contact_submissions_rls_closure.sql', A + 'db/migrations-cache/0036_contact_submissions_rls_closure.rollback.sql', A + 'db/schema/domains/communications/contact-submissions.ts', A + 'db/rls-storage-authority/communications-notifications.ts', A + 'db/__tests__/rls-storage-authority-registry-composition.test.ts', A + 'app/api/contact/route.ts', A + 'app/api/__tests__/contact-acknowledgement.route.test.ts', A + 'db/__tests__/platform-0045-contact-submissions.pglite.test.ts', A + 'lib/services/__tests__/s9-contact-submissions.test.ts'],
      explanation: 'Migration 0045 adds contact_submissions (every column length-limited, a crm_status check of pending, recorded or failed, retain_until defaulting to two years) and cache 0036 gives it a system-role-only policy; the manifest classifies it SYSTEM_ONLY with no runtime privilege (registry count pin 865 to 866, disclosed). The contact route stores the submission under the system role first, acknowledges the visitor once it exists, then syncs to the CRM and records recorded or failed; an unconfigured or failing CRM no longer refuses or loses the submission, and a failed store answers 503 and contacts no CRM. The route test was rewritten for the new behaviour (the 503-on-unconfigured-CRM cases replaced, disclosed). Proved on PGlite and with route tests.',
    }],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('S08 added')
