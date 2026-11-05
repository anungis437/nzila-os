const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/communications/distribution-lists/[id]/subscribers/route.ts', [
  ["    auth: { required: true, minRole: 'member' },", "    // The list is the subscribers' e-mail addresses, so it is read by the staff who send to them, and bounded.\n    auth: { required: true, minRole: 'steward' },"],
  ["      .orderBy(desc(newsletterListSubscribers.subscribedAt));", "      .orderBy(desc(newsletterListSubscribers.subscribedAt))\n      .limit(5000);"],
])
for (const f of ['app/api/communications/distribution-lists/route.ts', 'app/api/communications/distribution-lists/[id]/route.ts']) {
  edit(f, [["  readRole: 'member',\n", "  // A distribution list names its audience and carries its filter criteria: staff read it.\n  readRole: 'steward',\n"]])
}
edit('app/api/extensions/[id]/route.ts', [[
  "export const PATCH = withApi(\n  {\n    auth: { required: true, minRole: 'steward' },",
  "export const PATCH = withApi(\n  {\n    // Rewriting an integration's endpoint and field mapping redirects where organization data is sent: an administrator's act, as the delete is.\n    auth: { required: true, minRole: 'admin' },",
]])
console.log('ok')
