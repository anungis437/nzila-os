# Console Phase 2 Roadmap Follow-Through

Date: 2026-04-17

## Goal

Protect the ROI of the new Phase 2 systems by finishing the missing truth sources and automations instead of adding more dashboard surface area.

## Phase 3 Priorities

### P3.1 Venture Revenue Attribution

Highest ROI remaining backend gap.

Needed because:

- capital ranking still uses conservative proxies for non-Zonga venture traction
- founder efficiency is strongest when venture revenue and pipeline map cleanly to time spent

Work:

1. Add explicit venture/product attribution to commerce opportunities, quotes, and invoices
2. Backfill existing records where metadata already contains a product hint
3. Update Focus and Portfolio to use direct per-venture revenue/pipeline values

### P3.2 Live Treasury Integration

Needed because runway is still mixed-mode.

Work:

1. Pull cash balances from bank or accounting source
2. Sync liabilities due and near-term obligations from finance systems
3. Replace manual treasury snapshot dependency for weekly operation

### P3.3 Real Burn Composition

Needed because current runway combines live platform burn with env/manual people burn.

Work:

1. ingest payroll / contractor burn
2. ingest SaaS subscriptions / fixed operating spend
3. expose variable vs fixed burn split in Runway

### P3.4 Scheduled CEO Delivery

Needed because the briefing currently exists only when opened manually.

Work:

1. Monday 7am generated briefing
2. email or Slack digest
3. optional board PDF export

### P3.5 Execution Loop Closure

Needed because decision-making is ahead of execution tracking.

Work:

1. move weekly initiatives from static array into DB
2. link briefing decisions to initiatives
3. close the loop from recommendation to execution state

## Recommended Order

1. Venture revenue attribution
2. Live treasury integration
3. Real burn composition
4. Scheduled CEO delivery
5. Execution loop closure

## Why This Order

The first three items improve truth quality.

The fourth improves distribution.

The fifth improves follow-through.

That sequencing keeps the next phase aligned with the non-negotiable rule: truth first, then automation.

## Estimated Effort

- Venture revenue attribution: 3-4 dev days
- Live treasury integration: 3-5 dev days
- Burn composition integration: 2-3 dev days
- Scheduled CEO delivery: 2 dev days
- Execution initiatives DB upgrade: 2-3 dev days

Total: 12-17 dev days

## Definition Of Success For Phase 3

Phase 3 is successful when:

- runway no longer depends on manual cash fallback for normal operation
- founder efficiency is venture-attributed using direct commercial data
- Aubert receives the weekly briefing without needing to remember to open Console
- top decisions are connected to tracked execution items