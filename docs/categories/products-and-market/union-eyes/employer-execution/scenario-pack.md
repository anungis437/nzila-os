# Employer Execution Scenario Pack

## Coverage goal

The scenario pack validates deterministic behavior for payroll execution, replay attribution, lifecycle governance, and evidence-chain continuity.

## Scenarios

1. `A1 standard payroll run with no overrides`
2. `A2 overtime + double time threshold behavior`
3. `B3 classification override replaces base rate`
4. `B4 regional premium stacks with base rule`
5. `B5 travel rule suppresses default travel behavior`
6. `B6 dues rule augment case`
7. `C7 replay exact match`
8. `C8 replay with rule version change`
9. `C9 replay with input change`
10. `D10 critical compliance issue blocks official approval`
11. `D11 error requires acknowledgement before approval`
12. `D12 approved run immutability and adjustment-run requirement`
13. `E13 remittance linked to payroll evidence chain`
14. `E14 replay linked to payroll evidence chain`
15. `E15 broken evidence chain verification failure`

## Required assertions

- Composition model (`replace`, `augment`, `stack`, `suppress`) changes outcomes deterministically.
- Replay output emits deterministic `changed` state and cause details.
- Lifecycle control enforcement blocks invalid transitions.
- Evidence chain verification succeeds for valid lineage and fails on parent seal mismatch.

## Execution notes

- Scenarios run in `execution-scenario-pack.test.ts`.
- Assertions should remain deterministic and avoid network/external dependencies.
- Add new scenarios with stable names and fixed inputs.
