# Branding & Partnership Governance

> **Golden rule:** Zonga owns the **PRODUCT**, Client owns the **WORKSPACE**, Partner owns the **RELATIONSHIP / DISTRIBUTION**.

## Three-Tier Brand Hierarchy

| Role | Definition | Example |
|------|-----------|---------|
| **Platform** | Zonga itself — product owner, always primary | Zonga |
| **Client** | Deployment tenant — workspace/org context | MS Célébration Canada |
| **Partner** | Distribution/relationship layer — strategic | The Rock Power Group Inc. |

## Policy Matrix

Every brand rendering decision goes through a strict placement × role × mode matrix.

### Placements (13 surfaces)

`app_header` · `app_sidebar` · `app_dashboard` · `login` · `onboarding` · `workspace_label` · `footer` · `about` · `support` · `marketing_hero` · `marketing_trust` · `marketing_partnership` · `marketing_case_study`

### Visibility Modes

| Mode | Description |
|------|-------------|
| `logo` | Full color logo |
| `muted_logo` | Reduced opacity logo |
| `grayscale_logo` | Desaturated logo |
| `text_only` | Name text, no logo |
| `hidden` | Not rendered |

### Key Rules

- **Platform:** Visible everywhere. Full logo by default.
- **Client:** Text-only in header/login/footer. Hidden in dashboard/hero.
- **Partner:** Hidden in ALL app surfaces. Text-only in footer/about/support. Logo only in marketing partnership/case study sections (behind feature flags).

### DENY by Default

If no rule exists for a role+placement pair, the brand is **denied**. This is a security-first approach — new placements must be explicitly whitelisted.

## Feature Flags

All flags default to `false` (conservative — no external branding until explicitly enabled).

| Flag | Controls |
|------|----------|
| `ENABLE_CLIENT_LOGO_LOGIN` | Client logo mode on login page |
| `ENABLE_CLIENT_LOGO_TRUST` | Client logo in marketing trust strip |
| `ENABLE_PARTNER_BRANDING` | Partner logos in marketing sections |
| `ENABLE_PARTNERSHIP_SECTION` | Partnership section visibility |

Set via environment variables (prefix `NEXT_PUBLIC_`):
```
NEXT_PUBLIC_ENABLE_PARTNER_BRANDING=true
```

## Anti-White-Label Safeguards

The system enforces these invariants:

1. **No client logo in header** — text-only maximum
2. **No partner in header** — completely hidden
3. **No dual-logo headers** — only Zonga logo allowed
4. **No co-branded hero** — marketing hero is Zonga-only
5. **No partner in product surfaces** — dashboard/login are Zonga+client only

`detectWhiteLabelViolations()` validates a configuration and returns violations.

## Architecture

```
lib/branding/
├── types.ts          # Type definitions (BrandRole, BrandPlacement, etc.)
├── placements.ts     # 39-rule policy matrix with O(1) lookup
├── policy.ts         # Enforcement (canRenderBrand, assertBrandPolicy, etc.)
├── feature-flags.ts  # Conservative feature flag loading
├── partnership.ts    # Three-tier attribution builder
├── registry.ts       # Brand asset registry (Zonga immutable)
├── brand-config.ts   # Deployment brands (client + partner registration)
└── index.ts          # Barrel export

components/branding/
├── ZongaBrandMark.tsx        # Platform brand (always visible)
├── ExternalBrandMark.tsx     # Client/partner with policy enforcement
├── WorkspaceIdentity.tsx     # "Zonga | Client Workspace" pattern
├── PartnershipAttribution.tsx # Three-tier attribution strip
├── TrustStrip.tsx            # "Trusted by" brand carousel
└── index.ts                  # Barrel export
```

## Usage

### Dashboard shell (sidebar + mobile header)

```tsx
import { WorkspaceIdentity } from '@/components/branding'

<WorkspaceIdentity placement="app_sidebar" size="sm" />
// Renders: "Z Zonga" (and optionally "| Client Workspace" when client is registered)
```

### Site navigation (scroll-aware)

```tsx
import { ZongaBrandMark } from '@/components/branding'

<ZongaBrandMark placement="app_header" size="md" theme={scrolled ? 'light' : 'dark'} />
// theme="dark" → white text (dark background)
// theme="light" → navy text (light background)
```

### Auth pages (login, sign-up, etc.)

