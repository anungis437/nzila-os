# UX Polish — Shared Dashboard Components

> Documents the shared component library in `app/(dashboard)/components/` and
> which detail pages use them.

## Components

### StatusBadge

Renders a coloured dot + label badge for any entity status.

- ~50-entry palette mapping statuses to `{dot, bg, text}` Tailwind classes
- `humanise()` formats raw status strings (e.g. `PENDING_PAYMENT` → `Pending Payment`)
- Usage: `<StatusBadge status="confirmed" />`

### LifecycleTimeline

Vertical timeline for detail page sidebars showing entity history.

- Props: `events: TimelineEvent[]` — each has `label`, `description`, `timestamp`, `actor`, optional `icon`/`colour`
- Built-in `resolveIcon()` heuristic maps labels to appropriate Heroicons and colours
- Usage: build a `TimelineEvent[]` from the entity's created date + timeline repo entries

### SystemGuidance

Contextual guidance banner showing blockers, next steps, or tips.

- 5 severity levels: `info` (blue), `success` (emerald), `warning` (amber), `error` (red), `tip` (violet)
- Props: `severity`, `title`, `children` (message body)
- Driven by a `guidanceMap` record keyed by entity status

### ProgressStepper

Horizontal step progress bar for entity lifecycles.

- Props: `steps: Step[]` (each has `key`, `label`, optional `icon`), `currentIndex: number`
- Completed steps render with electric bg + CheckCircleIcon
- Current step gets a ring highlight; pending steps are grey

## Barrel Export

All components are re-exported from `app/(dashboard)/components/index.ts`:

```ts
import { StatusBadge, LifecycleTimeline, SystemGuidance, ProgressStepper } from '@/app/(dashboard)/components'
import type { TimelineEvent, Step } from '@/app/(dashboard)/components'
```

## Page Adoption

| Page | StatusBadge | LifecycleTimeline | SystemGuidance | ProgressStepper |
|---|---|---|---|---|
| Orders `[id]` | ✅ | ✅ | ✅ | ✅ |
| Purchase Orders `[id]` | ✅ | ✅ | ✅ | — |
| Quotes `[id]` | ✅ | ✅ | ✅ | ✅ |
| Production (dashboard) | — | — | — | — |
| Analytics (dashboard) | — | — | — | — |

Production and Analytics are dashboard/pipeline views where shared detail-page components
don't add value — they use domain-specific pipeline visualisations.
