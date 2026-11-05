const fs = require('fs')
const edit = (file, pairs) => {
  let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  for (const [from, to] of pairs) {
    if (!t.includes(from)) throw new Error(`${file}: missing ${from.slice(0, 60)}`)
    t = t.replace(from, to)
  }
  fs.writeFileSync(file, t)
}

edit('app/api/onboarding/peer-benchmarks/route.ts', [
  ["const { userId, organizationId: _organizationId } = context;", "const { userId, organizationId } = context;"],
  [
    "    const reqOrgId = searchParams.get('organizationId');\n\n    if (!reqOrgId) {\n      return standardErrorResponse(\n      ErrorCode.MISSING_REQUIRED_FIELD,\n      'organizationId is required'\n    );\n    }\n",
    "    // The comparison is of the caller's own organization against its peers. A target taken from the request would let any member\n    // read another organization's standing (member count and rates), so a named target must be the caller's own and otherwise reads\n    // as not found.\n    if (!organizationId) {\n      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');\n    }\n    const requested = searchParams.get('organizationId');\n    if (requested && requested !== organizationId) {\n      return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Organization not found');\n    }\n    const reqOrgId = organizationId;\n",
  ],
])

edit('app/api/onboarding/suggest-clauses/route.ts', [
  ["const { userId, organizationId: _organizationId } = context;", "const { userId, organizationId } = context;"],
  [
    "const { organizationId: reqOrgId } = validation.data;",
    "// Suggestions are drawn for the caller's own organization; another organization named in the body reads as not found.\n    if (!organizationId) {\n      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');\n    }\n    if (validation.data.organizationId !== organizationId) {\n      return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Organization not found');\n    }\n    const reqOrgId = organizationId;",
  ],
])
console.log('ok')
