/**
 * apply.ts — Orchestrates the full apply workflow:
 *            validate → resolve → render → parity → markdown check.
 */

import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
import pc from "picocolors";
import { validateManifestFile } from "./validate.js";
import { buildPlaceholders } from "./placeholders.js";
import { renderToTarget } from "./render.js";
import { enforceScriptParity } from "./parity.js";
import { checkMD032, printMarkdownWarnings, type MarkdownWarning } from "./markdown.js";

export interface ApplyOptions {
  targetDir: string;
  updateMode: boolean;
}

export async function apply(opts: ApplyOptions): Promise<boolean> {
  const { targetDir, updateMode } = opts;
  const templateRoot = path.resolve(import.meta.dirname, "..", "..");

  // 1. Locate and validate manifest
  const manifestPath = path.join(targetDir, "scripts-book.manifest.json");
  console.log(pc.bold("\n==> Validating manifest..."));
  const manifest = await validateManifestFile(manifestPath);
  console.log(pc.green("  ✓ Manifest is valid"));

  // 2. Build placeholders
  const placeholders = buildPlaceholders(manifest);

  // 3. Render files
  console.log(pc.bold("\n==> Rendering template files..."));
  const result = await renderToTarget({
    templateRoot,
    targetDir,
    placeholders,
    modules: manifest.modules,
    profile: manifest.profile,
    options: {
      enable_ci: manifest.options.enable_ci,
      enable_deploy_workflows: manifest.options.enable_deploy_workflows,
    },
    templateVersion: manifest.template_version,
    updateMode,
  });

  console.log(pc.green(`  ✓ Wrote ${result.written.length} files`));
  if (result.skipped.length > 0) {
    console.log(pc.yellow(`  ⚠ Skipped ${result.skipped.length} user-modified files`));
  }

  // 4. Enforce parity
  console.log(pc.bold("\n==> Checking script parity (.sh / .ps1 / .py)..."));
  const scriptsBookDir = path.join(targetDir, "scripts-book");
  const parity = await enforceScriptParity(
    scriptsBookDir,
    manifest.options.strict_parity,
    !manifest.options.strict_parity,
  );

  if (parity.ok) {
    console.log(pc.green("  ✓ Script parity OK"));
  } else if (manifest.options.strict_parity) {
    console.error(pc.red("  ✗ Strict parity FAILED:"));
    for (const m of parity.missing) {
      console.error(pc.red(`    Missing: ${m}`));
    }
    return false;
  } else {
    console.log(
      pc.yellow(`  ⚠ Generated ${parity.generated.length} stub(s) for parity`),
    );
  }

  // 5. Lightweight markdown check
  console.log(pc.bold("\n==> Checking markdown (MD032)..."));
  const mdFiles = await fg("**/*.md", { cwd: targetDir, onlyFiles: true, absolute: true });
  const allWarnings: MarkdownWarning[] = [];
  for (const mdFile of mdFiles) {
    const content = await fs.readFile(mdFile, "utf-8");
    const relative = path.relative(targetDir, mdFile);
    const warnings = checkMD032(content, relative);
    allWarnings.push(...warnings);
  }

  if (allWarnings.length === 0) {
    console.log(pc.green("  ✓ No MD032 warnings"));
  } else {
    console.log(pc.yellow(`  ⚠ ${allWarnings.length} MD032 warning(s):`));
    printMarkdownWarnings(allWarnings);
  }

  console.log(pc.bold(pc.green("\n==> Apply complete.\n")));
  return true;
}

/**
 * Doctor command: checks if target repo has required files.
 */
export async function doctor(targetDir: string): Promise<boolean> {
  console.log(pc.bold("\n==> Running doctor checks..."));
  let allOk = true;

  // Check manifest exists
  const manifestPath = path.join(targetDir, "scripts-book.manifest.json");
  if (await fs.pathExists(manifestPath)) {
    console.log(pc.green("  ✓ scripts-book.manifest.json found"));
  } else {
    console.error(pc.red("  ✗ scripts-book.manifest.json not found"));
    allOk = false;
  }

  // Check scripts-book exists
  const sbDir = path.join(targetDir, "scripts-book");
  if (await fs.pathExists(sbDir)) {
    console.log(pc.green("  ✓ scripts-book/ directory found"));
  } else {
    console.warn(pc.yellow("  ⚠ scripts-book/ directory not found (run sb:apply first)"));
  }

  // Check lockfile
  const lockPath = path.join(targetDir, "scripts-book.lock.json");
  if (await fs.pathExists(lockPath)) {
    console.log(pc.green("  ✓ scripts-book.lock.json found"));
  } else {
    console.warn(pc.yellow("  ⚠ scripts-book.lock.json not found (run sb:apply first)"));
  }

  // Check docs directory
  const docsDir = path.join(targetDir, "docs");
  if (await fs.pathExists(docsDir)) {
    const requiredDocs = ["deployment.md", "security.md", "governance.md"];
    for (const doc of requiredDocs) {
      const docPath = path.join(docsDir, doc);
      if (await fs.pathExists(docPath)) {
        console.log(pc.green(`  ✓ docs/${doc} found`));
      } else {
        console.warn(pc.yellow(`  ⚠ docs/${doc} not found`));
      }
    }
  }

  // Check parity if scripts-book exists
  if (await fs.pathExists(sbDir)) {
    const parity = await enforceScriptParity(sbDir, true, false);
    if (parity.ok) {
      console.log(pc.green("  ✓ Script parity OK"));
    } else {
      console.warn(pc.yellow(`  ⚠ ${parity.missing.length} parity issue(s)`));
      for (const m of parity.missing) {
        console.warn(pc.yellow(`    Missing: ${m}`));
      }
    }
  }

  console.log(pc.bold(allOk ? "\n==> Doctor: OK\n" : "\n==> Doctor: Issues found\n"));
  return allOk;
}
