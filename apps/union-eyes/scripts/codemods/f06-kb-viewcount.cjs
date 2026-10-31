const fs = require('fs')
const f = 'app/api/knowledge-base/[id]/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap("      id: knowledgeBase.id,\n      title: knowledgeBase.title,", "      id: knowledgeBase.id,\n      organizationId: knowledgeBase.organizationId,\n      title: knowledgeBase.title,")
swap(
  "    sql`UPDATE knowledge_base SET view_count = view_count + 1 WHERE id = ${id}::uuid`,",
  "    // The counter is bumped on the exact row that was read, with its organization in the predicate: the system context is not tenant-scoped.\n    sql`UPDATE knowledge_base SET view_count = view_count + 1 WHERE id = ${id}::uuid AND organization_id = ${row.organizationId}::uuid`,",
)
swap("  return NextResponse.json({ data: row });", "  const { organizationId: _owner, ...visible } = row;\n  return NextResponse.json({ data: visible });")
fs.writeFileSync(f, s)
console.log('ok')
