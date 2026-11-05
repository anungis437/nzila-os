export const APP = 'apps/union-eyes/'
export const APP_API = `${APP}app/api/`
export const CRUD_FACTORY = `${APP}lib/api/crud-factory.ts`
export const CRUD_GOVERNANCE = `${APP}lib/api/crud-governance.ts`
export const LOW_ROLE = `${APP}lib/api/crud-low-role-guard.ts`

export const ev = (ref, quote) => ({ ref, quote })
export const routeEv = (route, quote) => ev(`${APP_API}${route}`, quote)
export const appEv = (file, quote) => ev(`${APP}${file}`, quote)

export const NOT_ATOMIC = { field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'performAuditedOperation records intent and outcome around the effect; it is not committed with it.' }
export const NOT_ATOMIC_EVENT = { field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'The invocation is recorded with a separate auditLog event that is not committed with the row write.' }
export const GET_CORR = (audit) => ({ field: 'mutating', manifest: `mutating true, audit ${audit}`, actual: 'A GET reads state and writes nothing.' })
export const GET_WRITES = (audit) => ({ field: 'mutating', manifest: `read-only GET, audit ${audit}`, actual: 'This GET inserts a row, so the read-only classification is wrong.' })
export const COMPUTE_CORR = (audit) => ({ field: 'mutating', manifest: `mutating true, audit ${audit}`, actual: 'The POST returns a computed result and writes no row.' })
export const NO_ATOMIC_AUDIT_CORR = (audit) => ({ field: 'audit', manifest: `audit ${audit}`, actual: 'The route writes no audit record and no row.' })
