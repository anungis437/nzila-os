// @nzila/platform-shell — Barrel export

// Registry
export { ModuleRegistry } from './registry/registry.js';
export type {
  ModuleRegistryConfig,
  ModuleResolveContext,
} from './registry/registry.js';
export { DEFAULT_MODULES } from './registry/default-modules.js';

// Context
export type {
  ShellContextValue,
  ShellUser,
  ShellOrg,
} from './context/types.js';
export { ShellProvider, useShell } from './context/provider.js';
export type { ShellProviderProps } from './context/provider.js';

// Components
export { ShellLayout } from './components/ShellLayout.js';
export { GlobalNav } from './components/GlobalNav.js';
export { OrgSelector } from './components/OrgSelector.js';
export { AppSwitcher } from './components/AppSwitcher.js';
export { UserMenu } from './components/UserMenu.js';
export { NotificationBell } from './components/NotificationBell.js';
