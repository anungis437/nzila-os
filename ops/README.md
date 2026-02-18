# Nzila OS — Operations (Ops)

Audience: On-call engineers, platform admins, security, auditors  
Objective: SOC-style operational defensibility

## Folder Structure
- incident-response/
- oncall/
- runbooks/
- disaster-recovery/
- business-continuity/
- compliance/
- change-management/
- security-operations/

## Operating Principles
1. Evidence-first (Azure Blob, hashed artifacts)
2. Append-only ledgers (share_ledger_entries, audit_events)
3. Least privilege (Clerk RBAC + entity scoping)
4. Separation of duties
