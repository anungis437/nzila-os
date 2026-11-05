const fs = require('fs')
const f = 'app/api/ml/predictions/sla-breach-risk/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 60)}`); s = s.replace(a, b) }
swap(
  "export const GET = withApi(\n  {\n    auth: { minRole: 'member' },",
  "export const GET = withApi(\n  {\n    // The list is the same model output the POST produces, so it is read at the same floor and behind the same gate and safety check.\n    auth: { minRole: 'steward' },",
)
swap(
  "  async ({ organizationId }) => {\n    if (!organizationId) throw ApiError.badRequest('Organization context required');\n\n    const predictions = await db",
  "  async ({ organizationId, userId }) => {\n    if (!organizationId) throw ApiError.badRequest('Organization context required');\n\n    const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {\n      organizationId,\n      userId: userId ?? '',\n    });\n    if (blocked) return blocked;\n\n    enforceAISafety({ origin: 'sla-breach-risk', action: 'GET', organizationId, userId: userId ?? '', userRole: 'steward', dataClass: 'confidential' });\n\n    const predictions = await db",
)
fs.writeFileSync(f, s)
console.log('ok')
