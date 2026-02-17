#!/usr/bin/env node
/**
 * index.ts — CLI entry point for the Nzila Scripts Book Generator.
 */

import { Command } from "commander";
import path from "node:path";
import pc from "picocolors";
import { runValidation } from "./validate.js";
import { apply, doctor } from "./apply.js";
import { computeDiff, printDiff } from "./diff.js";
import { validateManifestFile } from "./validate.js";
import { buildPlaceholders } from "./placeholders.js";

const program = new Command();

program
  .name("scripts-book")
  .description("Nzila Scripts Book Template Generator CLI")
  .version("1.0.0");

program
  .command("validate")
  .description("Validate template integrity, parity, and markdown")
  .option("--manifest <path>", "Path to a manifest file to validate")
  .action(async (opts: { manifest?: string }) => {
    const ok = await runValidation(opts.manifest);
    process.exit(ok ? 0 : 1);
  });

program
  .command("apply")
  .description("Generate scripts-book into a target repository")
  .requiredOption("--target <path>", "Path to the target repository")
  .option("--update", "Only update files that match previous generated hashes", false)
  .action(async (opts: { target: string; update: boolean }) => {
    const targetDir = path.resolve(opts.target);
    console.log(pc.bold(`\nApplying template to: ${targetDir}`));
    const ok = await apply({ targetDir, updateMode: opts.update });
    process.exit(ok ? 0 : 1);
  });

program
  .command("diff")
  .description("Preview changes without writing files")
  .requiredOption("--target <path>", "Path to the target repository")
  .action(async (opts: { target: string }) => {
    const targetDir = path.resolve(opts.target);
    const templateRoot = path.resolve(import.meta.dirname, "..", "..");

    const manifestPath = path.join(targetDir, "scripts-book.manifest.json");
    const manifest = await validateManifestFile(manifestPath);
    const placeholders = buildPlaceholders(manifest);

    console.log(pc.bold(`\nDiff preview for: ${targetDir}`));
    const entries = await computeDiff({
      templateRoot,
      targetDir,
      placeholders,
      modules: manifest.modules,
      profile: manifest.profile,
      options: {
        enable_ci: manifest.options.enable_ci,
        enable_deploy_workflows: manifest.options.enable_deploy_workflows,
      },
    });

    printDiff(entries);
  });

program
  .command("doctor")
  .description("Check target repo for required files and scripts")
  .requiredOption("--target <path>", "Path to the target repository")
  .action(async (opts: { target: string }) => {
    const targetDir = path.resolve(opts.target);
    console.log(pc.bold(`\nDoctor check for: ${targetDir}`));
    const ok = await doctor(targetDir);
    process.exit(ok ? 0 : 1);
  });

program.parse();
