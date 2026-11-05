const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/exit-interviews/[id]/review/route.ts', [
  [
    "    if (existing.createdBy === userId) {\n      throw ApiError.forbidden('The author of an exit interview cannot review it');\n    }",
    "    if (existing.createdBy === userId) {\n      throw ApiError.forbidden('The author of an exit interview cannot review it');\n    }\n    // Nor does whoever last changed it: the record keeps no separate submitter, so the last editor stands in for the person who prepared the\n    // interview for review.\n    if (existing.updatedBy && existing.updatedBy === userId) {\n      throw ApiError.forbidden('The person who last edited or submitted an exit interview cannot review it');\n    }",
  ],
])
edit('app/api/exit-interviews/[id]/documents/route.ts', [
  [
    "    // A published or archived interview is a finished record; material is attached while it is being prepared.\n    if (interview.status === 'published' || interview.status === 'archived') {\n      throw ApiError.conflict('Cannot attach documents to a published or archived interview');\n    }",
    "    // A reviewed, published or archived interview is no longer being prepared: what the reviewer approved is what is published.\n    if (interview.status === 'reviewed' || interview.status === 'published' || interview.status === 'archived') {\n      throw ApiError.conflict('Cannot attach documents to a reviewed, published or archived interview');\n    }",
  ],
])
