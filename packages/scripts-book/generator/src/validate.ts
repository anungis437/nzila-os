/**
 * validate.ts — Manifest validation, module existence checks, and parity validation.
 */

import { z } from "zod";
import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
import pc from "picocolors";

export const ManifestSchema = z.object({
  template_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  product_name: z.string().min(1),
  repo_name: z.string().min(1),
  owner_github: z.string().min(1),
  primary_app_path: z.string().min(1),
  app_port: z.number().int().min(1).max(65535),
  tenant_key: z.string().min(1),
  image_repo: z.string().min(1),
  auth_provider: z.enum(["clerk", "none"]),
  db_provider: z.enum(["azure_postgresql"]),
  deploy_provider: z.enum(["azure_container_apps"]),
  environments: z.object({
    staging_url: z.string().url(),
    production_url: z.string().url(),
  }),
  profile: z.enum([
    "nextjs-aca-azurepg-clerk",
    "nodeapi-aca-azurepg-clerk",
    "django-aca-azurepg",
  ]),
  modules: z
    .array(
      z.enum([
        "core-governance",
        "repo-bootstrap",
        "monorepo-pnpm-turbo",
        "auth-clerk",
        "db-azurepg",
        "deploy-aca-oidc",
        "security-baseline",
        "observability-audit",
        "exports-compliance",
        "ai-ops",
      ]),
    )
    .min(1),
  options: z.object({
    enable_ci: z.boolean(),
    enable_deploy_workflows: z.boolean(),
    enable_ai_ops: z.boolean(),
    strict_parity: z.boolean(),
  }),
});

export type ManifestType = z.infer<typeof ManifestSchema>;

/** Resolve the template kit root (two levels above generator/src). */
export function getTemplateRoot(): string {
  // When compiled: generator/dist/validate.js → go up to nzila-scripts-book-template
  return path.resolve(import.meta.dirname, "..", "..");
}

/** Validate a manifest JSON object. Returns parsed manifest or throws. */
export function validateManifest(raw: unknown): ManifestType {
  return ManifestSchema.parse(raw);
}

/** Validate manifest from a file path. */
export async function validateManifestFile(
  filePath: string,
): Promise<ManifestType> {
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`Manifest not found: ${filePath}`);
  }
  const raw = await fs.readJson(filePath);
  return validateManifest(raw);
}

/** Validate that all referenced modules exist in the modules/ directory. */
export async function validateModules(
  modules: string[],
  templateRoot: string,
): Promise<string[]> {
  const errors: string[] = [];
  for (const mod of modules) {
    const modDir = path.join(templateRoot, "modules", mod);
    if (!(await fs.pathExists(modDir))) {
      errors.push(`Module not found: ${mod} (expected at ${modDir})`);
    } else {
      const modJson = path.join(modDir, "module.json");
      if (!(await fs.pathExists(modJson))) {
        errors.push(`Module missing module.json: ${mod}`);
      }
    }
  }
  return errors;
}

/** Check .sh / .ps1 / .py triplet parity in a directory. */
export async function validateParity(
  dir: string,
): Promise<{ missing: string[]; ok: boolean }> {
  const missing: string[] = [];

  const shFiles = await fg("**/*.sh", { cwd: dir, onlyFiles: true });
  const ps1Files = await fg("**/*.ps1", { cwd: dir, onlyFiles: true });
  const pyFiles = await fg("**/*.py", { cwd: dir, onlyFiles: true });

  // Collect all basenames (without extension) and their extensions
  const scriptMap = new Map<string, Set<string>>();

  for (const f of shFiles) {
    const base = f.replace(/\.sh$/, "");
    if (!scriptMap.has(base)) scriptMap.set(base, new Set());
    scriptMap.get(base)!.add(".sh");
  }
  for (const f of ps1Files) {
    const base = f.replace(/\.ps1$/, "");
    if (!scriptMap.has(base)) scriptMap.set(base, new Set());
    scriptMap.get(base)!.add(".ps1");
  }
  for (const f of pyFiles) {
    const base = f.replace(/\.py$/, "");
    if (!scriptMap.has(base)) scriptMap.set(base, new Set());
    scriptMap.get(base)!.add(".py");
  }

  const requiredExts = [".sh", ".ps1", ".py"];
  for (const [base, exts] of scriptMap) {
    for (const ext of requiredExts) {
      if (!exts.has(ext)) {
        missing.push(`${base}${ext}`);
      }
    }
  }

  return { missing, ok: missing.length === 0 };
}

/** Run full validation suite and print results. Returns true if all pass. */
export async function runValidation(
  manifestPath?: string,
): Promise<boolean> {
  const templateRoot = getTemplateRoot();
  let allOk = true;

  // 1. Validate manifest (if provided)
  if (manifestPath) {
    try {
      await validateManifestFile(manifestPath);
      console.log(pc.green("✓ Manifest is valid"));
    } catch (err) {
      console.error(pc.red("✗ Manifest validation failed:"));
      console.error(
        err instanceof Error ? err.message : String(err),
      );
      allOk = false;
    }
  }

  // 2. Validate modules exist
  const moduleDirs = await fg("*/module.json", {
    cwd: path.join(templateRoot, "modules"),
    onlyFiles: true,
  });
  const moduleNames = moduleDirs.map((f) => path.dirname(f));
  console.log(
    pc.green(`✓ Found ${moduleNames.length} modules: ${moduleNames.join(", ")}`),
  );

  // 3. Validate parity in template scripts-book
  const scriptsBookDir = path.join(templateRoot, "template", "scripts-book");
  const parity = await validateParity(scriptsBookDir);
  if (parity.ok) {
    console.log(pc.green("✓ Script parity OK (.sh / .ps1 / .py)"));
  } else {
    console.error(pc.red("✗ Script parity failures:"));
    for (const m of parity.missing) {
      console.error(pc.red(`  Missing: ${m}`));
    }
    allOk = false;
  }

  return allOk;
}
