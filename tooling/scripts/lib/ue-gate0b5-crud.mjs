/**
 * Generic CRUD facts for Gate 0B.5. The route configuration, the table definition (taken from the file the route's own
 * import resolves to), the CRUD governance class and the factory behaviour are all read from source at build time.
 * Gate 0B.4 assumed every table is OPERATIONAL. This tranche meets READ_ONLY and DENIED tables (writes, and for DENIED
 * also reads, are refused by the factory), owner columns a route declares but the table does not have, and tables
 * whose owner column the low-role guard uses. A domain supplies only what no source line can say: the business
 * meaning of the table and the defects it carries.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { CRUD_GOVERNANCE, CRUD_FACTORY, LOW_ROLE, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { MASS_CREATE, MASS_PATCH, crudModel, statusEnumValues } from './ue-gate0b4-crud.mjs'

export { MASS_CREATE, MASS_PATCH, crudModel, statusEnumValues }

const GOVERNANCE_WORDS = {
  OPERATIONAL: 'OPERATIONAL',
  READ_ONLY: 'READ_ONLY',
  DENIED: 'DENIED',
}

/**
 * Builds a CRUD record. `p` is the domain profile for the table:
 *   persona, owner, sens, priv(method, model), does(method, model, floor), future, gate, deps, status, def(method, model),
 *   extraEv(a, model), decisions, cross, reqRead, corr(method, model), tenant, inferences
 */
