import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function fileExists(p: string): boolean {
  return fs.existsSync(p);
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function canonicalPath(value: string): string {
  const normalized = normalizePath(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isWithinBase(candidate: string, base: string): boolean {
  const candidateCanonical = canonicalPath(candidate);
  const baseCanonical = canonicalPath(base);
  return candidateCanonical === baseCanonical || candidateCanonical.startsWith(`${baseCanonical}/`);
}

function safeJoinUnder(base: string, ...parts: string[]): string | null {
  if (parts.some((part) => part.includes("\0") || /(^|[\\/])\.\.([\\/]|$)/.test(part))) return null;
  const candidate = normalizePath([base, ...parts].join("/"));
  return isWithinBase(candidate, base) ? candidate : null;
}

function readUtf8(filePath: string): string {
  return execFileSync(
    process.execPath,
    ["-e", 'const fs=require("node:fs");process.stdout.write(fs.readFileSync(process.argv[1],"utf8"));', filePath],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(readUtf8(filePath));
  } catch {
    return null;
  }
}

function countTestFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = safeJoinUnder(dir, entry.name);
      if (!full) continue;
      if (
        entry.isDirectory() &&
        entry.name !== "node_modules" &&
        entry.name !== ".next"
      ) {
        walk(full);
      } else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
        count++;
      }
    }
  };
  walk(dirPath);
  return count;
}

