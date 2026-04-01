/**
 * @nzila/platform-shell — Module Registry
 *
 * Runtime registry that holds registered modules and resolves
 * manifests based on user context (roles, entitlements, org scope).
 */
import type {
  ModuleRegistration,
  ModuleManifest,
  ModuleTier,
} from '@nzila/platform-contracts/module-registry';
import type { PlatformRole } from '@nzila/platform-contracts/role';

// ---------------------------------------------------------------------------
// Registry config
// ---------------------------------------------------------------------------

export interface ModuleRegistryConfig {
  /** Custom access checker — overrides default role-based check. */
  checkAccess?: (
    module: ModuleRegistration,
    context: ModuleResolveContext,
  ) => boolean;
  /** Custom entitlement checker. */
  checkEntitlement?: (
    module: ModuleRegistration,
    context: ModuleResolveContext,
  ) => boolean;
  /** Feature flag resolver. */
  isFeatureEnabled?: (flagKey: string) => boolean;
}

export interface ModuleResolveContext {
  userId: string;
  orgId: string;
  roles: PlatformRole[];
  entitlements: string[];
  /** Modules explicitly enabled for this org. */
  enabledModuleIds?: string[];
}

// ---------------------------------------------------------------------------
// Registry implementation
// ---------------------------------------------------------------------------

export class ModuleRegistry {
  private readonly modules = new Map<string, ModuleRegistration>();
  private readonly config: ModuleRegistryConfig;

  constructor(config: ModuleRegistryConfig = {}) {
    this.config = config;
  }

  /** Register a module. Throws if duplicate id. */
  register(module: ModuleRegistration): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module "${module.id}" is already registered.`);
    }
    this.modules.set(module.id, module);
  }

  /** Register multiple modules at once. */
  registerAll(modules: ModuleRegistration[]): void {
    for (const m of modules) this.register(m);
  }

  /** Get a module by id. */
  get(id: string): ModuleRegistration | undefined {
    return this.modules.get(id);
  }

  /** List all registered modules. */
  list(): ModuleRegistration[] {
    return Array.from(this.modules.values());
  }

  /** List modules visible in navigation, sorted by navOrder. */
  listNavModules(): ModuleRegistration[] {
    return this.list()
      .filter((m) => m.showInNav && m.tier !== 'DEPRECATED')
      .sort((a, b) => a.navOrder - b.navOrder);
  }

  /**
   * Resolve all modules into manifests for a specific user/org context.
   * Applies role checks, entitlement checks, feature flags, and org enablement.
   */
  resolve(context: ModuleResolveContext): ModuleManifest[] {
    return this.list().map((m) => this.resolveOne(m, context));
  }

  /** Resolve nav-visible manifests only. */
  resolveNav(context: ModuleResolveContext): ModuleManifest[] {
    return this.resolve(context)
      .filter((m) => m.showInNav && m.tier !== 'DEPRECATED')
      .sort((a, b) => a.navOrder - b.navOrder);
  }

  // ─────────────────────────────────────────────────────────────────────────

  private resolveOne(
    module: ModuleRegistration,
    context: ModuleResolveContext,
  ): ModuleManifest {
    const enabledForOrg = this.isEnabledForOrg(module, context);
    const accessible = enabledForOrg && this.isAccessible(module, context);

    return {
      ...module,
      accessible,
      enabledForOrg,
      resolvedUrl: module.basePath.startsWith('http')
        ? module.basePath
        : undefined,
    };
  }

  private isEnabledForOrg(
    module: ModuleRegistration,
    context: ModuleResolveContext,
  ): boolean {
    // Feature flag check
    if (module.featureFlag && this.config.isFeatureEnabled) {
      if (!this.config.isFeatureEnabled(module.featureFlag)) return false;
    }

    // If org has an explicit enable list, module must be in it (or enabled by default)
    if (context.enabledModuleIds) {
      return (
        module.enabledByDefault ||
        context.enabledModuleIds.includes(module.id)
      );
    }

    return true;
  }

  private isAccessible(
    module: ModuleRegistration,
    context: ModuleResolveContext,
  ): boolean {
    // Custom access checker
    if (this.config.checkAccess) {
      return this.config.checkAccess(module, context);
    }

    // Role check: if module requires specific roles, user must have at least one
    if (module.requiredRoles.length > 0) {
      const hasRole = module.requiredRoles.some((r) =>
        context.roles.includes(r as PlatformRole),
      );
      if (!hasRole) return false;
    }

    // Entitlement check
    if (this.config.checkEntitlement) {
      return this.config.checkEntitlement(module, context);
    }

    if (module.requiredEntitlements.length > 0) {
      const hasAll = module.requiredEntitlements.every((e) =>
        context.entitlements.includes(e),
      );
      if (!hasAll) return false;
    }

    return true;
  }
}
