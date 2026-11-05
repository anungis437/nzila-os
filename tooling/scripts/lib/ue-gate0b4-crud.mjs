/**
 * Generic CRUD facts for Gate 0B.4. The route configuration, the table definition (taken from the file the route's own
 * import resolves to), the CRUD governance class and the factory behaviour are all read from source at build time.
 * A domain supplies only what no source line can say: the business meaning of the table and the defects it carries.
 */
import { governanceClassOf } from './ue-gate0b1-classification.mjs'
import { mk } from './ue-gate0b4-record.mjs'
import { CRUD_GOVERNANCE, CRUD_FACTORY, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const PERSONAL_COLUMNS = ['email', 'phone', 'phoneNumber', 'mobile', 'address', 'dateOfBirth', 'senderId', 'recipientId', 'employeeId', 'memberId', 'userId']
const OWNER_COLUMNS = ['userId', 'memberId']

export const MASS_CREATE = '? { ...(body as Record<string, unknown>) }'
export const MASS_PATCH = 'let updates = stripBlockedPatchFields(body, { pk, orgScoped, blockedPatchFields });'

/** Everything the source says about the table a CRUD route is configured over. */
export function crudModel(a, readText) {
  const routeText = readText(a.routeFile)
  const tableName = routeText.match(/table:\s*(\w+),/)?.[1]
  if (!tableName) throw new Error(`${a.route} configures no table`)
  const text = a.tableText(tableName)
  const sql = text.match(/pgTable\(\s*['"](\w+)['"]/)?.[1]
  const columns = [...text.matchAll(/^\s+(\w+):\s*\w+\(/gm)].map((match) => match[1])
  const explicitOwner = routeText.match(/ownerColumn:\s*'(\w+)'/)?.[1]
  const lowRoleOwner = explicitOwner ? null : OWNER_COLUMNS.find((name) => columns.includes(name)) ?? null
  const lowRoleDeny = !explicitOwner && !lowRoleOwner && PERSONAL_COLUMNS.some((name) => columns.includes(name))
  return {
    tableName,
    sql,
    columns,
    hasOrg: columns.includes('organizationId'),
    hasStatus: columns.includes('status'),
    orgScoped: /orgScoped:\s*true/.test(routeText),
    readRole: routeText.match(/readRole:\s*'(\w+)'/)?.[1],
    writeRole: routeText.match(/writeRole:\s*'(\w+)'/)?.[1],
    entitlement: routeText.match(/entitlement:\s*'(\w+)'/)?.[1],
    explicitOwner,
    lowRoleOwner,
    lowRoleDeny,
    governance: governanceClassOf(readText(CRUD_GOVERNANCE), sql),
  }
}

/** Enum values for a status column, read from the schema file that defines the enum. */
export function statusEnumValues(a, model, readText) {
  const text = a.tableText(model.tableName)
  const enumName = text.match(/status:\s*(\w+)\(/)?.[1]
  if (!enumName) return null
  const file = a.definedIn(model.tableName)
  const source = readText(file)
  const start = source.indexOf(`export const ${enumName}`)
  if (start < 0) return { enumName, values: null, file }
  const block = source.slice(start, source.indexOf(']', start))
  return { enumName, values: [...block.matchAll(/["'](\w+)["']/g)].map((match) => match[1]).slice(1), file, marker: source.slice(start, source.indexOf('\n', start)).trim() }
}

/**
 * Builds a CRUD record. `p` is the domain profile for the table:
 *   persona, owner, sens, priv(method, model), does(method, model), future, gate, deps, status, def(method, model),
 *   extraEv(a, model), decisions, cross, reqRead, authExtra(method)
 */
export function crudRecord(a, readText, p) {
  const model = crudModel(a, readText)
  const { method } = a
  const isRead = method === 'GET'
  const floor = isRead ? model.readRole : method === 'DELETE' ? 'admin' : model.writeRole
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
  if (model.explicitOwner) evidence.push(a.h('authorization', `ownerColumn: '${model.explicitOwner}'`))

  let mut = 'NOT_MUTATING'
  let auditDetail = 'A read: the generic factory writes no row and no audit record.'
  let reqAudit = p.reqRead ?? 'Reads need no audit record unless the rows carry personal data; then audit them once the readers are named.'
  const corr = []
  const def = [...(p.def?.(method, model) ?? [])]
  if (isRead) evidence.push(a.imp('mutation', 'crudRoutes', /db\.select\(\)\.from\(table\)/))
  else {
    mut = 'ATOMIC_AUDIT_IN_TRANSACTION'
    auditDetail = `${model.sql} is ${model.governance}, so the factory commits the audit record in the same tenant transaction (crud.${model.sql}.<action>) and lists the field names it changed.`
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
  if (model.governance !== 'OPERATIONAL') throw new Error(`${a.route} ${method}: ${model.sql} is ${model.governance}; the CRUD facts assume an OPERATIONAL table`)
  if (!model.hasOrg && model.orgScoped) def.push('DEF-0B4-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN')
  evidence.push(...(p.extraEv?.(a, model) ?? []))

  const tenant = model.orgScoped && model.hasOrg
    ? 'orgScoped: true and the table has an organization column: the factory scopes the query to the session organization.'
    : model.orgScoped
      ? 'orgScoped: true is a no-op here: the table has no organization column, so the query carries no tenant predicate.'
      : 'orgScoped: false: the factory adds no tenant predicate.'
  const rec = mk({
    persona: p.persona ?? `Organization ${floor} or above through the generic CRUD factory`,
    service: `${CRUD_FACTORY} (crudRoutes over ${model.sql})`,
    authn: 'Authenticated session resolved by the generic CRUD factory (crudRoutes over withApi).',
    authz: `Generic CRUD role floor: ${method} requires ${floor}${model.entitlement ? ` and the ${model.entitlement} entitlement` : ''}${model.explicitOwner ? `, with every row held to ${model.explicitOwner} equal to the session user id` : ''}. A role title is not a kernel decision.`,
    tenant: p.tenant ?? tenant,
    owner: p.owner,
    sens: p.sens,
    priv: p.priv(method, model),
    mut,
    auditDetail,
    reqAudit,
    does: p.does(method, model, floor),
    status: p.status?.(method, model) ?? 'PARTIAL',
    gate: p.gate,
    deps: p.deps,
    future: p.future,
    dec: p.decisions ?? [],
    ev: evidence,
    def,
    corr: [...corr, ...(p.corr?.(method, model) ?? [])],
    crudTable: model.sql,
    crudClass: model.governance,
    cross: p.cross?.(method, model),
  })
  return rec
}
