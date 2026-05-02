# Decision Coverage Inventory

This inventory tracks high-value mutation routes against the canonical decision model.

Gap levels:

- `none` — route is fully decision-aligned
- `minor` — registered and partially enforced, with replay or export gaps remaining
- `major` — meaningful decision mapping exists, but route-level enforcement is incomplete
- `blocker` — critical mutation lacks usable decision registration or authority path

| Surface | Route | Decision type | Current audit status | Policy status | Authority validation status | Replay status | Export status | Gap level |
|--------|-------|---------------|----------------------|---------------|-----------------------------|---------------|---------------|-----------|
| control-plane | `apps/control-plane/app/api/control-plane/authority/authorize-workflow/route.ts` | `platform.workflow.authorized` | Persisted NAR proof via audit_records | Explicit platform workflow policy ref | Explicit preflight authority validation | Replay-supported in registry | Export supported through `/api/audit/export` | none |
| control-plane | `apps/control-plane/app/api/control-plane/governance/actions/route.ts` | `platform.governance.action.executed` | State transitions now emit DecisionRecord + persisted NAR | Governance policy ref enforced at route boundary | Shared decision authority (`governance:action:execute`) | Replay-supported in registry | Export supported through `/api/audit/export` | none |
| orchestrator | `apps/orchestrator-api/src/routes/execute.ts` | `platform.workflow.executed` | Workflow execution emits persisted NAR-backed proof | Explicit platform workflow execution policy ref | Explicit execution authority capture in route | Replay-supported in registry | Export supported through `/api/audit/export` | none |
| union-eyes | `apps/union-eyes/app/api/cases/intake/route.ts` | `union.grievance.intake.submitted` | Intake now emits and persists NAR proof | Explicit labour intake policy ref | Explicit `grievance:create` validation | Replay-supported in registry | Export supported through `/api/audit/export` | none |
| union-eyes | `apps/union-eyes/app/api/cases/[caseId]/escalate/route.ts` | `union.case.escalated` | Escalation now emits and persists NAR proof | Explicit labour escalation policy ref | Explicit `case:escalate` validation | Replay-supported in registry | Export supported through `/api/audit/export` | none |
| faircase | `apps/abr/app/api/abr/incidents/route.ts` | `faircase.case.classified` | Incident classification now emits and persists NAR proof | Explicit legal case classification policy ref | Explicit `case:classify` validation | Replay-supported in registry | Export supported through `/api/audit/export` | none |
| flow | `apps/flow/app/api/quotes/route.ts` | `flow.quote.created` | Quote creation emits and persists NAR proof | Explicit commerce quote policy ref | Explicit authority validation from org permissions | Replay-supported in registry | Export supported through `/api/audit/export` | none |
| zonga | `apps/zonga/app/api/payouts/route.ts` | `zonga.payout.approved` | Payout approvals now emit and persist NAR proof | Explicit media payout approval policy ref | Explicit `payout:approve` validation | Replay-supported in registry | Export supported through `/api/audit/export` | none |
| platform-admin | `apps/platform-admin/app/api/admin/org/route.ts` | `platform.org.entitlement.checked` | Entitlement checks now persist NAR proof alongside CP outcome | Explicit platform entitlement policy ref | Explicit org-admin authority capture | Replay-supported in registry | Export supported through `/api/audit/export` | none |

## Migration Checklist

- `flow.vendor.selected` remains a documented temporary exception (route not present)
- `zonga.rights.validated` remains a documented temporary exception (no standalone validation mutation route)
- strict gate requires `pnpm decision:coverage:strict` in CI