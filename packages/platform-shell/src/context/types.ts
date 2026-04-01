/**
 * @nzila/platform-shell — Shell Context Types
 *
 * Types for the shell-level React context that all apps
 * consume to access org scope, user identity, and module registry.
 */
import type { ModuleManifest } from '@nzila/platform-contracts/module-registry';
import type { PlatformRole } from '@nzila/platform-contracts/role';

export interface ShellUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  roles: PlatformRole[];
}

export interface ShellOrg {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  role: string;
}

export interface ShellContextValue {
  /** Current authenticated user. Null if not signed in. */
  user: ShellUser | null;
  /** Current active org scope. Null if no org selected. */
  org: ShellOrg | null;
  /** All orgs the user belongs to. */
  availableOrgs: ShellOrg[];
  /** Resolved modules for the current user/org context. */
  modules: ModuleManifest[];
  /** Currently active module id. */
  activeModuleId: string | null;
  /** Switch to a different org. */
  switchOrg: (orgId: string) => void;
  /** Navigate to a module. */
  navigateToModule: (moduleId: string) => void;
  /** Whether the shell is still loading initial data. */
  loading: boolean;
}
