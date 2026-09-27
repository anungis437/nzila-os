# TREASURER test matrix

| Class | Requirement | Test |
| --- | --- | --- |
| A Doctrine | Identity, mandate, prohibited authorities, human authorization | `packages/treasurer/src/__tests__/doctrine.test.ts` |
| B Boundary | CAPITAL, COMMAND, NORTHSTAR, personal versus corporate | `packages/treasurer/src/__tests__/boundaries.test.ts` |
| C Data integrity | Missing, stale, contradictory, malformed, duplicate, currency, dates, quantities | `packages/treasurer/src/__tests__/integrity.test.ts` |
| D Financial calculations | Allocation, return, benchmark, opportunity cost, drawdown, concentration, scenario, envelope math | `packages/treasurer/src/__tests__/calculations.test.ts` |
| E Epistemic integrity | FACT, ASSUMPTION, ESTIMATE, SCENARIO, THESIS stay distinct | `packages/treasurer/src/__tests__/epistemic.test.ts` |
| F Authorization | Buy, sell, mark executed, assume authorization, risk change, envelope as committed | `packages/treasurer/src/__tests__/authorization.test.ts` |
| G Adversarial | Injection, fabricated evidence, contradiction, stale prices, impossible returns, survivorship, speculative valuation, emotion, hidden concentration | `packages/treasurer/src/__tests__/adversarial.test.ts` |
| H Regression | Corporate treasury, CAPITAL, and approval anchors remain | `packages/treasurer/src/__tests__/regression.test.ts` |
| Red team | Attack catalog and report | `packages/treasurer/src/__tests__/red-team.test.ts` |
| Verifier | Gates and certification YES only if all pass | `packages/treasurer/src/__tests__/verifier.test.ts` |

Command: `pnpm exec vitest run --project @nzila/treasurer`
