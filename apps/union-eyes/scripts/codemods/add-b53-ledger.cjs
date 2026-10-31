const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B53-F12-NOT-SENT-NOT-IMPLEMENTED-AND-RETAINED'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'app/api/__tests__/f12-b53-messaging.contract.test.ts'
  const existing = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation, ...extra })
  ledger.batches.push({
    id,
    family: 'F12: routes that record a send or advertise an operation they do not perform answer 501; communications history is retained',
    evidenceCommit: null,
    items: [
      existing('DEF-0B5-SMS-ROWS-WRITTEN-WITHOUT-SENDING', [A + 'lib/api/records-a-send-only.ts', A + 'app/api/communications/sms/route.ts', A + 'app/api/communications/sms/campaigns/route.ts', A + 'app/api/communications/sms/conversations/route.ts'],
        'The SMS message, campaign and conversation collections keep their officer-floor read, and their POST (which inserted rows carrying status, provider id, price and delivery times for messages never sent) now answers 501 and writes nothing. Contract test pins the read and the refusal.'),
      existing('DEF-0B5-SMS-READ-ROUTE-IS-GENERIC-MESSAGE-CRUD', [A + 'app/api/communications/sms/conversations/[conversationId]/read/route.ts', A + 'lib/api/__tests__/f07-read-authority.contract.test.ts'],
        'The conversation read path no longer lists every message of the organization or inserts a message row: both methods answer 501 at the officer floor. The F07 read-authority contract test listed this path among the CRUD floors and was adjusted to drop it (disclosed); the new test pins the 501.'),
      existing('DEF-0B5-COMMS-TEMPLATE-HARD-DELETE', [A + 'app/api/communications/templates/[id]/route.ts', A + 'app/api/messaging/templates/[id]/route.ts'],
        'Both message-template item routes declare retainOnDelete: DELETE answers 409 and the template (and the campaign links it keeps) survives.',
        { status: 'PARTIAL', remaining: 'No archive or withdrawal action exists yet, so a template can no longer be removed through the API.' }),
      existing('DEF-0B5-COMMS-LIST-DELETE-ERASES-SUBSCRIBER-CONSENT-TRAIL', [A + 'app/api/communications/distribution-lists/[id]/route.ts'],
        'The distribution-list item route declares retainOnDelete, so a delete can no longer cascade away the subscribed, unsubscribed and unsubscribe-reason history of the list.',
        { status: 'PARTIAL', remaining: 'No archive action exists yet.' }),
      existing('DEF-0B4-BATCH-STATUS-FABRICATED-PROCESSING', [A + 'app/api/billing/batch-status/[jobId]/route.ts'],
        'A job id that is not a campaign job, or a campaign of another organization, is answered 404 instead of a fabricated processing status with a start time of now; the failed-recipient list names a recipient id, not an e-mail address.'),
      existing('DEF-0B10-ORG-NLRB-AND-LABOUR-BOARD-FILING-ROUTES-RECORD-NO-FILING', [A + 'app/api/organizing/nlrb-filings/route.ts', A + 'app/api/organizing/labour-board/route.ts'],
        'Existing implementation, verified by a new source-contract test: both filing paths answer 501 and neither is the generic campaign CRUD any more.'),
      existing('DEF-0B10-ORG-FORM-GENERATION-ROUTE-RETURNS-JSON', [A + 'app/api/organizing/forms/generate/route.ts'],
        'Existing implementation, verified: the form generation path answers 501 and no longer inserts or lists campaign rows.',
        { status: 'PARTIAL', remaining: 'The client still saves a JSON response as a PDF; the form generator itself is not built.' }),
      existing('DEF-0B8-JUR-MEETING-ROOM-BOOKINGS-PATH-IS-THE-ROOM-ITEM', [A + 'app/api/meeting-rooms/[id]/bookings/route.ts'],
        'Existing implementation, verified: the bookings path answers 501 for GET and POST, reads and writes no room or booking row.',
        { status: 'PARTIAL', remaining: 'The room_bookings table is not migrated; the booking rules in lib/services/room-booking-rules.ts are not wired in.' }),
      existing('DEF-0B4-CARBON-ORG-ID-FROM-QUERY-STRING', [A + 'app/api/carbon/dashboard/route.ts'],
        'Existing implementation, verified: the carbon dashboard no longer reads an organization id from the query string and no longer returns figures; it answers 501.'),
      existing('DEF-0B5-SURVEY-RESPONSES-ROUTE-IGNORES-SURVEY-ID', [A + 'app/api/communications/surveys/[surveyId]/responses/route.ts'],
        'Existing implementation, verified: the response create verifies the survey belongs to the caller organization, is active and open, and strips respondent identity for an anonymous survey; the list is a count-only steward read of the path survey.',
        { status: 'PARTIAL', remaining: 'The POST still takes the survey id from the body rather than the path.' }),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B53 added')
