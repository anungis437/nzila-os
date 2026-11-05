const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B85-DECISIONS-APPLIED'
const test = A + 'lib/services/__tests__/s29-decisions-applied.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const item = (prefix, files, explanation) => ({ prefix, status: ST, files: [...files, test], explanation })

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Owner decisions applied: organization types, calendar revocation, bot challenge',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B10-OPL-04',
        [A + 'app/api/organizations/route.ts', A + 'components/admin/OrganizationHierarchyAdmin.tsx', A + 'messages/en.json', A + 'messages/fr.json'],
        'The create handler stores description, province, charter number and affiliation date in their columns. The hierarchy admin selector now offers the canonical types (platform, congress, federation, union, local, region, district) in English and French instead of the legacy labels the handler refused, and create and update decide success from the HTTP status (the handler never returned a success field) and show the refusal.',
      ),
      item(
        'DEF-0B3-CALENDAR-DISCONNECT-ADMIN-FLOOR-NO-REVOKE',
        [A + 'lib/external-calendar-sync/provider-revocation.ts', A + 'app/api/calendar-sync/connections/[id]/route.ts', A + 'app/api/__tests__/calendar-sync-connections-owner-scoping.route.test.ts'],
        'A member disconnects their own calendar (member floor, own connection only). The provider is asked to revoke the grant first (Google: the token revocation endpoint with a 5 second bound; Microsoft has no per-token revocation, so it reports not_supported rather than ending every session of the person), the local credentials are then deleted whatever the provider answered, and the audit row and the response say what happened (providerRevocation, providerRevocationVerified). The owner-scoping delete test was rewritten for the two-step flow and two cases were added (disclosed).',
      ),
      item(
        'DEF-0B6-SYS-CONTACT-RATE-LIMIT-KEYED-ON-FORGEABLE-ADDRESS-NO-BOT-CHALLENGE',
        [A + 'lib/public-intake/bot-challenge.ts', A + 'lib/public-intake/guard.ts', A + 'app/api/contact/route.ts', A + 'app/(marketing)/contact/contact-form.tsx', A + 'lib/public-intake/__tests__/bot-challenge.test.ts'],
        'The contact route asks for a Cloudflare Turnstile token (guardPublicIntake challenge: true: x-turnstile-token header or the body turnstileToken, stripped before the route sees the body). Production fails closed: no configured secret answers 503 and an unreachable verifier is a refusal; outside production an unconfigured challenge is open. The contact form renders the widget when a site key is configured and sends the token. The address the limit keys on was already the trusted-hop address (earlier batch).',
      ),
      item(
        'DEF-0B8-ICRA-PUBLIC-WRITES-HAVE-NO-BOT-CHALLENGE-AND-TURNSTILE-IS-OPTIONAL',
        [A + 'app/api/icra/start/route.ts', A + 'app/api/icra/checkout/route.ts', A + 'app/api/workbook/start/route.ts', A + 'app/api/workbook/checkout/route.ts', A + 'app/api/icra/submit/route.ts', A + 'components/icra/ICRAReportGate.tsx'],
        'The ICRA start and checkout and the workbook start and checkout routes ask for the same Turnstile token and fail closed in production; ICRA submit, which already verified a token, now refuses (503) in production when no secret is configured instead of treating the challenge as satisfied. The report checkout component renders the widget and sends the token. The workbook start page writes through a server component, not this route, and is unchanged.',
      ),
    ],
  })
}

const post = ledger.batches.flatMap((x) => x.items).find((i) => i.prefix.startsWith('DEF-0B11-SOC-POST-PUBLISHES-AT-ONCE'))
if (!post) throw new Error('post item')
post.status = ST
delete post.remaining
post.files = [...new Set([...(post.files || []), A + 'app/api/social-media/posts/route.ts', A + 'app/api/social-media/posts/review/route.ts', A + 'lib/social-media/social-media-service.ts', A + 'app/api/__tests__/social-posts-review.route.test.ts', A + 'app/api/__tests__/social-posts-and-redemptions-audit.route.test.ts', test])]
if (!post.explanation.includes('B85')) post.explanation += ' B85: POST /api/social-media/posts now only records a draft for each named account (account_ids is required and each account must be an active account of the organization on a selected platform), with its audit record in the same transaction; nothing is sent. A different officer approves or rejects it at POST /api/social-media/posts/review (the author cannot; a rejection needs a reason): the approval is claimed atomically before anything is sent, the external publish is audited before and after, the post is completed in place, and the deciding officer and time are kept on the post. The publish tests that pinned an immediate publish were rewritten for the draft flow (disclosed) and a review-route test file was added.'

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B85 added')
