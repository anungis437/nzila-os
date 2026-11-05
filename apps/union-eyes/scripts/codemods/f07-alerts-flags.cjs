const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 60)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}

edit('app/api/alerts/realtime/route.ts', [[
  "    auth: { minRole: 'member' },",
  "    // An alert execution carries the rule's trigger data (case, member and system detail), so the inbox is an officer's.\n    auth: { minRole: 'officer' },",
]])

edit('app/api/feature-flags/route.ts', [
  [
    "    if (requestedFlag) {\n",
    "    if (requestedFlag) {\n      // Only a flag the application defines can be asked about: any signed-in user used to probe any flag name, including the names of\n      // unreleased or pilot features, and learn whether it was on for them.\n      if (!KNOWN_FLAGS.has(requestedFlag)) {\n        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Unknown feature flag');\n      }\n",
  ],
  [
    "export const GET = withApiAuth(",
    "const KNOWN_FLAGS: ReadonlySet<string> = new Set<string>(['pilot-mode', ...Object.values(LRO_FEATURES), ...Object.values(AI_FEATURES)]);\n\nexport const GET = withApiAuth(",
  ],
])
console.log('ok')
