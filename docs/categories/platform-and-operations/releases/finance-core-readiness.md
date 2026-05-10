# Finance Core — Release Readiness Report

## Release: Finance Core v0.1.0

**Status**: ✅ Initial capability layer — ready for internal integration

## Scope

This release delivers the foundational Finance Core capability layer as native Nzila OS packages. All packages are in-memory implementations suitable for development, testing, and building higher-level integrations.

## What Is Enabled

| Package | Status | Notes |
|---|---|---|
| `@nzila/finance-core` | ✅ Ready | Accounts, types, feature flags, events, idempotency |
| `@nzila/finance-ledger` | ✅ Ready | Double-entry journal, reversals, reconciliation |
| `@nzila/finance-compliance` | ✅ Ready | Placeholder KYC/sanctions/risk — hooks only |
| `@nzila/finance-governance` | ✅ Ready | Approval workflows, spending controls, community funds |
| `@nzila/finance-analytics` | ✅ Ready | Cashflow, aging, cohort, fee revenue summaries |
| `@nzila/finance-identity` | ✅ Ready | Identity profiles with compliance state integration |

## What Is Placeholder Only

The following capabilities exist as defined interfaces and types but require additional integration work before production use:

| Capability | Placeholder Reason |
|---|---|
| KYC review | Real KYC provider (Onfido, Persona, etc.) not yet wired |
| Sanctions screening | Licensed list provider not yet integrated |
| Payment intent execution | `@nzila/payments-stripe` integration not yet wired at Finance Core level |
| Payout execution | Compliance sign-off required; feature flag defaults to OFF |
| Database persistence | In-memory only; persistence adapters are app-layer responsibility |
| Notification dispatch | Events defined; `@nzila/platform-notifications` wiring is app-layer |
| Audit trail | Hooks defined; `@nzila/audit` wiring is app-layer |

## Test Coverage Summary

| Package | Test Files | Tests | Status |
|---|---|---|---|
| `finance-core` | 2 | 11 | ✅ All pass |
| `finance-ledger` | 2 | 9 | ✅ All pass |
| `finance-compliance` | 2 | 13 | ✅ All pass |
| `finance-governance` | 3 | 18 | ✅ All pass |
| `finance-analytics` | 2 | 4 | ✅ All pass |
| `finance-identity` | 1 | 6 | ✅ All pass |
| **Total** | **12** | **61** | ✅ |

## Risks Remaining

| Risk | Severity | Mitigation |
|---|---|---|
| KYC/sanctions are placeholders | High | `FINANCE_COMPLIANCE_ENABLED` defaults to OFF; document clearly |
| In-memory storage is not persistent | Medium | Production deployments must implement persistence adapters |
| No authorisation enforcement inside packages | Medium | Caller must check permissions via `@nzila/platform-auth` |
| Payout/payment execution not wired | Medium | Feature flags default to OFF; explicit sign-off before enabling |
| No multi-currency ledger entries yet | Low | FX conversion available via `@nzila/fx`; ledger entries are single-currency |
| No database migrations | Low | Finance Core is package-level; migrations are app-layer concern |

## Quality Gates Passed

- [x] TypeScript strict mode — no type errors
- [x] All tests pass with vitest
- [x] No `any` types
- [x] No secrets in code
- [x] No external project names or branding
- [x] All monetary values as integer cents
- [x] All timestamps as ISO 8601 strings
- [x] `orgId` scoping on all records
- [x] Immutable ledger entries (append-only)
- [x] Double-entry balance enforcement
- [x] Feature flags with safe defaults
- [x] Architecture documentation complete
- [x] Operations runbook complete
- [x] Controls governance document complete

## Integration Checklist for Consuming Teams

Before enabling Finance Core features in a production app:

- [ ] Wire `@nzila/audit` AuditEngine to all Finance Core state transitions
- [ ] Implement persistence adapter (replace InMemory* services with database-backed implementations)
- [ ] Wire `@nzila/platform-auth` guards on all Finance Core API routes
- [ ] Configure `SpendingControl` per tenant via platform admin
- [ ] Wire `@nzila/platform-event-fabric` bus to Finance Core event emissions
- [ ] Wire `@nzila/platform-notifications` for approval and compliance alerts
- [ ] Review and enable only the feature flags needed for your use case
- [ ] Obtain compliance sign-off before enabling `FINANCE_PAYMENTS_ENABLED` or `FINANCE_PAYOUTS_ENABLED`
- [ ] Integrate a licensed KYC provider before enabling `FINANCE_COMPLIANCE_ENABLED`

## Future Roadmap

**v0.2 — Persistence layer**
- Database adapters for all services (Drizzle ORM, aligned with `@nzila/db`)
- Schema migrations

**v0.3 — Platform integration**
- Native `@nzila/platform-event-fabric` event emission built into services
- Native `@nzila/audit` integration with hash chain

**v0.4 — Multi-currency**
- Multi-currency ledger entries (IAS 21 compliant, via `@nzila/fx`)
- FX revaluation support

**v0.5 — Compliance integration**
- Real KYC provider adapter (pluggable)
- Sanctions screening adapter (pluggable)
- Risk model configuration API

**v1.0 — Production certification**
- Security audit
- Load testing
- Legal/compliance sign-off
- Full regulatory export support