export async function GET(request: Request) {
  try {
    await requireApiAuth(request);

    const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
    const packagesDir = safeJoinUnder(root, "packages") ?? "";

  // ── Load registries ───────────────────────────

  const appsRegistry = readJsonSafe<{
    apps: Array<{
      name: string;
      path: string;
      tier: string;
      owner: string;
      domain: string;
    }>;
  }>(safeJoinUnder(root, "platform", "registry", "apps.json") ?? "");

  const platformRegistry = readJsonSafe<{
    platform_services: Array<{ name: string; lifecycle: string }>;
    shared_packages: Array<{ name: string; category: string; stability: string }>;
  }>(safeJoinUnder(root, "platform", "registry", "platform-registry.json") ?? "");

  // ── Package stats ─────────────────────────────

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
          d.isDirectory() &&
          (() => {
            const pkgPath = safeJoinUnder(packagesDir, d.name, "package.json");
            return pkgPath ? fs.existsSync(pkgPath) : false;
          })()
      );

    totalPackages = dirs.length;

    for (const dir of dirs) {
      const metaPath = safeJoinUnder(packagesDir, dir.name, "package.meta.json");
      if (!metaPath) continue;
      if (fs.existsSync(metaPath)) {
        withMeta++;
        const meta = JSON.parse(readUtf8(metaPath));
        const cat = meta.category || "UNKNOWN";
        categories[cat] = (categories[cat] || 0) + 1;
        const stab = meta.stability || "UNKNOWN";
        stability[stab] = (stability[stab] || 0) + 1;
        if (meta.deprecated) deprecated++;
      }
    }
  }

  // ── App lifecycle tiers ───────────────────────

  const registeredApps = appsRegistry?.apps ?? [];
  const tierCounts: Record<string, number> = {};
  for (const app of registeredApps) {
    tierCounts[app.tier] = (tierCounts[app.tier] || 0) + 1;
  }

  // Detect filesystem apps not in registry
  const appsDir = safeJoinUnder(root, "apps") ?? "";
  const fsAppNames = fs.existsSync(appsDir)
    ? fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter(
          (d) =>
            d.isDirectory() &&
            (() => {
              const pkgPath = safeJoinUnder(appsDir, d.name, "package.json");
              return pkgPath ? fs.existsSync(pkgPath) : false;
            })()
        )
        .map((d) => d.name)
    : [];

  const registeredNames = new Set(registeredApps.map((a) => a.name));
  const unregisteredApps = fsAppNames.filter((n) => !registeredNames.has(n));

  // ── App compliance (gold standard checks) ────

  const apps = registeredApps.map((regApp) => {
    const appDir = safeJoinUnder(/* turbopackIgnore: true */ root, "apps", regApp.name);
    if (!appDir) {
      return {
        app: regApp.name,
        tier: regApp.tier,
        owner: regApp.owner,
        domain: regApp.domain,
        checks: 0,
        passed: 0,
        level: "MISSING" as const,
      };
    }
    if (!fs.existsSync(appDir)) {
      return {
        app: regApp.name,
        tier: regApp.tier,
        owner: regApp.owner,
        domain: regApp.domain,
        checks: 0,
        passed: 0,
        level: "MISSING" as const,
      };
    }

    let checks = 0;
    let passed = 0;

    const assert = (ok: boolean) => {
      checks++;
      if (ok) passed++;
    };

    assert(
      (() => {
        const filePath = safeJoinUnder(appDir, "app", "api", "health", "route.ts");
        return filePath ? fileExists(filePath) : false;
      })()
    );
    assert(
      (() => {
        const metricsPath = safeJoinUnder(appDir, "app", "api", "metrics", "route.ts");
        const analyticsPath = safeJoinUnder(appDir, "app", "api", "analytics", "route.ts");
        return (metricsPath ? fileExists(metricsPath) : false) || (analyticsPath ? fileExists(analyticsPath) : false);
      })()
    );
    assert(
      (() => {
        const evidenceApiPath = safeJoinUnder(appDir, "app", "api", "evidence", "export", "route.ts");
        const evidenceLibPath = safeJoinUnder(appDir, "lib", "evidence.ts");
        return (evidenceApiPath ? fileExists(evidenceApiPath) : false) || (evidenceLibPath ? fileExists(evidenceLibPath) : false);
      })()
    );
    assert(
      (() => {
        const policyEnforcementPath = safeJoinUnder(appDir, "lib", "policy-enforcement.ts");
        const policyCamelPath = safeJoinUnder(appDir, "lib", "policyEnforcement.ts");
        const policyEnginePath = safeJoinUnder(appDir, "lib", "services", "policy-engine.ts");
        return (policyEnforcementPath ? fileExists(policyEnforcementPath) : false)
          || (policyCamelPath ? fileExists(policyCamelPath) : false)
          || (policyEnginePath ? fileExists(policyEnginePath) : false);
      })()
    );
    assert((() => {
      const domainModelPath = safeJoinUnder(appDir, "docs", "DOMAIN_MODEL.md");
      return domainModelPath ? fileExists(domainModelPath) : false;
    })());
    assert(countTestFiles(appDir) >= 3);

    const pct = checks > 0 ? Math.round((passed / checks) * 100) : 0;
    const level =
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

  // ── Platform services summary ─────────────────

  const services = platformRegistry?.platform_services ?? [];
  const serviceLifecycles: Record<string, number> = {};
  for (const s of services) {
    serviceLifecycles[s.lifecycle] = (serviceLifecycles[s.lifecycle] || 0) + 1;
  }

  // ── Contract tests ────────────────────────────

  const contractDir = safeJoinUnder(root, "tooling", "contract-tests") ?? "";
  let contractCount = 0;
  if (fs.existsSync(contractDir)) {
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== "node_modules") {
          const nestedPath = safeJoinUnder(dir, entry.name);
          if (nestedPath) walk(nestedPath);
        } else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
          contractCount++;
        }
      }
    };
    walk(contractDir);
  }

  // ── Summary ───────────────────────────────────

  const fullApps = apps.filter((a) => a.level === "FULL").length;
  const partialApps = apps.filter((a) => a.level === "PARTIAL").length;

  return NextResponse.json({
    packages: {
      total: totalPackages,
      withMeta,
      deprecated,
      categories,
      stability,
      metaCoverage:
        totalPackages > 0
          ? Math.round((withMeta / totalPackages) * 100)
          : 0,
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
        totalPackages > 0
          ? Math.round((withMeta / totalPackages) * 100)
          : 0,
      appComplianceRate:
        apps.length > 0 ? Math.round((fullApps / apps.length) * 100) : 0,
      deprecatedPackages: deprecated,
      registryCompleteness:
        fsAppNames.length > 0
          ? Math.round(
              ((fsAppNames.length - unregisteredApps.length) /
                fsAppNames.length) *
                100
            )
          : 0,
    },
  });
  } catch (error) {
    return handleAuthError(error);
  }
}
