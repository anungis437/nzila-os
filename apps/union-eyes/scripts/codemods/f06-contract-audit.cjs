const fs = require('fs')
const f = 'services/platform-economics/contract-service.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap("import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';", "import { persistAtomicAudit } from '@/lib/audit/atomic-audit';\nimport type { RLSTx } from '@/lib/db/with-rls-context';")
swap(
  "    await auditLog({\n      eventType: AuditEventType.DATA_CREATE,\n      severity: AuditSeverity.HIGH,\n      organizationId: input.organizationId,\n      resource: 'commercial_contract',\n      resourceId: contractId,\n      action: 'contract_created',\n      userId: input.createdBy,\n      metadata: { contractNumber, lineCount: lines.length },\n    });",
  "    // The record commits with the contract, or neither does.\n    await persistAtomicAudit(tx as unknown as RLSTx, {\n      organizationId: input.organizationId,\n      userId: input.createdBy,\n      action: 'contract_created',\n      resourceType: 'commercial_contract',\n      resourceId: contractId,\n      details: { contractNumber, lineCount: lines.length },\n    });",
)
swap(
  "    await auditLog({\n      eventType: AuditEventType.DATA_UPDATE,\n      severity: AuditSeverity.HIGH,\n      organizationId: contract.organizationId,\n      resource: 'commercial_contract',\n      resourceId: contractId,\n      action: 'contract_activated',\n      userId: approvedBy,\n      metadata: { entitlementCount: entitlements.length },\n    });",
  "    await persistAtomicAudit(tx as unknown as RLSTx, {\n      organizationId: contract.organizationId,\n      userId: approvedBy,\n      action: 'contract_activated',\n      resourceType: 'commercial_contract',\n      resourceId: contractId,\n      details: { entitlementCount: entitlements.length },\n    });",
)
swap(
  "    await auditLog({\n      eventType: AuditEventType.DATA_UPDATE,\n      severity: AuditSeverity.CRITICAL,\n      organizationId: contract.organizationId,\n      resource: 'commercial_contract',\n      resourceId: contractId,\n      action: 'contract_terminated',\n      userId: terminatedBy,\n      metadata: { reason },\n    });",
  "    await persistAtomicAudit(tx as unknown as RLSTx, {\n      organizationId: contract.organizationId,\n      userId: terminatedBy,\n      action: 'contract_terminated',\n      resourceType: 'commercial_contract',\n      resourceId: contractId,\n      details: { reason },\n    });",
)
if (/auditLog\(/.test(s) || /AuditEventType|AuditSeverity/.test(s)) throw new Error('residual audit-logger use')
fs.writeFileSync(f, s)

const t = 'services/platform-economics/__tests__/contract-service.test.ts'
let u = fs.readFileSync(t, 'utf8').replace(/\r\n/g, '\n')
u = u.replace("vi.mock('@/lib/audit-logger', () => ({", "vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.auditLog }));\nvi.mock('@/lib/audit-logger', () => ({")
fs.writeFileSync(t, u)
console.log('ok')
