# Operational Build Demo-Content Scan (Wave 0 §8)

- Generated: 2026-07-21T11:06:58.994Z
- Patterns: cupe\s*[-_]?\s*4373|cupe\s*local\s*4373|CUPE4373_
- Source files scanned: 5301
- Source files with hits: 29
- Total source hits: 104
- Build directory: `C:\APPS\nzila-automation\apps\union-eyes\.next`
- Build files scanned: 22068
- Build files with hits: 71
- Total build hits: 71
- Errors: **0**

## Source hits by file

| File | Hits | Classification | Reason | Target wave |
|------|-----:|----------------|--------|:-----------:|
| `apps/union-eyes/app/[locale]/(auth)/login/[[...login]]/page.tsx` | 4 | gated-render | Login page imports Cupe4373PersonaPicker and renders it only when isCupe4373DemoRuntime() is true. | 6 |
| `apps/union-eyes/app/[locale]/(auth)/sign-in/[[...sign-in]]/page.tsx` | 3 | gated-render | Sign-in landing branches on isCupe4373DemoRuntime() to surface the CUPE Local 4373 marketing copy. | 6 |
| `apps/union-eyes/app/[locale]/dashboard/admin/pilots/page.tsx` | 4 | gated-render | Admin pilots surface lets operators apply/export the CUPE4373 reference template; the string is a legitimate template identifier surfaced to admins. | 6 |
| `apps/union-eyes/app/[locale]/dashboard/communications/page.tsx` | 2 | code-comment | Two adjacent comments explain the former demo import path (@/components/demo/cupe4373-communications-page). | 6 |
| `apps/union-eyes/app/[locale]/dashboard/documents/layout.tsx` | 2 | runtime-detector | Documents dashboard layout redirects to /dashboard when isCupe4373DemoRuntime() is false (demo-only surface). | 6 |
| `apps/union-eyes/app/[locale]/dashboard/layout.tsx` | 3 | gated-render | Dashboard shell binds isCupeDemo = isCupe4373DemoRuntime() and renders a 'CUPE Local 4373 demo' badge inside the demo branch. | 6 |
| `apps/union-eyes/app/[locale]/dashboard/page.tsx` | 2 | code-comment | Two comments document the deleted @/components/demo/cupe4373-operations-dashboard dynamic import. | 6 |
| `apps/union-eyes/app/[locale]/dashboard/reports/page.tsx` | 1 | code-comment | Comment names the former Cupe4373ReportsPage demo module for traceability of the /dashboard/reports NOT_IMPLEMENTED capability (see UE-DASH-REPORTS-INDEX). | 6 |
| `apps/union-eyes/app/[locale]/page.tsx` | 2 | runtime-detector | Root landing page inspects isCupe4373DemoRuntime() to route demo users to /dashboard. | 6 |
| `apps/union-eyes/app/api/health/route.ts` | 1 | runtime-detector | Health endpoint reports whether the featureProfile matches the cupe4373 demo token. | 6 |
| `apps/union-eyes/app/api/pilot/apply/[id]/commercial-transition/route.ts` | 3 | runtime-detector | Commercial-transition validator asserts featureProfile ≠ cupe4373 to block accidental production use of the demo profile. | 6 |
| `apps/union-eyes/app/api/pilot/apply/[id]/package-export/route.ts` | 1 | runtime-detector | Package-export validator asserts featureProfile ≠ cupe4373 before publishing an exportable package. | 6 |
| `apps/union-eyes/app/login/page.tsx` | 2 | runtime-detector | Legacy /login route uses isCupe4373DemoRuntime() to select the post-login redirect path. | 6 |
| `apps/union-eyes/components/auth/cupe4373-persona-picker.tsx` | 6 | demo-component | The CUPE 4373 demo persona picker itself — hardcoded persona emails, one-click demo login. Rendered only when isCupe4373DemoRuntime() is true. | 6 |
| `apps/union-eyes/components/auth/login-form.tsx` | 2 | runtime-detector | Login form falls back to /dashboard when isCupe4373DemoRuntime() is true (else /dashboard/priorities). | 6 |
| `apps/union-eyes/components/documents/documents-console.tsx` | 1 | gated-render | Documents console displays a CUPE 4373 CBA sample entry when the demo runtime is active. | 6 |
| `apps/union-eyes/components/home/portal-home.tsx` | 3 | gated-render | Portal home embeds a CUPE 4373 CBA document title inside a mock document list rendered only for the demo runtime. | 6 |
| `apps/union-eyes/components/onboarding/onboarding-provider.tsx` | 2 | runtime-detector | Onboarding provider suppresses the standard onboarding flow when isCupe4373DemoRuntime() is true. | 6 |
| `apps/union-eyes/components/sidebar.tsx` | 4 | gated-render | Sidebar imports getCupe4373DemoNavigation / getCupe4373DemoGroups and returns them inside the isCupeDemo branch. | 6 |
| `apps/union-eyes/components/work/work-surface.tsx` | 2 | code-comment | Two adjacent comments document the removed Cupe4373CasesConsole demo module short-circuit. | 6 |
| `apps/union-eyes/infra/environments/union-eyes-env.bicep` | 5 | build-config | Bicep template enumerates UE_DEPLOYMENT_TYPE / UE_FEATURE_PROFILE / *_DEMO_PROFILE values including 'cupe4373-demo' and 'cupe4373' for the demo environment. Not shipped in the runtime bundle. | 6 |
| `apps/union-eyes/instrumentation.ts` | 1 | code-comment | Instrumentation entry-point comment mentions the cupe4373 demo profile as an example of an unsafe misdeploy. | 6 |
| `apps/union-eyes/lib/config/env-validation.ts` | 5 | env-schema | Zod enums literally enumerate 'cupe4373-demo' and 'cupe4373' as valid values for UE_DEPLOYMENT_TYPE, UE_FEATURE_PROFILE, NEXT_PUBLIC_UE_FEATURE_PROFILE, UE_DEMO_PROFILE, NEXT_PUBLIC_UE_DEMO_PROFILE. | 6 |
| `apps/union-eyes/lib/dashboard/require-dashboard-access.ts` | 1 | runtime-detector | Dashboard access guard reads UE_FEATURE_PROFILE to gate CUPE-specific behaviour. | 6 |
| `apps/union-eyes/lib/dashboard/role-experience.ts` | 21 | runtime-detector | Owns isCupe4373DemoRuntime(), CUPE4373_DEMO_PROFILE constant, CUPE4373_DEMO_NAVIGATION, CUPE4373_DEMO_GROUPS, CUPE4373_DEMO_MEMBER_NAVIGATION, CUPE4373_DEMO_ALLOWED_PREFIXES, and the getCupe4373Demo* helpers. | 6 |
| `apps/union-eyes/lib/pilot-admin-operational.ts` | 1 | runtime-detector | Anti-theatre sentinel list ('cupe4373', 'demo', 'sample', 'placeholder') used to detect placeholder pilot values in operational mode. | 6 |
| `apps/union-eyes/lib/reality/capability-registry.ts` | 11 | registry-evidence | UE-DEMO-CUPE4373 capability entry evidence/notes text and the new UE-BUILD-OPERATIONAL-ISOLATION notes reference the profile name. | 6 |
| `apps/union-eyes/lib/runtime/environment.ts` | 8 | env-schema | TypeScript union types (UeDeploymentType, UeFeatureProfile) literally list 'cupe4373-demo' and 'cupe4373'. | 6 |
| `apps/union-eyes/package.json` | 1 | build-config | package.json includes the `seed:cupe4373-members` script — command-line only, not in bundle. | 6 |

## Errors

_None. Every demo-identifier reference in operational source is allowlisted with a classification and reason._

---

This report is generated by `tooling/reality/operational-build-scan.ts` and enforced by the `pnpm reality:build-scan` script. See `docs/union-eyes/reality-remediation/20_OPERATIONAL_BUILD_DEMO_SCAN.md`.
