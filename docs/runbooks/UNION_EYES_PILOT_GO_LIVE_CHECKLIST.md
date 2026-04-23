# UNION EYES PILOT GO-LIVE CHECKLIST

Date: 2026-04-23
Audience: Delivery, platform ops, product owner, pilot customer admin

## Pilot Prerequisites

1. Runtime:
- App endpoints healthy (`/api/health` = 200).
- Domain endpoints reachable for pilot hostnames.

2. Auth:
- Local auth working for pilot org users.
- Invite and magic-link tested for pilot tenant.
- Admin role assignment validated.

3. Data:
- Required claims/member/governance tables present in pilot DB.
- Seed/demo data policy confirmed.

4. Integrations (pilot scope only):
- Required integrations configured and tested.
- Non-required integrations explicitly disabled or out-of-scope.

## Required Customer Inputs

- Pilot organization profile and legal entity details.
- Authorized admins and role mapping list.
- Approved login method policy (local, SSO, magic-link policy).
- Integration endpoints/credentials for in-scope systems.
- Success criteria and reporting cadence.

## Pilot Kickoff Checklist

1. Confirm pilot scope pages/features list.
2. Confirm data handling boundaries and privacy expectations.
3. Confirm support channels and escalation contacts.
4. Run live smoke for auth + claims + health endpoints.
5. Capture baseline metric snapshot.

## Pilot Go-Live Checklist

1. All pilot users can authenticate.
2. Core claims workflow completes end-to-end.
3. Role-based access controls behave correctly for pilot roles.
4. Audit/event logs available for pilot support triage.
5. Pilot integrations (if any) pass handshake and one real transaction.

## Support Model

- L1: Product operations triage.
- L2: Platform engineering (auth/integration/runtime).
- L3: Database/infra support for migration or data integrity issues.

SLA suggestion during pilot:
- Critical: acknowledge within 1 hour, workaround within 4 hours.
- High: acknowledge same business day.

## Rollback Path

1. Disable newly introduced pilot-only toggles.
2. Revert to last known-good release image.
3. Freeze write operations if data integrity concern is suspected.
4. Communicate incident status and ETA to pilot stakeholders.

## Known Limitations (Current)

- Staging/prod topology separation is not fully clean today.
- Some enterprise screens are desktop-preferred, not fully mobile-first.
- AI capability consistency is feature-dependent and must remain advisory.

## Pilot Success Criteria

1. Pilot users complete core workflows without blocking defects.
2. No unresolved security/auth incidents.
3. Support ticket volume trends downward after onboarding week.
4. Pilot stakeholder confirms value and operational fit.