export function crudRecord(a, readText, p) {
  const model = crudModel(a, readText)
  const { method } = a
  const isRead = method === 'GET'
  const floor = isRead ? model.readRole : method === 'DELETE' ? 'admin' : model.writeRole
  const ownerAbsent = Boolean(model.explicitOwner) && !model.columns.includes(model.explicitOwner)
  const refusesRead = model.governance === 'DENIED'
  const refusesWrite = model.governance !== 'OPERATIONAL'
  if (!GOVERNANCE_WORDS[model.governance]) throw new Error(`${a.route}: ${model.sql} is ${model.governance}, which the Gate 0B.5 CRUD facts do not describe`)
  const refused = isRead ? refusesRead : refusesWrite

  const evidence = [
    ...(method === 'DELETE' ? [] : [a.h('authorization', isRead ? `readRole: '${model.readRole}'` : `writeRole: '${model.writeRole}'`)]),
    ...guardEv(a, 'crud'),
    a.h('tenantScope', model.orgScoped ? 'orgScoped: true,' : 'orgScoped: false,'),
    model.hasOrg
      ? a.tbl('tenantScope', model.tableName, /organizationId:/)
      : a.tbl('tenantScope', model.tableName, /pgTable\(|\.table\(/, { absentColumns: ['organizationId'] }),
    a.sch('scope', CRUD_GOVERNANCE, `'${model.sql}'`),
  ]
  if (model.entitlement) evidence.push(a.h('authorization', `entitlement: '${model.entitlement}'`))
  if (model.explicitOwner) {
    evidence.push(a.h('authorization', `ownerColumn: '${model.explicitOwner}'`))
    if (ownerAbsent) {
      evidence.push(
        a.tbl('authorization', model.tableName, /pgTable\(/, { absentColumns: [model.explicitOwner] }),
        a.imp('authorization', 'crudRoutes', 'if (ownerCol && userId) {'),
      )
    }
  }
  if (model.lowRoleOwner && isRead && model.readRole === 'member') evidence.push(a.sch('privacy', LOW_ROLE, "const OWNER_COLUMNS = ['userId', 'memberId'] as const"))

  let mut = 'NOT_MUTATING'
  let auditDetail = 'A read: the generic factory writes no row and no audit record.'
  let reqAudit = p.reqRead ?? 'Reads need no audit record unless the rows carry personal data; then audit them once the readers are named.'
  let nonMutationReason
  const corr = []
  const def = [...(p.def?.(method, model) ?? [])]
  let behaviorStatus = p.status?.(method, model) ?? 'PARTIAL'
  if (isRead && !refusesRead) evidence.push(a.imp('mutation', 'crudRoutes', /db\.select\(\)\.from\(table\)/))
  else if (isRead) {
    evidence.push(
      a.imp('mutation', 'crudRoutes', 'assertCrudRead(governance);'),
      a.sch('behavior', CRUD_GOVERNANCE, 'export function assertCrudRead'),
    )
    auditDetail = `${model.sql} is DENIED in the CRUD governance table, so assertCrudRead refuses every read with 403 before any query; nothing is read, written or audited.`
    reqAudit = 'No audit record is needed for a refused read; a dedicated, authority-checked route must decide who may read and audit the reads that return personal data.'
    behaviorStatus = 'LATENT_NOT_OPERATIONAL'
  } else if (refusesWrite) {
    mut = 'WRITE_REFUSED_BY_GOVERNANCE'
    auditDetail = `${model.sql} is ${model.governance} in the CRUD governance table, so assertCrudWrite refuses the write with 403 before any row or audit record is written; nothing is mutated and nothing is audited.`
    reqAudit = 'No audit record is required for a refused write; if the write is later enabled through a dedicated route it must commit its audit record in the same transaction as the row.'
    evidence.push(
      a.imp('mutation', 'crudRoutes', 'assertCrudWrite(governance);'),
      a.sch('audit', CRUD_GOVERNANCE, 'export function assertCrudWrite'),
    )
    corr.push({ field: 'audit', manifest: 'audit CRUD_ATOMIC', actual: `${model.sql} is ${model.governance}, so the write is refused before any row or audit record is written.` })
    behaviorStatus = 'LATENT_NOT_OPERATIONAL'
  } else if (!isRead) {
    mut = 'ATOMIC_AUDIT_IN_TRANSACTION'
    auditDetail = `${model.sql} is OPERATIONAL, so the factory commits the audit record in the same tenant transaction (crud.${model.sql}.<action>) and lists the field names it changed.`
    reqAudit = 'Keep the factory in-transaction audit record and add the authorization decision and the changed values to it.'
    evidence.push(a.imp('audit', 'crudRoutes', 'await persistAtomicAudit(tx, {'))
    if (method === 'POST') evidence.push(a.imp('mutation', 'crudRoutes', 'tx.insert(table).values(finalValues)'), a.imp('defect', 'crudRoutes', MASS_CREATE))
    if (method === 'PATCH') evidence.push(a.imp('mutation', 'crudRoutes', /\.update\(table\)/), a.imp('defect', 'crudRoutes', MASS_PATCH))
    if (method === 'DELETE') {
      evidence.push(a.imp('mutation', 'crudRoutes', model.hasStatus ? ".set({ status: 'archived', updatedAt: new Date() } as Record<string, unknown>)" : '// Hard delete for tables without a status column'))
      if (model.hasStatus) {
        const info = statusEnumValues(a, model, readText)
        if (info?.values && !info.values.includes('archived')) {
          evidence.push(a.sch('defect', info.file, info.marker, { symbol: info.enumName }))
          def.push('DEF-0B3-CRUD-SOFT-DELETE-ARCHIVED-NOT-IN-ENUM')
        }
      }
    }
    if (method !== 'DELETE') def.push('DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT')
  }
  if (!isRead && refusesWrite) nonMutationReason = undefined
  if (!model.hasOrg && model.orgScoped) def.push('DEF-0B4-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN')
  evidence.push(...(p.extraEv?.(a, model) ?? []))

  const tenant = model.orgScoped && model.hasOrg
    ? 'orgScoped: true and the table has an organization column: the factory scopes the query to the session organization.'
    : model.orgScoped
      ? 'orgScoped: true is a no-op here: the table has no organization column, so the query carries no tenant predicate.'
      : 'orgScoped: false: the factory adds no tenant predicate.'
  const ownerText = model.explicitOwner
    ? ownerAbsent
      ? `, and the configuration declares ownerColumn ${model.explicitOwner}, which the table does not have, so the factory applies no owner condition`
      : `, with every row held to ${model.explicitOwner} equal to the session user id`
    : ''
  const refusalText = refused ? `; ${model.sql} is ${model.governance} in the CRUD governance table, so the factory then refuses the ${isRead ? 'read' : 'write'}` : ''
  return mk({
    persona: p.persona ?? `Organization ${floor} or above through the generic CRUD factory`,
    service: `${CRUD_FACTORY} (crudRoutes over ${model.sql})`,
    authn: 'Authenticated session resolved by the generic CRUD factory (crudRoutes over withApi).',
    authz: `Generic CRUD role floor: ${method} requires ${floor}${model.entitlement ? ` and the ${model.entitlement} entitlement` : ''}${ownerText}${refusalText}. A role title is not a kernel decision.`,
    tenant: p.tenant ?? tenant,
    owner: p.owner,
    sens: p.sens,
    priv: p.priv(method, model),
    mut,
    auditDetail,
    reqAudit,
    does: p.does(method, model, floor),
    status: behaviorStatus,
    gate: p.gate,
    deps: p.deps,
    future: p.future,
    dec: p.decisions ?? [],
    ev: evidence,
    inf: p.inferences?.(method, model) ?? [],
    def,
    corr: [...corr, ...(p.corr?.(method, model) ?? [])],
    crudTable: model.sql,
    crudClass: model.governance,
    cross: p.cross?.(method, model),
    nonMutationReason,
  })
}
