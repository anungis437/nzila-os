// @nzila/platform-shell — Barrel export

// Registry
export { ModuleRegistry } from './registry/registry';
export type {
  ModuleRegistryConfig,
  ModuleResolveContext,
} from './registry/registry';
export { DEFAULT_MODULES } from './registry/default-modules';

// Context
export type {
  ShellContextValue,
  ShellUser,
  ShellOrg,
} from './context/types';
export { ShellProvider, useShell } from './context/provider';
export type { ShellProviderProps } from './context/provider';

// Components
export { NzilaAppShell } from './components/NzilaAppShell';
export type { NzilaAppShellProps } from './components/NzilaAppShell';
export { ShellLayout } from './components/ShellLayout';
export { GlobalNav } from './components/GlobalNav';
export { OrgSelector } from './components/OrgSelector';
export { AppSwitcher } from './components/AppSwitcher';
export { UserMenu } from './components/UserMenu';
export { NotificationBell } from './components/NotificationBell';
