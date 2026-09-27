# @nzila/treasurer

TREASURER is the NzilaOS agent for the Principal's personal investment-capital intelligence.

It is not corporate CAPITAL (`scripts/lib/capital-allocation.ts`) and it is not the ExecutiveOS treasury agent (`packages/executive-os`, key `treasury`).

PRODUCTION AUTHORITY: NO

FINANCIAL TRANSACTION AUTHORITY: NEVER

Normative doctrine: `docs/doctrine/treasurer/TREASURER_DOCTRINE.md`

Governance artifacts: `governance/personal-capital/treasurer/`

The verifier in `src/verifier.ts` re-executes doctrine, boundary, calculation, authority, red-team, and regression gates. `TREASURER_CERTIFIED` is YES only when every gate passes.
