# Nzila OS — Shell Architecture

## Overview

The OS Shell (`@nzila/platform-shell`) provides the unified navigation, org switching, and module discovery layer for all Nzila OS apps. It acts as the "operating system chrome" that wraps each vertical product.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  ShellProvider (React Context)                          │
│  ├── user: ShellUser                                    │
│  ├── org: ShellOrg (current org scope)                  │
│  ├── availableOrgs: ShellOrg[]                          │
│  ├── modules: ModuleManifest[] (resolved for context)   │
│  ├── switchOrg(orgId)                                   │
│  └── navigateToModule(moduleId)                         │
├─────────────────────────────────────────────────────────┤
│  ShellLayout                                            │
│  ├── GlobalNav (icon rail — left)                       │
│  ├── Module Sidebar (optional — per-app)                │
│  └── Main Content (app routes)                          │
└─────────────────────────────────────────────────────────┘
```

## Module Registry

The `ModuleRegistry` holds all registered apps and resolves visibility/accessibility based on user context.

### Registration

```typescript
import { ModuleRegistry, DEFAULT_MODULES } from '@nzila/platform-shell/registry';

const registry = new ModuleRegistry();
registry.registerAll(DEFAULT_MODULES);
```

### Resolution

The registry resolves modules into manifests based on:
1. **Role check** — Does the user have a required role?
2. **Entitlement check** — Does the org's plan include required features?
3. **Feature flag check** — Is the feature flag enabled?
4. **Org enablement** — Is the module explicitly enabled for this org?

```typescript
const manifests = registry.resolveNav({
  userId: 'user-1',
  orgId: 'org-1',
  roles: ['org_admin'],
  entitlements: ['sso', 'api_access'],
});
// Returns only accessible, nav-visible modules sorted by navOrder
```

## Components

### ShellLayout

Top-level layout wrapper. Renders the GlobalNav + optional module sidebar + main content area.

### GlobalNav

Compact icon rail on the left. Shows org avatar at top, module icons in the middle. Highlights the active module.

### OrgSelector

Dropdown for switching between organizations. Hidden when user belongs to only one org.

### AppSwitcher

Horizontal module switcher (alternative to GlobalNav for toolbar layouts).

### UserMenu

User avatar and name display. Extensible for dropdown menu.

### NotificationBell

Badge-count notification icon with polling support.

## Integration

Each app wraps its root layout with the shell:

```tsx
import { ShellProvider, ShellLayout, ModuleRegistry, DEFAULT_MODULES } from '@nzila/platform-shell';

const registry = new ModuleRegistry();
registry.registerAll(DEFAULT_MODULES);

export default function RootLayout({ children }) {
  return (
    <ShellProvider
      user={user}
      availableOrgs={orgs}
      registry={registry}
      activeModuleId="union-eyes"
    >
      <ShellLayout>{children}</ShellLayout>
    </ShellProvider>
  );
}
```

## Registered Modules

All 17 apps are registered in `DEFAULT_MODULES` with proper tiers, roles, and entitlements. See `packages/platform-shell/src/registry/default-modules.ts`.
