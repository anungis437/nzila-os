/**
 * Architecture summary — derives a real snapshot from the monorepo on disk.
 *
 * Sources:
 *   - packages/<name>/package.meta.json    → category, stability, deprecated
 *   - apps/<name>/package.json              → app inventory
 *   - platform/registry/apps.json           → registered apps (tier/owner/domain)
 *   - platform/registry/platform-registry.json → platform service lifecycles
 *   - tooling/contract-tests/**             → contract test count
 *
 * Returns `null` when the monorepo source tree is not reachable from cwd
 * (e.g. minimal production container without the workspace mounted). Callers
 * MUST handle that by rendering an honest empty / unavailable state — never
 * by fabricating fallback numbers.
 */
import "server-only";

import * as fs from "node:fs";
import * as path from "node:path";

export type AppItem = {
  app: string;
  tier: string;
  owner: string;
  domain: string;
  checks: number;
  passed: number;
  level: "FULL" | "PARTIAL" | "NON_COMPLIANT" | "MISSING";
};

export type ArchitectureSummary = {
  packages: {
    total: number;
    withMeta: number;
    deprecated: number;
    categories: Record<string, number>;
    stability: Record<string, number>;
    metaCoverage: number;
  };
  apps: {
    items: AppItem[];
    fullCompliance: number;
    partialCompliance: number;
    total: number;
    tiers: Record<string, number>;
    unregistered: string[];
  };
  platformServices: {
    total: number;
    lifecycles: Record<string, number>;
  };
  contracts: {
    testFiles: number;
  };
  overall: {
    metaCoverage: number;
    appComplianceRate: number;
    deprecatedPackages: number;
    registryCompleteness: number;
  };
  generatedAt: string;
};

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function findRepoRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function countTestFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") continue;
        walk(full);
      } else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
        count++;
      }
    }
  };
  walk(dirPath);
  return count;
}

/**
 * Build the architecture summary from the on-disk monorepo, or return null
 * when the workspace root cannot be located from process.cwd().
 */
