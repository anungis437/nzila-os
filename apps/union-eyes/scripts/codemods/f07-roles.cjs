const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
const READ = "  readRole: 'member',\n"

// SMS: message bodies, conversations and campaigns carry member phone numbers and private exchanges; an officer reads them, not a steward or member.
for (const f of [
  'app/api/communications/sms/route.ts',
  'app/api/communications/sms/campaigns/route.ts',
  'app/api/communications/sms/conversations/route.ts',
  'app/api/communications/sms/conversations/[conversationId]/read/route.ts',
]) {
  edit(f, [
    [READ, "  // Message content, recipients and member phone numbers: officer authority, never a member or steward floor.\n  readRole: 'officer',\n"],
    ["  writeRole: 'steward',\n", "  writeRole: 'officer',\n"],
  ])
}

// Bargaining proposals include unreleased drafts of the union's position.
for (const f of ['app/api/bargaining/proposals/route.ts', 'app/api/bargaining/proposals/[id]/route.ts']) {
  edit(f, [[READ, "  // Draft bargaining positions are confidential to those who bargain.\n  readRole: 'steward',\n"]])
}

// The joint health-and-safety committee roster names the members and employer designees.
for (const f of ['app/api/cnesst/hs-committees/route.ts', 'app/api/cnesst/hs-committees/[id]/route.ts']) {
  edit(f, [[READ, "  // The roster names the worker and employer members of the committee.\n  readRole: 'steward',\n"]])
}

edit('app/api/analytics/kpis/route.ts', [[READ, "  readRole: 'member',\n  // The alert recipients are user ids and email addresses of the staff who are notified.\n  omitFromResponse: ['alertRecipients'],\n"]])

for (const f of ['app/api/committees/route.ts', 'app/api/committees/[id]/route.ts']) {
  edit(f, [[READ, "  readRole: 'member',\n  // Internal notes and custom fields are the committee's working record, not a directory entry.\n  omitFromResponse: ['notes', 'customFields'],\n"]])
}

for (const f of ['app/api/communications/surveys/route.ts', 'app/api/communications/surveys/[surveyId]/route.ts']) {
  edit(f, [
    ["import { surveys } from '@/db/schema';", "import { ne } from 'drizzle-orm';\nimport { surveys } from '@/db/schema';"],
    [READ, "  readRole: 'member',\n  // A draft survey is unpublished work; a member reads only surveys that have left draft.\n  belowStaffReadCondition: ne(surveys.status, 'draft'),\n"],
  ])
}
console.log('ok')
