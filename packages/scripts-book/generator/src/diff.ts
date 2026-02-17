/**
 * diff.ts — Preview changes without writing files to disk.
 */

import path from "node:path";
import fs from "fs-extra";
import crypto from "node:crypto";
import pc from "picocolors";
import { type PlaceholderValues, replacePlaceholders } from "./placeholders.js";
import {
  resolveFiles,
  listChapterFiles,
} from "./moduleResolver.js";

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

export interface DiffEntry {
  relativePath: string;
  status: "new" | "changed" | "unchanged";
}

export interface DiffOptions {
  templateRoot: string;
  targetDir: string;
  placeholders: PlaceholderValues;
  modules: string[];
  profile: string;
  options: {
    enable_ci: boolean;
    enable_deploy_workflows: boolean;
  };
}

export async function computeDiff(opts: DiffOptions): Promise<DiffEntry[]> {
  const { templateRoot, targetDir, placeholders, modules, profile, options } =
    opts;
  const entries: DiffEntry[] = [];

  const resolved = await resolveFiles(templateRoot, modules, profile, options);

  async function checkFile(srcPath: string, destRelative: string): Promise<void> {
    let content = await fs.readFile(srcPath, "utf-8");
    content = replacePlaceholders(content, placeholders);
    const newHash = sha256(content);

    const destPath = path.join(targetDir, destRelative);
    if (!(await fs.pathExists(destPath))) {
      entries.push({ relativePath: destRelative, status: "new" });
      return;
    }

    const existing = await fs.readFile(destPath, "utf-8");
    const existingHash = sha256(existing);
    entries.push({
      relativePath: destRelative,
      status: newHash === existingHash ? "unchanged" : "changed",
    });
  }

  // scripts-book chapters
  for (const chapter of resolved.chapters) {
    const files = await listChapterFiles(templateRoot, chapter);
    for (const relFile of files) {
      const srcPath = path.join(
        templateRoot,
        "template",
        "scripts-book",
        relFile,
      );
      await checkFile(srcPath, path.join("scripts-book", relFile));
    }
  }

  // docs
  for (const doc of resolved.docs) {
    const srcPath = path.join(templateRoot, "template", "docs", doc);
    if (await fs.pathExists(srcPath)) {
      await checkFile(srcPath, path.join("docs", doc));
    }
  }

  // workflows
  if (resolved.includeWorkflows) {
    const workflowDir = path.join(
      templateRoot,
      "template",
      "github",
      "workflows",
    );
    if (options.enable_ci) {
      const src = path.join(workflowDir, "verify.yml");
      if (await fs.pathExists(src)) {
        await checkFile(
          src,
          path.join(".github", "workflows", "verify.yml"),
        );
      }
    }
    if (options.enable_deploy_workflows) {
      for (const wf of ["deploy-staging.yml", "deploy-production.yml"]) {
        const src = path.join(workflowDir, wf);
        if (await fs.pathExists(src)) {
          await checkFile(src, path.join(".github", "workflows", wf));
        }
      }
    }
  }

  // Dockerfile
  if (resolved.dockerTemplate) {
    const src = path.join(
      templateRoot,
      "template",
      "docker",
      resolved.dockerTemplate,
    );
    if (await fs.pathExists(src)) {
      await checkFile(src, resolved.dockerTemplate);
    }
  }

  return entries;
}

/** Print a diff summary. */
export function printDiff(entries: DiffEntry[]): void {
  const newFiles = entries.filter((e) => e.status === "new");
  const changed = entries.filter((e) => e.status === "changed");
  const unchanged = entries.filter((e) => e.status === "unchanged");

  if (newFiles.length > 0) {
    console.log(pc.green(`\n  New files (${newFiles.length}):`));
    for (const e of newFiles) console.log(pc.green(`    + ${e.relativePath}`));
  }

  if (changed.length > 0) {
    console.log(pc.yellow(`\n  Changed files (${changed.length}):`));
    for (const e of changed) console.log(pc.yellow(`    ~ ${e.relativePath}`));
  }

  if (unchanged.length > 0) {
    console.log(pc.dim(`\n  Unchanged files (${unchanged.length}):`));
    for (const e of unchanged) console.log(pc.dim(`    = ${e.relativePath}`));
  }

  console.log(
    `\n  Summary: ${newFiles.length} new, ${changed.length} changed, ${unchanged.length} unchanged`,
  );
}