export function buildArchitectureSummary(): ArchitectureSummary | null {
  const root = findRepoRoot();
  if (!root) return null;

  const packagesDir = path.join(root, "packages");
  const appsDir = path.join(root, "apps");

  // Registries (optional — when absent, fall back to filesystem discovery).
  const appsRegistry = readJsonSafe<{
    apps: Array<{
      name: string;
      path: string;
      tier: string;
      owner: string;
      domain: string;
    }>;
  }>(path.join(root, "platform", "registry", "apps.json"));

  const platformRegistry = readJsonSafe<{
    platform_services: Array<{ name: string; lifecycle: string }>;
    shared_packages: Array<{ name: string; category: string; stability: string }>;
  }>(path.join(root, "platform", "registry", "platform-registry.json"));

  // ── Packages ─────────────────────────────────────────
  let totalPackages = 0;
  let withMeta = 0;
  let deprecated = 0;
  const categories: Record<string, number> = {};
  const stability: Record<string, number> = {};

  if (fs.existsSync(packagesDir)) {
    const dirs = fs
      .readdirSync(packagesDir, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() && fileExists(path.join(packagesDir, d.name, "package.json")),
      );
    totalPackages = dirs.length;

    for (const dir of dirs) {
      const meta = readJsonSafe<{
        category?: string;
        stability?: string;
        deprecated?: boolean;
      }>(path.join(packagesDir, dir.name, "package.meta.json"));
      if (!meta) continue;
      withMeta++;
      const cat = meta.category ?? "UNKNOWN";
      categories[cat] = (categories[cat] ?? 0) + 1;
      const stab = meta.stability ?? "UNKNOWN";
      stability[stab] = (stability[stab] ?? 0) + 1;
      if (meta.deprecated) deprecated++;
    }
  }

  // ── Apps ─────────────────────────────────────────────
  const fsAppNames = fs.existsSync(appsDir)
    ? fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter(
          (d) =>
            d.isDirectory() && fileExists(path.join(appsDir, d.name, "package.json")),
        )
        .map((d) => d.name)
    : [];

  const registeredApps = appsRegistry?.apps ?? [];
  const registeredNames = new Set(registeredApps.map((a) => a.name));
  const unregisteredApps = fsAppNames.filter((n) => !registeredNames.has(n));

  const tierCounts: Record<string, number> = {};
  for (const a of registeredApps) tierCounts[a.tier] = (tierCounts[a.tier] ?? 0) + 1;

  const apps: AppItem[] = registeredApps.map((regApp) => {
    const appDir = path.join(appsDir, regApp.name);
    if (!fs.existsSync(appDir)) {
      return {
        app: regApp.name,
        tier: regApp.tier,
        owner: regApp.owner,
        domain: regApp.domain,
        checks: 0,
        passed: 0,
        level: "MISSING",
      };
    }

    let checks = 0;
    let passed = 0;
    const assert = (ok: boolean) => {
      checks++;
      if (ok) passed++;
    };

    assert(fileExists(path.join(appDir, "app", "api", "health", "route.ts")));
    assert(
      fileExists(path.join(appDir, "app", "api", "metrics", "route.ts")) ||
        fileExists(path.join(appDir, "app", "api", "analytics", "route.ts")),
    );
    assert(
      fileExists(path.join(appDir, "app", "api", "evidence", "export", "route.ts")) ||
        fileExists(path.join(appDir, "lib", "evidence.ts")),
    );
    assert(
      fileExists(path.join(appDir, "lib", "policy-enforcement.ts")) ||
        fileExists(path.join(appDir, "lib", "policyEnforcement.ts")) ||
        fileExists(path.join(appDir, "lib", "services", "policy-engine.ts")),
    );
    assert(fileExists(path.join(appDir, "docs", "DOMAIN_MODEL.md")));
    assert(countTestFiles(appDir) >= 3);

    const pct = checks > 0 ? Math.round((passed / checks) * 100) : 0;
    const level: AppItem["level"] =
      pct === 100 ? "FULL" : pct >= 50 ? "PARTIAL" : "NON_COMPLIANT";

    return {
      app: regApp.name,
      tier: regApp.tier,
      owner: regApp.owner,
      domain: regApp.domain,
      checks,
      passed,
      level,
    };
  });

  const fullApps = apps.filter((a) => a.level === "FULL").length;
  const partialApps = apps.filter((a) => a.level === "PARTIAL").length;

  // ── Platform services ────────────────────────────────
  const services = platformRegistry?.platform_services ?? [];
  const serviceLifecycles: Record<string, number> = {};
  for (const s of services) {
    serviceLifecycles[s.lifecycle] = (serviceLifecycles[s.lifecycle] ?? 0) + 1;
  }

  // ── Contract tests ───────────────────────────────────
  const contractCount = countTestFiles(path.join(root, "tooling", "contract-tests"));

  return {
    packages: {
      total: totalPackages,
      withMeta,
      deprecated,
      categories,
      stability,
      metaCoverage:
        totalPackages > 0 ? Math.round((withMeta / totalPackages) * 100) : 0,
    },
    apps: {
      items: apps,
      fullCompliance: fullApps,
      partialCompliance: partialApps,
      total: apps.length,
      tiers: tierCounts,
      unregistered: unregisteredApps,
    },
    platformServices: {
      total: services.length,
      lifecycles: serviceLifecycles,
    },
    contracts: {
      testFiles: contractCount,
    },
    overall: {
      metaCoverage:
        totalPackages > 0 ? Math.round((withMeta / totalPackages) * 100) : 0,
      appComplianceRate:
        apps.length > 0 ? Math.round((fullApps / apps.length) * 100) : 0,
      deprecatedPackages: deprecated,
      registryCompleteness:
        fsAppNames.length > 0
          ? Math.round(
              ((fsAppNames.length - unregisteredApps.length) / fsAppNames.length) * 100,
            )
          : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}
