const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('lib/services/clause-service.ts', [
  [`export async function getClausesByCBAId(
  cbaId: string,
  _options: ClauseSearchOptions = {}
): Promise<Clause[]> {`, `// A clause is named by its agreement and by the organization that holds it: a clause written against another organization's agreement id never appears here.
export async function getClausesByCBAId(
  cbaId: string,
  organizationId: string,
  _options: ClauseSearchOptions = {}
): Promise<Clause[]> {`],
  [`      .where(eq(cbaClause.cbaId, cbaId))
      .orderBy(asc(cbaClause.orderIndex), asc(cbaClause.clauseNumber));`, `      .where(and(eq(cbaClause.cbaId, cbaId), eq(cbaClause.organizationId, organizationId)))
      .orderBy(asc(cbaClause.orderIndex), asc(cbaClause.clauseNumber));`],
])
edit('lib/services/bargaining-notes-service.ts', [
  [`export async function getBargainingNotesByCBA(
  cbaId: string,
  sessionType?: string
): Promise<BargainingNote[]> {
  try {
    const conditions = [eq(bargainingNotes.cbaId, cbaId)];`, `export async function getBargainingNotesByCBA(
  cbaId: string,
  organizationId: string,
  sessionType?: string
): Promise<BargainingNote[]> {
  try {
    const conditions = [eq(bargainingNotes.cbaId, cbaId), eq(bargainingNotes.organizationId, organizationId)];`],
])
edit('app/api/cbas/[id]/route.ts', [
  ['await getClausesByCBAId(id);', 'await getClausesByCBAId(id, organizationId);'],
  ['(await getBargainingNotesByCBA(id)).filter(', '(await getBargainingNotesByCBA(id, organizationId)).filter('],
])
edit('app/api/__tests__/cbas-bargaining-notes.route.test.ts', [
  [`    expect(m.getCba).toHaveBeenCalledWith('org-1', 'c1', { countView: false });
    expect(body.bargainingNotes`, `    expect(m.getCba).toHaveBeenCalledWith('org-1', 'c1', { countView: false });
    expect(m.getNotes).toHaveBeenCalledWith('c1', 'org-1');
    expect(body.bargainingNotes`],
])
edit('lib/__tests__/clause-service.test.ts', [
  [`getClausesByCBAId('cba1');`, `getClausesByCBAId('cba1', 'org1');`],
  [`getClausesByCBAId('cba1')).rejects`, `getClausesByCBAId('cba1', 'org1')).rejects`],
])
edit('lib/services/__tests__/bargaining-notes-service.test.ts', [
  [`getBargainingNotesByCBA("cba-1");`, `getBargainingNotesByCBA("cba-1", "org-1");`],
  [`getBargainingNotesByCBA("cba-1", "negotiation");`, `getBargainingNotesByCBA("cba-1", "org-1", "negotiation");`],
  [`getBargainingNotesByCBA("cba-1")).rejects`, `getBargainingNotesByCBA("cba-1", "org-1")).rejects`],
])
console.log('ok')
