const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/employers/communications/contacts/route.ts', [
  [
    "    const contact = await withRLSContext({ organizationId }, async (tx) => {\n      const [row] = await tx\n        .insert(employerContacts)",
    "    const contact = await withRLSContext({ organizationId }, async (tx) => {\n      // An employer has one primary contact: naming a new one demotes the previous one in the same transaction.\n      if (data.isPrimary) {\n        await tx\n          .update(employerContacts)\n          .set({ isPrimary: false, updatedAt: new Date() })\n          .where(and(eq(employerContacts.organizationId, organizationId), eq(employerContacts.employerId, data.employerId), eq(employerContacts.isPrimary, true)))\n      }\n      const [row] = await tx\n        .insert(employerContacts)",
  ],
])
