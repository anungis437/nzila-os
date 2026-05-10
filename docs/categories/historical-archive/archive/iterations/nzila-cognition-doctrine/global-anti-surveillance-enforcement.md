# Global Anti-Surveillance Enforcement

> Doctrine: Nzila OS is **anti-surveillance** infrastructure. This is structurally enforced.

## 1. Convergence Statement

Nzila OS prohibits, repo-wide, the construction or operation of:

- employee scoring
- behavioral ranking
- productivity surveillance
- engagement optimization
- coercive operational analytics
- attention manipulation
- behavioral prediction scoring
- worker productivity ranking
- individual-employee surveillance

These prohibitions apply to:

- packages
- apps
- APIs
- prompts
- UX
- internal tooling
- partner integrations

There are **no exceptions**.

## 2. Doctrinal Rationale

Nzila OS exists to preserve continuity and institutional legitimacy. Surveillance infrastructure undermines legitimacy and is incompatible with the governance-safe cognition doctrine.

## 3. Enforcement Mechanisms

- **Validator**: `tooling/scripts/validate-institutional-cognition-convergence.mjs` enforces prohibited semantics absence on user-facing surfaces.
- **Terminology guards**: prohibited terms documented here are scanned across live surfaces.
- **CI doctrine checks**: `pnpm validate:cognition` runs the validator and fails the build on regression.
- **Doctrine review**: any new intelligence surface must reference the [Institutional Operational Cognition Doctrine](institutional-operational-cognition-doctrine.md) and pass the validator.

## 4. Required Live-Surface Posture

User-facing intelligence surfaces must:

- never present individual-employee scores
- never present behavioral rankings
- never present productivity surveillance metrics
- never optimize engagement
- never use attention-capture mechanics
- include anti-surveillance affirmations where appropriate

## 5. Authority

This policy is doctrinal and binding on the entire repo. It derives from the [Institutional Operational Cognition Doctrine](institutional-operational-cognition-doctrine.md).