`AuthPageLayout` defaults `appName` and `appAbbrev` from `ZONGA_BRAND` registry:

```tsx
<AuthPageLayout
  tagline="Your Music, Your Revenue"
  subtitle="..."
  stats={stats}
  heroImage="..."
/>
// appName defaults to ZONGA_BRAND.name ("Zonga")
// appAbbrev defaults to ZONGA_BRAND.shortName ("Z")
```

### Footer with attribution

```tsx
import { ZongaBrandMark, PartnershipAttribution } from '@/components/branding'

<ZongaBrandMark placement="footer" size="md" />
<PartnershipAttribution placement="footer" variant="inline" />
// Renders: "Powered by Zonga · Deployed for {Client} · In partnership with {Partner}"
```

### Marketing page (flag-gated sections)

```tsx
import { PartnershipAttribution, TrustStrip } from '@/components/branding'
import { loadBrandingFlags } from '@/lib/branding/feature-flags'

const flags = loadBrandingFlags()

{flags.ENABLE_PARTNERSHIP_SECTION && (
  <PartnershipAttribution placement="marketing_partnership" variant="stacked" />
)}

{flags.ENABLE_CLIENT_LOGO_TRUST && (
  <TrustStrip placement="marketing_trust" brands={registeredBrands} flags={flags} />
)}
```

### Rendering a workspace header

```tsx
import { WorkspaceIdentity } from '@/components/branding'

<WorkspaceIdentity
  placement="app_header"
  client={currentClient}
  size="md"
/>
// Renders: "Z Zonga | MS Célébration Workspace"
```

### Checking policy in server components

```ts
import { assertBrandPolicy } from '@/lib/branding'

// Throws BrandPolicyViolation if denied
assertBrandPolicy('partner', 'app_header', 'logo')
```

### Building attribution

```ts
import { buildAttribution, formatAttributionText } from '@/lib/branding'
import { ZONGA_BRAND } from '@/lib/branding'

const attr = buildAttribution('footer', ZONGA_BRAND, client, partner)
formatAttributionText(attr)
// "Powered by Zonga · Deployed for MS Célébration · In partnership with Rock Power"
```

### Registering brands

```ts
import { registerBrand, clearExternalBrands } from '@/lib/branding'

registerBrand({
  asset: {
    id: 'ms-celebration',
    role: 'client',
    name: 'MS Célébration Canada',
    logoUrl: '/partners/ms-celebration.svg',
  }
})
```

## Adding New Partners

1. Register the brand asset in the registry
2. Verify policy allows desired placements: `canRenderBrand('partner', placement, mode)`
3. Enable feature flags if marketing sections are needed
4. Run `detectWhiteLabelViolations()` to validate configuration
5. All 54 branding tests must pass

## Tests

```bash
# Unit + policy tests
pnpm vitest apps/zonga/lib/branding/branding.test.ts

# Integration tests (surface wiring)
pnpm vitest apps/zonga/lib/branding/branding-integration.test.ts

# CI contract test (brand governance enforcement)
pnpm vitest tooling/contract-tests/zonga-brand-governance.test.ts
```

### Test coverage:
- **54 unit tests:** Policy matrix, enforcement, feature flags, anti-white-label, attribution, registry
- **~42 integration tests:** Surface wiring for dashboard, auth, footer, nav, marketing, about, support/contact, case study, brand config
- **~15 contract tests:** CI enforcement — no hardcoded brands, barrel exports, governed surfaces, about/contact/case-study placement verification

## Adopted Surfaces

| Surface | Component Used | Placement |
|---------|---------------|-----------|
| Dashboard sidebar | `WorkspaceIdentity` | `app_sidebar` |
| Dashboard mobile header | `WorkspaceIdentity` | `app_sidebar` |
| Site navigation | `ZongaBrandMark` | `app_header` |
| Site footer | `ZongaBrandMark` + `PartnershipAttribution` | `footer` |
| Auth pages (6) | `AuthPageLayout` → `ZONGA_BRAND` | `login` |
| Marketing page | `PartnershipAttribution` + `TrustStrip` | `marketing_partnership` / `marketing_trust` |
| About page | `PartnershipAttribution` | `about` |
| Contact page | `PartnershipAttribution` | `support` |
| Case studies page | `PartnershipAttribution` | `marketing_case_study` |
