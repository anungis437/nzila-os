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
edit('app/api/__tests__/f12-b53-messaging.contract.test.ts', [
  ["  ])('%s is retained on delete (DEF-0B5-COMMS-TEMPLATE-HARD-DELETE, DEF-0B5-COMMS-LIST-DELETE-ERASES-SUBSCRIBER-CONSENT-TRAIL)', (route) => {\n    expect(read(route)).toContain('retainOnDelete: true')\n  })", "  ])('%s archives on delete instead of removing the row (DEF-0B5-COMMS-TEMPLATE-HARD-DELETE, DEF-0B5-COMMS-LIST-DELETE-ERASES-SUBSCRIBER-CONSENT-TRAIL)', (route) => {\n    expect(read(route)).toContain(\"archiveColumn: 'isActive'\")\n    expect(read(route)).not.toContain('retainOnDelete')\n  })"],
])
edit('lib/services/__tests__/s1-schema-closure.test.ts', [
  ["  it('accepts a KPI direction on create", "  it('archives templates and distribution lists with their is_active flag and lists only active ones (no schema change needed)', () => {\n    const factory = read('lib/api/crud-factory.ts')\n    expect(factory).toContain('archiveColumn?: string')\n    expect(factory).toContain('[opts.archiveColumn as string]: false')\n    for (const route of ['app/api/communications/templates/[id]/route.ts', 'app/api/messaging/templates/[id]/route.ts', 'app/api/communications/distribution-lists/[id]/route.ts']) {\n      expect(read(route), route).toContain(\"archiveColumn: 'isActive'\")\n    }\n    for (const route of ['app/api/communications/templates/route.ts', 'app/api/messaging/templates/route.ts', 'app/api/communications/distribution-lists/route.ts']) {\n      expect(read(route), route).toContain('IS NOT FALSE')\n    }\n  })\n\n  it('accepts a KPI direction on create"],
])
