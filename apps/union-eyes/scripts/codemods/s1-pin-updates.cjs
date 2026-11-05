const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  const crlf = s.includes('\r\n')
  s = s.replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s)
}
edit('lib/services/__tests__/b55-workflow-integrity.test.ts', [
  ["    const guard = route.indexOf('meeting.updatedBy === userId')", "    const guard = route.indexOf('recorder === userId')"],
  ["    expect(read('app/api/exit-interviews/[id]/review/route.ts')).toContain('existing.updatedBy === userId')", "    expect(read('app/api/exit-interviews/[id]/review/route.ts')).toContain('submitter === userId')"],
])
edit('lib/services/__tests__/b56-content-registration.test.ts', [
  ["    expect(route).toContain(\"currentStatus === 'review' && newStatus === 'published' && current.updated_by === userId\")", "    expect(route).toContain(\"currentStatus === 'review' && newStatus === 'published' && submitter === userId\")"],
])
