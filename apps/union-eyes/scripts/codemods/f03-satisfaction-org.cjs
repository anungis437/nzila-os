const fs = require('fs')
const edit = (file, pairs) => {
  let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  for (const [from, to] of pairs) {
    if (!t.includes(from)) throw new Error(`${file}: missing ${from.slice(0, 60)}`)
    t = t.replace(from, to)
  }
  fs.writeFileSync(file, t)
}
edit('lib/services/satisfaction-service.ts', [
  [
    "export async function getPendingSurveys(memberId: string): Promise<SatisfactionSurvey[]> {\n  return db\n    .select()\n    .from(satisfactionSurveys)\n    .where(\n      and(\n        eq(satisfactionSurveys.memberId, memberId),",
    "export async function getPendingSurveys(memberId: string, organizationId: string): Promise<SatisfactionSurvey[]> {\n  return db\n    .select()\n    .from(satisfactionSurveys)\n    .where(\n      and(\n        eq(satisfactionSurveys.memberId, memberId),\n        eq(satisfactionSurveys.organizationId, organizationId),",
  ],
])
edit('app/api/satisfaction/route.ts', [
  [
    "  async ({ userId }) => {\n    const surveys = await getPendingSurveys(userId!);",
    "  async ({ userId, organizationId }) => {\n    if (!userId || !organizationId) throw ApiError.badRequest('Organization context required');\n    const surveys = await getPendingSurveys(userId, organizationId);",
  ],
])
edit('lib/services/__tests__/satisfaction-service.test.ts', [["expect(await getPendingSurveys('m-1')).toEqual(pending);", "expect(await getPendingSurveys('m-1', 'org-1')).toEqual(pending);"]])
console.log('ok')
