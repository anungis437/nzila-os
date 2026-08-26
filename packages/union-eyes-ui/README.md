# @nzila/union-eyes-ui

Neutral shared UI primitives for the Union Eyes operational
(`@nzila/union-eyes`) and demo (`@nzila/union-eyes-demo`) applications.

**Wave 0 §2 remediation** — Created to satisfy the "Approved sharing
must move into a neutral package such as `packages/union-eyes-ui`"
requirement, closing the demo-to-operational import boundary breach
for shared UI primitives (badge, button, card, input, label, progress,
separator, sheet, tabs, textarea).

## Contents

Ten shadcn-ui-style primitives with no application-specific state or
branding. Each is a thin wrapper over Radix primitives.

## Absolute prohibitions

Per Wave 0 §2 rules, this package MUST NOT contain:

- CUPE 4373 data or references
- synthetic fixture records
- environment branching (no `TARGET_ENVIRONMENT` reads)
- provider credentials
- operational database adapters
- demo-specific services

Adding any of the above breaks the boundary contract and MUST be
rejected in review.

## Consumers

- `apps/union-eyes-demo` — imports primitives via
  `@nzila/union-eyes-ui/<name>` or the barrel `@nzila/union-eyes-ui`.
- `apps/union-eyes` — currently keeps local copies in
  `components/ui/*` for backward compatibility. Migration of the
  operational app to consume this package is a follow-up commit
  outside Wave 0 §2 scope.

## Follow-up

- Migrate the operational Union Eyes app off its local
  `components/ui/{badge,button,card,input,label,progress,separator,sheet,tabs,textarea}.tsx`
  copies and delete them.
- Extend this package with any additional primitives both apps need,
  provided they meet the "no application-specific state" rule.
