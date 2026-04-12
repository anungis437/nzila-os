'use client';

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import type { ModuleManifest } from '@nzila/platform-contracts/module-registry';
import type {
  ShellContextValue,
  ShellUser,
  ShellOrg,
} from './types';
import { ModuleRegistry, type ModuleResolveContext } from '../registry/registry';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error('useShell must be used within a <ShellProvider>.');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider props
// ---------------------------------------------------------------------------

export interface ShellProviderProps {
  children: ReactNode;
  /** Pre-resolved user (typically from auth session). */
  user: ShellUser | null;
  /** All orgs the user belongs to. */
  availableOrgs: ShellOrg[];
  /** Initially selected org id. */
  initialOrgId?: string;
  /** The module registry instance. */
  registry: ModuleRegistry;
  /** User's platform-level entitlements. */
  entitlements?: string[];
  /** Modules explicitly enabled for the current org. */
  enabledModuleIds?: string[];
  /** Callback when org changes. */
  onOrgChange?: (orgId: string) => void;
  /** Callback when module is selected. */
  onModuleNavigate?: (moduleId: string) => void;
  /** Current active module id (from router). */
  activeModuleId?: string;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ShellProvider({
  children,
  user,
  availableOrgs,
  initialOrgId,
  registry,
  entitlements = [],
  enabledModuleIds,
  onOrgChange,
  onModuleNavigate,
  activeModuleId: controlledActiveModuleId,
}: ShellProviderProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    initialOrgId ?? availableOrgs[0]?.id ?? null,
  );
  const [localActiveModule, setLocalActiveModule] = useState<string | null>(
    controlledActiveModuleId ?? null,
  );

  const activeModuleId = controlledActiveModuleId ?? localActiveModule;
  const currentOrg = availableOrgs.find((o) => o.id === selectedOrgId) ?? null;

  const modules: ModuleManifest[] = useMemo(() => {
    if (!user || !currentOrg) return [];
    const resolveCtx: ModuleResolveContext = {
      userId: user.id,
      orgId: currentOrg.id,
      roles: user.roles,
      entitlements,
      enabledModuleIds,
    };
    return registry.resolveNav(resolveCtx);
  }, [user, currentOrg, entitlements, enabledModuleIds, registry]);

  const switchOrg = useCallback(
    (orgId: string) => {
      setSelectedOrgId(orgId);
      onOrgChange?.(orgId);
    },
    [onOrgChange],
  );

  const navigateToModule = useCallback(
    (moduleId: string) => {
      setLocalActiveModule(moduleId);
      onModuleNavigate?.(moduleId);
    },
    [onModuleNavigate],
  );

  const value: ShellContextValue = useMemo(
    () => ({
      user,
      org: currentOrg,
      availableOrgs,
      modules,
      activeModuleId,
      switchOrg,
      navigateToModule,
      loading: false,
    }),
    [user, currentOrg, availableOrgs, modules, activeModuleId, switchOrg, navigateToModule],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
