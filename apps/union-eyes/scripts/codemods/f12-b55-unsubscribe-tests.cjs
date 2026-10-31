const fs = require('fs')
function patch(p, fn) {
  const s = fs.readFileSync(p, 'utf8')
  const out = fn(s)
  if (out === s) throw new Error('no change ' + p)
  fs.writeFileSync(p, out)
}
patch('app/api/__tests__/communications-unsubscribe.route.test.ts', (s) =>
  s
    .replace("  messageLog: { campaignId: 'campaignId', recipientId: 'recipientId', channelType: 'channelType', status: 'status' },\n}));", "  messageLog: { campaignId: 'campaignId', recipientId: 'recipientId', channelType: 'channelType', status: 'status' },\n  newsletterListSubscribers: { profileId: 'profileId', status: 'status', listId: 'listId' },\n  newsletterDistributionLists: { id: 'id', organizationId: 'organizationId' },\n}));")
    .replace("ne: vi.fn(() => 'ne') };", "ne: vi.fn(() => 'ne'), inArray: vi.fn(() => 'in') };")
    .replace("m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());", "// The unsubscribe writes run on the transaction handed to the callback; the mock db stands in for it.\n    m.withSystemContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));"),
)
patch('app/api/__tests__/communications-public-mutation-isolation.pglite.test.ts', (s) =>
  s
    .replace("import { campaigns, communicationPreferences, consentRecords, messageLog } from '@/db/schema';", "import { campaigns, communicationPreferences, consentRecords, messageLog, newsletterDistributionLists, newsletterListSubscribers } from '@/db/schema';")
    .replace("createTableDatabase([campaigns, messageLog, communicationPreferences, consentRecords, notificationDeliveryLog])", "createTableDatabase([campaigns, messageLog, communicationPreferences, consentRecords, notificationDeliveryLog, newsletterDistributionLists, newsletterListSubscribers])"),
)
