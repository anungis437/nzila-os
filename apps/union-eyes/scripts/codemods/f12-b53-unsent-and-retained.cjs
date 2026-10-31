const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
const IMPORT = "import { recordsASendOnly } from '@/lib/api/records-a-send-only';\n"
for (const [p, what, summary] of [
  ['app/api/communications/sms/route.ts', 'SMS messages', 'Create an SMS message record (not implemented)'],
  ['app/api/communications/sms/campaigns/route.ts', 'SMS campaigns', 'Create an SMS campaign record (not implemented)'],
  ['app/api/communications/sms/conversations/route.ts', 'SMS conversations', 'Create an SMS conversation record (not implemented)'],
]) {
  edit(p, [
    ["import { crudRoutes } from '@/lib/api/crud-factory';\n", "import { crudRoutes } from '@/lib/api/crud-factory';\n" + IMPORT],
    ["const { GET, POST } = crudRoutes({", "const { GET } = crudRoutes({"],
    ["export { GET, POST };", `// The rows record a send (status, provider id, price, delivery times) and this route sends nothing, so it creates none.\nexport const POST = recordsASendOnly('${summary}', '${what}');\nexport { GET };`],
  ])
}

fs.writeFileSync('app/api/communications/sms/conversations/[conversationId]/read/route.ts', `/**
 * GET POST /api/communications/sms/conversations/[conversationId]/read
 *
 * Not implemented. This path advertises marking a conversation read, but it was the generic SMS message collection: it ignored the
 * conversation id, listed every message of the organization and inserted a message row on POST, and nothing was marked read. It now
 * answers HTTP 501 and reads, writes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: {
      tags: ['Communications'],
      summary: 'Mark an SMS conversation read (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Marking an SMS conversation read is not implemented: no read state is stored for conversations.');
  },
);

export const GET = handler;
export const POST = handler;
`)

for (const p of ['app/api/communications/templates/[id]/route.ts', 'app/api/messaging/templates/[id]/route.ts', 'app/api/communications/distribution-lists/[id]/route.ts']) {
  edit(p, [["  itemRoute: true,\n", "  itemRoute: true,\n  // A removed template or list takes its history with it (a list's subscribed and unsubscribed trail cascades); it is retained.\n  retainOnDelete: true,\n"]])
}

edit('app/api/billing/batch-status/[jobId]/route.ts', [
  [
    "      // Query newsletter campaigns to get batch job status\n      // Job ID format: \"campaign-{campaignId}\" or \"batch-{timestamp}\"\n      let status = 'processing';",
    "      // Only a newsletter campaign job exists. Any other id, or a campaign of another organization, is not a job: reporting it as\n      // processing would invent a running job.\n      if (!jobId.startsWith('campaign-')) {\n        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Batch job not found');\n      }\n      let status = 'processing';",
  ],
  [
    "        if (campaign) {\n          // Get recipient stats",
    "        if (!campaign) {\n          return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Batch job not found');\n        }\n        {\n          // Get recipient stats",
  ],
  [
    "              .select({\n                email: newsletterRecipients.email,\n                error: newsletterRecipients.errorMessage,\n              })",
    "              .select({\n                id: newsletterRecipients.id,\n                error: newsletterRecipients.errorMessage,\n              })",
  ],
  ["              recipientEmail: r.email,\n              error: r.error || 'Unknown error',", "              recipientId: r.id,\n              error: r.error || 'Unknown error',"],
])
